/**
 * Checks the invariant that stops the business locking itself out of its own
 * admin panel. Creates and removes its own scratch users, leaving the
 * database as it found it.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";
import { isLastActiveAdmin } from "../lib/users";

let failures = 0;
function check(label: string, actual: boolean, expected: boolean) {
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} → ${actual}${ok ? "" : ` (want ${expected})`}`);
  if (!ok) failures++;
}

const SCRATCH = ["zz-test-admin", "zz-test-admin-2", "zz-test-store"];

async function main() {
  await prisma.user.deleteMany({ where: { username: { in: SCRATCH } } });

  // Park the real admins so the scratch admin is genuinely the only one.
  const realAdmins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { id: true },
  });
  await prisma.user.updateMany({
    where: { id: { in: realAdmins.map((a) => a.id) } },
    data: { active: false },
  });

  const hash = await bcrypt.hash("scratch-password", 10);
  const store = await prisma.store.findFirstOrThrow();

  try {
    const onlyAdmin = await prisma.user.create({
      data: { username: SCRATCH[0], passwordHash: hash, name: "Scratch Admin", role: "ADMIN" },
    });
    const storeUser = await prisma.user.create({
      data: {
        username: SCRATCH[2],
        passwordHash: hash,
        name: "Scratch Store",
        role: "STORE",
        storeId: store.id,
      },
    });

    check("sole admin is protected", await isLastActiveAdmin(onlyAdmin.id), true);
    check("store user is not protected", await isLastActiveAdmin(storeUser.id), false);

    // A second admin removes the protection from the first.
    const second = await prisma.user.create({
      data: { username: SCRATCH[1], passwordHash: hash, name: "Scratch Admin 2", role: "ADMIN" },
    });
    check("with a second admin, neither is protected", await isLastActiveAdmin(onlyAdmin.id), false);
    check("second admin also unprotected", await isLastActiveAdmin(second.id), false);

    // An *inactive* second admin cannot administer anything, so it does not count.
    await prisma.user.update({ where: { id: second.id }, data: { active: false } });
    check("inactive admin does not count as cover", await isLastActiveAdmin(onlyAdmin.id), true);
    check("inactive admin is not itself protected", await isLastActiveAdmin(second.id), false);

    check("unknown id is not protected", await isLastActiveAdmin("does-not-exist"), false);
  } finally {
    await prisma.user.deleteMany({ where: { username: { in: SCRATCH } } });
    await prisma.user.updateMany({
      where: { id: { in: realAdmins.map((a) => a.id) } },
      data: { active: true },
    });
    const restored = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    console.log(`Cleanup done — ${restored} active admin(s) restored`);
  }

  console.log(failures === 0 ? "\nALL USER RULE CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
