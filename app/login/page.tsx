import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await connection();
  const { registered, reauth } = await searchParams;
  const session = await auth();
  if (reauth !== "1") {
    if (session?.user.role === "SUPER_ADMIN") redirect("/admin");
    if (session?.user.role === "MOSQUE_ADMIN" && session.user.tenantId) redirect("/dashboard");
    if (session?.user.role === "USER") redirect("/account");
  }

  return <main className="login-page"><section className="login-panel">
    <div className="brand-symbol"><span /></div>
    <p className="eyebrow">MOSQUE SCREEN / ADMINISTRATION</p>
    <h1>Welcome back</h1>
    <p className="login-copy">Sign in to your Minbar account.</p>
    {reauth === "1" && <p className="signup-success" role="status">Your session no longer matches an active mosque administrator account. Please sign in again.</p>}
    {registered === "1" && <p className="signup-success" role="status">Account created. Sign in with your new credentials.</p>}
    <LoginForm />
    <p className="login-footnote">Access is restricted to authorized administrators.</p>
  </section></main>;
}