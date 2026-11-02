/**
 * Calendrier des newsletters Grands Comptes (rubrique « Calendriers newsletters »).
 * Chaque newsletter suit 6 étapes datées, du choix des sujets à l'envoi aux clients.
 * Les statuts se déduisent uniquement des dates et du jour courant.
 */

export type Actor = "presta" | "b2b" | "comm" | "clients";

export const ACTORS: Record<Actor, { label: string; people: string }> = {
  presta: { label: "Prestataire", people: "Watt's Next" },
  b2b: { label: "B2B", people: "Guillaume" },
  comm: { label: "Communication", people: "Geoffrey & Matthieu" },
  clients: { label: "Clients", people: "Envoi aux clients Grands Comptes" },
};

/** Relecture is shared between B2B and Communication. */
export const REVIEWERS = "Lidvine & Guillaume";

export type Step = { key: string; label: string; short: string; from: Actor; to: Actor };

export const STEPS: Step[] = [
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
];

export type Newsletter = { id: string; month: number; year: number; dates: string[] };

/** Dates des 6 étapes (AAAA-MM-JJ), dans l'ordre de STEPS. */
export const NEWSLETTERS: Newsletter[] = [
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
];

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
export function upcomingDeadlines(today: Date, list = NEWSLETTERS): Deadline[] {
  const out: Deadline[] = [];
  for (const n of list) {
    n.dates.forEach((date, index) => {
      const days = daysUntil(date, today);
      if (days >= 0) out.push({ newsletter: n, step: STEPS[index], index, date, days });
    });
  }
  return out.sort(
    (a, b) =>
      a.days - b.days || a.newsletter.id.localeCompare(b.newsletter.id) || a.index - b.index,
  );
}

/** Next newsletter still to be sent (its send date is today or later). */
export function nextSend(today: Date, list = NEWSLETTERS): Newsletter | null {
  return list.find((n) => daysUntil(n.dates[n.dates.length - 1], today) >= 0) ?? null;
}

/** Tab-separated table, ready to paste into Excel. */
export function toSpreadsheetText(list = NEWSLETTERS): string {
  const head = [
    "Newsletter",
    ...STEPS.map((s) => `${s.label} (${ACTORS[s.from].label} → ${ACTORS[s.to].label})`),
  ];
  const rows = list.map((n) => [
    newsletterTitle(n),
    ...n.dates.map((d) => parseDay(d).toLocaleDateString("fr-FR")),
  ]);
  return [head, ...rows].map((r) => r.join("\t")).join("\n");
}

/** iCalendar file with one all-day event per step, for Outlook / Google Agenda. */
export function toICalendar(list = NEWSLETTERS): string {
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`);
  const day = (iso: string) => iso.replaceAll("-", "");
  const next = (iso: string) => {
    const d = parseDay(iso);
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  };
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Digicom//Calendrier newsletters Grands Comptes//FR",
    "CALSCALE:GREGORIAN",
  ];
  for (const n of list) {
    n.dates.forEach((iso, i) => {
      const s = STEPS[i];
      lines.push(
        "BEGIN:VEVENT",
        `UID:newsletter-gc-${n.id}-${s.key}@digicom`,
        "DTSTAMP:20260101T000000Z",
        `DTSTART;VALUE=DATE:${day(iso)}`,
        `DTEND;VALUE=DATE:${next(iso)}`,
        `SUMMARY:${esc(`NL Grands Comptes ${newsletterTitle(n)} · ${s.label}`)}`,
        `DESCRIPTION:${esc(`${ACTORS[s.from].label} → ${ACTORS[s.to].label}`)}`,
        "END:VEVENT",
      );
    });
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
