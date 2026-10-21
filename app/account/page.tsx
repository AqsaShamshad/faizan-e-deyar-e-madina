import { LogOut, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export const metadata = { title: "Your account" };

export const instant = false;

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "SUPER_ADMIN") redirect("/admin");
  if (session.user.role === "MOSQUE_ADMIN" && session.user.tenantId) redirect("/dashboard");
  if (session.user.role !== "USER") redirect("/login");

  return (
    <main className="login-page">
      <section className="login-panel account-panel">
        <div className="brand-symbol" aria-hidden="true"><span /></div>
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>Account created</h1>
        <p className="login-copy">You are signed in as {session.user.email}. This account does not have mosque administration access.</p>
        <div className="account-access-note"><UserRound size={17} /><span>To manage a mosque screen, ask your platform administrator to set up a mosque administrator account for you.</span></div>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="button button-secondary login-submit" type="submit"><LogOut size={16} /> Sign out</button>
        </form>
      </section>
    </main>
  );
}