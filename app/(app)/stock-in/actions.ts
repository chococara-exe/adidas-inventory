"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createReceiptWithStock } from "@/lib/receipts";

export type StockInState = { error?: string };

const stockInSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().min(1).max(100000),
      })
    )
    .min(1, "Add at least one item."),
  note: z.string().trim().max(500),
});

/**
 * Store users record incoming stock for their own store. Only increases are
 * possible here — every stock-in creates a STOCK_IN receipt plus ledger
 * movements, which is the required log.
 */
export async function createStockIn(
  _prev: StockInState,
  formData: FormData
): Promise<StockInState> {
  const user = await requireUser();
  if (user.role !== "STORE" || !user.storeId) {
    return { error: "Only store accounts can record stock in." };
  }

  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Invalid line data." };
  }
  const parsed = stockInSchema.safeParse({
    lines: linesRaw,
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  // Record the item's current price on the line for reference.
  const items = await prisma.item.findMany({
    where: { id: { in: data.lines.map((l) => l.itemId) } },
  });
  const priceById = new Map(items.map((i) => [i.id, i.priceSen]));

  let receiptId = "";
  try {
    receiptId = await createReceiptWithStock({
      type: "STOCK_IN",
      date: new Date(),
      storeId: user.storeId,
      createdById: user.userId,
      note: data.note,
      lines: data.lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitPriceSen: priceById.get(l.itemId) ?? 0,
      })),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not record stock in." };
  }

  revalidatePath("/");
  revalidatePath("/items");
  revalidatePath("/receipts");
  redirect(`/receipts/${receiptId}`);
}
