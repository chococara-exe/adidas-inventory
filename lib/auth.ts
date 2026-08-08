import { redirect } from "next/navigation";
import { getSession, type SessionData } from "./session";

export type AuthedUser = {
  userId: string;
  role: "ADMIN" | "STORE";
  storeId: string | null;
  username: string;
  name: string;
};

/** Returns the logged-in user or redirects to /login. */
export async function requireUser(): Promise<AuthedUser> {
  const session = await getSession();
  if (!session.userId || !session.role) redirect("/login");
  return {
    userId: session.userId,
    role: session.role,
    storeId: session.storeId ?? null,
    username: session.username ?? "",
    name: session.name ?? "",
  };
}

/** Returns the logged-in admin or redirects (to /login or home). */
export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

export async function getSessionUser(): Promise<SessionData | null> {
  const session = await getSession();
  return session.userId ? session : null;
}
