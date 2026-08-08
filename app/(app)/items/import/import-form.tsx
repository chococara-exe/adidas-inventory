"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importItems, type ImportState } from "../actions";

export function ImportForm({ stores }: { stores: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importItems,
    {}
  );

  return (
    <div>
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-zinc-700">
            Spreadsheet file
          </label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept=".xlsx,.xls,.csv"
            className="mt-2 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
          />
        </div>

        <div>
          <label htmlFor="storeId" className="block text-sm font-medium text-zinc-700">
            Apply “Initial Stock” column to
          </label>
          <select
            id="storeId"
            name="storeId"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
          >
            <option value="">Don&apos;t import stock (items only)</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-400">
            If a store is selected, each row&apos;s Initial Stock is added to that store and
            logged as a stock-in.
          </p>
        </div>

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Importing…" : "Import"}
        </button>
      </form>

      {state.report && (
        <div className="mt-6 border-t border-zinc-200 pt-5">
          <h2 className="text-base font-semibold text-zinc-900">Import result</h2>
          <p className="mt-2 text-sm text-zinc-700">
            <span className="font-semibold text-green-700">{state.report.created}</span>{" "}
            item{state.report.created === 1 ? "" : "s"} created
            {state.report.stockUnits > 0 && (
              <> with <span className="font-semibold">{state.report.stockUnits}</span> units of stock</>
            )}
            {state.report.skipped.length > 0 && (
              <>
                , <span className="font-semibold text-amber-700">{state.report.skipped.length}</span>{" "}
                row{state.report.skipped.length === 1 ? "" : "s"} skipped
              </>
            )}
            .
          </p>
          {state.report.skipped.length > 0 && (
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {state.report.skipped.map((s, i) => (
                <li key={i}>
                  <span className="font-mono font-medium">Row {s.row}:</span> {s.reason}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/items"
            className="mt-4 inline-block rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            View items
          </Link>
        </div>
      )}
    </div>
  );
}
