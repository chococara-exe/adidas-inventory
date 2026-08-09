import { prisma } from "./db";

/**
 * True when this user is the only admin who can still sign in. Locking that
 * account out — by deactivating it or demoting it to a store role — would
 * leave nobody able to administer the system, so both paths check this first.
 */
export async function isLastActiveAdmin(userId: string): Promise<boolean> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role !== "ADMIN" || !target.active) return false;

  const others = await prisma.user.count({
    where: { role: "ADMIN", active: true, NOT: { id: userId } },
  });
  return others === 0;
}
