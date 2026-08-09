"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveUser, type FormState } from "../stores/actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900";

export type UserData = {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: "ADMIN" | "STORE";
  storeId: string;
  active: boolean;
};

export function UserForm({
  stores,
  user,
}: {
  stores: { id: string; name: string }[];
  user?: UserData;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveUser, {});
  const [role, setRole] = useState<"ADMIN" | "STORE">(user?.role ?? "STORE");

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      {user && <input type="hidden" name="id" value={user.id} />}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
          Full name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={user?.name}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-zinc-700">
          Username
        </label>
        <input
          id="username"
          name="username"
          required
          autoComplete="off"
          defaultValue={user?.username}
          placeholder="e.g. midvalley"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-zinc-400">
          Letters, numbers, dot, dash and underscore. This is what they type to sign in.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-zinc-700">
            Role
          </label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as "ADMIN" | "STORE")}
            className={inputClass}
          >
            <option value="STORE">Store — own store only</option>
            <option value="ADMIN">Admin — all stores</option>
          </select>
        </div>
        <div>
          <label htmlFor="storeId" className="block text-sm font-medium text-zinc-700">
            Store
          </label>
          <select
            id="storeId"
            name="storeId"
            required={role === "STORE"}
            disabled={role === "ADMIN"}
            defaultValue={user?.storeId ?? ""}
            className={`${inputClass} disabled:bg-zinc-100 disabled:text-zinc-400`}
          >
            <option value="">{role === "ADMIN" ? "All stores" : "Select store…"}</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
            Email <span className="text-zinc-400">(for notifications)</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={user?.email}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">
            Phone <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={user?.phone}
            placeholder="+60…"
            className={inputClass}
          />
        </div>
      </div>

      <fieldset className="rounded-xl border border-zinc-200 p-4">
        <legend className="px-1 text-sm font-medium text-zinc-700">
          {user ? "Reset password" : "Password"}
        </legend>
        {user && (
          <p className="mb-3 text-xs text-zinc-500">
            Leave both fields blank to keep the current password unchanged.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
              {user ? "New password" : "Password"}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required={!user}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-zinc-700"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required={!user}
              className={inputClass}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-400">At least 8 characters.</p>
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input
          type="checkbox"
          name="active"
          defaultChecked={user?.active ?? true}
          className="h-4 w-4 rounded border-zinc-300"
        />
        Account is active (can sign in)
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
          {pending ? "Saving…" : user ? "Save changes" : "Create user"}
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
