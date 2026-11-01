"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { sendMosqueAccountDetails } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { notDeletedTenantWhere } from "@/lib/tenant";

const passwordSchema = z.string().min(12, "Use at least 12 characters.");
const baseSchema = z.object({
  name: z.string().trim().min(2, "Enter the mosque name.").max(120),
  address: z.string().trim().max(300, "Address must be 300 characters or fewer.").optional().default("").transform((value) => value || null),
  contactNumber: z.string().trim().max(40, "Contact number must be 40 characters or fewer.").optional().default("").transform((value) => value || null),
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

  const { name, address, contactNumber, adminName, email, password } = parsed.data;
  const existingAdmin = await prisma.user.findUnique({
    where: { email },
    select: { role: true, tenantId: true, tenant: { select: { deletedAt: true } } },
  });
  if (existingAdmin?.role === "MOSQUE_ADMIN" && existingAdmin.tenantId && existingAdmin.tenant?.deletedAt) {
    const deletedTenantId = existingAdmin.tenantId;
    await prisma.$transaction(async (transaction) => {
      const deletedTenant = await transaction.tenant.findUnique({
        where: { id: deletedTenantId },
        select: { deletedAt: true },
      });
      if (!deletedTenant?.deletedAt) return;
      await transaction.user.deleteMany({ where: { tenantId: deletedTenantId } });
      await transaction.tenant.delete({ where: { id: deletedTenantId } });
    });
  }
  const emailConflict = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailConflict) return { success: false, message: "That email address is already in use.", fieldErrors: { email: ["Choose a different email."] } };

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const tenant = await prisma.$transaction(async (transaction) => {
      const tenant = await transaction.tenant.create({ data: { name, address, contactNumber, timeZone: "Europe/London", status: "ACTIVE" } });
      await transaction.user.create({ data: { name: adminName, email, passwordHash, role: "MOSQUE_ADMIN", tenantId: tenant.id } });
      return tenant;
    });
    const appUrl = process.env.APP_URL?.replace(/\/$/, "");
    const screenUrl = appUrl ? `${appUrl}/screen/${tenant.id}` : `/screen/${tenant.id}`;
    let emailSent = false;
    try {
      emailSent = await sendMosqueAccountDetails({ to: email, name, adminName, password, url: screenUrl });
    } catch {
      emailSent = false;
    }
    revalidatePath("/admin");
    return {
      success: true,
      message: emailSent ? `${name} was added and the screen and account details were emailed.` : `${name} was added, but the welcome email with account details could not be sent. Copy the screen link below and share the sign-in details securely.`,
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
  const { name, address, contactNumber, adminName, email } = parsed.data;
  const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailOwner && emailOwner.id !== currentAdmin.id) return { success: false, message: "That email address is already in use.", fieldErrors: { email: ["Choose a different email."] } };

  await prisma.$transaction([
    prisma.tenant.update({ where: { id }, data: { name, address, contactNumber } }),
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

export async function deleteTenantAccount(id: string): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsedId = z.cuid().safeParse(id);
  if (!parsedId.success) return { success: false, message: "Invalid account." };
  const deleted = await prisma.$transaction(async (transaction) => {
    const tenant = await transaction.tenant.findFirst({
      where: { id, ...notDeletedTenantWhere },
      select: { id: true },
    });
    if (!tenant) return false;
    await transaction.user.deleteMany({ where: { tenantId: id } });
    await transaction.tenant.delete({ where: { id } });
    return true;
  });
  if (!deleted) return { success: false, message: "This mosque account is no longer available." };
  revalidatePath("/admin");
  return { success: true, message: "Mosque account and its data permanently deleted." };
}

export async function resetTenantPassword(id: string, password: string): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsedId = z.cuid().safeParse(id);
  const parsedPassword = passwordSchema.safeParse(password);
  if (!parsedId.success) return { success: false, message: "Invalid account." };
  if (!parsedPassword.success) return { success: false, message: parsedPassword.error.issues[0]?.message ?? "Choose a stronger password." };
  const tenant = await prisma.tenant.findFirst({
    where: { id, ...notDeletedTenantWhere },
    select: {
      name: true,
      admins: { where: { role: "MOSQUE_ADMIN" }, take: 1, select: { id: true, name: true, email: true } },
    },
  });
  const tenantAdmin = tenant?.admins[0];
  if (!tenantAdmin) return { success: false, message: "This mosque account is no longer available." };
  const passwordHash = await bcrypt.hash(parsedPassword.data, 12);
  await prisma.user.update({ where: { id: tenantAdmin.id }, data: { passwordHash } });
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  const screenUrl = appUrl ? `${appUrl}/screen/${id}` : `/screen/${id}`;
  let emailSent = false;
  try {
    emailSent = await sendMosqueAccountDetails({
      to: tenantAdmin.email,
      name: tenant.name,
      adminName: tenantAdmin.name,
      password: parsedPassword.data,
      url: screenUrl,
    });
  } catch {
    emailSent = false;
  }
  revalidatePath("/admin");
  return {
    success: true,
    message: emailSent
      ? "Account password reset and login details emailed."
      : "Account password reset, but the email with login details could not be sent. Share the new password securely.",
    id,
    screenUrl,
    emailSent,
  };
}