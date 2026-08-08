import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRM } from "@/lib/currency";
import { RECEIPT_TYPE_LABELS, type ReceiptType } from "@/lib/constants";

const TYPE_BADGE: Record<string, string> = {
  SALE: "bg-green-50 text-green-700",
  SPOIL: "bg-red-50 text-red-700",
  TRANSFER: "bg-blue-50 text-blue-700",
  STOCK_IN: "bg-amber-50 text-amber-700",
};

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; store?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { type = "", store = "" } = await searchParams;

  const stores = isAdmin
    ? await prisma.store.findMany({ orderBy: { name: "asc" } })
    : [];

  const receipts = await prisma.receipt.findMany({
    where: {
      ...(isAdmin
        ? store
          ? { OR: [{ storeId: store }, { toStoreId: store }] }
          : {}
        : {
            OR: [
              { storeId: user.storeId ?? "__none__" },
              { toStoreId: user.storeId ?? "__none__" },
            ],
          }),
      ...(type ? { type } : {}),
    },
    include: {
      store: true,
      toStore: true,
      createdBy: true,
      lines: true,
    },
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take: 100,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Receipts</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isAdmin ? "All stores — latest 100" : "Your store's receipts — latest 100"}
          </p>
        </div>
        <Link
          href="/receipts/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          New receipt
        </Link>
      </div>

      <form className="mt-5 flex flex-wrap gap-2">
        <select
          name="type"
          defaultValue={type}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
        >
          <option value="">All types</option>
          {Object.entries(RECEIPT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {isAdmin && (
          <select
            name="store"
            defaultValue={store}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
          >
            <option value="">All stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <button className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          Filter
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">No.</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">By</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No receipts yet.
                </td>
              </tr>
            )}
            {receipts.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/receipts/${r.id}`}
                    className="font-mono font-medium text-zinc-900 hover:underline"
                  >
                    #{String(r.number).padStart(5, "0")}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {r.date.toLocaleDateString("en-MY", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      TYPE_BADGE[r.type] ?? "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {RECEIPT_TYPE_LABELS[r.type as ReceiptType] ?? r.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {r.store.name}
                  {r.toStore && <span className="text-zinc-400"> → {r.toStore.name}</span>}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">
                  {r.lines.reduce((s, l) => s + l.quantity, 0)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-zinc-900">
                  {r.type === "SALE" ? formatRM(r.totalSen) : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600">{r.createdBy.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
