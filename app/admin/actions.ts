"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { sendMosqueScreenLink } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { notDeletedTenantWhere } from "@/lib/tenant";

const passwordSchema = z.string().min(12, "Use at least 12 characters.");
const baseSchema = z.object({
  name: z.string().trim().min(2, "Enter the mosque name.").max(120),
  adminName: z.string().trim().min(2, "Enter an account name.").max(120),
  email: z.email("Enter a valid email address.").transform((value) => value.trim().toLowerCase()),
});

type ActionResult = { success: boolean; message: string; fieldErrors?: Record<string, string[]>; id?: string; screenUrl?: string; emailSent?: boolean };

async function requireSuperAdmin() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") throw new Error("Not authorized.");
}

function invalid(result: z.ZodError): ActionResult {
  return {
    success: false,
    message: "Check the highlighted fields.",
    fieldErrors: result.flatten().fieldErrors as Record<string, string[]>,
  };
}

export async function createTenantAccount(input: unknown): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = baseSchema.extend({ password: passwordSchema }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { name, adminName, email, password } = parsed.data;
  const emailConflict = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailConflict) return { success: false, message: "That email address is already in use.", fieldErrors: { email: ["Choose a different email."] } };

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const tenant = await prisma.$transaction(async (transaction) => {
      const tenant = await transaction.tenant.create({ data: { name, timeZone: "Europe/London", status: "ACTIVE" } });
      await transaction.user.create({ data: { name: adminName, email, passwordHash, role: "MOSQUE_ADMIN", tenantId: tenant.id } });
      return tenant;
    });
    const appUrl = process.env.APP_URL?.replace(/\/$/, "");
    const screenUrl = appUrl ? `${appUrl}/screen/${tenant.id}` : `/screen/${tenant.id}`;
    let emailSent = false;
    try {
      emailSent = await sendMosqueScreenLink({ to: email, name, url: screenUrl });
    } catch {
      emailSent = false;
    }
    revalidatePath("/admin");
    return {
      success: true,
      message: emailSent ? `${name} was added and the screen link was emailed.` : `${name} was added. Copy the screen link below and send it to the administrator.`,
      id: tenant.id,
      screenUrl,
      emailSent,
    };
  } catch {
    return { success: false, message: "The account could not be created. Check for a duplicate email or address." };
  }
}

export async function updateTenantAccount(id: string, input: unknown): Promise<ActionResult> {
  await requireSuperAdmin();
  const idResult = z.cuid().safeParse(id);
  const parsed = baseSchema.safeParse(input);
  if (!idResult.success || !parsed.success) return parsed.success ? { success: false, message: "Invalid account." } : invalid(parsed.error);

  const current = await prisma.tenant.findFirst({
    where: { id, ...notDeletedTenantWhere },
    include: { admins: { where: { role: "MOSQUE_ADMIN" }, take: 1 } },
  });
  const currentAdmin = current?.admins[0];
  if (!current || !currentAdmin) return { success: false, message: "This mosque account is no longer available." };
  const { name, adminName, email } = parsed.data;
  const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailOwner && emailOwner.id !== currentAdmin.id) return { success: false, message: "That email address is already in use.", fieldErrors: { email: ["Choose a different email."] } };

  await prisma.$transaction([
    prisma.tenant.update({ where: { id }, data: { name } }),
    prisma.user.update({ where: { id: currentAdmin.id }, data: { name: adminName, email } }),
  ]);
  revalidatePath("/admin");
  return { success: true, message: `${name} was updated.`, id };
}

export async function setTenantStatus(id: string, status: "ACTIVE" | "SUSPENDED"): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsedId = z.cuid().safeParse(id);
  const parsedStatus = z.enum(["ACTIVE", "SUSPENDED"]).safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return { success: false, message: "Invalid account." };
  const result = await prisma.tenant.updateMany({ where: { id, ...notDeletedTenantWhere }, data: { status: parsedStatus.data } });
  if (!result.count) return { success: false, message: "This mosque account is no longer available." };
  revalidatePath("/admin");
  return { success: true, message: `Mosque ${status === "ACTIVE" ? "reactivated" : "suspended"}.` };
}

export async function softDeleteTenant(id: string): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsedId = z.cuid().safeParse(id);
  if (!parsedId.success) return { success: false, message: "Invalid account." };
  const result = await prisma.tenant.updateMany({ where: { id, ...notDeletedTenantWhere }, data: { deletedAt: new Date() } });
  if (!result.count) return { success: false, message: "This mosque account is no longer available." };
  revalidatePath("/admin");
  return { success: true, message: "Mosque account deleted." };
}

export async function resetTenantPassword(id: string, password: string): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsedId = z.cuid().safeParse(id);
  const parsedPassword = passwordSchema.safeParse(password);
  if (!parsedId.success) return { success: false, message: "Invalid account." };
  if (!parsedPassword.success) return { success: false, message: parsedPassword.error.issues[0]?.message ?? "Choose a stronger password." };
  const tenant = await prisma.tenant.findFirst({
    where: { id, ...notDeletedTenantWhere },
    select: { admins: { where: { role: "MOSQUE_ADMIN" }, take: 1, select: { id: true } } },
  });
  const tenantAdmin = tenant?.admins[0];
  if (!tenantAdmin) return { success: false, message: "This mosque account is no longer available." };
  const passwordHash = await bcrypt.hash(parsedPassword.data, 12);
  await prisma.user.update({ where: { id: tenantAdmin.id }, data: { passwordHash } });
  revalidatePath("/admin");
  return { success: true, message: "Account password reset." };
}