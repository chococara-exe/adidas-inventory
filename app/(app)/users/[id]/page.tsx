import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserForm } from "../user-form";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [user, stores] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { receipts: true } } },
    }),
    prisma.store.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!user) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{user.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        <span className="font-mono">{user.username}</span> · {user._count.receipts} receipt
        {user._count.receipts === 1 ? "" : "s"} recorded · joined{" "}
        {user.createdAt.toLocaleDateString("en-MY", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <UserForm
          stores={stores}
          user={{
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email ?? "",
            phone: user.phone ?? "",
            role: user.role === "ADMIN" ? "ADMIN" : "STORE",
            storeId: user.storeId ?? "",
            active: user.active,
          }}
        />
      </div>
    </div>
  );
}
