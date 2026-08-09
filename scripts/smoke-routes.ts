/**
 * Route smoke test: signs in as each seeded role and checks every page
 * answers with the right status — 200 for allowed, redirect for blocked.
 * Requires the app to be running on BASE (default http://localhost:3000).
 */
import { sealData } from "iron-session";
import { prisma } from "../lib/db";

const BASE = process.env.BASE ?? "http://localhost:3000";

let failures = 0;
function check(label: string, actual: string, expected: string) {
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} → ${actual}${ok ? "" : ` (want ${expected})`}`);
  if (!ok) failures++;
}

async function cookieFor(username: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { username } });
  const seal = await sealData(
    { userId: u.id, role: u.role, storeId: u.storeId, username: u.username, name: u.name },
    { password: process.env.SESSION_SECRET!, ttl: 3600 }
  );
  return `asm_session=${seal}`;
}

/** "200", or "→/login" / "→/" for a redirect. */
async function hit(path: string, cookie?: string) {
  const res = await fetch(BASE + path, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location") ?? "?";
    return `→${loc.replace(BASE, "") || "/"}`;
  }
  return String(res.status);
}

async function main() {
  const admin = await cookieFor("admin");
  const store = await cookieFor("demo");
  const anyStore = await prisma.store.findFirstOrThrow();
  const anyUser = await prisma.user.findFirstOrThrow({ where: { username: "demo" } });

  const adminOnly = [
    "/stores",
    "/stores/new",
    `/stores/${anyStore.id}`,
    "/users/new",
    `/users/${anyUser.id}`,
    "/items/new",
    "/items/import",
  ];

  console.log("--- admin: admin-only pages should open ---");
  for (const p of adminOnly) check(`admin ${p}`, await hit(p, admin), "200");

  console.log("\n--- store user: admin-only pages should bounce home ---");
  for (const p of adminOnly) check(`store ${p}`, await hit(p, store), "→/");

  console.log("\n--- shared pages ---");
  for (const p of ["/", "/receipts", "/receipts/new", "/items", "/reports"]) {
    check(`admin ${p}`, await hit(p, admin), "200");
    check(`store ${p}`, await hit(p, store), "200");
  }
  check("store /stock-in", await hit("/stock-in", store), "200");
  check("admin /stock-in", await hit("/stock-in", admin), "→/");

  console.log("\n--- signed out: everything should go to login ---");
  for (const p of ["/", "/stores", "/users/new", "/items", "/reports", "/receipts"]) {
    check(`anon ${p}`, await hit(p), "→/login");
  }
  check("anon /api/items/template", await hit("/api/items/template"), "401");

  console.log(failures === 0 ? "\nALL ROUTE CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
