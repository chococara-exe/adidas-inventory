"use client";

import { useActionState, useState } from "react";
import { createStockIn, type StockInState } from "./actions";

export type StockInItem = {
  id: string;
  name: string;
  articleNumber: string;
  stock: number;
};

type Line = { key: number; itemId: string; quantity: number };

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

export function StockInForm({ items }: { items: StockInItem[] }) {
  const [state, formAction, pending] = useActionState<StockInState, FormData>(
    createStockIn,
    {}
  );
  const [nextKey, setNextKey] = useState(1);
  const [lines, setLines] = useState<Line[]>([{ key: 0, itemId: "", quantity: 1 }]);

  const payload = lines
    .filter((l) => l.itemId)
    .map((l) => ({ itemId: l.itemId, quantity: l.quantity }));

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />

      <div className="rounded-xl border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-3 py-2">Item</th>
              <th className="w-32 px-3 py-2">Quantity added</th>
              <th className="w-10 px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.key} className="border-b border-zinc-100 last:border-0">
                <td className="px-3 py-2">
                  <select
                    value={line.itemId}
                    onChange={(e) =>
                      setLines((ls) =>
                        ls.map((l) =>
                          l.key === line.key ? { ...l, itemId: e.target.value } : l
                        )
                      )
                    }
                    className={`w-full ${inputClass}`}
                  >
                    <option value="">Select item…</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.articleNumber}) — currently {i.stock}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((ls) =>
                        ls.map((l) =>
                          l.key === line.key
                            ? {
                                ...l,
                                quantity: Math.max(
                                  1,
                                  Math.floor(Number(e.target.value) || 1)
                                ),
                              }
                            : l
                        )
                      )
                    }
                    className={`w-full ${inputClass}`}
                  />
                </td>
                <td className="px-1 py-2">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                      className="rounded-lg px-2 py-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove line"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-zinc-200 px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setLines((ls) => [...ls, { key: nextKey, itemId: "", quantity: 1 }]);
              setNextKey((k) => k + 1);
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            + Add line
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Note <span className="text-zinc-400">(optional, e.g. delivery reference)</span>
        </label>
        <textarea name="note" rows={2} className={`mt-1 w-full ${inputClass}`} />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending || payload.length === 0}
        className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Recording…" : "Record stock in"}
      </button>
    </form>
  );
}
