"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, such as 17:30.");
const prayers = ["fajr", "zuhr", "asr", "maghrib", "isha"] as const;
const scheduleFields = [
  ...prayers.flatMap((prayer) => [`${prayer}Start`, `${prayer}Azan`, `${prayer}Jamat`]),
  "sunrise", "chaasht", "zawal", "jumua",
] as const;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "Choose a valid calendar date.");

const scheduleSchema = z.object({
  date: dateSchema,
  ...Object.fromEntries(scheduleFields.map((field) => [field, timeSchema])),
});

const azanSchema = z.object({
  fajr: timeSchema,
  zuhr: timeSchema,
  asr: timeSchema,
  maghrib: timeSchema,
  isha: timeSchema,
  jumua: timeSchema,
});

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 4 * 1024 * 1024;

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

function assertPrayerOrder(values: Record<string, string>) {
  for (const prayer of prayers) {
    if (values[`${prayer}Azan`] < values[`${prayer}Start`]) {
      throw new Error(`${prayer[0].toUpperCase()}${prayer.slice(1)} azan cannot be before start.`);
    }
    if (values[`${prayer}Jamat`] < values[`${prayer}Azan`]) {
      throw new Error(`${prayer[0].toUpperCase()}${prayer.slice(1)} jamat cannot be before azan.`);
    }
  }
}

export async function savePrayerTime(formData: FormData) {
  const { tenantId, userId } = await requireMosqueTenant();
  const parsed = scheduleSchema.safeParse(formValues(formData, ["date", ...scheduleFields]));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the prayer times.");
  const { date: dateValue, ...values } = parsed.data;
  assertPrayerOrder(values);
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  await prisma.prayerTime.upsert({
    where: { tenantId_date: { tenantId, date } },
    create: { tenantId, date, timings: values },
    update: { timings: values },
  });
  await prisma.auditLog.create({ data: { tenantId, userId, action: "UPSERT", entity: "PrayerTime", details: { date: dateValue } } });
  revalidatePath("/dashboard");
}

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted value.");
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

export type ImportResult = { message: string; errors: string[]; imported: number };

export async function importPrayerCsv(_previous: ImportResult, formData: FormData): Promise<ImportResult> {
  const { tenantId, userId } = await requireMosqueTenant();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size || file.size > 1024 * 1024 || !file.name.toLowerCase().endsWith(".csv")) {
    return { message: "Choose a CSV file under 1 MB.", errors: [], imported: 0 };
  }

  let rows: string[][];
  try {
    rows = parseCsv(await file.text());
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Could not read this CSV.", errors: [], imported: 0 };
  }
  const headers = ["date", ...scheduleFields];
  if (rows.length < 2 || headers.some((header, index) => rows[0]?.[index] !== header) || rows[0]?.length !== headers.length) {
    return { message: "The CSV header does not match the monthly timetable template.", errors: [], imported: 0 };
  }

  const errors: string[] = [];
  const validRows: Array<{ date: Date; timings: Record<string, string> }> = [];
  const seenDates = new Set<string>();
  rows.slice(1).forEach((cells, rowIndex) => {
    const line = rowIndex + 2;
    if (cells.length !== headers.length) {
      errors.push(`Row ${line}: expected ${headers.length} columns.`);
      return;
    }
    const input = Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
    const parsed = scheduleSchema.safeParse(input);
    if (!parsed.success) {
      errors.push(`Row ${line}: ${parsed.error.issues[0]?.message ?? "invalid values"}`);
      return;
    }
    const { date: dateValue, ...timings } = parsed.data;
    try {
      assertPrayerOrder(timings);
    } catch (error) {
      errors.push(`Row ${line}: ${error instanceof Error ? error.message : "invalid prayer order"}`);
      return;
    }
    if (seenDates.has(dateValue)) {
      errors.push(`Row ${line}: duplicate date ${dateValue} in this file.`);
      return;
    }
    seenDates.add(dateValue);
    validRows.push({ date: new Date(`${dateValue}T00:00:00.000Z`), timings });
  });

  const existing = await prisma.prayerTime.findMany({
    where: { tenantId, date: { in: validRows.map((entry) => entry.date) } },
    select: { date: true },
  });
  const existingDates = new Set(existing.map(({ date }) => date.toISOString().slice(0, 10)));
  for (const { date } of validRows) {
    const key = date.toISOString().slice(0, 10);
    if (existingDates.has(key)) errors.push(`Date ${key} already has a timetable entry.`);
  }
  if (errors.length) return { message: "Nothing was imported. Correct the listed rows and upload again.", errors, imported: 0 };

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.prayerTime.createMany({ data: validRows.map(({ date, timings }) => ({ tenantId, date, timings })) });
      await transaction.auditLog.create({ data: { tenantId, userId, action: "IMPORT", entity: "PrayerTime", details: { count: validRows.length } } });
    });
  } catch {
    return { message: "Nothing was imported. A timetable date may have been added at the same time; reload and check the schedule.", errors: [], imported: 0 };
  }
  revalidatePath("/dashboard");
  return { message: `${validRows.length} timetable row${validRows.length === 1 ? "" : "s"} imported.`, errors: [], imported: validRows.length };
}

