import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ItemForm } from "../item-form";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [item, categories] = await Promise.all([
    prisma.item.findUnique({
      where: { id },
      include: {
        category: true,
        subCategory: true,
        stockLevels: { include: { store: true }, orderBy: { store: { name: "asc" } } },
      },
    }),
    prisma.category.findMany({
      include: { subCategories: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!item) notFound();

  const totalStock = item.stockLevels.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{item.name}</h1>
      <p className="mt-1 font-mono text-sm text-zinc-500">{item.articleNumber}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">Edit details</h2>
          <ItemForm
            categories={categories}
            item={{
              id: item.id,
              name: item.name,
              articleNumber: item.articleNumber,
              categoryName: item.category.name,
              subCategoryName: item.subCategory?.name ?? "",
              priceRM: (item.priceSen / 100).toFixed(2),
              isNameset: item.isNameset,
              lowStockThreshold: item.lowStockThreshold,
              imageUrl: item.imageUrl,
            }}
          />
        </div>

        <div className="h-fit rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Stock by store</h2>
          <div className="mt-1 text-sm text-zinc-500">Total: {totalStock} units</div>
          {item.stockLevels.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No stock recorded anywhere yet.</p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <tbody>
                {item.stockLevels.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 text-zinc-700">{s.store.name}</td>
                    <td
                      className={`py-2 text-right font-semibold ${
                        s.quantity <= item.lowStockThreshold
                          ? "text-red-600"
                          : "text-zinc-900"
                      }`}
                    >
                      {s.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
