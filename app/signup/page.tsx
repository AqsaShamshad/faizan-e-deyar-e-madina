import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account" };

export const instant = false;

export default async function SignupPage() {
  const session = await auth();
  if (session?.user.role === "SUPER_ADMIN") redirect("/admin");
  if (session?.user.role === "MOSQUE_ADMIN" && session.user.tenantId) redirect("/dashboard");
  if (session?.user.role === "USER") redirect("/account");

  return (
    <main className="login-page">
      <section className="login-panel">
        <Link href="/login" aria-label="Minbar sign in" className="brand-symbol"><span /></Link>
        <p className="eyebrow">MOSQUE SCREEN / ACCOUNT</p>
        <h1>Create your account</h1>
        <p className="login-copy">Register for a standard user account. Mosque administrator access is assigned separately.</p>
        <SignupForm />
        <p className="login-footnote">Account registration never grants mosque or platform administrator access.</p>
      </section>
    </main>
  );
}