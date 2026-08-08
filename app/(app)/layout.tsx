import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logout } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "Dashboard", roles: ["ADMIN", "STORE"] },
  { href: "/receipts", label: "Receipts", roles: ["ADMIN", "STORE"] },
  { href: "/stock-in", label: "Stock In", roles: ["STORE"] },
  { href: "/items", label: "Items", roles: ["ADMIN", "STORE"] },
  { href: "/reports", label: "Reports", roles: ["ADMIN"] },
  { href: "/stores", label: "Stores & Users", roles: ["ADMIN"] },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const store = user.storeId
    ? await prisma.store.findUnique({ where: { id: user.storeId } })
    : null;

  const nav = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-zinc-200 bg-white print:hidden">
        <div className="border-b border-zinc-200 px-5 py-4">
          <div className="text-base font-bold tracking-tight text-zinc-900">
            Stock Management
          </div>
          <div className="mt-0.5 truncate text-xs text-zinc-500">
            {user.role === "ADMIN" ? "Administrator" : store?.name ?? "Store"}
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-200 p-3">
          <div className="px-3 pb-2 text-xs text-zinc-500">
            Signed in as <span className="font-medium text-zinc-700">{user.name}</span>
          </div>
          <form action={logout}>
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="ml-56 flex-1 p-8 print:ml-0 print:bg-white print:p-0">{children}</main>
    </div>
  );
}
