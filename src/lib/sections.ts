import { SHEET_META } from "@/lib/workbook";

// Sections a person can be granted. Key "Group" = whole space (incl. its
// Suivi), key "Group/Sub" = one sub-list. allowed = null means everything.
//
// `defaultOn`: sections added after people already had a saved access list.
// For them, a key that is simply absent from the list means "allowed" (so
// nobody loses access when a section becomes manageable); an explicit
// refusal is stored as "!key". For the original sections, absent = refused.
export type SectionGroup = { group: string; subs: string[]; defaultOn?: boolean; accent: string };

export const SECTION_TREE: SectionGroup[] = [
  { group: "Stratégie PAC", subs: ["Contenus"], accent: "bg-violet-500" },
  { group: "Blog", subs: ["Particulier", "Professionnel"], accent: "bg-sky-500" },
  { group: "FAQ", subs: ["Particulier", "Professionnel"], accent: "bg-teal-500" },
  { group: "Benchmark", subs: [], defaultOn: true, accent: "bg-emerald-600" },
  {
    group: "Calendriers newsletters",
    subs: ["Grands Comptes", "Interne", "B2C", "SME"],
    defaultOn: true,
    accent: "bg-blue-600",
  },
  // Closed by default: opened per account in « Demandes d'accès ».
  { group: "Parlons Planète", subs: ["Blog"], accent: "bg-lime-600" },
  // Closed by default: opened per account. Also enforced in the database (can_use_organisation).
  { group: "Organisation", subs: [], accent: "bg-amber-500" },
  // Closed by default: opened per account. Also enforced in the database (can_view_planning).
  { group: "Planning intégré", subs: [], accent: "bg-cyan-700" },
];

/**
 * Nom affiché d'une rubrique quand il diffère de sa clé. La clé (ex. « Planning intégré »)
 * reste celle des accès enregistrés (`allowed_sections`) et des fonctions SQL
 * (`can_view_planning`) : ne jamais la renommer, seulement le nom affiché.
 */
export const GROUP_DISPLAY_NAMES: Record<string, string> = { "Planning intégré": "Le Radar" };
export const groupDisplayName = (group: string) => GROUP_DISPLAY_NAMES[group] ?? group;

export const ALL_SECTION_KEYS = SECTION_TREE.flatMap((t) => [
  t.group,
  ...t.subs.map((s) => `${t.group}/${s}`),
]);

const DEFAULT_ON_KEYS = new Set(
  SECTION_TREE.filter((t) => t.defaultOn).flatMap((t) => [
    t.group,
    ...t.subs.map((s) => `${t.group}/${s}`),
  ]),
);

const DENIED = "!";

const FIXED_SUB: Record<string, string> = {
  "Structure RES": "Particulier",
  "Structure PRO": "Professionnel",
  "STRATEGIE - ARTICLES": "Contenus",
  "NEWSLETTER GRANDS COMPTES": "Grands Comptes",
  "NEWSLETTER INTERNE": "Interne",
  "NEWSLETTER B2C": "B2C",
  "NEWSLETTER SME": "SME",
  "PLANETE - ARTICLES": "Blog",
};

/** Keys a person can actually open, resolving defaults and explicit refusals. */
export function grantedSections(allowed: string[] | null | undefined): Set<string> {
  if (!allowed) return new Set(ALL_SECTION_KEYS);
  const listed = new Set(allowed);
  return new Set(
    ALL_SECTION_KEYS.filter(
      (k) => listed.has(k) || (DEFAULT_ON_KEYS.has(k) && !listed.has(DENIED + k)),
    ),
  );
}

/** Stored form of a set of granted keys: every key, granted or explicitly refused. */
export function serializeSections(granted: Set<string>): string[] {
  return ALL_SECTION_KEYS.map((k) => (granted.has(k) ? k : DENIED + k));
}

export function sheetAllowed(sheet: string, allowed: string[] | null | undefined): boolean {
  if (!allowed) return true;
  const [base, scope] = sheet.split("::");
  const group = SHEET_META[base]?.group;
  if (!group || !SECTION_TREE.some((t) => t.group === group)) return true;
  const granted = grantedSections(allowed);
  if (!granted.has(group)) return false;
  const sub = (scope ?? FIXED_SUB[base] ?? "").split("/")[0];
  return !sub || granted.has(`${group}/${sub}`);
}
