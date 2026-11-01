"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicScreenData } from "@/lib/public-screen";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Megaphone,
  MoonStar,
  Sun,
  Sunrise,
  Sunset,
  Timer,
  UsersRound,
  Volume2,
  VolumeX,
} from "lucide-react";

const prayerRows = [
  { key: "fajr", label: "Fajr", Icon: Sunrise },
  { key: "zuhr", label: "Zuhr", Icon: Sun },
  { key: "asr", label: "Asr", Icon: Sun },
  { key: "maghrib", label: "Maghrib", Icon: Sunset },
  { key: "isha", label: "Isha", Icon: MoonStar },
] as const;
const timingColumns = ["Start", "Jamat"] as const;
const noSlides: NonNullable<PublicScreenData["slides"]> = [];
const ringtoneDurationSeconds = 10;

type Props = { screenId: string; initialData: PublicScreenData };

function MosqueIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 21h18M5 21V10l2-2 2 2v11M15 21V10l2-2 2 2v11M9 11a3 3 0 0 1 6 0M12 8V4m0-1 1.25 1.25L12 5.5M10 21v-5a2 2 0 0 1 4 0v5" />
    </svg>
  );
}

function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
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
  const minute = Number(
    values.find(({ type }) => type === "minute")?.value ?? 0,
  );
  return hour * 60 + minute;
}

