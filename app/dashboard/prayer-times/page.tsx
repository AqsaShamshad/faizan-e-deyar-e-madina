import { DashboardContent } from "../dashboard-content";

export const instant = false;

export default async function PrayerTimesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  const editDate = typeof date === "string" && isCalendarDate(date) ? date : undefined;
  return <DashboardContent section="prayer-times" editDate={editDate} />;
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
