"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { ArrowRight, Clock3, Eye, EyeOff, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import {
  createLogo, createNewsItem, createSlide, deleteLogo, deleteNewsItem, deleteRingtone, deleteSlide,
  importPrayerCalendar, savePrayerTime, saveSlideshowPauseDuration, setNewsItemActive, setSlideActive,
  saveRingtone, updateNewsItem, updateSlide,
  type CalendarImportResult,
} from "./actions";
import { CalendarLocationPicker, type CountryOption } from "./calendar-location-picker";
import type { DashboardSection } from "./dashboard-content";

const prayerFields = [
  ["fajrStart", "Fajr start"], ["fajrAzan", "Fajr azan"], ["fajrJamat", "Fajr Jamaat"],
  ["zuhrStart", "Zuhr start"], ["zuhrAzan", "Zuhr azan"], ["zuhrJamat", "Zuhr Jamaat"],
  ["asrStart", "Asr start"], ["asrAzan", "Asr azan"], ["asrJamat", "Asr Jamaat"],
  ["maghribStart", "Maghrib start"], ["maghribAzan", "Maghrib azan"], ["maghribJamat", "Maghrib Jamaat"],
  ["ishaStart", "Isha start"], ["ishaAzan", "Isha azan"], ["ishaJamat", "Isha Jamaat"],
  ["sunrise", "Sunrise"], ["chaasht", "Chaasht"], ["zawal", "Zawal"],
] as const;
const initialCalendarImport: CalendarImportResult = { message: "", imported: 0 };

type Schedule = { id: string; date: string; timings: Record<string, string>; jumuaTimes: string[] };
type News = { id: string; text: string; position: number; isActive: boolean };
type Slide = { id: string; fileName: string; duration: number; position: number; isActive: boolean };
type Logo = { id: string; fileName: string };
type Ringtone = { id: string; fileName: string; contentType: string } | null;

