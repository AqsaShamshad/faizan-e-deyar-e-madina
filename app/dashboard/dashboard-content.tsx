import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notDeletedTenantWhere } from "@/lib/tenant";
import { DashboardModules } from "./modules";

export async function DashboardContent({ requestedTenantId }: { requestedTenantId?: string }) {
  await connection();
  const session = await auth();
  if (session?.user.role !== "MOSQUE_ADMIN") redirect("/login");

  const tenantId = session.user.tenantId;
  if (!tenantId) redirect("/login?reauth=1");

  const currentAdmin = await prisma.user.findFirst({
    where: { id: session.user.id, role: "MOSQUE_ADMIN", tenantId },
    select: { id: true },
  });
  if (!currentAdmin) redirect("/login?reauth=1");
  if (requestedTenantId && requestedTenantId !== tenantId) redirect(`/dashboard/${tenantId}`);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, ...notDeletedTenantWhere, status: "ACTIVE" },
    select: {
      name: true,
      prayerTimes: {
        where: { date: { gte: today } },
        orderBy: { date: "asc" },
        take: 31,
        select: { id: true, date: true, timings: true },
      },
      azanTiming: { select: { timings: true } },
      newsItems: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, text: true, position: true, isActive: true },
      },
      slides: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, fileName: true, duration: true, position: true, isActive: true },
      },
      logos: { orderBy: { createdAt: "desc" }, select: { id: true, fileName: true } },
    },
  });

  if (!tenant) notFound();

  const schedules = tenant.prayerTimes.map((schedule) => ({
    id: schedule.id,
    date: schedule.date.toISOString().slice(0, 10),
    timings: stringRecord(schedule.timings),
  }));
  const firstSchedule = schedules[0] ?? null;

  return (
    <main className="admin-main">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">MOSQUE WORKSPACE</p>
          <h1>{tenant.name}</h1>
          <p className="heading-copy">Manage the prayer times and content shown on your mosque screen.</p>
        </div>
      </header>
      <DashboardModules
        schedules={schedules}
        azanTimings={stringRecord(tenant.azanTiming?.timings)}
        newsItems={tenant.newsItems}
        slides={tenant.slides}
        logos={tenant.logos}
        firstSchedule={firstSchedule}
      />
    </main>
  );
}

function stringRecord(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}