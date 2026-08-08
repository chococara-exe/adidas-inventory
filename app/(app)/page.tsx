import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRM } from "@/lib/currency";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const storeFilter = isAdmin ? {} : { storeId: user.storeId ?? "__none__" };

  const [itemCount, stockAgg, todaySales, lowStock] = await Promise.all([
    prisma.item.count({ where: { active: true } }),
    prisma.stockLevel.aggregate({
      _sum: { quantity: true },
      where: isAdmin ? {} : { storeId: user.storeId ?? "__none__" },
    }),
    prisma.receipt.aggregate({
      _sum: { totalSen: true },
      _count: true,
      where: { type: "SALE", date: { gte: startOfToday() }, ...storeFilter },
    }),
    prisma.stockLevel.findMany({
      where: {
        ...(isAdmin ? {} : { storeId: user.storeId ?? "__none__" }),
        item: { active: true },
      },
      include: { item: true, store: true },
    }),
  ]);

  const lowStockRows = lowStock.filter(
    (s) => s.quantity <= s.item.lowStockThreshold
  );

  const cards = [
    { label: "Active items", value: String(itemCount) },
    { label: "Units in stock", value: String(stockAgg._sum.quantity ?? 0) },
    {
      label: "Sales today",
      value: `${todaySales._count} receipt${todaySales._count === 1 ? "" : "s"}`,
    },
    { label: "Revenue today", value: formatRM(todaySales._sum.totalSen ?? 0) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {isAdmin ? "All stores" : "Your store at a glance"}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-sm text-zinc-500">{c.label}</div>
            <div className="mt-1 text-2xl font-bold text-zinc-900">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Low stock</h2>
        {lowStockRows.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            No items are at or below their low-stock threshold.
          </p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <th className="py-2 pr-4">Item</th>
                {isAdmin && <th className="py-2 pr-4">Store</th>}
                <th className="py-2 pr-4">Stock</th>
                <th className="py-2">Threshold</th>
              </tr>
            </thead>
            <tbody>
              {lowStockRows.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                  <td className="py-2 pr-4 font-medium text-zinc-900">{s.item.name}</td>
                  {isAdmin && <td className="py-2 pr-4 text-zinc-600">{s.store.name}</td>}
                  <td className="py-2 pr-4 font-semibold text-red-600">{s.quantity}</td>
                  <td className="py-2 text-zinc-600">{s.item.lowStockThreshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
