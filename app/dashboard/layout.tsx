import { Building2, Clock3, Images, Megaphone, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { logout } from "../admin/logout-action";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
	await connection();
	const session = await auth();
	if (session?.user.role !== "MOSQUE_ADMIN" || !session.user.tenantId) redirect("/login");

	return (
		<div className="admin-shell">
			<aside className="sidebar">
				<a href="/dashboard" className="brand-lockup">
					<span className="brand-symbol" aria-hidden="true"><span /></span>
					<span><strong>Minbar</strong><small>MOSQUE SCREENS</small></span>
				</a>
				<div className="sidebar-label">SCREEN CONTENT</div>
				<nav aria-label="Dashboard sections">
					<a className="nav-item" href="/dashboard#prayer-times"><Clock3 size={17} />Prayer times</a>
					<a className="nav-item" href="/dashboard#azan-times"><Building2 size={17} />Azan timings</a>
					<a className="nav-item" href="/dashboard#news-ticker"><Megaphone size={17} />News ticker</a>
					<a className="nav-item" href="/dashboard#slides"><Images size={17} />Screen slides</a>
					<a className="nav-item" href="/dashboard#logos"><Building2 size={17} />Mosque logos</a>
				</nav>
				<div className="sidebar-bottom">
					<div className="secure-label"><ShieldCheck size={16} /><span>Protected workspace</span></div>
					<div className="account-chip">
						<span className="account-initial">{session.user.name?.slice(0, 1).toUpperCase() ?? "A"}</span>
						<span><strong>{session.user.name ?? "Administrator"}</strong><small>Mosque administrator</small></span>
					</div>
					<form action={logout}><button className="logout-button" type="submit">Sign out</button></form>
				</div>
			</aside>
			<div className="admin-content">
				<header className="topbar"><span>{session.user.name ?? "Mosque administrator"}</span><span className="topbar-status"><i />Screen workspace</span></header>
				{children}
			</div>
		</div>
	);
}
