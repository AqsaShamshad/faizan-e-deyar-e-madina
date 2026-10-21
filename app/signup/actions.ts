"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type SignupState = { error?: string };

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.email("Enter a valid email address.").transform((email) => email.trim().toLowerCase()),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});

export async function createAccount(_previous: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const { name, email, password } = parsed.data;
  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return { error: "An account could not be created with those details. Try signing in or use another email." };

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({ data: { name, email, passwordHash, role: "USER" } });
  } catch {
    return { error: "Account creation is temporarily unavailable. Check the database connection and try again." };
  }

  redirect("/login?registered=1");
}