"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveStore, type FormState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900";

export function StoreForm({
  store,
}: {
  store?: { id: string; name: string; isCentral: boolean };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveStore, {});

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      {store && <input type="hidden" name="id" value={store.id} />}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
          Store name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={store?.name}
          placeholder="e.g. Mid Valley Megamall"
          className={inputClass}
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="isCentral"
          defaultChecked={store?.isCentral}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300"
        />
        <span>
          <span className="font-medium">This is the central storage warehouse</span>
          <span className="block text-xs text-zinc-500">
            Stores order their stock from here. Only one store can hold this role.
          </span>
        </span>
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : store ? "Save changes" : "Create store"}
        </button>
        <Link
          href="/stores"
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
