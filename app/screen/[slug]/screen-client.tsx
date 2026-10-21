"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { PublicScreenData } from "@/lib/public-screen";

const prayerRows = [
  { key: "fajr", label: "Fajr" },
  { key: "zuhr", label: "Zuhr" },
  { key: "asr", label: "Asr" },
  { key: "maghrib", label: "Maghrib" },
  { key: "isha", label: "Isha" },
] as const;
const noSlides: NonNullable<PublicScreenData["slides"]> = [];

type Props = { screenId: string; initialData: PublicScreenData };

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

function clockMinutes(date: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(values.find(({ type }) => type === "hour")?.value ?? 0);
  const minute = Number(values.find(({ type }) => type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function getNextPrayer(data: PublicScreenData, now: Date) {
  const zone = data.timeZone ?? "UTC";
  const today = localDateKey(now, zone);
  const todaySchedule = data.schedules?.find((schedule) => schedule.date === today);
  const currentMinute = clockMinutes(now, zone);
  for (const prayer of prayerRows) {
    const time = todaySchedule?.timings[`${prayer.key}Azan`];
    if (time) {
      const [hour, minute] = time.split(":").map(Number);
      if (hour * 60 + minute > currentMinute) return prayer.key;
    }
  }
  const tomorrow = new Date(`${today}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  return data.schedules?.some((schedule) => schedule.date === tomorrowKey && schedule.timings.fajrAzan)
    ? "fajr"
    : null;
}

function formatTime(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone, ...options }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(date);
  }
}

export function PrayerScreen({ screenId, initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [now, setNow] = useState<Date | null>(null);
  const [offline, setOffline] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const schedule = useMemo(() => {
    if (!now) return undefined;
    const today = localDateKey(now, data.timeZone ?? "UTC");
    return data.schedules?.find((item) => item.date === today);
  }, [data.schedules, data.timeZone, now]);
  const nextPrayer = now ? getNextPrayer(data, now) : null;
  const slides = data.slides ?? noSlides;
  const activeSlide = slides[slideIndex % Math.max(slides.length, 1)];

  useEffect(() => {
    const cacheKey = `mosque-screen:${screenId}`;
    const clockTimer = window.setInterval(() => setNow(new Date()), 1000);

    let disposed = false;
    const refresh = async () => {
      try {
        const response = await fetch(`/screen/${encodeURIComponent(screenId)}/data`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not refresh the display.");
        const latest = (await response.json()) as PublicScreenData;
        if (disposed) return;
        if (latest.status !== "active") {
          setData({ status: "inactive" });
          setOffline(false);
          window.localStorage.removeItem(cacheKey);
          return;
        }
        setData(latest);
        setOffline(false);
        window.localStorage.setItem(cacheKey, JSON.stringify(latest));
      } catch {
        if (!disposed) {
          const cached = window.localStorage.getItem(cacheKey);
          if (cached) {
            try {
              const parsed = JSON.parse(cached) as PublicScreenData;
              if (parsed.status === "active" && parsed.timeZone) setData(parsed);
            } catch {
              window.localStorage.removeItem(cacheKey);
            }
          }
          setOffline(true);
        }
      }
    };
    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener("online", refresh);
    return () => {
      disposed = true;
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
      window.removeEventListener("online", refresh);
    };
  }, [screenId]);

  useEffect(() => {
    if (!activeSlide || slides.length < 2) return;
    const timer = window.setInterval(() => setSlideIndex((index) => (index + 1) % slides.length), activeSlide.duration * 1000);
    return () => window.clearInterval(timer);
  }, [activeSlide, slides]);

  if (data.status !== "active") return <InactiveScreen />;
  const zone = data.timeZone ?? "UTC";
  const messages = data.news ?? [];

  return (
    <main className="screen-frame" aria-label={`${data.tenantName ?? "Mosque"} prayer display`}>
      <header className="screen-header">
        <div className="screen-identity">
          {data.logoId ? <Image className="screen-logo" src={`/screen/${encodeURIComponent(screenId)}/assets/logo/${data.logoId}`} alt="" width={74} height={74} unoptimized /> : <span className="screen-mark" aria-hidden="true">م</span>}
          <div><p className="screen-kicker">PRAYER TIMES</p><h1>{data.tenantName}</h1><span className="screen-zone">{zone.replaceAll("_", " ")}</span></div>
        </div>
        <div className="screen-clock" aria-label="Current time and date">
          <time>{now ? formatTime(now, zone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "--:--"}</time>
          <span>{now ? formatTime(now, zone, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}</span>
          {offline && <small className="screen-connection" role="status">Offline · showing saved timetable</small>}
        </div>
      </header>

      <div className="screen-main">
        <section className="screen-prayers" aria-label="Today's prayer times">
          <div className="screen-section-head"><div><p className="screen-kicker">DAILY SCHEDULE</p><h2>Today at the mosque</h2></div><span className="screen-date">{now ? formatTime(now, zone, { day: "2-digit", month: "short" }) : ""}</span></div>
          <div className="screen-prayer-table">
            <div className="screen-prayer-head"><span>Prayer</span><span>Start</span><span>Azan</span><span>Jamat</span></div>
            {prayerRows.map((prayer) => {
              const current = prayer.key === nextPrayer;
              return <div className={`screen-prayer-row${current ? " screen-prayer-next" : ""}`} key={prayer.key} aria-current={current ? "true" : undefined}>
                <strong>{prayer.label}{current && <small> NEXT</small>}</strong>
                <span>{schedule?.timings[`${prayer.key}Start`] ?? "—"}</span>
                <span>{schedule?.timings[`${prayer.key}Azan`] ?? "—"}</span>
                <span>{schedule?.timings[`${prayer.key}Jamat`] ?? "—"}</span>
              </div>;
            })}
          </div>
          <div className="screen-sun-times"><span><small>SUNRISE</small><strong>{schedule?.timings.sunrise ?? "—"}</strong></span><span><small>CHAASHT</small><strong>{schedule?.timings.chaasht ?? "—"}</strong></span><span><small>ZAWAL</small><strong>{schedule?.timings.zawal ?? "—"}</strong></span><span><small>JUMUA</small><strong>{schedule?.timings.jumua ?? "—"}</strong></span></div>
          {!schedule && <p className="screen-missing">Today’s timetable has not been added yet.</p>}
          {nextPrayer === null && schedule && <p className="screen-missing">All prayers for today have passed.</p>}
        </section>

        <aside className="screen-media" aria-label="Mosque announcements and slides">
          {activeSlide ? <Image className="screen-slide" key={activeSlide.id} src={`/screen/${encodeURIComponent(screenId)}/assets/slide/${activeSlide.id}`} alt="Mosque announcement" fill unoptimized priority /> : <div className="screen-slide-empty"><span className="screen-mark" aria-hidden="true">م</span><p>{messages.length ? "Community announcements" : "May your day be blessed"}</p></div>}
          {slides.length > 1 && <span className="screen-slide-count">{(slideIndex % slides.length) + 1} / {slides.length}</span>}
        </aside>
      </div>

      <footer className="screen-ticker" aria-label="Mosque announcements">
        <span className="ticker-label">ANNOUNCEMENTS</span>
        <div className="ticker-window">{messages.length ? <div className="ticker-track">{[...messages, ...messages].map((message, index) => <span key={`${message.id}-${index}`}>{message.text}<i /></span>)}</div> : <p>There are no announcements at this time.</p>}</div>
      </footer>
    </main>
  );
}

export function InactiveScreen() {
  return <main className="screen-inactive"><span className="inactive-mark" aria-hidden="true">م</span><p className="screen-kicker">MOSQUE SCREEN</p><h1>This screen is not active</h1><p>Please contact the mosque administrator for more information.</p></main>;
}