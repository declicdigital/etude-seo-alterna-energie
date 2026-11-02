/**
 * Calendriers des newsletters (rubrique « Calendriers newsletters »).
 * Chaque calendrier a ses étapes, son équipe et ses newsletters datées.
 * Les statuts se déduisent uniquement des dates et du jour courant.
 */

export type Actor = { label: string; short: string; people: string };

export type Step = {
  key: string;
  label: string;
  short: string;
  from: string;
  /** Absent for a step done within one team (e.g. writing by Communication). */
  to?: string;
};

export type Newsletter = { id: string; month: number; year: number; dates: string[] };

/** `people` is omitted when the person has no role label (shown by name only). */
export type TeamMember = { role: string; people?: string; step: number };

/* ── Cadences ─────────────────────────────────────────────────────────────
 * Newsletters after the dated 2026 plan are generated from each calendar's
 * cadence: a send day per month and fixed offsets (in days) for each step.
 * Deadlines only fall on working days: a date on a weekend or French public
 * holiday moves to the previous working day, or to the next one if moving
 * earlier would reach the previous step's date (as done in 2026 for 8 May
 * and 11 November).
 */

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function shiftDay(iso: string, days: number): string {
  const d = parseDay(iso);
  return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/** Easter Sunday (Gregorian calendar, anonymous algorithm). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const FIXED_HOLIDAYS = ["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"];

/** French public holidays: fixed ones plus Easter Monday, Ascension, Whit Monday. */
export function isPublicHoliday(iso: string): boolean {
  if (FIXED_HOLIDAYS.includes(iso.slice(5))) return true;
  const easter = toIso(easterSunday(Number(iso.slice(0, 4))));
  return [1, 39, 50].some((offset) => shiftDay(easter, offset) === iso);
}

export function isWorkingDay(iso: string): boolean {
  const day = parseDay(iso).getDay();
  return day !== 0 && day !== 6 && !isPublicHoliday(iso);
}

function workingDayFrom(iso: string, direction: 1 | -1): string {
  let d = iso;
  while (!isWorkingDay(d)) d = shiftDay(d, direction);
  return d;
}

/** Moves each date to a working day, keeping the steps in order. */
export function toWorkingDays(dates: string[]): string[] {
  const out: string[] = [];
  dates.forEach((iso, i) => {
    let d = iso;
    if (!isWorkingDay(d)) {
      d = workingDayFrom(iso, -1);
      if (i > 0 && d <= out[i - 1]) d = workingDayFrom(iso, 1);
    }
    out.push(i > 0 && d < out[i - 1] ? out[i - 1] : d);
  });
  return out;
}

type Cadence = {
  /** Nominal send date for a month (before working-day adjustment). */
  sendDay: (year: number, month: number) => string;
  /** Day offsets of each step from the send date, in step order. */
  offsets: number[];
};

function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  fromDay: number,
  nth = 1,
): string {
  const first = new Date(year, month - 1, fromDay);
  const delta = (weekday - first.getDay() + 7) % 7;
  return toIso(new Date(year, month - 1, fromDay + delta + 7 * (nth - 1)));
}

/** Monthly, sent on the first Thursday from the 3rd; steps Mon J-17 → Thu. */
export const GRANDS_COMPTES_CADENCE: Cadence = {
  sendDay: (year, month) => nthWeekday(year, month, 4, 3),
  offsets: [-17, -15, -8, -3, -2, 0],
};

/** Quarterly, sent on the third Monday; steps Fri J-10 → Mon. */
export const INTERNE_CADENCE: Cadence = {
  sendDay: (year, month) => nthWeekday(year, month, 1, 1, 3),
  offsets: [-10, -6, -6, -5, 0],
};

export function generateNewsletters(
  cadence: Cadence,
  year: number,
  months: number[],
): Newsletter[] {
  return months.map((month) => {
    const send = cadence.sendDay(year, month);
    return {
      id: `${year}-${String(month).padStart(2, "0")}`,
      month,
      year,
      dates: toWorkingDays(cadence.offsets.map((o) => shiftDay(send, o))),
    };
  });
}

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const QUARTER_MONTHS = [2, 5, 8, 11];

