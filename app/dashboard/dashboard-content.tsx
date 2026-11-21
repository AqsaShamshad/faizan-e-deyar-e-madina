import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { countries } from "countries-list";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notDeletedTenantWhere } from "@/lib/tenant";
import { getJumuaTimes, prayerTimingRecord } from "@/lib/prayer-times";
import { DashboardModules } from "./modules";

export type DashboardSection = "all" | "prayer-times" | "monthly-calendar" | "news-ticker" | "screen-slides" | "mosque-logos";

export async function DashboardContent({
  requestedTenantId,
  section = "all",
  editDate,
}: {
  requestedTenantId?: string;
  section?: DashboardSection;
  editDate?: string;
}) {
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
      timeZone: true,
      prayerCity: true,
      prayerCountry: true,
      prayerMethod: true,
      prayerSchool: true,
      slideshowPauseDuration: true,
      newsItems: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, text: true, position: true, isActive: true },
      },
      slides: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, fileName: true, duration: true, position: true, isActive: true },
      },
      logos: { orderBy: { createdAt: "desc" }, select: { id: true, fileName: true } },
      ringtone: { select: { id: true, fileName: true, contentType: true } },
    },
  });

  if (!tenant) notFound();

  const monthParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tenant.timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const monthValues = Object.fromEntries(monthParts.map(({ type, value }) => [type, value]));
  const initialMonth = `${monthValues.year}-${monthValues.month}`;
  const monthStart = new Date(`${initialMonth}-01T00:00:00.000Z`);
  const [year, month] = initialMonth.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const prayerTimes = await prisma.prayerTime.findMany({
    where: {
      tenantId,
      date: section === "monthly-calendar"
        ? { gte: monthStart, lt: monthEnd }
        : editDate
          ? new Date(`${editDate}T00:00:00.000Z`)
          : { gte: today },
    },
    orderBy: { date: "asc" },
    ...(section === "monthly-calendar" ? {} : { take: 31 }),
    select: { id: true, date: true, timings: true },
  });

  const schedules = prayerTimes.map((schedule) => ({
    id: schedule.id,
    date: schedule.date.toISOString().slice(0, 10),
    timings: prayerTimingRecord(schedule.timings),
    jumuaTimes: getJumuaTimes(schedule.timings),
  }));
  const firstSchedule = schedules[0] ?? null;
  const countryOptions = Object.entries(countries)
    .map(([code, country]) => ({ code, name: country.name }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return (
    <main className={`admin-main${section === "monthly-calendar" ? " monthly-calendar-main" : ""}`}>
      {/* <header className="admin-heading">
        <div>
          <p className="eyebrow">MOSQUE WORKSPACE</p>
          <h1>{tenant.name}</h1>
          <p className="heading-copy">Manage the prayer times and content shown on your mosque screen.</p>
        </div>
      </header> */}
      <DashboardModules
        section={section}
        schedules={schedules}
        prayerCity={tenant.prayerCity ?? ""}
        prayerCountry={tenant.prayerCountry ?? ""}
        countryOptions={countryOptions}
        prayerMethod={tenant.prayerMethod}
        prayerSchool={tenant.prayerSchool}
        slideshowPauseDuration={tenant.slideshowPauseDuration}
        initialMonth={initialMonth}
        newsItems={tenant.newsItems}
        slides={tenant.slides}
        logos={tenant.logos}
        ringtone={tenant.ringtone}
        firstSchedule={firstSchedule}
      />
    </main>
  );
}
