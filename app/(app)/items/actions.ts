"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseRM } from "@/lib/currency";

export type ItemFormState = { error?: string };

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function saveImage(file: File): Promise<string> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Image must be a JPG, PNG or WebP file.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be under 5 MB.");

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const filename = crypto.randomUUID() + ext;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${filename}`;
}

/** Find-or-create category and optional sub-category by name. */
async function resolveCategory(categoryName: string, subCategoryName: string) {
  const category = await prisma.category.upsert({
    where: { name: categoryName },
    update: {},
    create: { name: categoryName },
  });
  let subCategoryId: string | null = null;
  if (subCategoryName) {
    const sub = await prisma.subCategory.upsert({
      where: { categoryId_name: { categoryId: category.id, name: subCategoryName } },
      update: {},
      create: { categoryId: category.id, name: subCategoryName },
    });
    subCategoryId = sub.id;
  }
  return { categoryId: category.id, subCategoryId };
}

const itemSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  articleNumber: z.string().trim().min(1, "Article number is required."),
  categoryName: z.string().trim().min(1, "Category is required."),
  subCategoryName: z.string().trim(),
  isNameset: z.boolean(),
  lowStockThreshold: z.number().int().min(0),
});

export async function saveItem(
  _prev: ItemFormState,
  formData: FormData
): Promise<ItemFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const priceSen = parseRM(String(formData.get("priceRM") ?? ""));
  if (priceSen === null) return { error: "Enter a valid price, e.g. 129.90" };

  const parsed = itemSchema.safeParse({
    name: formData.get("name"),
    articleNumber: formData.get("articleNumber"),
    categoryName: formData.get("categoryName"),
    subCategoryName: formData.get("subCategoryName") ?? "",
    isNameset: formData.get("isNameset") === "on",
    lowStockThreshold: Number(formData.get("lowStockThreshold") ?? 5),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  // Article numbers must stay unique — they are the import/merge key.
  const clash = await prisma.item.findUnique({
    where: { articleNumber: data.articleNumber },
  });
  if (clash && clash.id !== id) {
    return { error: `Article number ${data.articleNumber} already exists (${clash.name}).` };
  }

  let imageUrl: string | undefined;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      imageUrl = await saveImage(image);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Image upload failed." };
    }
  }

  const { categoryId, subCategoryId } = await resolveCategory(
    data.categoryName,
    data.subCategoryName
  );

  const fields = {
    name: data.name,
    articleNumber: data.articleNumber,
    categoryId,
    subCategoryId,
    priceSen,
    isNameset: data.isNameset,
    lowStockThreshold: data.lowStockThreshold,
    ...(imageUrl ? { imageUrl } : {}),
  };

  if (id) {
    await prisma.item.update({ where: { id }, data: fields });
  } else {
    await prisma.item.create({ data: fields });
  }

  revalidatePath("/items");
  redirect("/items");
}

export type ImportReport = {
  created: number;
  stockUnits: number;
  skipped: { row: number; reason: string }[];
};
export type ImportState = { error?: string; report?: ImportReport };

type ImportRow = Record<string, unknown>;

function cell(row: ImportRow, key: string): string {
  // Header lookup tolerant of case/spacing differences
  const found = Object.keys(row).find(
    (k) => k.trim().toLowerCase() === key.toLowerCase()
  );
  return found !== undefined ? String(row[found] ?? "").trim() : "";
}

export async function importItems(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const admin = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a spreadsheet file (.xlsx or .csv) to import." };
  }
  const storeId = String(formData.get("storeId") ?? "");
  if (storeId) {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return { error: "Selected store not found." };
  }

  const XLSX = await import("xlsx");
  let rows: ImportRow[];
  try {
    const wb = XLSX.read(await file.arrayBuffer());
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "" });
  } catch {
    return { error: "Could not read that file. Use the downloadable template (.xlsx) or a .csv." };
  }
  if (rows.length === 0) return { error: "The spreadsheet has no data rows." };
  if (rows.length > 2000) return { error: "Too many rows — import at most 2000 items at a time." };

  const report: ImportReport = { created: 0, stockUnits: 0, skipped: [] };
  const seenArticles = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNo = i + 2; // 1-based + header row
    const row = rows[i];

    const name = cell(row, "Name");
    const articleNumber = cell(row, "Article Number");
    const categoryName = cell(row, "Category");
    const subCategoryName = cell(row, "Sub-category");
    const priceRaw = cell(row, "Price (RM)");
    const isNameset = /^y(es)?$/i.test(cell(row, "Is Nameset (Y/N)"));
    const thresholdRaw = cell(row, "Low Stock Threshold");
    const initialStockRaw = cell(row, "Initial Stock");

    if (!name && !articleNumber) continue; // fully blank row

    if (!name || !articleNumber || !categoryName || !priceRaw) {
      report.skipped.push({
        row: rowNo,
        reason: "Missing required value (Name, Article Number, Category and Price are required).",
      });
      continue;
    }

    const priceSen = parseRM(priceRaw);
    if (priceSen === null) {
      report.skipped.push({ row: rowNo, reason: `Invalid price “${priceRaw}”.` });
      continue;
    }

    const threshold = thresholdRaw === "" ? 5 : Number(thresholdRaw);
    if (!Number.isInteger(threshold) || threshold < 0) {
      report.skipped.push({ row: rowNo, reason: `Invalid low-stock threshold “${thresholdRaw}”.` });
      continue;
    }

    const initialStock = initialStockRaw === "" ? 0 : Number(initialStockRaw);
    if (!Number.isInteger(initialStock) || initialStock < 0) {
      report.skipped.push({ row: rowNo, reason: `Invalid initial stock “${initialStockRaw}”.` });
      continue;
    }

    if (seenArticles.has(articleNumber)) {
      report.skipped.push({ row: rowNo, reason: `Duplicate article number ${articleNumber} within the file.` });
      continue;
    }
    seenArticles.add(articleNumber);

    const existing = await prisma.item.findUnique({ where: { articleNumber } });
    if (existing) {
      report.skipped.push({ row: rowNo, reason: `Article number ${articleNumber} already exists (${existing.name}).` });
      continue;
    }

    const { categoryId, subCategoryId } = await resolveCategory(categoryName, subCategoryName);

    await prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          name,
          articleNumber,
          categoryId,
          subCategoryId,
          priceSen,
          isNameset,
          lowStockThreshold: threshold,
        },
      });
      if (storeId && initialStock > 0) {
        await tx.stockLevel.create({
          data: { itemId: item.id, storeId, quantity: initialStock },
        });
        await tx.stockMovement.create({
          data: {
            itemId: item.id,
            storeId,
            delta: initialStock,
            reason: "STOCK_IN",
            userId: admin.userId,
          },
        });
        report.stockUnits += initialStock;
      }
    });
    report.created++;
  }

  revalidatePath("/items");
  return { report };
}

export async function setItemActive(id: string, active: boolean) {
  await requireAdmin();
  await prisma.item.update({ where: { id }, data: { active } });
  revalidatePath("/items");
}
