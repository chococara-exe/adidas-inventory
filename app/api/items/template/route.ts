import * as XLSX from "xlsx";
import { getSessionUser } from "@/lib/auth";

const TEMPLATE_HEADERS = [
  "Name",
  "Article Number",
  "Category",
  "Sub-category",
  "Price (RM)",
  "Is Nameset (Y/N)",
  "Low Stock Threshold",
  "Initial Stock",
] as const;

export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return new Response("Unauthorized", { status: 401 });
  }

  const wb = XLSX.utils.book_new();

  const items = XLSX.utils.aoa_to_sheet([
    [...TEMPLATE_HEADERS],
    ["Malaysia Home Jersey 24/25", "IP4148", "Jerseys", "Home", 299.0, "N", 5, 20],
    ["Nameset (Generic)", "NS-GEN", "Namesets", "", 59.0, "Y", 10, 50],
  ]);
  items["!cols"] = [
    { wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, items, "Items");

  const instructions = XLSX.utils.aoa_to_sheet([
    ["How to fill in the Items sheet"],
    [""],
    ["Required columns: Name, Article Number, Category, Price (RM)."],
    ["Article Number must be unique — rows whose article number already exists are skipped."],
    ["Category / Sub-category: created automatically if they don't exist yet."],
    ["Price (RM): a number, e.g. 299 or 129.90."],
    ["Is Nameset (Y/N): Y for nameset items (player name/number chosen at sale time)."],
    ["Low Stock Threshold: alert level; leave blank for the default of 5."],
    ["Initial Stock: optional; applied to the store you pick on the import screen."],
    [""],
    ["Delete the two example rows before importing your real items."],
  ]);
  instructions["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, instructions, "Instructions");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="item-import-template.xlsx"',
    },
  });
}
