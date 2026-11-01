"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getJumuaTimes, prayerTimingRecord } from "@/lib/prayer-times";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, such as 17:30.");
const prayers = ["fajr", "zuhr", "asr", "maghrib", "isha"] as const;
const scheduleFields = [
  ...prayers.flatMap((prayer) => [`${prayer}Start`, `${prayer}Azan`, `${prayer}Jamat`]),
  "sunrise", "chaasht", "zawal",
] as const;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "Choose a valid calendar date.");

const scheduleSchema = z.object({
  date: dateSchema,
  ...Object.fromEntries(scheduleFields.map((field) => [field, z.union([timeSchema, z.literal("")])])),
});

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 4 * 1024 * 1024;
const audioTypes = new Set([
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave", "audio/x-pn-wav",
  "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/webm", "video/mp4",
]);
const maxAudioSize = 4 * 1024 * 1024;
const calendarFormSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid month."),
  city: z.string().trim().min(2, "Enter a city.").max(100),
  country: z.string().trim().min(2, "Enter a country.").max(100),
  method: z.coerce.number().int().min(0).max(99),
  school: z.coerce.number().int().min(0).max(1),
});
const alAdhanCalendarSchema = z.object({
  code: z.number(),
  status: z.string(),
  data: z.array(z.object({
    timings: z.record(z.string(), z.string()),
    date: z.object({ gregorian: z.object({ date: z.string() }) }),
    meta: z.object({ timezone: z.string().optional() }).optional(),
  })),
});
async function requireMosqueTenant() {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (session?.user?.role !== "MOSQUE_ADMIN" || typeof tenantId !== "string" || !tenantId) {
    throw new Error("Not authorized.");
  }
  return { tenantId, userId: session.user.id };
}

function formValues(formData: FormData, fields: readonly string[]) {
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? "").trim()]));
}

function revalidateDashboard() {
  revalidatePath("/dashboard", "layout");
}

function assertPrayerOrder(values: Record<string, string>) {
  for (const prayer of prayers) {
    const start = values[`${prayer}Start`];
    const azan = values[`${prayer}Azan`];
    const jamat = values[`${prayer}Jamat`];
    if (!start || !azan) throw new Error(`Enter ${prayer[0].toUpperCase()}${prayer.slice(1)} start and azan times.`);
    if (azan < start) {
      throw new Error(`${prayer[0].toUpperCase()}${prayer.slice(1)} azan cannot be before start.`);
    }
    if (jamat && jamat < azan) {
      throw new Error(`${prayer[0].toUpperCase()}${prayer.slice(1)} jamat cannot be before azan.`);
    }
  }
}

export async function savePrayerTime(formData: FormData) {
  const { tenantId, userId } = await requireMosqueTenant();
  const parsed = scheduleSchema.safeParse(formValues(formData, ["date", ...scheduleFields]));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the prayer times.");
  const parsedJumuaTimes = z.array(z.union([timeSchema, z.literal("")])).safeParse(formData.getAll("jumuaTimes"));
  if (!parsedJumuaTimes.success) {
    throw new Error(parsedJumuaTimes.error.issues[0]?.message ?? "Check the Jumua times.");
  }
  const jumuaTimes = parsedJumuaTimes.data.filter(Boolean).sort();
  if (new Set(jumuaTimes).size !== jumuaTimes.length) {
    throw new Error("Each Jumua time must be unique.");
  }
  const { date: dateValue, ...values } = parsed.data;
  assertPrayerOrder(values);
  const timings = { ...values, jumuaTimes };
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  await prisma.prayerTime.upsert({
    where: { tenantId_date: { tenantId, date } },
    create: { tenantId, date, timings },
    update: { timings },
  });
  await prisma.auditLog.create({ data: { tenantId, userId, action: "UPSERT", entity: "PrayerTime", details: { date: dateValue } } });
  revalidateDashboard();
}

export type CalendarImportResult = { message: string; imported: number };

