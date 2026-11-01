import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Building2, LayoutDashboard, Settings2, ShieldCheck } from "lucide-react";
import { logout } from "./logout-action";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") redirect("/login");

  return <div className="admin-shell">
    <aside className="sidebar">
      <a href="/admin" className="brand-lockup"><span className="brand-symbol"><span /></span><span><strong>Faizan-e-deyar-e-Madinah</strong><small>MOSQUE SCREENS</small></span></a>
      <div className="sidebar-label">WORKSPACE</div>
      <nav aria-label="Main navigation"><a className="nav-item" href="/admin"><LayoutDashboard size={17} />Overview</a><a className="nav-item nav-active" href="/admin"><Building2 size={17} />Mosque accounts<span className="nav-count">01</span></a></nav>
      <div className="sidebar-bottom"><div className="secure-label"><ShieldCheck size={16} /><span>Protected workspace</span></div><div className="account-chip"><span className="account-initial">{session.user.name?.slice(0, 1).toUpperCase() ?? "A"}</span><span><strong>{session.user.name ?? "Administrator"}</strong><small>Super administrator</small></span><Settings2 size={16} /></div><form action={logout}><button className="logout-button">Sign out</button></form></div>
    </aside>
    <div className="admin-content"><header className="topbar"><span>Platform administration</span><span className="topbar-status"><i />Systems operational</span></header>{children}</div>
  </div>;
}