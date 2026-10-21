"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { z } from "zod";

export async function authenticate(_previous: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const values = z.object({ email: z.email(), password: z.string().min(1) }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!values.success) return { error: "Enter a valid email and password." };

  try {
    await signIn("credentials", { ...values.data, redirectTo: "/login/complete" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Those credentials could not be verified." };
    throw error;
  }
  redirect("/login/complete");
}