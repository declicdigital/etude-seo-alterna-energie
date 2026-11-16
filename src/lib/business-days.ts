/**
 * Jours ouvrés en France (métropole) : du lundi au vendredi, hors jours fériés.
 * Utilisé par le récap mensuel, envoyé le premier jour ouvré du mois.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Dimanche de Pâques (algorithme de Meeus / Jones / Butcher), en UTC. */
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
  return new Date(Date.UTC(year, month - 1, day));
}

/** Jours fériés de l'année (AAAA-MM-JJ). */
export function frenchHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const plus = (days: number) => iso(new Date(easter.getTime() + days * 86400000));
  return new Set([
    `${year}-01-01`, // Jour de l'an
    plus(1), // Lundi de Pâques
    `${year}-05-01`, // Fête du Travail
    `${year}-05-08`, // Victoire 1945
    plus(39), // Ascension
    plus(50), // Lundi de Pentecôte
    `${year}-07-14`, // Fête nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
  ]);
}

export function isBusinessDay(day: string): boolean {
  const d = new Date(`${day}T12:00:00Z`);
  const wd = d.getUTCDay();
  if (wd === 0 || wd === 6) return false;
  return !frenchHolidays(d.getUTCFullYear()).has(day);
}

/** Premier jour ouvré du mois « AAAA-MM ». */
export function firstBusinessDay(month: string): string {
  const [y, m] = month.split("-").map(Number);
  for (let day = 1; day <= 10; day++) {
    const candidate = `${y}-${pad(m)}-${pad(day)}`;
    if (isBusinessDay(candidate)) return candidate;
  }
  return `${y}-${pad(m)}-01`;
}

/** Date du jour à Paris (AAAA-MM-JJ). */
export function parisToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
