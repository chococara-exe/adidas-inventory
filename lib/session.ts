import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import type { Role } from "./constants";

export type SessionData = {
  userId?: string;
  role?: Role;
  storeId?: string | null;
  username?: string;
  name?: string;
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, {
    password: process.env.SESSION_SECRET!,
    cookieName: "asm_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  });
}
