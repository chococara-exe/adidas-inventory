import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setUserActive } from "./actions";

const PAGE_ERRORS: Record<string, string> = {
  "last-admin": "That is the last active admin — create another admin first.",
  "self-deactivate": "You cannot deactivate your own account.",
};

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;

  const [stores, users] = await Promise.all([
    prisma.store.findMany({
      include: {
        _count: { select: { users: true, receipts: true } },
        stockLevels: { select: { quantity: true } },
      },
      orderBy: [{ isCentral: "desc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      include: { store: { select: { name: true } } },
      orderBy: [{ active: "desc" }, { role: "asc" }, { username: "asc" }],
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Stores &amp; Users</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Manage the stores in the business and the accounts that sign in to them.
      </p>

      {error && PAGE_ERRORS[error] && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {PAGE_ERRORS[error]}
        </p>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">
            Stores <span className="font-normal text-zinc-500">({stores.length})</span>
          </h2>
          <Link
            href="/stores/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Add store
          </Link>
        </div>

        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3 text-right">Users</th>
                <th className="px-4 py-3 text-right">Units in stock</th>
                <th className="px-4 py-3 text-right">Receipts</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/stores/${s.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.isCentral && (
                      <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                        Central storage
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-600">
                    {s._count.users}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-900">
                    {s.stockLevels.reduce((sum, l) => sum + l.quantity, 0)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-600">
                    {s._count.receipts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">
            Users <span className="font-normal text-zinc-500">({users.length})</span>
          </h2>
          <Link
            href="/users/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Add user
          </Link>
        </div>

        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-zinc-100 last:border-0 ${
                    u.active ? "" : "bg-zinc-50/60"
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/users/${u.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {u.name}
                    </Link>
                    {!u.active && (
                      <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-600">
                        inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600">{u.username}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === "ADMIN"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {u.role === "ADMIN" ? "Admin" : "Store"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {u.store?.name ?? <span className="text-zinc-400">All stores</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">
                    {u.email && <div>{u.email}</div>}
                    {u.phone && <div className="text-zinc-500">{u.phone}</div>}
                    {!u.email && !u.phone && <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={setUserActive.bind(null, u.id, !u.active)}>
                      <button className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                        {u.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
