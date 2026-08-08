import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ItemForm } from "../item-form";

export default async function NewItemPage() {
  await requireAdmin();
  const categories = await prisma.category.findMany({
    include: { subCategories: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Add item</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Create a new item. Typing a category that doesn&apos;t exist yet creates it.
      </p>
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <ItemForm categories={categories} />
      </div>
    </div>
  );
}
