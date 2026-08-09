import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StoreForm } from "../store-form";
import { deleteStore } from "../actions";

export default async function EditStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;

  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      users: { orderBy: { name: "asc" } },
      _count: { select: { receipts: true, transfersIn: true } },
      stockLevels: { select: { quantity: true } },
    },
  });
  if (!store) notFound();

  const units = store.stockLevels.reduce((sum, l) => sum + l.quantity, 0);
  const removable =
    store.users.length === 0 &&
    store._count.receipts === 0 &&
    store._count.transfersIn === 0 &&
    units === 0;

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{store.name}</h1>
        {store.isCentral && (
          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            Central storage
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        {units} unit{units === 1 ? "" : "s"} in stock · {store._count.receipts} receipt
        {store._count.receipts === 1 ? "" : "s"} · {store.users.length} user
        {store.users.length === 1 ? "" : "s"}
      </p>

      {error === "in-use" && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          This store has users, stock or receipt history, so it cannot be deleted.
          Reassign its users and stock first.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">Store details</h2>
          <StoreForm store={{ id: store.id, name: store.name, isCentral: store.isCentral }} />

          <div className="mt-8 border-t border-zinc-200 pt-5">
            <h3 className="text-sm font-semibold text-zinc-900">Delete this store</h3>
            {removable ? (
              <>
                <p className="mt-1 text-sm text-zinc-500">
                  This store has no users, stock or history, so it can be removed.
                </p>
                <form action={deleteStore.bind(null, store.id)} className="mt-3">
                  <button className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                    Delete store
                  </button>
                </form>
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                Stores with users, stock or receipt history are kept so past records stay
                intact.
              </p>
            )}
          </div>
        </div>

        <div className="h-fit rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Users</h2>
            <Link href="/users/new" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Add
            </Link>
          </div>
          {store.users.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Nobody can sign in to this store yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {store.users.map((u) => (
                <li key={u.id}>
                  <Link
                    href={`/users/${u.id}`}
                    className="block rounded-lg px-3 py-2 hover:bg-zinc-50"
                  >
                    <div className="text-sm font-medium text-zinc-900">
                      {u.name}
                      {!u.active && (
                        <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-normal text-zinc-600">
                          inactive
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-zinc-500">{u.username}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
