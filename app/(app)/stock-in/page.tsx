import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StockInForm } from "./stock-in-form";

export default async function StockInPage() {
  const user = await requireUser();
  if (user.role !== "STORE" || !user.storeId) redirect("/");

  const items = await prisma.item.findMany({
    where: { active: true },
    include: { stockLevels: { where: { storeId: user.storeId } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Stock in</h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-500">
        Record stock arriving at your store. This only adds stock — every entry is
        logged and visible to the admin.
      </p>
      <div className="mt-6 max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
        <StockInForm
          items={items.map((i) => ({
            id: i.id,
            name: i.name,
            articleNumber: i.articleNumber,
            stock: i.stockLevels[0]?.quantity ?? 0,
          }))}
        />
      </div>
    </div>
  );
}
