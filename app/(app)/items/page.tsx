import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRM } from "@/lib/currency";
import { setItemActive } from "./actions";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactive?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { q = "", inactive } = await searchParams;
  const showInactive = isAdmin && inactive === "1";

  const items = await prisma.item.findMany({
    where: {
      ...(showInactive ? {} : { active: true }),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { articleNumber: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      category: true,
      subCategory: true,
      stockLevels: isAdmin
        ? true
        : { where: { storeId: user.storeId ?? "__none__" } },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Items</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isAdmin ? "All items with total stock across stores" : "Items and your store's stock"}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <a
              href="/api/items/template"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Download template
            </a>
            <Link
              href="/items/import"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Import spreadsheet
            </Link>
            <Link
              href="/items/new"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              Add item
            </Link>
          </div>
        )}
      </div>

      <form className="mt-5 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or article number…"
          className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
        />
        {showInactive && <input type="hidden" name="inactive" value="1" />}
        <button className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          Search
        </button>
        {isAdmin && (
          <Link
            href={showInactive ? "/items" : "/items?inactive=1"}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900"
          >
            {showInactive ? "Hide inactive" : "Show inactive"}
          </Link>
        )}
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Article #</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">{isAdmin ? "Total stock" : "Your stock"}</th>
              {isAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-zinc-500">
                  No items found{q ? ` for “${q}”` : ""}.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const stock = item.stockLevels.reduce((sum, s) => sum + s.quantity, 0);
              return (
                <tr key={item.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-lg border border-zinc-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400">
                          —
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-zinc-900">
                          {isAdmin ? (
                            <Link href={`/items/${item.id}`} className="hover:underline">
                              {item.name}
                            </Link>
                          ) : (
                            item.name
                          )}
                          {!item.active && (
                            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                              inactive
                            </span>
                          )}
                        </div>
                        {item.isNameset && (
                          <div className="text-xs text-amber-600">Nameset item</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                    {item.articleNumber}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {item.category.name}
                    {item.subCategory ? ` / ${item.subCategory.name}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-900">
                    {formatRM(item.priceSen)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      stock <= item.lowStockThreshold ? "text-red-600" : "text-zinc-900"
                    }`}
                  >
                    {stock}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <form
                        action={setItemActive.bind(null, item.id, !item.active)}
                        className="inline"
                      >
                        <button className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                          {item.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
