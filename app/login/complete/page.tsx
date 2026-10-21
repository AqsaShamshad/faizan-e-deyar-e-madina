import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";

export const instant = false;

export default async function LoginCompletePage() {
  await connection();
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "SUPER_ADMIN") redirect("/admin");
  if (session.user.role === "MOSQUE_ADMIN" && session.user.tenantId) redirect("/dashboard");
  if (session.user.role === "USER") redirect("/account");
  redirect("/login");
}