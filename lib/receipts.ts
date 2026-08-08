import { prisma } from "./db";
import type { ReceiptType } from "./constants";

export type ReceiptLineInput = {
  itemId: string;
  quantity: number;
  unitPriceSen: number;
  namesetDetail?: string | null;
};

export type CreateReceiptInput = {
  type: ReceiptType;
  date: Date;
  storeId: string;
  toStoreId?: string | null;
  createdById: string;
  staffName?: string | null;
  note?: string | null;
  lines: ReceiptLineInput[];
};

/**
 * Creates a receipt and applies its stock effect atomically:
 *  - SALE / SPOIL: deduct from storeId (fails if insufficient stock)
 *  - TRANSFER: deduct from storeId, add to toStoreId
 *  - STOCK_IN: add to storeId
 * Every change is also written to the StockMovement ledger.
 * Throws Error with a user-readable message on validation failure.
 */
export async function createReceiptWithStock(
  input: CreateReceiptInput
): Promise<string> {
  const isInbound = input.type === "STOCK_IN";
  if (input.type === "TRANSFER" && !input.toStoreId) {
    throw new Error("Transfer receipts need a receiving store.");
  }

  // Total quantity per item across lines (an item may appear on several
  // lines, e.g. namesets with different players).
  const totals = new Map<string, number>();
  for (const l of input.lines) {
    if (l.quantity < 1) throw new Error("Quantities must be at least 1.");
    totals.set(l.itemId, (totals.get(l.itemId) ?? 0) + l.quantity);
  }
  if (totals.size === 0) throw new Error("Add at least one item line.");

  const items = await prisma.item.findMany({
    where: { id: { in: [...totals.keys()] } },
  });
  const itemById = new Map(items.map((i) => [i.id, i]));
  for (const itemId of totals.keys()) {
    const item = itemById.get(itemId);
    if (!item) throw new Error("One of the items no longer exists.");
    if (!item.active) throw new Error(`${item.name} is inactive and cannot be used.`);
  }

  const totalSen =
    input.type === "SALE"
      ? input.lines.reduce((sum, l) => sum + l.quantity * l.unitPriceSen, 0)
      : 0;

  return prisma.$transaction(async (tx) => {
    for (const [itemId, qty] of totals) {
      if (isInbound) {
        await tx.stockLevel.upsert({
          where: { itemId_storeId: { itemId, storeId: input.storeId } },
          update: { quantity: { increment: qty } },
          create: { itemId, storeId: input.storeId, quantity: qty },
        });
      } else {
        const level = await tx.stockLevel.findUnique({
          where: { itemId_storeId: { itemId, storeId: input.storeId } },
        });
        const available = level?.quantity ?? 0;
        if (available < qty) {
          throw new Error(
            `Not enough stock of ${itemById.get(itemId)!.name}: ${available} available, ${qty} requested.`
          );
        }
        await tx.stockLevel.update({
          where: { itemId_storeId: { itemId, storeId: input.storeId } },
          data: { quantity: { decrement: qty } },
        });
        if (input.type === "TRANSFER") {
          await tx.stockLevel.upsert({
            where: { itemId_storeId: { itemId, storeId: input.toStoreId! } },
            update: { quantity: { increment: qty } },
            create: { itemId, storeId: input.toStoreId!, quantity: qty },
          });
        }
      }
    }

    const last = await tx.receipt.findFirst({
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const receipt = await tx.receipt.create({
      data: {
        number: (last?.number ?? 0) + 1,
        type: input.type,
        date: input.date,
        storeId: input.storeId,
        toStoreId: input.type === "TRANSFER" ? input.toStoreId : null,
        createdById: input.createdById,
        staffName: input.staffName || null,
        note: input.note || null,
        totalSen,
        lines: {
          create: input.lines.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            unitPriceSen: l.unitPriceSen,
            namesetDetail: l.namesetDetail || null,
          })),
        },
      },
    });

    const outReason = input.type === "TRANSFER" ? "TRANSFER_OUT" : input.type;
    for (const [itemId, qty] of totals) {
      await tx.stockMovement.create({
        data: {
          itemId,
          storeId: input.storeId,
          delta: isInbound ? qty : -qty,
          reason: isInbound ? "STOCK_IN" : outReason,
          receiptId: receipt.id,
          userId: input.createdById,
        },
      });
      if (input.type === "TRANSFER") {
        await tx.stockMovement.create({
          data: {
            itemId,
            storeId: input.toStoreId!,
            delta: qty,
            reason: "TRANSFER_IN",
            receiptId: receipt.id,
            userId: input.createdById,
          },
        });
      }
    }

    return receipt.id;
  });
}
