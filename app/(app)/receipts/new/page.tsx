import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ReceiptForm, type ItemOption } from "../receipt-form";

export default async function NewReceiptPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const [items, stores] = await Promise.all([
    prisma.item.findMany({
      where: { active: true },
      include: {
        stockLevels: isAdmin
          ? { where: { id: "__none__" } }
          : { where: { storeId: user.storeId ?? "__none__" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.store.findMany({ orderBy: { name: "asc" } }),
  ]);

  const itemOptions: ItemOption[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    articleNumber: i.articleNumber,
    priceSen: i.priceSen,
    isNameset: i.isNameset,
    stock: isAdmin ? null : i.stockLevels[0]?.quantity ?? 0,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">New receipt</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Stock is deducted automatically when the receipt is created.
      </p>
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <ReceiptForm
          items={itemOptions}
          stores={stores.map((s) => ({ id: s.id, name: s.name }))}
          isAdmin={isAdmin}
          ownStoreId={user.storeId}
        />
      </div>
    </div>
  );
}
