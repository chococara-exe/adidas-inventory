import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Central storage (Phase 2 warehouse) + one demo store
  const central = await prisma.store.upsert({
    where: { name: "Central Storage" },
    update: {},
    create: { name: "Central Storage", isCentral: true },
  });

  const demoStore = await prisma.store.upsert({
    where: { name: "Demo Store" },
    update: {},
    create: { name: "Demo Store" },
  });

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: await bcrypt.hash("admin123", 10),
      name: "Administrator",
      role: "ADMIN",
      email: "vineranalytics@gmail.com",
    },
  });

  await prisma.user.upsert({
    where: { username: "demo" },
    update: {},
    create: {
      username: "demo",
      passwordHash: await bcrypt.hash("demo123", 10),
      name: "Demo Store User",
      role: "STORE",
      storeId: demoStore.id,
    },
  });

  const categories: Record<string, string[]> = {
    Jerseys: ["Home", "Away", "Third"],
    Namesets: [],
    Footwear: ["Boots", "Sneakers"],
    Accessories: ["Caps", "Bags", "Socks"],
  };

  for (const [name, subs] of Object.entries(categories)) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    for (const sub of subs) {
      await prisma.subCategory.upsert({
        where: { categoryId_name: { categoryId: cat.id, name: sub } },
        update: {},
        create: { categoryId: cat.id, name: sub },
      });
    }
  }

  const jerseys = await prisma.category.findUniqueOrThrow({ where: { name: "Jerseys" } });
  const namesets = await prisma.category.findUniqueOrThrow({ where: { name: "Namesets" } });

  const demoItems = [
    { name: "Malaysia Home Jersey 24/25", articleNumber: "IP4148", categoryId: jerseys.id, priceSen: 29900, isNameset: false },
    { name: "Nameset (Generic)", articleNumber: "NS-GEN", categoryId: namesets.id, priceSen: 5900, isNameset: true },
  ];

  for (const item of demoItems) {
    const created = await prisma.item.upsert({
      where: { articleNumber: item.articleNumber },
      update: {},
      create: item,
    });
    // Give the demo store some starting stock via the ledger
    const existing = await prisma.stockLevel.findUnique({
      where: { itemId_storeId: { itemId: created.id, storeId: demoStore.id } },
    });
    if (!existing) {
      const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
      await prisma.$transaction([
        prisma.stockLevel.create({
          data: { itemId: created.id, storeId: demoStore.id, quantity: 20 },
        }),
        prisma.stockMovement.create({
          data: {
            itemId: created.id,
            storeId: demoStore.id,
            delta: 20,
            reason: "STOCK_IN",
            userId: admin.id,
          },
        }),
      ]);
    }
  }

  console.log("Seed complete. Logins — admin/admin123, demo/demo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
