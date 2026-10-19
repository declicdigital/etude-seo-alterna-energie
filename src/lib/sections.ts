import { SHEET_META } from "@/lib/workbook";

// Sections a person can be granted. Key "Group" = whole space (incl. its
// Suivi), key "Group/Sub" = one sub-list. allowed = null means everything.
export const SECTION_TREE: { group: string; subs: string[] }[] = [
  { group: "Stratégie PAC", subs: ["Contenus"] },
  { group: "Blog", subs: ["Particulier", "Professionnel"] },
  { group: "FAQ", subs: ["Particulier", "Professionnel"] },
];

export const ALL_SECTION_KEYS = SECTION_TREE.flatMap((t) => [t.group, ...t.subs.map((s) => `${t.group}/${s}`)]);

const FIXED_SUB: Record<string, string> = {
  "Structure RES": "Particulier",
  "Structure PRO": "Professionnel",
  "STRATEGIE - ARTICLES": "Contenus",
};

export function sheetAllowed(sheet: string, allowed: string[] | null | undefined): boolean {
  if (!allowed) return true;
  const [base, scope] = sheet.split("::");
  const group = SHEET_META[base]?.group;
  if (!group || !SECTION_TREE.some((t) => t.group === group)) return true;
  if (!allowed.includes(group)) return false;
  const sub = (scope ?? FIXED_SUB[base] ?? "").split("/")[0];
  return !sub || allowed.includes(`${group}/${sub}`);
}