function getNextPrayer(data: PublicScreenData, now: Date) {
  const zone = data.timeZone ?? "UTC";
  const today = localDateKey(now, zone);
  const todaySchedule = data.schedules?.find(
    (schedule) => schedule.date === today,
  );
  const currentMinute = clockMinutes(now, zone);
  for (const prayer of prayerRows) {
    const time = todaySchedule?.timings[`${prayer.key}Azan`];
    if (time) {
      const [hour, minute] = time.split(":").map(Number);
      if (hour * 60 + minute > currentMinute)
        return { key: prayer.key, date: today };
    }
  }
  const tomorrow = new Date(`${today}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  return data.schedules?.some(
    (schedule) => schedule.date === tomorrowKey && schedule.timings.fajrAzan,
  )
    ? { key: "fajr", date: tomorrowKey }
    : null;
}

function formatTime(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(
      date,
    );
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      ...options,
    }).format(date);
  }
}

function displayTime(value: string | undefined) {
  if (!value) return "—";
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return value;

  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

export function PrayerScreen({ screenId, initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [now, setNow] = useState<Date | null>(null);
  const [offline, setOffline] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [soundMuted, setSoundMuted] = useState(false);
  const [soundMessage, setSoundMessage] = useState("");
  const [ringtoneSecondsRemaining, setRingtoneSecondsRemaining] = useState(0);
  const ringtoneRef = useRef<HTMLMediaElement>(null);
  const ringtoneStopTimer = useRef<number | null>(null);
  const pendingAlerts = useRef(new Set<string>());
  const handledAlerts = useRef(new Set<string>());
  const schedule = useMemo(() => {
    if (!now) return undefined;
    const today = localDateKey(now, data.timeZone ?? "UTC");
    return data.schedules?.find((item) => item.date === today);
  }, [data.schedules, data.timeZone, now]);
  const nextPrayer = now ? getNextPrayer(data, now) : null;
  const nextPrayerRow = prayerRows.find(
    (prayer) => prayer.key === nextPrayer?.key,
  );
  const slides = data.slides ?? noSlides;
  const activeSlide = slides[slideIndex % Math.max(slides.length, 1)];

  const startRingtone = useCallback(async () => {
    const ringtone = ringtoneRef.current;
    if (!ringtone) return false;

    if (ringtoneStopTimer.current !== null)
      window.clearTimeout(ringtoneStopTimer.current);
    ringtone.currentTime = 0;

    try {
      await ringtone.play();
    } catch {
      setRingtoneSecondsRemaining(0);
      setSoundMessage("Tap Test ringtone to retry audio on this screen.");
      return false;
    }

    setSoundMessage("");
    setRingtoneSecondsRemaining(ringtoneDurationSeconds);
    ringtoneStopTimer.current = window.setTimeout(() => {
      ringtone.pause();
      ringtone.currentTime = 0;
      ringtoneStopTimer.current = null;
      setRingtoneSecondsRemaining(0);
    }, ringtoneDurationSeconds * 1000);
    return true;
  }, []);

  useEffect(() => {
    const cacheKey = `mosque-screen:${screenId}`;
    const clockTimer = window.setInterval(() => setNow(new Date()), 1000);

    let disposed = false;
    let refreshing = false;
    const refresh = async () => {
      if (
        disposed ||
        refreshing ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      refreshing = true;
      try {
        const response = await fetch(
          `/screen/${encodeURIComponent(screenId)}/data`,
          { cache: "no-store" },
        );
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
              if (parsed.status === "active" && parsed.timeZone)
                setData(parsed);
            } catch {
              window.localStorage.removeItem(cacheKey);
            }
          }
          setOffline(true);
        }
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), 10_000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [screenId]);

  useEffect(() => {
    if (!activeSlide || slides.length < 2) return;
    const timer = window.setInterval(
      () => setSlideIndex((index) => (index + 1) % slides.length),
      activeSlide.duration * 1000,
    );
    return () => window.clearInterval(timer);
  }, [activeSlide, slides]);

  useEffect(() => {
    if (ringtoneSecondsRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setRingtoneSecondsRemaining((remaining) => Math.max(remaining - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ringtoneSecondsRemaining]);

  useEffect(
    () => () => {
      if (ringtoneStopTimer.current !== null)
        window.clearTimeout(ringtoneStopTimer.current);
      ringtoneRef.current?.pause();
    },
    [],
  );

  useEffect(() => {
    if (!now || data.status !== "active" || !data.ringtoneId) return;
    if (now.getSeconds() > 5) return;
    const zone = data.timeZone ?? "UTC";
    const date = localDateKey(now, zone);
    const todaySchedule = data.schedules?.find((item) => item.date === date);
    if (!todaySchedule) return;

    const minute = clockMinutes(now, zone);
    const dueAlerts: string[] = [];
    const markHandled = (key: string, value = "1") => {
      if (handledAlerts.current.has(key)) return false;
      handledAlerts.current.add(key);
      try {
        window.localStorage.setItem(`mosque-alert:${key}`, value);
      } catch {
        // In-memory de-duplication still protects this page session.
      }
      return true;
    };
    for (const prayer of prayerRows) {
      const startTime = todaySchedule.timings[`${prayer.key}Start`];
      const azanTime = todaySchedule.timings[`${prayer.key}Azan`];
      if (startTime && startTime === azanTime) {
        const [hour, minuteValue] = startTime.split(":").map(Number);
        if (hour * 60 + minuteValue !== minute) continue;

        const keys = ["Start", "Azan"].map(
          (alert) => `${screenId}:${date}:${prayer.key}:${alert}`,
        );
        markHandled(keys[0]);
        if (!handledAlerts.current.has(keys[1])) dueAlerts.push(keys[1]);
        continue;
      }
      for (const alert of ["Start", "Azan"] as const) {
        const time = todaySchedule.timings[`${prayer.key}${alert}`];
        if (!time) continue;
        const [hour, minuteValue] = time.split(":").map(Number);
        if (hour * 60 + minuteValue !== minute) continue;

        const key = `${screenId}:${date}:${prayer.key}:${alert}`;
        if (alert === "Start") markHandled(key);
        else if (!handledAlerts.current.has(key)) dueAlerts.push(key);
      }
    }

    if (!dueAlerts.length) return;
    const pendingAlertsForEffect = pendingAlerts.current;
    const newAlerts = dueAlerts.filter(
      (key) => !pendingAlertsForEffect.has(key),
    );
    if (!newAlerts.length) return;
    newAlerts.forEach((key) => pendingAlertsForEffect.add(key));

    let started = false;
    const timer = window.setTimeout(async () => {
      started = true;
      try {
        if (await startRingtone())
          newAlerts.forEach((key) => markHandled(key, "played"));
      } finally {
        newAlerts.forEach((key) => pendingAlertsForEffect.delete(key));
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      if (!started)
        newAlerts.forEach((key) => pendingAlertsForEffect.delete(key));
    };
  }, [data, now, screenId, startRingtone]);

  useEffect(() => {
    try {
      const prefix = `mosque-alert:${screenId}:`;
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key?.startsWith(prefix)) continue;
        const alertKey = key.slice("mosque-alert:".length);
        const value = window.localStorage.getItem(key);
        if (
          value === "played" ||
          (value === "1" && !alertKey.endsWith(":Azan"))
        ) {
          handledAlerts.current.add(alertKey);
        }
      }
    } catch {
      window.setTimeout(() => {
        setSoundMessage(
          "This browser cannot save alert history; alerts will only be de-duplicated until this page closes.",
        );
      }, 0);
    }
  }, [screenId]);

  if (data.status !== "active") return <InactiveScreen />;
  const zone = data.timeZone ?? "UTC";
  const messages = data.news ?? [];

  return (
    <main
      className="screen-frame"
      aria-label={`${data.tenantName ?? "Mosque"} prayer display`}
    >
      <header className="screen-header">
        <svg
          className="screen-skyline"
          viewBox="0 0 640 100"
          preserveAspectRatio="xMidYMax meet"
          aria-hidden="true"
        >
          <path
            d="M0 100V75h20V57h7v18h9V43h7v32h15V64h10v11h13V53h7v22h15V68h12v7h18V58h7v17h14V45h8v30h16V61h9v14h17V51h8v24h15V65h11v10h19V57h8v18h14V44h8v31h17V63h11v12h17V52h8v23h16V68h13v7h18V54h8v21h18V43h8v32h20V65h12v10h17V53h9v22h15V68h13v7h22V55h9v20h14V42h9v33h16V62h10v13h19V100Zm96-4h14V83l18-15 18 15v13h13V79l18-16 18 16v17h12V77l20-20 20 20v19h15V79l18-15 18 15v17h18V76l18-16 18 16v20h20V79l18-15 18 15v17h17V100H96Zm150-34V49l14-10 14 10v13Zm142 0V47l15-11 15 11v15Zm83 0V50l13-10 13 10v12Z"
            fill="currentColor"
          />
          <path
            d="M0 96h640v4H0zM318 54V38h4v16m-2-26 8 12h-16Z"
            fill="currentColor"
          />
        </svg>
        <span
          className="screen-ornament screen-ornament-top-left"
          aria-hidden="true"
        />
        <span
          className="screen-ornament screen-ornament-top-right"
          aria-hidden="true"
        />
        <div className="screen-identity">
          {data.logoId ? (
            <Image
              className="screen-logo"
              src={`/screen/${encodeURIComponent(screenId)}/assets/logo/${data.logoId}`}
              alt=""
              width={74}
              height={74}
              unoptimized
            />
          ) : (
            <span className="screen-mark">
              <MosqueIcon size={34} />
            </span>
          )}
          <div>
            <h1>{data.tenantName}</h1>
          </div>
        </div>
        <div className="screen-clock" aria-label="Current time">
          <Clock3 className="screen-clock-icon" aria-hidden="true" />
          <time>
            {now
              ? formatTime(now, zone, {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })
              : "--:--"}
          </time>
          {data.ringtoneId && (
            <div className="screen-audio-control">
              {data.ringtoneContentType === "video/mp4" ? (
                <video
                  ref={(element) => {
                    ringtoneRef.current = element;
                  }}
                  src={`/screen/${encodeURIComponent(screenId)}/assets/ringtone/${data.ringtoneId}`}
                  preload="auto"
                  playsInline
                  muted={soundMuted}
                />
              ) : (
                <audio
                  ref={(element) => {
                    ringtoneRef.current = element;
                  }}
                  src={`/screen/${encodeURIComponent(screenId)}/assets/ringtone/${data.ringtoneId}`}
                  preload="auto"
                  muted={soundMuted}
                />
              )}
              {ringtoneSecondsRemaining > 0 ? (
                <small role="status">
                  Azan audio playing · {ringtoneSecondsRemaining}s
                </small>
              ) : (
                <>
                  {soundMessage && <small role="status">{soundMessage}</small>}
                  <button
                    className="screen-audio-enable"
                    type="button"
                    onClick={() => void startRingtone()}
                  >
                    Test ringtone · 10 sec
                  </button>
                </>
              )}
            </div>
          )}
          {offline && (
            <small className="screen-connection" role="status">
              Offline · showing saved timetable
            </small>
          )}
        </div>
      </header>

      <div className="screen-main">
        <section
          className="screen-media"
          aria-label="Mosque image and announcements"
        >
          {activeSlide ? (
            <Image
              className="screen-slide"
              key={activeSlide.id}
              src={`/screen/${encodeURIComponent(screenId)}/assets/slide/${activeSlide.id}`}
              alt="Mosque announcement"
              fill
              unoptimized
              priority
            />
          ) : (
            <div className="screen-slide-empty">
              <span className="screen-mark">
                <MosqueIcon size={48} />
              </span>
            </div>
          )}

          {slides.length > 1 && (
            <>
              <button
                className="screen-carousel-control screen-carousel-previous"
                type="button"
                aria-label="Previous announcement"
                onClick={() =>
                  setSlideIndex(
                    (index) => (index - 1 + slides.length) % slides.length,
                  )
                }
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                className="screen-carousel-control screen-carousel-next"
                type="button"
                aria-label="Next announcement"
                onClick={() =>
                  setSlideIndex((index) => (index + 1) % slides.length)
                }
              >
                <ChevronRight aria-hidden="true" />
              </button>
              <div
                className="screen-slide-pagination"
                aria-label="Choose announcement"
              >
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    className={
                      index === slideIndex % slides.length
                        ? "screen-slide-dot screen-slide-dot-active"
                        : "screen-slide-dot"
                    }
                    aria-label={`Show announcement ${index + 1}`}
                    aria-current={
                      index === slideIndex % slides.length ? "true" : undefined
                    }
                    onClick={() => setSlideIndex(index)}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="screen-prayers" aria-label="Today's prayer times">
          <div className="screen-section-head">
            <div className="screen-prayer-title">
              <span className="screen-prayer-title-icon">
                <MosqueIcon size={23} />
              </span>
              <div className="screen-prayer-heading-copy">
                <span>DAILY SCHEDULE</span>
                <h2>Prayer Times</h2>
              </div>
            </div>
            {nextPrayer && nextPrayerRow && (
              <div className="screen-next-badge">
                <span>Next Prayer</span>
                <strong>
                  <MoonStar size={14} aria-hidden="true" />
                  {nextPrayerRow.label}
                </strong>
              </div>
            )}
          </div>
          <div className="screen-prayer-table">
            <div className="screen-prayer-head">
              <span>
                <MosqueIcon size={14} />
                Prayer
              </span>
              <span>
                <Clock3 size={12} aria-hidden="true" />
                Start Time
              </span>
              <span>
                <UsersRound size={12} aria-hidden="true" />
                Jammat
              </span>
              <span aria-hidden="true" />
            </div>
            {prayerRows.map((prayer) => {
              const current =
                prayer.key === nextPrayer?.key &&
                nextPrayer.date === schedule?.date;
              return (
                <div
                  className={`screen-prayer-row${current ? " screen-prayer-next" : ""}`}
                  key={prayer.key}
                  aria-current={current ? "true" : undefined}
                >
                  <strong>
                    <prayer.Icon size={18} aria-hidden="true" />
                    {prayer.label}
                  </strong>
                  {timingColumns.map((column) => {
                    const value = schedule?.timings[`${prayer.key}${column}`];
                    const emphasized =
                      column === "Start" &&
                      ["fajr", "maghrib", "isha"].includes(prayer.key);
                    return (
                      <span
                        className={
                          emphasized && value
                            ? "screen-prayer-time-emphasis"
                            : undefined
                        }
                        key={column}
                      >
                        {displayTime(value)}
                      </span>
                    );
                  })}
                  {/* <ChevronRight
                    className="screen-prayer-chevron"
                    size={16}
                    aria-hidden="true"
                  /> */}
                </div>
              );
            })}
          </div>
          {!schedule && (
            <p className="screen-missing">
              Today’s timetable has not been added yet.
            </p>
          )}
          {nextPrayer === null && schedule && (
            <p className="screen-missing">All prayers for today have passed.</p>
          )}
          <p className="screen-prayer-blessing">
            <i />
            May Allah accept our prayers
            <i />
          </p>
        </section>

        <aside
          className="screen-details"
          aria-label="Date and additional prayer times"
        >
          
          <div className="screen-extra-times">
            <div className="screen-extra-heading">
              <span className="screen-extra-heading-icon">
                <Clock3 aria-hidden="true" />
              </span>
              <h2>Additional Times</h2>
              <i aria-hidden="true" />
            </div>
            <div className="screen-extra-row">
              <span>
                <i>
                  <Sunrise aria-hidden="true" />
                </i>
                Sunrise
              </span>
              <strong>{displayTime(schedule?.timings.sunrise)}</strong>
            </div>
           <div className="screen-extra-row"><span><i><Timer aria-hidden="true" /></i>Chaasht</span><strong>{displayTime(schedule?.timings.chaasht)}</strong></div>
            <div className="screen-extra-row">
              <span>
                <i>
                  <Clock3 aria-hidden="true" />
                </i>
                Zawal
              </span>
              <strong>{displayTime(schedule?.timings.zawal)}</strong>
            </div>
            {schedule?.jumuaTimes.map((time, index) => (
              <div className="screen-extra-row" key={`${time}-${index}`}>
                <span>
                  <i>
                    <UsersRound aria-hidden="true" />
                  </i>
                  Jumua {index + 1}
                </span>
                <strong>{displayTime(time)}</strong>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <footer className="screen-ticker" aria-label="Mosque announcements">
        <span
          className="screen-ornament screen-ornament-bottom-right"
          aria-hidden="true"
        />
        <span className="ticker-label">
          <Megaphone size={17} aria-hidden="true" />
          ANNOUNCEMENTS
        </span>
        <div className="ticker-window">
          {messages.length ? (
            <div className="ticker-track">
              {[...messages, ...messages].map((message, index) => (
                <span key={`${message.id}-${index}`}>
                  {message.text}
                  <i />
                </span>
              ))}
            </div>
          ) : (
            <p>There are no announcements at this time.</p>
          )}
        </div>
        <button
          className="screen-audio-toggle"
          type="button"
          aria-label={
            soundMuted ? "Unmute prayer alerts" : "Mute prayer alerts"
          }
          aria-pressed={soundMuted}
          onClick={() => setSoundMuted((muted) => !muted)}
        >
          {soundMuted ? (
            <VolumeX aria-hidden="true" />
          ) : (
            <Volume2 aria-hidden="true" />
          )}
        </button>
      </footer>
    </main>
  );
}

export function InactiveScreen() {
  return (
    <main className="screen-inactive">
      <span className="inactive-mark">
        <MosqueIcon size={40} />
      </span>
      <p className="screen-kicker">MOSQUE SCREEN</p>
      <h1>This screen is not active</h1>
      <p>Please contact the mosque administrator for more information.</p>
    </main>
  );
}