export async function saveAzanTimings(formData: FormData) {
  const { tenantId, userId } = await requireMosqueTenant();
  const parsed = azanSchema.safeParse(formValues(formData, ["fajr", "zuhr", "asr", "maghrib", "isha", "jumua"]));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the azan times.");
  await prisma.azanTime.upsert({
    where: { tenantId },
    create: { tenantId, timings: parsed.data },
    update: { timings: parsed.data },
  });
  await prisma.auditLog.create({ data: { tenantId, userId, action: "UPSERT", entity: "AzanTime" } });
  revalidatePath("/dashboard");
}

export async function createNewsItem(formData: FormData) {
  const { tenantId, userId } = await requireMosqueTenant();
  const text = z.string().trim().min(2).max(500).safeParse(formData.get("text"));
  if (!text.success) throw new Error("Enter ticker text between 2 and 500 characters.");
  const count = await prisma.newsItem.count({ where: { tenantId } });
  const item = await prisma.newsItem.create({ data: { tenantId, text: text.data, position: count } });
  await prisma.auditLog.create({ data: { tenantId, userId, action: "CREATE", entity: "NewsItem", entityId: item.id } });
  revalidatePath("/dashboard");
}

export async function updateNewsItem(id: string, formData: FormData) {
  const { tenantId } = await requireMosqueTenant();
  const parsedId = z.cuid().safeParse(id);
  const text = z.string().trim().min(2).max(500).safeParse(formData.get("text"));
  const position = z.coerce.number().int().min(0).max(10000).safeParse(formData.get("position"));
  if (!parsedId.success || !text.success || !position.success) throw new Error("Check the ticker item fields.");
  const updated = await prisma.newsItem.updateMany({ where: { id, tenantId }, data: { text: text.data, position: position.data } });
  if (!updated.count) throw new Error("Ticker item not found.");
  revalidatePath("/dashboard");
}

export async function setNewsItemActive(id: string, isActive: boolean) {
  const { tenantId } = await requireMosqueTenant();
  const parsed = z.object({ id: z.cuid(), isActive: z.boolean() }).safeParse({ id, isActive });
  if (!parsed.success) throw new Error("Invalid ticker item.");
  const updated = await prisma.newsItem.updateMany({ where: { id, tenantId }, data: { isActive } });
  if (!updated.count) throw new Error("Ticker item not found.");
  revalidatePath("/dashboard");
}

export async function deleteNewsItem(id: string) {
  const { tenantId } = await requireMosqueTenant();
  const parsed = z.cuid().safeParse(id);
  if (!parsed.success) throw new Error("Invalid ticker item.");
  await prisma.newsItem.deleteMany({ where: { id, tenantId } });
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
}

export async function updateSlide(id: string, formData: FormData) {
  const { tenantId } = await requireMosqueTenant();
  const parsedId = z.cuid().safeParse(id);
  const duration = z.coerce.number().int().min(5).max(120).safeParse(formData.get("duration"));
  const position = z.coerce.number().int().min(0).max(10000).safeParse(formData.get("position"));
  if (!parsedId.success || !duration.success || !position.success) throw new Error("Check the slide duration and order.");
  const updated = await prisma.slide.updateMany({ where: { id, tenantId }, data: { duration: duration.data, position: position.data } });
  if (!updated.count) throw new Error("Slide not found.");
  revalidatePath("/dashboard");
}

export async function setSlideActive(id: string, isActive: boolean) {
  const { tenantId } = await requireMosqueTenant();
  const parsed = z.object({ id: z.cuid(), isActive: z.boolean() }).safeParse({ id, isActive });
  if (!parsed.success) throw new Error("Invalid slide.");
  const updated = await prisma.slide.updateMany({ where: { id, tenantId }, data: { isActive } });
  if (!updated.count) throw new Error("Slide not found.");
  revalidatePath("/dashboard");
}

export async function deleteSlide(id: string) {
  const { tenantId } = await requireMosqueTenant();
  const parsed = z.cuid().safeParse(id);
  if (!parsed.success) throw new Error("Invalid slide.");
  await prisma.slide.deleteMany({ where: { id, tenantId } });
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
}

export async function deleteLogo(id: string) {
  const { tenantId } = await requireMosqueTenant();
  const parsed = z.cuid().safeParse(id);
  if (!parsed.success) throw new Error("Invalid logo.");
  await prisma.logo.deleteMany({ where: { id, tenantId } });
  revalidatePath("/dashboard");
}