export function DashboardModules({
  section, schedules, prayerCity, prayerCountry, countryOptions, prayerMethod, prayerSchool, initialMonth,
  slideshowPauseDuration,
  newsItems, slides, logos, ringtone, firstSchedule,
}: {
  section: DashboardSection;
  schedules: Schedule[];
  prayerCity: string;
  prayerCountry: string;
  countryOptions: CountryOption[];
  prayerMethod: number;
  prayerSchool: number;
  initialMonth: string;
  slideshowPauseDuration: number;
  newsItems: News[];
  slides: Slide[];
  logos: Logo[];
  ringtone: Ringtone;
  firstSchedule: { date: string; timings: Record<string, string>; jumuaTimes: string[] } | null;
}) {
  const [importResult, importAction, importing] = useActionState(importPrayerCalendar, initialCalendarImport);
  const [calendarPage, setCalendarPage] = useState(0);
  const defaultDate = firstSchedule?.date ?? new Date().toISOString().slice(0, 10);
  const calendarPageSize = 10;
  const calendarPageCount = Math.ceil(schedules.length / calendarPageSize);
  const currentCalendarPage = Math.min(calendarPage, Math.max(0, calendarPageCount - 1));
  const visibleSchedules = schedules.slice(
    currentCalendarPage * calendarPageSize,
    (currentCalendarPage + 1) * calendarPageSize,
  );

  return (
    <div className="module-stack">
      {(section === "all" || section === "prayer-times") && (
      <section className="module-section" id="prayer-times">
        <header className="module-heading"><div><p className="eyebrow">SCHEDULE</p><h2>Prayer times</h2><p>Enter the daily start, azan and Jamaat times, and add all Jumua services for that date.</p></div></header>
        <div className="module-panel">
          <h3>{firstSchedule ? "Update a day" : "Add a day"}</h3>
          <PrayerTimeForm firstSchedule={firstSchedule} defaultDate={defaultDate} />
        </div>
        {/* <div className="module-panel ringtone-panel">
          <h3>Prayer ringtone</h3>
          <p>This sound plays once when each prayer reaches its Start time and again at its Azan time. If both times are the same, it plays once.</p>
          <form action={saveRingtone} className="news-create upload-create">
            <label className="field"><span>{ringtone ? "Replace audio file" : "Upload audio file"}</span><input type="file" name="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/wave,audio/vnd.wave,audio/ogg,audio/mp4,audio/x-m4a,audio/webm,video/mp4,.mp3,.wav,.ogg,.m4a,.mp4,.webm" required /></label>
            <button className="button button-primary" type="submit">{ringtone ? "Replace ringtone" : "Upload ringtone"}</button>
            <small>MP3, WAV, OGG, M4A, MP4 or WebM. Maximum 4 MB.</small>
          </form>
          {ringtone && <div className="managed-row ringtone-managed-row">
            <div className="managed-copy"><strong>{ringtone.fileName}</strong><small>Used for Start and Azan reminders</small></div>
            {ringtone.contentType === "video/mp4"
              ? <video controls preload="none" src={`/dashboard/assets/ringtone/${ringtone.id}`}>Your browser does not support MP4 playback.</video>
              : <audio controls preload="none" src={`/dashboard/assets/ringtone/${ringtone.id}`}>Your browser does not support audio playback.</audio>}
            <form action={deleteRingtone} onSubmit={(event) => { if (!window.confirm("Remove the prayer ringtone?")) event.preventDefault(); }}>
              <button className="button button-danger" type="submit">Remove</button>
            </form>
          </div>}
        </div> */}
      </section>
      )}

      {section === "monthly-calendar" && (
        <section className="module-section" id="monthly-calendar">
          <header className="module-heading"><div><p className="eyebrow">SCHEDULE</p><h2>Monthly calendar</h2><p>Generate calculated prayer times for a full month using AlAdhan.</p></div></header>
          <div className="module-panel csv-panel">
            <p>Azan, Jamaat and Jumua times are stored per date. Select Edit on a day to update its times. Existing Jamaat and Jumua times are preserved; new dates need Jamaat times entered manually.</p>
            <form action={importAction} className="module-form csv-form">
              <label className="field"><span>Month</span><input type="month" name="month" required defaultValue={initialMonth} /></label>
              <CalendarLocationPicker
                countries={countryOptions}
                initialCity={prayerCity}
                initialCountry={prayerCountry}
              />
              <div className="form-grid">
                <label className="field"><span>Calculation method</span><select name="method" defaultValue={prayerMethod}>
                  <option value={15}>Moonsighting Committee Worldwide</option>
                  <option value={3}>Muslim World League</option>
                  <option value={1}>University of Islamic Sciences, Karachi</option>
                  <option value={2}>ISNA</option>
                  <option value={4}>Umm Al-Qura, Makkah</option>
                  <option value={5}>Egyptian General Authority</option>
                </select></label>
                <label className="field"><span>Asr calculation</span><select name="school" defaultValue={prayerSchool}>
                  <option value={1}>Hanafi</option>
                  <option value={0}>Shafi&apos;i</option>
                </select></label>
              </div>
              <button className="button button-primary" type="submit" disabled={importing}>{importing ? "Generating calendar…" : "Generate calendar"}</button>
            </form>
            {importResult.message && <div className={`import-result ${importResult.imported ? "" : "import-errors"}`} role="status"><strong>{importResult.message}</strong></div>}
          </div>
          <h3 className="monthly-calendar-table-heading">This month&apos;s prayer times</h3>
          {schedules.length === 0
            ? <EmptyState text="No prayer times have been added for this month yet." />
            : <>
              <div className="module-table-wrap" role="region" aria-label="Monthly prayer times table. Scroll horizontally to see all columns." tabIndex={0}>
                <table className="module-table">
                  <thead><tr><th>Date</th>{prayerFields.map(([name, label]) => <th key={name}>{label}</th>)}<th>Jumua times</th><th>Action</th></tr></thead>
                  <tbody>{visibleSchedules.map((schedule) => <tr key={schedule.id}>
                    <td>{new Date(`${schedule.date}T00:00:00`).toLocaleDateString("en-GB", { dateStyle: "medium" })}</td>
                    {prayerFields.map(([name]) => <td key={name}>{schedule.timings[name] || "—"}</td>)}
                    <td>{schedule.jumuaTimes.join(", ") || "—"}</td>
                    <td><Link className="button button-secondary calendar-edit-button" href={`/dashboard/prayer-times?date=${schedule.date}`}>Edit</Link></td>
                  </tr>)}</tbody>
                </table>
              </div>
              {calendarPageCount > 1 && <nav className="monthly-calendar-pagination" aria-label="Monthly prayer times pages">
                <span>Showing {currentCalendarPage * calendarPageSize + 1}–{Math.min((currentCalendarPage + 1) * calendarPageSize, schedules.length)} of {schedules.length} days</span>
                <div>
                  <button className="button button-secondary" type="button" disabled={currentCalendarPage === 0} onClick={() => setCalendarPage((page) => Math.max(0, page - 1))}>Previous</button>
                  <span aria-live="polite">Page {currentCalendarPage + 1} of {calendarPageCount}</span>
                  <button className="button button-secondary" type="button" disabled={currentCalendarPage >= calendarPageCount - 1} onClick={() => setCalendarPage((page) => Math.min(calendarPageCount - 1, page + 1))}>Next</button>
                </div>
              </nav>}
            </>}
        </section>
      )}

      {(section === "all" || section === "news-ticker") && (
      <section className="module-section" id="news-ticker">
        <header className="module-heading"><div><p className="eyebrow">ON-SCREEN MESSAGES</p><h2>News ticker</h2><p>Add announcements and choose their order on the display.</p></div></header>
        <div className="module-panel"><form action={createNewsItem} className="news-create"><label className="field"><span>Announcement</span><input name="text" maxLength={500} required placeholder="For example: Community dinner after Maghrib" /></label><button className="button button-primary" type="submit">Add announcement</button></form>
          {newsItems.length ? <div className="managed-list">{newsItems.map((item) => <ManagedNews key={item.id} item={item} />)}</div> : <EmptyState text="No ticker announcements yet. Add the first one above." />}
        </div>
      </section>
      )}

      {(section === "all" || section === "screen-slides") && (
      <section className="module-section" id="slides">
        <header className="module-heading"><div><p className="eyebrow">DISPLAY CONTENT</p><h2>Screen slides</h2><p>Upload images, set display duration and arrange their order.</p></div></header>
        <div className="module-panel">
          <form action={saveSlideshowPauseDuration} className="slide-display-settings">
            <div className="slide-pause-intro">
              <span className="slide-pause-icon"><Clock3 size={21} aria-hidden="true" /></span>
              <div>
                <p className="eyebrow">PRAYER-TIME DISPLAY</p>
                <h3>Pause slides when prayer begins</h3>
                <p>At the scheduled Start time, the current slide holds. The slideshow resumes automatically when the pause ends.</p>
              </div>
            </div>
            <div className="slide-pause-controls">
              <label className="field">
                <span>Pause length</span>
                <span className="slide-pause-input-wrap">
                  <input
                    id="slideshow-pause-duration"
                    type="number"
                    name="slideshowPauseDuration"
                    min={0}
                    max={120}
                    defaultValue={slideshowPauseDuration ?? 0}
                    required
                  />
                  <span>seconds</span>
                </span>
              </label>
              <button className="button button-secondary" type="submit"><Save size={15} aria-hidden="true" />Save setting</button>
            </div>
            <div className="slide-pause-example" aria-label="Example: prayer starts, the current slide pauses, then the slideshow resumes">
              <span className="slide-pause-example-label">EXAMPLE WITH 80 SECONDS</span>
              <span>Prayer starts</span>
              <ArrowRight size={15} aria-hidden="true" />
              <strong>Slide holds for 80 seconds</strong>
              <ArrowRight size={15} aria-hidden="true" />
              <span>Slides resume</span>
            </div>
            <p className="slide-pause-note">Set the pause to <strong>0 seconds</strong> to keep the slideshow running without pausing.</p>
          </form>
          <form action={createSlide} className="news-create upload-create">
            <label className="field"><span>Slide image</span><input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" required /></label>
            <label className="field"><span>Duration in seconds</span><input type="number" name="duration" min={5} max={120} defaultValue={10} required /></label>
            <button className="button button-primary" type="submit">Upload slide</button>
            <small>JPEG, PNG, WebP, HEIC or HEIF. HEIC/HEIF photos are converted to JPEG. Maximum 4 MB per image.</small>
          </form>
          {slides.length ? <div className="managed-list">{slides.map((slide) => <ManagedSlide key={slide.id} slide={slide} />)}</div> : <EmptyState text="No screen slides uploaded yet." />}
        </div>
      </section>
      )}

      {(section === "all" || section === "mosque-logos") && (
      <section className="module-section" id="logos">
        <header className="module-heading"><div><p className="eyebrow">MOSQUE IDENTITY</p><h2>Logos</h2><p>Upload a mosque logo for use on the display.</p></div></header>
        <div className="module-panel"><form action={createLogo} className="news-create upload-create"><label className="field"><span>Logo image</span><input type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label><button className="button button-primary" type="submit">Upload logo</button><small>JPEG, PNG or WebP. Maximum 4 MB per image.</small></form>
          {logos.length ? <div className="logo-list">{logos.map((logo) => <ManagedLogo key={logo.id} logo={logo} />)}</div> : <EmptyState text="No logo uploaded yet. Add your mosque’s logo above." />}
        </div>
      </section>
      )}
    </div>
  );
}

