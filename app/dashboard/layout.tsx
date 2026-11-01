import { Building2, CalendarDays, Clock3, Images, Megaphone, MonitorPlay, ShieldCheck } from "lucide-react";
import Link from "next/link";
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
				<Link href="/dashboard" className="brand-lockup">
					<span className="brand-symbol" aria-hidden="true"><span /></span>
					<span><strong>Faizan-e-deyar-e-Madinah</strong><small>MOSQUE SCREENS</small></span>
				</Link>
				<div className="sidebar-label">SCREEN CONTENT</div>
				<nav aria-label="Dashboard sections">
					<Link className="nav-item" href="/dashboard/prayer-times"><Clock3 size={17} />Prayer times</Link>
					<Link className="nav-item" href="/dashboard/monthly-calendar"><CalendarDays size={17} />Monthly calendar</Link>
					<Link className="nav-item" href="/dashboard/news-ticker"><Megaphone size={17} />News ticker</Link>
					<Link className="nav-item" href="/dashboard/screen-slides"><Images size={17} />Screen slides</Link>
					<Link className="nav-item" href="/dashboard/mosque-logos"><Building2 size={17} />Mosque logos</Link>
				</nav>
				<div className="sidebar-bottom">
					<div className="secure-label"><ShieldCheck size={16} /><span>Protected workspace</span></div>
					<div className="account-chip">
						<span className="account-initial"><Building2 size={15} aria-hidden="true" /></span>
						<span><strong>Mosque workspace</strong><small>Mosque administrator</small></span>
					</div>
					<form action={logout}><button className="logout-button" type="submit">Sign out</button></form>
				</div>
			</aside>
			<div className="admin-content">
				<header className="topbar">
					<span>Mosque workspace</span>
					<div className="dashboard-topbar-actions">
						<Link className="button button-secondary dashboard-screen-link" href={`/screen/${session.user.tenantId}`} target="_blank" rel="noopener noreferrer">
							<MonitorPlay size={15} aria-hidden="true" /> View screen
						</Link>
						<span className="topbar-status"><i />Screen workspace</span>
					</div>
				</header>
				{children}
			</div>
		</div>
	);
}
