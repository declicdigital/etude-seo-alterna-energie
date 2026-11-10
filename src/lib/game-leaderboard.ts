/**
 * Mini-jeu « Bug Buster » : cartes, avatars et classements (records du jour, de la semaine et
 * du mois, heure de Paris). Module sans React, partagé par le jeu et les fonctions serveur.
 */

export const GAME_MAPS = ["bureau", "solaire", "eolien", "nuit"] as const;
export type GameMapId = (typeof GAME_MAPS)[number];

export const GAME_AVATARS = ["digi", "sola", "eole", "volt"] as const;
export type GameAvatarId = (typeof GAME_AVATARS)[number];

export const PERIODS = ["day", "week", "month"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABELS: Record<Period, string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
};

/** Filtre de carte des classements : une carte précise ou toutes. */
export type BoardFilter = GameMapId | "all";

export type ScoreRow = {
  user_id: string;
  player_name: string;
  avatar: string;
  map: string;
  score: number;
  created_at: string;
};

export type BoardEntry = {
  name: string;
  avatar: GameAvatarId;
  map: GameMapId;
  score: number;
  at: string;
  me: boolean;
};

export type Boards = Record<Period, Record<BoardFilter, BoardEntry[]>>;

export const BOARD_SIZE = 10;

/** Décalage (minutes) de l'heure de Paris par rapport à UTC à un instant donné. */
function parisOffsetMinutes(at: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!m) return 60;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Instant UTC correspondant à minuit (heure de Paris) du jour civil y-m-d. */
function parisMidnight(y: number, m: number, d: number): Date {
  // À 00:00 UTC il est 1 h ou 2 h à Paris, toujours avant le changement d'heure (2 h / 3 h) :
  // le décalage lu à cet instant est donc celui de minuit.
  const utc = Date.UTC(y, m - 1, d);
  return new Date(utc - parisOffsetMinutes(new Date(utc)) * 60_000);
}

/** Débuts du jour, de la semaine (lundi) et du mois en cours, heure de Paris. */
export function periodStarts(now: Date): Record<Period, Date> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = dimanche
  const back = (weekday + 6) % 7;
  const monday = new Date(Date.UTC(y, m - 1, d - back));
  return {
    day: parisMidnight(y, m, d),
    week: parisMidnight(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate()),
    month: parisMidnight(y, m, 1),
  };
}

/** Plus ancienne date utile : la semaine peut commencer le mois précédent. */
export function earliestStart(now: Date): Date {
  const s = periodStarts(now);
  return s.week < s.month ? s.week : s.month;
}

const asAvatar = (a: string): GameAvatarId =>
  (GAME_AVATARS as readonly string[]).includes(a) ? (a as GameAvatarId) : "digi";
const asMap = (m: string): GameMapId =>
  (GAME_MAPS as readonly string[]).includes(m) ? (m as GameMapId) : "bureau";

/**
 * Meilleur score de chaque joueur par période et par carte (une ligne par personne), triés du
 * plus haut au plus bas ; à égalité, le premier arrivé passe devant.
 */
export function buildBoards(rows: ScoreRow[], now: Date, meId: string | null): Boards {
  const starts = periodStarts(now);
  const filters: BoardFilter[] = ["all", ...GAME_MAPS];
  const boards = {} as Boards;
  for (const period of PERIODS) {
    boards[period] = {} as Record<BoardFilter, BoardEntry[]>;
    const since = starts[period].getTime();
    const inPeriod = rows.filter((r) => new Date(r.created_at).getTime() >= since);
    for (const filter of filters) {
      const best = new Map<string, ScoreRow>();
      for (const r of inPeriod) {
        if (filter !== "all" && r.map !== filter) continue;
        const prev = best.get(r.user_id);
        if (
          !prev ||
          r.score > prev.score ||
          (r.score === prev.score && r.created_at < prev.created_at)
        )
          best.set(r.user_id, r);
      }
      boards[period][filter] = [...best.values()]
        .sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at))
        .slice(0, BOARD_SIZE)
        .map((r) => ({
          name: r.player_name,
          avatar: asAvatar(r.avatar),
          map: asMap(r.map),
          score: r.score,
          at: r.created_at,
          me: r.user_id === meId,
        }));
    }
  }
  return boards;
}

/**
 * Place qu'occuperait ce score dans un classement (1 = premier). Le record déjà enregistré de
 * la personne compte s'il est meilleur ; les autres joueurs ne comptent qu'une fois.
 */
export function liveRank(board: BoardEntry[], score: number): number {
  const mine = board.find((e) => e.me)?.score ?? 0;
  const mineBest = Math.max(mine, score);
  return 1 + board.filter((e) => !e.me && e.score > mineBest).length;
}

/** Score plausible pour une durée de partie (garde-fou contre les envois fantaisistes). */
export function plausibleScore(score: number, durationS: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= 3000 + Math.max(0, durationS) * 400;
}

/**
 * Difficulté de « Bug Buster » selon le temps de jeu (secondes) : les bugs tombent un peu plus
 * vite et plus souvent au fil de la partie, progressivement (×1,5 vers 1 min, ×2 vers 2 min,
 * plafond ×2,8 vers 3 min 20), et un nouveau palier est annoncé toutes les 30 s.
 */
export function difficultyAt(elapsed: number): { speed: number; spawnGap: number; stage: number } {
  const t = Math.max(0, elapsed);
  return {
    speed: Math.min(2.8, 1 + t / 110),
    spawnGap: Math.max(0.36, 1.15 / (1 + t / 140)),
    stage: 1 + Math.floor(t / 30),
  };
}
