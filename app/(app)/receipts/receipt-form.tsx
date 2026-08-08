"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createReceipt, type ReceiptFormState } from "./actions";
import { formatRM, parseRM } from "@/lib/currency";

export type ItemOption = {
  id: string;
  name: string;
  articleNumber: string;
  priceSen: number;
  isNameset: boolean;
  stock: number | null; // null = unknown (admin, depends on chosen store)
};

type Line = {
  key: number;
  itemId: string;
  quantity: number;
  priceRM: string;
  namesetDetail: string;
};

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

export function ReceiptForm({
  items,
  stores,
  isAdmin,
  ownStoreId,
}: {
  items: ItemOption[];
  stores: { id: string; name: string }[];
  isAdmin: boolean;
  ownStoreId: string | null;
}) {
  const [state, formAction, pending] = useActionState<ReceiptFormState, FormData>(
    createReceipt,
    {}
  );
  const [type, setType] = useState<"SALE" | "SPOIL" | "TRANSFER">("SALE");
  const [storeId, setStoreId] = useState(isAdmin ? "" : ownStoreId ?? "");
  const [nextKey, setNextKey] = useState(1);
  const [lines, setLines] = useState<Line[]>([
    { key: 0, itemId: "", quantity: 1, priceRM: "", namesetDetail: "" },
  ]);

  const itemById = new Map(items.map((i) => [i.id, i]));
  const today = new Date().toISOString().slice(0, 10);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function selectItem(key: number, itemId: string) {
    const item = itemById.get(itemId);
    updateLine(key, {
      itemId,
      priceRM: item ? (item.priceSen / 100).toFixed(2) : "",
      namesetDetail: "",
    });
  }

  const linesPayload = lines
    .filter((l) => l.itemId)
    .map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      unitPriceSen: parseRM(l.priceRM) ?? itemById.get(l.itemId)?.priceSen ?? 0,
      namesetDetail: l.namesetDetail || undefined,
    }));

  const totalSen = linesPayload.reduce((s, l) => s + l.quantity * l.unitPriceSen, 0);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="lines" value={JSON.stringify(linesPayload)} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Type</label>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className={`mt-1 w-full ${inputClass}`}
          >
            <option value="SALE">Sale</option>
            <option value="SPOIL">Spoil / damage</option>
            <option value="TRANSFER">Transfer to another store</option>
          </select>
        </div>

        {isAdmin && (
          <div>
            <label className="block text-sm font-medium text-zinc-700">Store</label>
            <select
              name="storeId"
              required
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className={`mt-1 w-full ${inputClass}`}
            >
              <option value="">Select store…</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {type === "TRANSFER" && (
          <div>
            <label className="block text-sm font-medium text-zinc-700">Transfer to</label>
            <select name="toStoreId" required className={`mt-1 w-full ${inputClass}`}>
              <option value="">Select store…</option>
              {stores
                .filter((s) => s.id !== (isAdmin ? storeId : ownStoreId))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={today}
            max={today}
            required
            className={`mt-1 w-full ${inputClass}`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Staff <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            name="staffName"
            placeholder="Salesperson name"
            className={`mt-1 w-full ${inputClass}`}
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-3 py-2">Item</th>
              <th className="w-24 px-3 py-2">Qty</th>
              {type === "SALE" && <th className="w-32 px-3 py-2">Unit price (RM)</th>}
              {type === "SALE" && <th className="w-28 px-3 py-2 text-right">Line total</th>}
              <th className="w-10 px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const item = line.itemId ? itemById.get(line.itemId) : undefined;
              const lineTotal =
                (parseRM(line.priceRM) ?? item?.priceSen ?? 0) * line.quantity;
              return (
                <tr key={line.key} className="border-b border-zinc-100 align-top last:border-0">
                  <td className="px-3 py-2">
                    <select
                      value={line.itemId}
                      onChange={(e) => selectItem(line.key, e.target.value)}
                      className={`w-full ${inputClass}`}
                    >
                      <option value="">Select item…</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.articleNumber})
                          {i.stock !== null ? ` — ${i.stock} in stock` : ""}
                        </option>
                      ))}
                    </select>
                    {item?.isNameset && (
                      <input
                        value={line.namesetDetail}
                        onChange={(e) =>
                          updateLine(line.key, { namesetDetail: e.target.value })
                        }
                        placeholder="Player name & number, e.g. MESSI 10 (leave blank for generic)"
                        className={`mt-2 w-full ${inputClass}`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.key, {
                          quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                        })
                      }
                      className={`w-full ${inputClass}`}
                    />
                  </td>
                  {type === "SALE" && (
                    <td className="px-3 py-2">
                      <input
                        inputMode="decimal"
                        value={line.priceRM}
                        onChange={(e) => updateLine(line.key, { priceRM: e.target.value })}
                        className={`w-full ${inputClass}`}
                      />
                    </td>
                  )}
                  {type === "SALE" && (
                    <td className="px-3 py-3 text-right font-medium text-zinc-900">
                      {line.itemId ? formatRM(lineTotal) : "—"}
                    </td>
                  )}
                  <td className="px-1 py-2">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setLines((ls) => ls.filter((l) => l.key !== line.key))
                        }
                        className="rounded-lg px-2 py-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove line"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setLines((ls) => [
                ...ls,
                { key: nextKey, itemId: "", quantity: 1, priceRM: "", namesetDetail: "" },
              ]);
              setNextKey((k) => k + 1);
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            + Add line
          </button>
          {type === "SALE" && (
            <div className="text-sm text-zinc-700">
              Total:{" "}
              <span className="text-base font-bold text-zinc-900">{formatRM(totalSen)}</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Note <span className="text-zinc-400">(optional)</span>
        </label>
        <textarea name="note" rows={2} className={`mt-1 w-full ${inputClass}`} />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || linesPayload.length === 0}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Create receipt"}
        </button>
        <Link
          href="/receipts"
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
