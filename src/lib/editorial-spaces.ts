/**
 * Editorial spaces sharing the embedded editorial tracker (public/suivi-editorial.html):
 * "" = Blog, "strategie" = Stratégie PAC, "planete" = Parlons Planète.
 * Each space keeps its own keys in editorial_kv (prefix) and its own pages.
 */
export const EDITORIAL_SPACES = ["strategie", "planete"] as const;
export type EditorialSpace = (typeof EDITORIAL_SPACES)[number];

const LABELS: Record<string, string> = {
  "": "Blog",
  strategie: "Stratégie PAC",
  planete: "Parlons Planète",
};
const PREFIXES: Record<string, string> = { "": "", strategie: "strat:", planete: "planete:" };
const SUIVI_SHEETS: Record<string, string> = {
  "": "SUIVI EDITORIAL",
  strategie: "SUIVI STRATEGIE",
  planete: "SUIVI PLANETE",
};

export function spaceLabel(space?: string | null): string {
  return LABELS[space ?? ""] ?? LABELS[""];
}

/** Key prefix of the space in editorial_kv. */
export function spacePrefix(space?: string | null): string {
  return PREFIXES[space ?? ""] ?? "";
}

/** Digicom sheet hosting the space's editorial tracker. */
export function spaceSuiviSheet(space?: string | null): string {
  return SUIVI_SHEETS[space ?? ""] ?? SUIVI_SHEETS[""];
}

export const SUIVI_SHEET_NAMES = Object.values(SUIVI_SHEETS);

/** Every space, Blog first, for jobs that walk all trackers. */
export const ALL_SPACES: string[] = ["", ...EDITORIAL_SPACES];