export type NewsletterCalendar = {
  id: "grands-comptes" | "interne";
  title: string;
  description: string;
  actors: Record<string, Actor>;
  steps: Step[];
  /** Who's who; `step` borrows that step's colour for the chip. */
  team: TeamMember[];
  newsletters: Newsletter[];
};

export const GRANDS_COMPTES: NewsletterCalendar = {
  id: "grands-comptes",
  title: "Grands Comptes",
  description: "Production et envoi de la newsletter mensuelle Grands Comptes.",
  actors: {
    presta: { label: "Prestataire", short: "Presta", people: "Watt's Next" },
    b2b: { label: "B2B", short: "B2B", people: "Guillaume" },
    comm: { label: "Communication", short: "Comm.", people: "Geoffrey & Matthieu" },
    clients: { label: "Clients", short: "Clients", people: "Clients Grands Comptes" },
  },
  steps: [
    {
      key: "proposition",
      label: "Proposition de sujets",
      short: "Sujets",
      from: "presta",
      to: "b2b",
    },
    {
      key: "validation",
      label: "Validation / ajustement",
      short: "Validation",
      from: "b2b",
      to: "presta",
    },
    {
      key: "redaction",
      label: "Envoi de la rédaction",
      short: "Rédaction",
      from: "presta",
      to: "b2b",
    },
    {
      key: "relecture",
      label: "Relecture & modifications",
      short: "Relecture",
      from: "b2b",
      to: "comm",
    },
    { key: "bat", label: "BAT", short: "BAT", from: "comm", to: "b2b" },
    { key: "envoi", label: "Envoi de la newsletter", short: "Envoi", from: "comm", to: "clients" },
  ],
  team: [
    { role: "Prestataire", people: "Watt's Next", step: 0 },
    { role: "B2B", people: "Guillaume", step: 1 },
    { role: "Relecture", people: "Lidvine & Guillaume", step: 3 },
    { role: "Communication", people: "Geoffrey & Matthieu", step: 4 },
  ],
  newsletters: [
    {
      id: "2026-03",
      month: 3,
      year: 2026,
      dates: ["2026-02-18", "2026-02-23", "2026-03-02", "2026-03-04", "2026-03-04", "2026-03-05"],
    },
    {
      id: "2026-04",
      month: 4,
      year: 2026,
      dates: ["2026-03-18", "2026-03-23", "2026-04-02", "2026-04-04", "2026-04-04", "2026-04-05"],
    },
    {
      id: "2026-05",
      month: 5,
      year: 2026,
      dates: ["2026-04-20", "2026-04-23", "2026-04-29", "2026-05-04", "2026-05-05", "2026-05-07"],
    },
    {
      id: "2026-06",
      month: 6,
      year: 2026,
      dates: ["2026-05-18", "2026-05-20", "2026-05-27", "2026-06-01", "2026-06-02", "2026-06-04"],
    },
    {
      id: "2026-07",
      month: 7,
      year: 2026,
      dates: ["2026-06-22", "2026-06-24", "2026-07-01", "2026-07-06", "2026-07-06", "2026-07-09"],
    },
    {
      id: "2026-08",
      month: 8,
      year: 2026,
      dates: ["2026-07-20", "2026-07-22", "2026-07-29", "2026-08-03", "2026-08-04", "2026-08-06"],
    },
    {
      id: "2026-09",
      month: 9,
      year: 2026,
      dates: ["2026-08-19", "2026-08-24", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03"],
    },
    {
      id: "2026-10",
      month: 10,
      year: 2026,
      dates: ["2026-09-21", "2026-09-23", "2026-09-30", "2026-10-05", "2026-10-06", "2026-10-08"],
    },
    {
      id: "2026-11",
      month: 11,
      year: 2026,
      dates: ["2026-10-19", "2026-10-21", "2026-10-28", "2026-11-02", "2026-11-03", "2026-11-05"],
    },
    {
      id: "2026-12",
      month: 12,
      year: 2026,
      dates: ["2026-11-18", "2026-11-23", "2026-11-30", "2026-12-02", "2026-12-02", "2026-12-03"],
    },
    ...generateNewsletters(GRANDS_COMPTES_CADENCE, 2027, ALL_MONTHS),
  ],
};

export const INTERNE: NewsletterCalendar = {
  id: "interne",
  title: "Interne",
  description: "Production et envoi de la newsletter interne trimestrielle.",
  actors: {
    comm: { label: "Communication", short: "Comm.", people: "Geoffrey & Matthieu" },
    personnel: { label: "Personnel", short: "Personnel", people: "Tous les internes" },
    b2c: { label: "B2C", short: "B2C", people: "Christophe" },
    geraldine: { label: "Géraldine", short: "Géraldine", people: "Géraldine" },
  },
  steps: [
    { key: "sujets", label: "Récolte des sujets", short: "Sujets", from: "comm", to: "personnel" },
    { key: "redaction", label: "Rédaction", short: "Rédaction", from: "comm" },
    { key: "bat", label: "BAT", short: "BAT", from: "comm", to: "b2c" },
    { key: "bat-final", label: "BAT final", short: "BAT final", from: "comm", to: "geraldine" },
    {
      key: "envoi",
      label: "Envoi de la newsletter",
      short: "Envoi",
      from: "comm",
      to: "personnel",
    },
  ],
  team: [
    { role: "Communication", people: "Geoffrey & Matthieu", step: 1 },
    { role: "B2C", people: "Christophe", step: 2 },
    { role: "Géraldine", step: 3 },
    { role: "Personnel", people: "Tous les internes", step: 4 },
  ],
  newsletters: [
    {
      id: "2026-02",
      month: 2,
      year: 2026,
      dates: ["2026-02-06", "2026-02-10", "2026-02-10", "2026-02-11", "2026-02-16"],
    },
    {
      id: "2026-05",
      month: 5,
      year: 2026,
      dates: ["2026-05-07", "2026-05-12", "2026-05-12", "2026-05-13", "2026-05-18"],
    },
    {
      id: "2026-08",
      month: 8,
      year: 2026,
      dates: ["2026-08-07", "2026-08-11", "2026-08-11", "2026-08-12", "2026-08-17"],
    },
    {
      id: "2026-11",
      month: 11,
      year: 2026,
      dates: ["2026-11-06", "2026-11-10", "2026-11-10", "2026-11-12", "2026-11-16"],
    },
    ...generateNewsletters(INTERNE_CADENCE, 2027, QUARTER_MONTHS),
  ],
};

export const NEWSLETTER_CALENDARS = [GRANDS_COMPTES, INTERNE];

/** "B2B → Communication", or just "Communication" for an in-team step. */
export function stepFlow(cal: NewsletterCalendar, step: Step, short = false): string {
  const name = (key: string) => (short ? cal.actors[key].short : cal.actors[key].label);
  return step.to ? `${name(step.from)} → ${name(step.to)}` : name(step.from);
}

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function newsletterTitle(n: Newsletter): string {
  const m = MONTHS[n.month - 1];
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${n.year}`;
}

/** Local-midnight date for an ISO day, so day differences don't drift with time zones. */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from `today` to `iso` (negative when past). */
export function daysUntil(iso: string, today: Date): number {
  return Math.round((parseDay(iso).getTime() - startOfDay(today).getTime()) / 86_400_000);
}

export function isWeekend(iso: string): boolean {
  const day = parseDay(iso).getDay();
  return day === 0 || day === 6;
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const LONG_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function formatDay(iso: string): string {
  return DATE_FMT.format(parseDay(iso));
}

export function formatLongDay(iso: string): string {
  return LONG_FMT.format(parseDay(iso));
}

/** "Aujourd'hui", "Demain", "Dans 3 j", "Il y a 2 j". */
export function relativeDay(iso: string, today: Date): string {
  const d = daysUntil(iso, today);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Demain";
  if (d === -1) return "Hier";
  return d > 0 ? `Dans ${d} j` : `Il y a ${-d} j`;
}

export type StepState = "done" | "today" | "current" | "upcoming";
export type NewsletterState = "sent" | "active" | "upcoming";

/**
 * A step is done once its date is past, "today" on its date. Among future
 * steps, the first one of a newsletter already under way is the current one.
 */
export function stepStates(n: Newsletter, today: Date): StepState[] {
  let currentGiven = false;
  return n.dates.map((iso, i) => {
    const d = daysUntil(iso, today);
    if (d < 0) return "done";
    if (d === 0) {
      currentGiven = true;
      return "today";
    }
    const started = i > 0 && daysUntil(n.dates[i - 1], today) <= 0;
    if (!currentGiven && started) {
      currentGiven = true;
      return "current";
    }
    return "upcoming";
  });
}

export function newsletterState(n: Newsletter, today: Date): NewsletterState {
  const last = n.dates[n.dates.length - 1];
  if (daysUntil(last, today) < 0) return "sent";
  if (daysUntil(n.dates[0], today) <= 0) return "active";
  return "upcoming";
}

export type Deadline = {
  newsletter: Newsletter;
  step: Step;
  index: number;
  date: string;
  days: number;
};

/** Every step from today on, soonest first (steps sharing a date keep their order). */
export function upcomingDeadlines(cal: NewsletterCalendar, today: Date): Deadline[] {
  const out: Deadline[] = [];
  for (const n of cal.newsletters) {
    n.dates.forEach((date, index) => {
      const days = daysUntil(date, today);
      if (days >= 0) out.push({ newsletter: n, step: cal.steps[index], index, date, days });
    });
  }
  return out.sort(
    (a, b) =>
      a.days - b.days || a.newsletter.id.localeCompare(b.newsletter.id) || a.index - b.index,
  );
}

/** Next newsletter still to be sent (its send date is today or later). */
export function nextSend(cal: NewsletterCalendar, today: Date): Newsletter | null {
  return cal.newsletters.find((n) => daysUntil(n.dates[n.dates.length - 1], today) >= 0) ?? null;
}

/** Tab-separated table, ready to paste into Excel. */
export function toSpreadsheetText(cal: NewsletterCalendar): string {
  const head = ["Newsletter", ...cal.steps.map((s) => `${s.label} (${stepFlow(cal, s)})`)];
  const rows = cal.newsletters.map((n) => [
    newsletterTitle(n),
    ...n.dates.map((d) => parseDay(d).toLocaleDateString("fr-FR")),
  ]);
  return [head, ...rows].map((r) => r.join("\t")).join("\n");
}

/** iCalendar file with one all-day event per step, for Outlook / Google Agenda. */
export function toICalendar(cal: NewsletterCalendar): string {
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Digicom//Calendrier newsletters ${cal.title}//FR`,
    "CALSCALE:GREGORIAN",
  ];
  for (const n of cal.newsletters) {
    n.dates.forEach((iso, i) => {
      const s = cal.steps[i];
      const start = parseDay(iso);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
      lines.push(
        "BEGIN:VEVENT",
        `UID:newsletter-${cal.id}-${n.id}-${s.key}@digicom`,
        "DTSTAMP:20260101T000000Z",
        `DTSTART;VALUE=DATE:${fmt(start)}`,
        `DTEND;VALUE=DATE:${fmt(end)}`,
        `SUMMARY:${esc(`NL ${cal.title} ${newsletterTitle(n)} · ${s.label}`)}`,
        `DESCRIPTION:${esc(stepFlow(cal, s))}`,
        "END:VEVENT",
      );
    });
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
