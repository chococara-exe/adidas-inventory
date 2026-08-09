import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserForm } from "../user-form";

export default async function NewUserPage() {
  await requireAdmin();
  const stores = await prisma.store.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Add user</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Create a sign-in account. Give the username and password to the person directly —
        passwords cannot be read back later.
      </p>
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <UserForm stores={stores} />
      </div>
    </div>
  );
}
