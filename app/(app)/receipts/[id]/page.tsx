import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRM } from "@/lib/currency";
import { RECEIPT_TYPE_LABELS, type ReceiptType } from "@/lib/constants";
import { PrintButton } from "./print-button";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      store: true,
      toStore: true,
      createdBy: true,
      lines: { include: { item: true } },
    },
  });
  if (!receipt) notFound();
  if (
    user.role !== "ADMIN" &&
    receipt.storeId !== user.storeId &&
    receipt.toStoreId !== user.storeId
  ) {
    notFound();
  }

  const isSale = receipt.type === "SALE";
  const totalQty = receipt.lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/receipts" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Back to receipts
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-2xl bg-white p-8 shadow-sm print:rounded-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-zinc-200 pb-5">
          <div>
            <div className="text-lg font-bold tracking-tight text-zinc-900">
              {receipt.store.name}
            </div>
            <div className="text-sm text-zinc-500">
              {RECEIPT_TYPE_LABELS[receipt.type as ReceiptType] ?? receipt.type} receipt
              {receipt.toStore && <> → {receipt.toStore.name}</>}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg font-bold text-zinc-900">
              #{String(receipt.number).padStart(5, "0")}
            </div>
            <div className="text-sm text-zinc-500">
              {receipt.date.toLocaleDateString("en-MY", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
        </div>

        <table className="mt-5 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="py-2 pr-3">Item</th>
              <th className="py-2 pr-3 text-right">Qty</th>
              {isSale && <th className="py-2 pr-3 text-right">Unit price</th>}
              {isSale && <th className="py-2 text-right">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line) => (
              <tr key={line.id} className="border-b border-zinc-100 last:border-0">
                <td className="py-2.5 pr-3">
                  <div className="font-medium text-zinc-900">{line.item.name}</div>
                  <div className="font-mono text-xs text-zinc-500">
                    {line.item.articleNumber}
                    {line.namesetDetail && (
                      <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 font-sans text-amber-700">
                        {line.namesetDetail}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-right text-zinc-700">{line.quantity}</td>
                {isSale && (
                  <td className="py-2.5 pr-3 text-right text-zinc-700">
                    {formatRM(line.unitPriceSen)}
                  </td>
                )}
                {isSale && (
                  <td className="py-2.5 text-right font-medium text-zinc-900">
                    {formatRM(line.quantity * line.unitPriceSen)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-300">
              <td className="py-3 pr-3 font-semibold text-zinc-900">Total</td>
              <td className="py-3 pr-3 text-right font-semibold text-zinc-900">{totalQty}</td>
              {isSale && <td />}
              {isSale && (
                <td className="py-3 text-right text-lg font-bold text-zinc-900">
                  {formatRM(receipt.totalSen)}
                </td>
              )}
            </tr>
          </tfoot>
        </table>

        <div className="mt-5 space-y-1 border-t border-zinc-200 pt-4 text-sm text-zinc-500">
          {receipt.staffName && <div>Staff: {receipt.staffName}</div>}
          <div>Recorded by: {receipt.createdBy.name}</div>
          {receipt.note && <div>Note: {receipt.note}</div>}
          <div>
            Created:{" "}
            {receipt.createdAt.toLocaleString("en-MY", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
