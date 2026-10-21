"use client";

import Image from "next/image";
import { useActionState, useTransition } from "react";
import {
  createLogo, createNewsItem, createSlide, deleteLogo, deleteNewsItem, deleteSlide,
  importPrayerCsv, saveAzanTimings, savePrayerTime, setNewsItemActive, setSlideActive,
  updateNewsItem, updateSlide,
  type ImportResult,
} from "./actions";

const prayerFields = [
  ["fajrStart", "Fajr start"], ["fajrAzan", "Fajr azan"], ["fajrJamat", "Fajr jamat"],
  ["zuhrStart", "Zuhr start"], ["zuhrAzan", "Zuhr azan"], ["zuhrJamat", "Zuhr jamat"],
  ["asrStart", "Asr start"], ["asrAzan", "Asr azan"], ["asrJamat", "Asr jamat"],
  ["maghribStart", "Maghrib start"], ["maghribAzan", "Maghrib azan"], ["maghribJamat", "Maghrib jamat"],
  ["ishaStart", "Isha start"], ["ishaAzan", "Isha azan"], ["ishaJamat", "Isha jamat"],
  ["sunrise", "Sunrise"], ["chaasht", "Chaasht"], ["zawal", "Zawal"], ["jumua", "Jumua"],
] as const;
const csvHeaders = ["date", ...prayerFields.map(([name]) => name)];
const initialImport: ImportResult = { message: "", errors: [], imported: 0 };

type Schedule = { id: string; date: string; timings: Record<string, string> };
type News = { id: string; text: string; position: number; isActive: boolean };
type Slide = { id: string; fileName: string; duration: number; position: number; isActive: boolean };
type Logo = { id: string; fileName: string };

