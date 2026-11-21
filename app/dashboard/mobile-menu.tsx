"use client";

import { Building2, CalendarDays, Clock3, Images, Menu, Megaphone, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Drawer } from "vaul";
import { logout } from "../admin/logout-action";

const sections = [
  { href: "/dashboard/prayer-times", label: "Prayer times", Icon: Clock3 },
  { href: "/dashboard/monthly-calendar", label: "Monthly calendar", Icon: CalendarDays },
  { href: "/dashboard/news-ticker", label: "News ticker", Icon: Megaphone },
  { href: "/dashboard/screen-slides", label: "Screen slides", Icon: Images },
  { href: "/dashboard/mosque-logos", label: "Mosque logos", Icon: Building2 },
];

export function MobileDashboardMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mobile-dashboard-menu">
      <Drawer.Root direction="left" open={open} onOpenChange={setOpen}>
        <Drawer.Trigger asChild>
          <button
            className="mobile-menu-toggle"
            type="button"
            aria-label={open ? "Close dashboard menu" : "Open dashboard menu"}
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="mobile-menu-overlay" />
          <Drawer.Content className="mobile-nav-drawer">
            <Drawer.Title className="mobile-nav-heading">SCREEN CONTENT</Drawer.Title>
            <Drawer.Description className="sr-only">
              Navigate to a dashboard section or sign out.
            </Drawer.Description>
            <nav id="mobile-dashboard-nav" aria-label="Dashboard sections">
              {sections.map(({ href, label, Icon }) => (
                <Drawer.Close asChild key={href}>
                  <Link className="nav-item" href={href}>
                    <Icon size={18} aria-hidden="true" />
                    {label}
                  </Link>
                </Drawer.Close>
              ))}
              <form action={logout} className="mobile-drawer-signout">
                <button className="logout-button" type="submit">Sign out</button>
              </form>
            </nav>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
