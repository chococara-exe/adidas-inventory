import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ImportForm } from "./import-form";

export default async function ImportItemsPage() {
  await requireAdmin();
  const stores = await prisma.store.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
        Import items from spreadsheet
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-500">
        Fill in the{" "}
        <a href="/api/items/template" className="font-medium text-zinc-900 underline">
          template spreadsheet
        </a>{" "}
        and upload it here. Rows with problems are skipped and reported — nothing is
        half-imported.
      </p>
      <div className="mt-6 max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
        <ImportForm stores={stores.map((s) => ({ id: s.id, name: s.name }))} />
      </div>
    </div>
  );
}