function apiTime(value: string | undefined) {
  const match = value?.match(/^([01]\d|2[0-3]):([0-5]\d)(?:\s|$)/);
  if (!match) throw new Error("AlAdhan returned an invalid prayer time.");
  return `${match[1]}:${match[2]}`;
}

export async function importPrayerCalendar(_previous: CalendarImportResult, formData: FormData): Promise<CalendarImportResult> {
  const { tenantId, userId } = await requireMosqueTenant();
  const parsed = calendarFormSchema.safeParse({
    month: formData.get("month"),
    city: formData.get("city"),
    country: formData.get("country"),
    method: formData.get("method"),
    school: formData.get("school"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check the calendar settings.", imported: 0 };

  const [year, month] = parsed.data.month.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const query = new URLSearchParams({
    city: parsed.data.city,
    country: parsed.data.country,
    method: String(parsed.data.method),
    school: String(parsed.data.school),
  });
  let response: Response;
  try {
    response = await fetch(`https://api.aladhan.com/v1/calendarByCity/${year}/${month}?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { message: "Could not connect to AlAdhan. Check your internet connection and try again.", imported: 0 };
  }
  if (!response.ok) return { message: `AlAdhan could not generate this calendar (HTTP ${response.status}). Check the city and country.`, imported: 0 };

  let apiData: unknown;
  try {
    apiData = await response.json();
  } catch {
    return { message: "AlAdhan returned an unreadable response. Please try again.", imported: 0 };
  }
  const calendar = alAdhanCalendarSchema.safeParse(apiData);
  const expectedDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (!calendar.success || calendar.data.code !== 200 || calendar.data.data.length !== expectedDays) {
    return { message: "AlAdhan did not return a complete calendar. No prayer times were changed.", imported: 0 };
  }

  const existing = await prisma.prayerTime.findMany({
    where: { tenantId, date: { gte: start, lt: end } },
    select: { date: true, timings: true },
  });
  const existingByDate = new Map(existing.map(({ date, timings }) => [date.toISOString().slice(0, 10), timings]));
  const seenDates = new Set<string>();
  const rows: Array<{ tenantId: string; date: Date; timings: Record<string, string | string[]> }> = [];
  let timeZone: string | undefined;
  const apiPrayerNames = { fajr: "Fajr", zuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" } as const;

  try {
    for (const day of calendar.data.data) {
      const dateParts = day.date.gregorian.date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (!dateParts) throw new Error("AlAdhan returned a date in an unsupported format.");
      const dateKey = `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}`;
      const date = new Date(`${dateKey}T00:00:00.000Z`);
      if (date < start || date >= end || seenDates.has(dateKey)) throw new Error("AlAdhan returned dates outside the selected month.");
      seenDates.add(dateKey);

      const previous = existingByDate.get(dateKey);
      const previousTimings = prayerTimingRecord(previous);
      const timings: Record<string, string> = {
        sunrise: apiTime(day.timings.Sunrise),
        chaasht: previousTimings.chaasht ?? "",
        zawal: previousTimings.zawal ?? "",
      };
      for (const [prayer, apiName] of Object.entries(apiPrayerNames)) {
        const time = apiTime(day.timings[apiName]);
        timings[`${prayer}Start`] = time;
        timings[`${prayer}Azan`] = time;
        timings[`${prayer}Jamat`] = previousTimings[`${prayer}Jamat`] ?? "";
      }
      rows.push({ tenantId, date, timings: { ...timings, jumuaTimes: getJumuaTimes(previous) } });
      timeZone ??= day.meta?.timezone;
    }
  } catch (error) {
    return { message: error instanceof Error ? error.message : "AlAdhan returned invalid calendar data.", imported: 0 };
  }

  if (rows.length !== expectedDays) return { message: "AlAdhan returned an incomplete calendar. No prayer times were changed.", imported: 0 };

  if (timeZone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone });
    } catch {
      return { message: "AlAdhan returned an invalid timezone. No prayer times were changed.", imported: 0 };
    }
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.prayerTime.deleteMany({ where: { tenantId, date: { gte: start, lt: end } } });
    await transaction.prayerTime.createMany({ data: rows });
    await transaction.tenant.update({
      where: { id: tenantId },
      data: {
        prayerCity: parsed.data.city,
        prayerCountry: parsed.data.country,
        prayerMethod: parsed.data.method,
        prayerSchool: parsed.data.school,
        ...(timeZone ? { timeZone } : {}),
      },
    });
    await transaction.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "IMPORT",
        entity: "PrayerTime",
        details: { count: rows.length, month: parsed.data.month, method: parsed.data.method, school: parsed.data.school },
      },
    });
  });
  revalidateDashboard();
  return {
    message: `${rows.length} calculated dates loaded. Existing Jamaat times were kept; enter Jamaat times for new dates manually.`,
    imported: rows.length,
  };
}

export async function createNewsItem(formData: FormData) {
  const { tenantId, userId } = await requireMosqueTenant();
  const text = z.string().trim().min(2).max(500).safeParse(formData.get("text"));
  if (!text.success) throw new Error("Enter ticker text between 2 and 500 characters.");
  const count = await prisma.newsItem.count({ where: { tenantId } });
  const item = await prisma.newsItem.create({ data: { tenantId, text: text.data, position: count } });
  await prisma.auditLog.create({ data: { tenantId, userId, action: "CREATE", entity: "NewsItem", entityId: item.id } });
  revalidateDashboard();
}

export async function updateNewsItem(id: string, formData: FormData) {
  const { tenantId } = await requireMosqueTenant();
  const parsedId = z.cuid().safeParse(id);
  const text = z.string().trim().min(2).max(500).safeParse(formData.get("text"));
  const position = z.coerce.number().int().min(0).max(10000).safeParse(formData.get("position"));
  if (!parsedId.success || !text.success || !position.success) throw new Error("Check the ticker item fields.");
  const updated = await prisma.newsItem.updateMany({ where: { id, tenantId }, data: { text: text.data, position: position.data } });
  if (!updated.count) throw new Error("Ticker item not found.");
  revalidateDashboard();
}

export async function setNewsItemActive(id: string, isActive: boolean) {
  const { tenantId } = await requireMosqueTenant();
  const parsed = z.object({ id: z.cuid(), isActive: z.boolean() }).safeParse({ id, isActive });
  if (!parsed.success) throw new Error("Invalid ticker item.");
  const updated = await prisma.newsItem.updateMany({ where: { id, tenantId }, data: { isActive } });
  if (!updated.count) throw new Error("Ticker item not found.");
  revalidateDashboard();
}

export async function deleteNewsItem(id: string) {
  const { tenantId } = await requireMosqueTenant();
  const parsed = z.cuid().safeParse(id);
  if (!parsed.success) throw new Error("Invalid ticker item.");
  await prisma.newsItem.deleteMany({ where: { id, tenantId } });
  revalidateDashboard();
}

export async function createSlide(formData: FormData) {
  const { tenantId, userId } = await requireMosqueTenant();
  const file = formData.get("file");
  const duration = z.coerce.number().int().min(5).max(120).safeParse(formData.get("duration"));
  if (!(file instanceof File) || !imageTypes.has(file.type) || file.size < 1 || file.size > maxImageSize || !duration.success) {
    throw new Error("Choose a JPEG, PNG, or WebP image under 4 MB and a duration from 5 to 120 seconds.");
  }
  const position = await prisma.slide.count({ where: { tenantId } });
  const slide = await prisma.slide.create({ data: {
    tenantId, fileName: file.name.slice(0, 255), contentType: file.type,
    image: new Uint8Array(await file.arrayBuffer()), duration: duration.data, position,
  } });
  await prisma.auditLog.create({ data: { tenantId, userId, action: "CREATE", entity: "Slide", entityId: slide.id } });
  revalidateDashboard();
}

export async function updateSlide(id: string, formData: FormData) {
  const { tenantId } = await requireMosqueTenant();
  const parsedId = z.cuid().safeParse(id);
  const duration = z.coerce.number().int().min(5).max(120).safeParse(formData.get("duration"));
  const position = z.coerce.number().int().min(0).max(10000).safeParse(formData.get("position"));
  if (!parsedId.success || !duration.success || !position.success) throw new Error("Check the slide duration and order.");
  const updated = await prisma.slide.updateMany({ where: { id, tenantId }, data: { duration: duration.data, position: position.data } });
  if (!updated.count) throw new Error("Slide not found.");
  revalidateDashboard();
}

export async function setSlideActive(id: string, isActive: boolean) {
  const { tenantId } = await requireMosqueTenant();
  const parsed = z.object({ id: z.cuid(), isActive: z.boolean() }).safeParse({ id, isActive });
  if (!parsed.success) throw new Error("Invalid slide.");
  const updated = await prisma.slide.updateMany({ where: { id, tenantId }, data: { isActive } });
  if (!updated.count) throw new Error("Slide not found.");
  revalidateDashboard();
}

export async function deleteSlide(id: string) {
  const { tenantId } = await requireMosqueTenant();
  const parsed = z.cuid().safeParse(id);
  if (!parsed.success) throw new Error("Invalid slide.");
  await prisma.slide.deleteMany({ where: { id, tenantId } });
  revalidateDashboard();
}

export async function createLogo(formData: FormData) {
  const { tenantId, userId } = await requireMosqueTenant();
  const file = formData.get("file");
  if (!(file instanceof File) || !imageTypes.has(file.type) || file.size < 1 || file.size > maxImageSize) {
    throw new Error("Choose a JPEG, PNG, or WebP image under 4 MB.");
  }
  const logo = await prisma.logo.create({ data: {
    tenantId, fileName: file.name.slice(0, 255), contentType: file.type,
    image: new Uint8Array(await file.arrayBuffer()),
  } });
  await prisma.auditLog.create({ data: { tenantId, userId, action: "CREATE", entity: "Logo", entityId: logo.id } });
  revalidateDashboard();
}

export async function deleteLogo(id: string) {
  const { tenantId } = await requireMosqueTenant();
  const parsed = z.cuid().safeParse(id);
  if (!parsed.success) throw new Error("Invalid logo.");
  await prisma.logo.deleteMany({ where: { id, tenantId } });
  revalidateDashboard();
}

export async function saveRingtone(formData: FormData) {
  const { tenantId, userId } = await requireMosqueTenant();
  const file = formData.get("file");
  if (!(file instanceof File) || !audioTypes.has(file.type) || file.size < 1 || file.size > maxAudioSize) {
    throw new Error("Choose an MP3, WAV, OGG, M4A, or WebM audio file under 4 MB.");
  }
  const audio = new Uint8Array(await file.arrayBuffer());

  const ringtone = await prisma.ringtone.upsert({
    where: { tenantId },
    create: {
      tenantId,
      fileName: file.name.slice(0, 255),
      contentType: file.type,
      audio,
    },
    update: {
      fileName: file.name.slice(0, 255),
      contentType: file.type,
      audio,
    },
    select: { id: true },
  });
  await prisma.auditLog.create({
    data: { tenantId, userId, action: "UPSERT", entity: "Ringtone", entityId: ringtone.id },
  });
  revalidateDashboard();
}

export async function deleteRingtone() {
  const { tenantId, userId } = await requireMosqueTenant();
  const ringtone = await prisma.ringtone.findUnique({ where: { tenantId }, select: { id: true } });
  if (!ringtone) throw new Error("Ringtone not found.");
  await prisma.$transaction([
    prisma.ringtone.delete({ where: { tenantId } }),
    prisma.auditLog.create({
      data: { tenantId, userId, action: "DELETE", entity: "Ringtone", entityId: ringtone.id },
    }),
  ]);
  revalidateDashboard();
}