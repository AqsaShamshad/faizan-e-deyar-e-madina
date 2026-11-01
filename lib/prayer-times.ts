const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function prayerTimingRecord(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        entry[0] !== "jumua" && entry[0] !== "jumuaTimes" && typeof entry[1] === "string",
    ),
  );
}

export function getJumuaTimes(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  const values = Array.isArray(record.jumuaTimes)
    ? record.jumuaTimes
    : typeof record.jumua === "string"
      ? [record.jumua]
      : [];
  return values
    .filter((time): time is string => typeof time === "string" && timePattern.test(time))
    .sort();
}