export function DashboardModules({
  schedules, azanTimings, newsItems, slides, logos, firstSchedule,
}: {
  schedules: Schedule[];
  azanTimings: Record<string, string>;
  newsItems: News[];
  slides: Slide[];
  logos: Logo[];
  firstSchedule: { date: string; timings: Record<string, string> } | null;
}) {
  const [importResult, importAction, importing] = useActionState(importPrayerCsv, initialImport);
  const defaultDate = firstSchedule?.date ?? new Date().toISOString().slice(0, 10);

  function downloadTemplate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const rows = Array.from({ length: days }, (_, index) => {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
      return [date, ...csvHeaders.slice(1).map(() => "")].join(",");
    });
    const blob = new Blob([[csvHeaders.join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prayer-timetable-${year}-${String(month + 1).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="module-stack">
      <section className="module-section" id="prayer-times">
        <header className="module-heading"><div><p className="eyebrow">SCHEDULE</p><h2>Prayer times</h2><p>Enter the daily start, azan and jamat times for your congregation.</p></div></header>
        <div className="module-grid module-grid-schedule">
          <div className="module-panel">
            <h3>{firstSchedule ? "Update a day" : "Add a day"}</h3>
            <form action={savePrayerTime} className="module-form">
              <label className="field"><span>Date</span><input type="date" name="date" required defaultValue={defaultDate} /></label>
              <div className="time-input-grid">{prayerFields.map(([name, label]) => <label className="field" key={name}><span>{label}</span><input type="time" name={name} required defaultValue={firstSchedule?.timings[name] ?? "05:00"} /></label>)}</div>
              <button className="button button-primary" type="submit">Save prayer times</button>
            </form>
          </div>
          <div className="module-panel csv-panel">
            <h3>Upload a timetable</h3>
            <p>Import a full month in one go. Every row is checked before anything is saved.</p>
            <button className="button button-secondary" type="button" onClick={downloadTemplate}>Download this month’s CSV template</button>
            <form action={importAction} className="module-form csv-form">
              <label className="field"><span>Timetable CSV</span><input type="file" name="file" accept=".csv,text/csv" required /></label>
              <button className="button button-primary" type="submit" disabled={importing}>{importing ? "Checking timetable…" : "Upload timetable"}</button>
            </form>
            {importResult.message && <div className={`import-result ${importResult.errors.length ? "import-errors" : ""}`} role="status"><strong>{importResult.message}</strong>{importResult.errors.length > 0 && <ul>{importResult.errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>}</div>}
          </div>
        </div>
        {schedules.length === 0 ? <EmptyState text="No prayer times have been added yet." /> : <div className="module-table-wrap"><table className="module-table"><thead><tr><th>Date</th>{prayerFields.slice(0, 15).map(([name, label]) => <th key={name}>{label}</th>)}</tr></thead><tbody>{schedules.slice(0, 14).map((schedule) => <tr key={schedule.id}><td>{new Date(`${schedule.date}T00:00:00`).toLocaleDateString("en-GB", { dateStyle: "medium" })}</td>{prayerFields.slice(0, 15).map(([name]) => <td key={name}>{schedule.timings[name] ?? "—"}</td>)}</tr>)}</tbody></table></div>}
      </section>

      <section className="module-section" id="azan-times">
        <header className="module-heading"><div><p className="eyebrow">CALL TO PRAYER</p><h2>Azan timings</h2><p>Set the daily azan times displayed on your screen.</p></div></header>
        <div className="module-panel">
          <form action={saveAzanTimings} className="module-form">
            <div className="form-grid">{["fajr", "zuhr", "asr", "maghrib", "isha", "jumua"].map((name) => <label className="field" key={name}><span>{name === "jumua" ? "Jumua" : `${name[0].toUpperCase()}${name.slice(1)}`}</span><input type="time" name={name} required defaultValue={azanTimings[name] ?? "12:30"} /></label>)}</div>
            <button className="button button-primary" type="submit">Save azan timings</button>
          </form>
        </div>
      </section>

      <section className="module-section" id="news-ticker">
        <header className="module-heading"><div><p className="eyebrow">ON-SCREEN MESSAGES</p><h2>News ticker</h2><p>Add announcements and choose their order on the display.</p></div></header>
        <div className="module-panel"><form action={createNewsItem} className="news-create"><label className="field"><span>Announcement</span><input name="text" maxLength={500} required placeholder="For example: Community dinner after Maghrib" /></label><button className="button button-primary" type="submit">Add announcement</button></form>
          {newsItems.length ? <div className="managed-list">{newsItems.map((item) => <ManagedNews key={item.id} item={item} />)}</div> : <EmptyState text="No ticker announcements yet. Add the first one above." />}
        </div>
      </section>

      <section className="module-section" id="slides">
        <header className="module-heading"><div><p className="eyebrow">DISPLAY CONTENT</p><h2>Screen slides</h2><p>Upload images, set display duration and arrange their order.</p></div></header>
        <div className="module-panel"><form action={createSlide} className="news-create upload-create"><label className="field"><span>Slide image</span><input type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label><label className="field"><span>Duration in seconds</span><input type="number" name="duration" min={5} max={120} defaultValue={10} required /></label><button className="button button-primary" type="submit">Upload slide</button><small>JPEG, PNG or WebP. Maximum 4 MB per image.</small></form>
          {slides.length ? <div className="managed-list">{slides.map((slide) => <ManagedSlide key={slide.id} slide={slide} />)}</div> : <EmptyState text="No screen slides uploaded yet." />}
        </div>
      </section>

      <section className="module-section" id="logos">
        <header className="module-heading"><div><p className="eyebrow">MOSQUE IDENTITY</p><h2>Logos</h2><p>Upload a mosque logo for use on the display.</p></div></header>
        <div className="module-panel"><form action={createLogo} className="news-create upload-create"><label className="field"><span>Logo image</span><input type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label><button className="button button-primary" type="submit">Upload logo</button><small>JPEG, PNG or WebP. Maximum 4 MB per image.</small></form>
          {logos.length ? <div className="logo-list">{logos.map((logo) => <ManagedLogo key={logo.id} logo={logo} />)}</div> : <EmptyState text="No logo uploaded yet. Add your mosque’s logo above." />}
        </div>
      </section>
    </div>
  );
}

function ManagedNews({ item }: { item: News }) {
  const [pending, startTransition] = useTransition();
  return <article className="managed-row"><div className="managed-copy"><strong>{item.text}</strong><small>Position {item.position + 1} · {item.isActive ? "Shown on screen" : "Hidden from screen"}</small></div><form action={updateNewsItem.bind(null, item.id)} className="managed-order"><label className="sr-only" htmlFor={`news-order-${item.id}`}>Ticker position</label><input id={`news-order-${item.id}`} type="number" name="position" min="0" max="10000" defaultValue={item.position} /><input type="hidden" name="text" value={item.text} /><button className="button button-quiet" type="submit">Save order</button></form><button className="button button-quiet" type="button" disabled={pending} onClick={() => startTransition(() => setNewsItemActive(item.id, !item.isActive))}>{item.isActive ? "Hide" : "Show"}</button><form action={deleteNewsItem.bind(null, item.id)} onSubmit={(event) => { if (!window.confirm("Remove this ticker announcement?")) event.preventDefault(); }}><button className="button button-danger" type="submit">Remove</button></form></article>;
}

function ManagedSlide({ slide }: { slide: Slide }) {
  const [pending, startTransition] = useTransition();
  return <article className="managed-row"><Image className="slide-preview" src={`/dashboard/assets/slide/${slide.id}`} alt="" width={72} height={48} unoptimized /><div className="managed-copy"><strong>{slide.fileName}</strong><small>{slide.duration} seconds · Position {slide.position + 1} · {slide.isActive ? "Shown" : "Hidden"}</small></div><form action={updateSlide.bind(null, slide.id)} className="managed-order"><label className="sr-only" htmlFor={`slide-position-${slide.id}`}>Slide position</label><input id={`slide-position-${slide.id}`} type="number" name="position" min="0" max="10000" defaultValue={slide.position} /><label className="sr-only" htmlFor={`slide-duration-${slide.id}`}>Duration in seconds</label><input id={`slide-duration-${slide.id}`} type="number" name="duration" min="5" max="120" defaultValue={slide.duration} /><button className="button button-quiet" type="submit">Save</button></form><button className="button button-quiet" type="button" disabled={pending} onClick={() => startTransition(() => setSlideActive(slide.id, !slide.isActive))}>{slide.isActive ? "Hide" : "Show"}</button><form action={deleteSlide.bind(null, slide.id)} onSubmit={(event) => { if (!window.confirm("Remove this slide?")) event.preventDefault(); }}><button className="button button-danger" type="submit">Remove</button></form></article>;
}

function ManagedLogo({ logo }: { logo: Logo }) {
  return <article className="logo-item"><Image src={`/dashboard/assets/logo/${logo.id}`} alt={`${logo.fileName} logo`} width={100} height={70} unoptimized /><strong>{logo.fileName}</strong><form action={deleteLogo.bind(null, logo.id)} onSubmit={(event) => { if (!window.confirm("Remove this logo?")) event.preventDefault(); }}><button className="button button-danger" type="submit">Remove</button></form></article>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="module-empty">{text}</p>;
}