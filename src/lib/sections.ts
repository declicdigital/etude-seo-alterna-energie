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
  { group: "Calendriers newsletters", subs: ["Grands Comptes"], defaultOn: true, accent: "bg-blue-600" },
];

export const ALL_SECTION_KEYS = SECTION_TREE.flatMap((t) => [t.group, ...t.subs.map((s) => `${t.group}/${s}`)]);

const DEFAULT_ON_KEYS = new Set(
  SECTION_TREE.filter((t) => t.defaultOn).flatMap((t) => [t.group, ...t.subs.map((s) => `${t.group}/${s}`)]),
);

const DENIED = "!";

const FIXED_SUB: Record<string, string> = {
  "Structure RES": "Particulier",
  "Structure PRO": "Professionnel",
  "STRATEGIE - ARTICLES": "Contenus",
  "NEWSLETTER GRANDS COMPTES": "Grands Comptes",
};

/** Keys a person can actually open, resolving defaults and explicit refusals. */
export function grantedSections(allowed: string[] | null | undefined): Set<string> {
  if (!allowed) return new Set(ALL_SECTION_KEYS);
  const listed = new Set(allowed);
  return new Set(
    ALL_SECTION_KEYS.filter((k) => listed.has(k) || (DEFAULT_ON_KEYS.has(k) && !listed.has(DENIED + k))),
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
