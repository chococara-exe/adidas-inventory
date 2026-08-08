"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createReceiptWithStock } from "@/lib/receipts";

export type ReceiptFormState = { error?: string };

const lineSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(100000),
  unitPriceSen: z.number().int().min(0),
  namesetDetail: z.string().trim().max(80).optional(),
});

const receiptSchema = z.object({
  type: z.enum(["SALE", "SPOIL", "TRANSFER"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  staffName: z.string().trim().max(80),
  note: z.string().trim().max(500),
  lines: z.array(lineSchema).min(1, "Add at least one item line."),
});

export async function createReceipt(
  _prev: ReceiptFormState,
  formData: FormData
): Promise<ReceiptFormState> {
  const user = await requireUser();

  // Store users act on their own store; admins pick one.
  const storeId =
    user.role === "ADMIN" ? String(formData.get("storeId") ?? "") : user.storeId ?? "";
  if (!storeId) return { error: "Select a store." };

  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Invalid line data." };
  }

  const parsed = receiptSchema.safeParse({
    type: formData.get("type"),
    date: formData.get("date"),
    staffName: formData.get("staffName") ?? "",
    note: formData.get("note") ?? "",
    lines: linesRaw,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const toStoreId = String(formData.get("toStoreId") ?? "");
  if (data.type === "TRANSFER") {
    if (!toStoreId) return { error: "Select the store receiving the transfer." };
    if (toStoreId === storeId) return { error: "Cannot transfer to the same store." };
    const toStore = await prisma.store.findUnique({ where: { id: toStoreId } });
    if (!toStore) return { error: "Receiving store not found." };
  }

  const date = new Date(data.date + "T00:00:00");
  if (isNaN(date.getTime())) return { error: "Invalid date." };

  let receiptId = "";
  try {
    receiptId = await createReceiptWithStock({
      type: data.type,
      date,
      storeId,
      toStoreId: data.type === "TRANSFER" ? toStoreId : null,
      createdById: user.userId,
      staffName: data.staffName,
      note: data.note,
      lines: data.lines,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the receipt." };
  }

  revalidatePath("/receipts");
  revalidatePath("/");
  redirect(`/receipts/${receiptId}`);
}
