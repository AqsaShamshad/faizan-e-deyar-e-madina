import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getJumuaTimes, prayerTimingRecord } from "@/lib/prayer-times";

const screenKeySchema = z.cuid();
const imageIdSchema = z.cuid();
const ringtoneIdSchema = z.cuid();
const timeValueSchema = z.union([
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  z.literal(""),
]);
const timingSchema = z.record(z.string(), z.union([timeValueSchema, z.array(timeValueSchema)]));

export type PublicSchedule = { date: string; timings: Record<string, string>; jumuaTimes: string[] };
export type PublicScreenData = {
  status: "active" | "inactive";
  tenantName?: string;
  timeZone?: string;
  schedules?: PublicSchedule[];
  news?: Array<{ id: string; text: string }>;
  slides?: Array<{ id: string; duration: number }>;
  logoId?: string;
  ringtoneId?: string;
  ringtoneContentType?: string;
};

function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function nextDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function getPublicScreenData(tenantId: string): Promise<PublicScreenData> {
  const validKey = screenKeySchema.safeParse(tenantId);
  if (!validKey.success) return { status: "inactive" };

  const tenant = await prisma.tenant.findUnique({
    where: { id: validKey.data },
    select: { id: true, name: true, timeZone: true, status: true, deletedAt: true },
  });
  if (!tenant || tenant.status !== "ACTIVE" || tenant.deletedAt) return { status: "inactive" };

  let today: string;
  try {
    today = localDateKey(new Date(), tenant.timeZone);
  } catch {
    return { status: "inactive" };
  }
  const start = new Date(`${today}T00:00:00.000Z`);
  const end = new Date(`${nextDateKey(today, 8)}T00:00:00.000Z`);

  const [prayerTimes, news, slides, logo, ringtone] = await Promise.all([
    prisma.prayerTime.findMany({
      where: { tenantId: tenant.id, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
      select: { date: true, timings: true },
    }),
    prisma.newsItem.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, text: true },
    }),
    prisma.slide.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, duration: true },
    }),
    prisma.logo.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.ringtone.findUnique({
      where: { tenantId: tenant.id },
      select: { id: true, contentType: true },
    }),
  ]);

  return {
    status: "active",
    tenantName: tenant.name,
    timeZone: tenant.timeZone,
    schedules: prayerTimes.flatMap(({ date, timings }) => {
      const parsed = timingSchema.safeParse(timings);
      return parsed.success
        ? [{
            date: date.toISOString().slice(0, 10),
            timings: prayerTimingRecord(parsed.data),
            jumuaTimes: getJumuaTimes(parsed.data),
          }]
        : [];
    }),
    news,
    slides,
    logoId: logo?.id,
    ringtoneId: ringtone?.id,
    ringtoneContentType: ringtone?.contentType,
  };
}

export async function getPublicScreenAsset(tenantId: string, kind: "slide" | "logo", id: string) {
  const validKey = screenKeySchema.safeParse(tenantId);
  if (!validKey.success || !imageIdSchema.safeParse(id).success) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: validKey.data },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!tenant || tenant.status !== "ACTIVE" || tenant.deletedAt) return null;

  if (kind === "slide") {
    return prisma.slide.findFirst({
      where: { id, tenantId: tenant.id, isActive: true },
      select: { image: true, contentType: true },
    });
  }

  return prisma.logo.findFirst({
    where: { id, tenantId: tenant.id },
    select: { image: true, contentType: true },
  });
}

export async function getPublicRingtoneAsset(tenantId: string, id: string) {
  const validKey = screenKeySchema.safeParse(tenantId);
  if (!validKey.success || !ringtoneIdSchema.safeParse(id).success) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: validKey.data },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!tenant || tenant.status !== "ACTIVE" || tenant.deletedAt) return null;

  return prisma.ringtone.findFirst({
    where: { id, tenantId: tenant.id },
    select: { audio: true, contentType: true },
  });
}