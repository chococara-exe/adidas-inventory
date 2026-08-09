"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { isLastActiveAdmin } from "@/lib/users";

export type FormState = { error?: string };

const MIN_PASSWORD = 8;

/* ------------------------------------------------------------------ stores */

const storeSchema = z.object({
  name: z.string().trim().min(1, "Store name is required.").max(80),
  isCentral: z.boolean(),
});

export async function saveStore(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const parsed = storeSchema.safeParse({
    name: formData.get("name"),
    isCentral: formData.get("isCentral") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, isCentral } = parsed.data;

  const clash = await prisma.store.findUnique({ where: { name } });
  if (clash && clash.id !== id) return { error: `A store named “${name}” already exists.` };

  // Phase 2 orders are placed against a single warehouse, so promoting one
  // store demotes whichever store held the flag before.
  await prisma.$transaction(async (tx) => {
    if (isCentral) {
      await tx.store.updateMany({
        where: { isCentral: true, ...(id ? { NOT: { id } } : {}) },
        data: { isCentral: false },
      });
    }
    if (id) {
      await tx.store.update({ where: { id }, data: { name, isCentral } });
    } else {
      await tx.store.create({ data: { name, isCentral } });
    }
  });

  revalidatePath("/stores");
  redirect("/stores");
}

export async function deleteStore(id: string): Promise<void> {
  await requireAdmin();

  // Stores carry history; only a store nothing points at can be removed
  // (i.e. one created by mistake).
  const [users, receipts, incoming, stock, movements] = await Promise.all([
    prisma.user.count({ where: { storeId: id } }),
    prisma.receipt.count({ where: { storeId: id } }),
    prisma.receipt.count({ where: { toStoreId: id } }),
    prisma.stockLevel.count({ where: { storeId: id, quantity: { not: 0 } } }),
    prisma.stockMovement.count({ where: { storeId: id } }),
  ]);
  if (users || receipts || incoming || stock || movements) {
    redirect(`/stores/${id}?error=in-use`);
  }

  await prisma.stockLevel.deleteMany({ where: { storeId: id } });
  await prisma.store.delete({ where: { id } });
  revalidatePath("/stores");
  redirect("/stores");
}

/* ------------------------------------------------------------------- users */

const userSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username can only use letters, numbers, dot, dash and underscore."),
  name: z.string().trim().min(1, "Full name is required.").max(80),
  email: z.union([z.literal(""), z.email("Enter a valid email address.")]),
  phone: z.string().trim().max(30),
  role: z.enum(["ADMIN", "STORE"]),
  active: z.boolean(),
});

export async function saveUser(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const parsed = userSchema.safeParse({
    username: formData.get("username"),
    name: formData.get("name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    role: formData.get("role"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  // Admins see every store, so they are not tied to one.
  const storeId = data.role === "ADMIN" ? null : String(formData.get("storeId") ?? "");
  if (data.role === "STORE" && !storeId) {
    return { error: "Store accounts must be assigned to a store." };
  }
  if (storeId) {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return { error: "Selected store not found." };
  }

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (!id || password) {
    if (password.length < MIN_PASSWORD) {
      return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
    }
    if (password !== confirm) return { error: "The two passwords do not match." };
  }

  const clash = await prisma.user.findUnique({ where: { username: data.username } });
  if (clash && clash.id !== id) return { error: `Username “${data.username}” is taken.` };

  if (id) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return { error: "User not found." };

    // Locking out the last admin would leave nobody able to administer the
    // system, so block both routes to it.
    if (await isLastActiveAdmin(id)) {
      if (data.role !== "ADMIN") {
        return { error: "This is the last active admin — create another admin first." };
      }
      if (!data.active) {
        return { error: "This is the last active admin and cannot be deactivated." };
      }
    }
    if (id === admin.userId && !data.active) {
      return { error: "You cannot deactivate your own account." };
    }
  }

  const fields = {
    username: data.username,
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    role: data.role,
    storeId,
    active: data.active,
    ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
  };

  if (id) {
    await prisma.user.update({ where: { id }, data: fields });
  } else {
    await prisma.user.create({
      data: { ...fields, passwordHash: fields.passwordHash! },
    });
  }

  revalidatePath("/stores");
  redirect("/stores");
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  const admin = await requireAdmin();
  if (!active) {
    if (id === admin.userId) redirect("/stores?error=self-deactivate");
    if (await isLastActiveAdmin(id)) redirect("/stores?error=last-admin");
  }
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/stores");
}