function PrayerTimeForm({
  firstSchedule,
  defaultDate,
}: {
  firstSchedule: { date: string; timings: Record<string, string>; jumuaTimes: string[] } | null;
  defaultDate: string;
}) {
  const [toast, setToast] = useState("");
  const [pending, startTransition] = useTransition();

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await savePrayerTime(formData);
        notify("Prayer times saved.");
      } catch (error) {
        notify(error instanceof Error ? error.message : "Unable to save prayer times.");
      }
    });
  }

  return (
    <>
      <form action={submit} className="module-form">
        <label className="field"><span>Date</span><input type="date" name="date" required defaultValue={defaultDate} /></label>
        <div className="time-input-grid">{prayerFields.map(([name, label]) => {
          const isOptional = name.endsWith("Jamat") || name === "sunrise" || name === "chaasht" || name === "zawal";
          return <label className="field" key={name}><span>{label}</span><input type="time" name={name} required={!isOptional} defaultValue={firstSchedule?.timings[name] ?? (isOptional ? "" : "05:00")} /></label>;
        })}</div>
        <JumuaTimeFields initialTimes={firstSchedule?.jumuaTimes ?? []} />
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending && <LoaderCircle className="spin" size={16} aria-hidden="true" />}
          {pending ? "Saving…" : "Save prayer times"}
        </button>
      </form>
      <div className={`toast ${toast ? "toast-visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}

function JumuaTimeFields({ initialTimes }: { initialTimes: string[] }) {
  const [times, setTimes] = useState(initialTimes.length ? initialTimes : [""]);

  return (
    <fieldset className="jumua-time-fields">
      <legend>Jumua times</legend>
      <div className="jumua-time-toolbar">
        <button className="button button-secondary jumua-add-button" type="button" onClick={() => setTimes((current) => [...current, ""])}>
          <Plus size={14} aria-hidden="true" />
          Add more
        </button>
      </div>
      {times.map((time, index) => (
        <div className="jumua-time-input" key={index}>
          <label className="field">
            <span>Jumua {index + 1}</span>
            <input
              type="time"
              name="jumuaTimes"
              value={time}
              onChange={(event) => setTimes((current) => current.map((value, row) => row === index ? event.target.value : value))}
            />
          </label>
          <button
            className="button button-quiet jumua-remove-button"
            type="button"
            disabled={times.length === 1}
            aria-label={`Remove Jumua time ${index + 1}`}
            title={`Remove Jumua time ${index + 1}`}
            onClick={() => setTimes((current) => current.filter((_, row) => row !== index))}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
    </fieldset>
  );
}

function ManagedNews({ item }: { item: News }) {
  const [pending, startTransition] = useTransition();
  return <article className="managed-row"><div className="managed-copy"><strong>{item.text}</strong><small>Position {item.position + 1} · {item.isActive ? "Shown on screen" : "Hidden from screen"}</small></div><form action={updateNewsItem.bind(null, item.id)} className="managed-order"><label className="sr-only" htmlFor={`news-order-${item.id}`}>Ticker position</label><input id={`news-order-${item.id}`} type="number" name="position" min="0" max="10000" defaultValue={item.position} /><input type="hidden" name="text" value={item.text} /><button className="button button-quiet" type="submit">Save order</button></form><button className="button button-quiet" type="button" disabled={pending} onClick={() => startTransition(() => setNewsItemActive(item.id, !item.isActive))}>{item.isActive ? "Hide" : "Show"}</button><form action={deleteNewsItem.bind(null, item.id)} onSubmit={(event) => { if (!window.confirm("Remove this ticker announcement?")) event.preventDefault(); }}><button className="button button-danger" type="submit">Remove</button></form></article>;
}

function ManagedSlide({ slide }: { slide: Slide }) {
  const [pending, startTransition] = useTransition();
  const [hasChanges, setHasChanges] = useState(false);

  function checkForChanges(form: HTMLFormElement) {
    const formData = new FormData(form);
    setHasChanges(
      Number(formData.get("position")) !== slide.position ||
      Number(formData.get("duration")) !== slide.duration,
    );
  }

  return (
    <article className="managed-row slide-managed-row">
      <div className="slide-card-header">
        <Image className="slide-preview" src={`/dashboard/assets/slide/${slide.id}`} alt="" width={72} height={48} unoptimized />
        <div className="slide-card-heading">
          <strong title={slide.fileName}>{slide.fileName}</strong>
          <span className={`slide-status-badge ${slide.isActive ? "slide-status-shown" : "slide-status-hidden"}`}>
            {slide.isActive ? "Shown" : "Hidden"}
          </span>
          <small className="slide-desktop-meta">
            {slide.duration} seconds · Position {slide.position + 1} · {slide.isActive ? "Shown" : "Hidden"}
          </small>
        </div>
      </div>
      <form
        action={updateSlide.bind(null, slide.id)}
        className="managed-order slide-edit-form"
        onChange={(event) => checkForChanges(event.currentTarget)}
      >
        <label className="slide-edit-field" htmlFor={`slide-position-${slide.id}`}>
          <span className="sr-only">Position</span>
          <input id={`slide-position-${slide.id}`} type="number" inputMode="numeric" name="position" min="0" max="10000" defaultValue={slide.position} required />
        </label>
        <label className="slide-edit-field" htmlFor={`slide-duration-${slide.id}`}>
          <span className="sr-only">Duration (sec)</span>
          <input id={`slide-duration-${slide.id}`} type="number" inputMode="numeric" name="duration" min="5" max="120" defaultValue={slide.duration} required />
        </label>
        <button className="button button-primary slide-save-button" type="submit" disabled={!hasChanges}>Save</button>
      </form>
      <div className="slide-actions">
        <button
          className="button button-quiet slide-icon-button"
          type="button"
          disabled={pending}
          aria-label={slide.isActive ? "Hide slide" : "Show slide"}
          title={slide.isActive ? "Hide slide" : "Show slide"}
          onClick={() => startTransition(() => setSlideActive(slide.id, !slide.isActive))}
        >
          {slide.isActive ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          <span className="slide-icon-label">{slide.isActive ? "Hide" : "Show"}</span>
        </button>
        <form action={deleteSlide.bind(null, slide.id)} onSubmit={(event) => { if (!window.confirm("Remove this slide?")) event.preventDefault(); }}>
          <button className="button button-danger slide-icon-button" type="submit" aria-label="Remove slide" title="Remove slide">
            <Trash2 size={18} aria-hidden="true" />
            <span className="slide-icon-label">Remove</span>
          </button>
        </form>
      </div>
    </article>
  );
}

function ManagedLogo({ logo }: { logo: Logo }) {
  return <article className="logo-item"><Image src={`/dashboard/assets/logo/${logo.id}`} alt={`${logo.fileName} logo`} width={100} height={70} unoptimized /><strong>{logo.fileName}</strong><form action={deleteLogo.bind(null, logo.id)} onSubmit={(event) => { if (!window.confirm("Remove this logo?")) event.preventDefault(); }}><button className="button button-danger" type="submit">Remove</button></form></article>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="module-empty">{text}</p>;
}