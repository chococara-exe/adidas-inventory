import { prisma } from "../lib/db";
import { createReceiptWithStock } from "../lib/receipts";

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  const demo = await prisma.store.findUniqueOrThrow({ where: { name: "Demo Store" } });
  const central = await prisma.store.findUniqueOrThrow({ where: { name: "Central Storage" } });
  const jersey = await prisma.item.findUniqueOrThrow({ where: { articleNumber: "IP4148" } });

  const levelBefore = async (storeId: string) =>
    (
      await prisma.stockLevel.findUnique({
        where: { itemId_storeId: { itemId: jersey.id, storeId } },
      })
    )?.quantity ?? 0;

  const demoBefore = await levelBefore(demo.id);
  const centralBefore = await levelBefore(central.id);
  const centralExisted = !!(await prisma.stockLevel.findUnique({
    where: { itemId_storeId: { itemId: jersey.id, storeId: central.id } },
  }));
  const createdReceipts: string[] = [];
  console.log(`Starting stock — Demo: ${demoBefore}, Central: ${centralBefore}`);

  try {
    // 1. SALE deducts stock and computes total
    const saleId = await createReceiptWithStock({
      type: "SALE",
      date: new Date(),
      storeId: demo.id,
      createdById: admin.id,
      lines: [{ itemId: jersey.id, quantity: 2, unitPriceSen: jersey.priceSen }],
    });
    createdReceipts.push(saleId);
    check("SALE deducts stock", (await levelBefore(demo.id)) === demoBefore - 2);
    const sale = await prisma.receipt.findUniqueOrThrow({
      where: { id: saleId },
      include: { movements: true },
    });
    check("SALE total computed", sale.totalSen === 2 * jersey.priceSen);
    check(
      "SALE writes one -2 movement",
      sale.movements.length === 1 &&
        sale.movements[0].delta === -2 &&
        sale.movements[0].reason === "SALE"
    );

    // 2. Overselling is rejected and changes nothing
    let threw = "";
    try {
      await createReceiptWithStock({
        type: "SALE",
        date: new Date(),
        storeId: demo.id,
        createdById: admin.id,
        lines: [{ itemId: jersey.id, quantity: 99999, unitPriceSen: jersey.priceSen }],
      });
    } catch (e) {
      threw = e instanceof Error ? e.message : "unknown";
    }
    check("Oversell rejected", threw.includes("Not enough stock"), `got: ${threw}`);
    check("Oversell left stock unchanged", (await levelBefore(demo.id)) === demoBefore - 2);

    // 3. Split lines of the same item are checked as a combined quantity
    threw = "";
    try {
      await createReceiptWithStock({
        type: "SALE",
        date: new Date(),
        storeId: demo.id,
        createdById: admin.id,
        lines: [
          { itemId: jersey.id, quantity: demoBefore - 2, unitPriceSen: 100 },
          { itemId: jersey.id, quantity: 1, unitPriceSen: 100 },
        ],
      });
    } catch (e) {
      threw = e instanceof Error ? e.message : "unknown";
    }
    check("Split-line oversell rejected", threw.includes("Not enough stock"), `got: ${threw}`);

    // 4. TRANSFER moves stock between stores with paired movements
    const transferId = await createReceiptWithStock({
      type: "TRANSFER",
      date: new Date(),
      storeId: demo.id,
      toStoreId: central.id,
      createdById: admin.id,
      lines: [{ itemId: jersey.id, quantity: 5, unitPriceSen: jersey.priceSen }],
    });
    createdReceipts.push(transferId);
    check("TRANSFER deducts source", (await levelBefore(demo.id)) === demoBefore - 7);
    check("TRANSFER adds destination", (await levelBefore(central.id)) === centralBefore + 5);
    const transfer = await prisma.receipt.findUniqueOrThrow({
      where: { id: transferId },
      include: { movements: true },
    });
    check(
      "TRANSFER writes paired movements",
      transfer.movements.length === 2 &&
        transfer.movements.some((m) => m.reason === "TRANSFER_OUT" && m.delta === -5) &&
        transfer.movements.some((m) => m.reason === "TRANSFER_IN" && m.delta === 5)
    );
    check("TRANSFER has no revenue", transfer.totalSen === 0);

    // 5. STOCK_IN adds stock
    const stockInId = await createReceiptWithStock({
      type: "STOCK_IN",
      date: new Date(),
      storeId: demo.id,
      createdById: admin.id,
      lines: [{ itemId: jersey.id, quantity: 4, unitPriceSen: jersey.priceSen }],
    });
    createdReceipts.push(stockInId);
    check("STOCK_IN adds stock", (await levelBefore(demo.id)) === demoBefore - 7 + 4);

    // 6. Receipt numbers are sequential
    const nums = await Promise.all(
      createdReceipts.map(async (id) =>
        (await prisma.receipt.findUniqueOrThrow({ where: { id } })).number
      )
    );
    check(
      "Receipt numbers sequential",
      nums[1] === nums[0] + 1 && nums[2] === nums[1] + 1,
      `got ${nums.join(", ")}`
    );
  } finally {
    // Cleanup: remove test rows and restore stock exactly
    await prisma.stockMovement.deleteMany({ where: { receiptId: { in: createdReceipts } } });
    await prisma.receipt.deleteMany({ where: { id: { in: createdReceipts } } });
    await prisma.stockLevel.update({
      where: { itemId_storeId: { itemId: jersey.id, storeId: demo.id } },
      data: { quantity: demoBefore },
    });
    if (centralExisted) {
      await prisma.stockLevel.update({
        where: { itemId_storeId: { itemId: jersey.id, storeId: central.id } },
        data: { quantity: centralBefore },
      });
    } else {
      await prisma.stockLevel.deleteMany({
        where: { itemId: jersey.id, storeId: central.id },
      });
    }
    const demoAfter = await levelBefore(demo.id);
    console.log(`Cleanup done — Demo restored to ${demoAfter}`);
  }

  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
