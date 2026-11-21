import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Building2, LayoutDashboard, Settings2, ShieldCheck } from "lucide-react";
import { logout } from "./logout-action";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/login");

  const name = session.user.name ?? "Administrator";

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link href="/admin" className="brand-lockup">
          <span className="brand-symbol"><span /></span>
          <span>
            <strong>Faizan-e-Deyar-e-Madinah</strong>
            <small>MOSQUE SCREENS</small>
          </span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <Link className="nav-item" href="/admin">
            <LayoutDashboard size={17} />
            Overview
          </Link>
          <Link className="nav-item nav-active" href="/admin" aria-current="page">
            <Building2 size={17} />
            Mosque accounts
            <span className="nav-count">01</span>
          </Link>
        </nav>

        <div className="sidebar-bottom">
          <div className="secure-label">
            <ShieldCheck size={16} />
            <span>Protected workspace</span>
          </div>

          <div className="account-chip">
            <span className="account-initial">{name.slice(0, 1).toUpperCase()}</span>
            <span className="account-meta">
              <strong>{name}</strong>
              <small>Super administrator</small>
            </span>
            <Settings2 size={16} />
          </div>
        </div>
      </aside>

      <div className="admin-content">
        <header className="topbar py-5">
          <span>Platform administration</span>
          <div className="admin-topbar-actions ">
            {/* <span className="topbar-status"><i />Systems operational</span> */}
            <form action={logout} className="mobile-topbar-signout">
              <button className="button button-secondary" type="submit">Sign out</button>
            </form>
          </div>
        </header>

        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}