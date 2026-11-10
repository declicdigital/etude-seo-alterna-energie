import { sheetAllowed } from "@/lib/sections";

/** Every rubrique of Digicom, entry sheet first. The home page and the guide only list the ones a person can open. */
export const RUBRIQUE_SHEETS = [
  { key: "pac", sheets: ["SUIVI STRATEGIE", "STRATEGIE - ARTICLES"], editorial: true },
  {
    key: "blog",
    sheets: ["SUIVI EDITORIAL", "BLOG - ARTICLES::Particulier", "BLOG - ARTICLES::Professionnel"],
    editorial: true,
  },
  { key: "planete", sheets: ["SUIVI PLANETE", "PLANETE - ARTICLES"], editorial: true },
  {
    key: "faq",
    sheets: ["SUIVI FAQ", "FAQ - DEMANDES::Particulier", "FAQ - DEMANDES::Professionnel"],
    editorial: true,
  },
  { key: "benchmark", sheets: ["BENCHMARK"], editorial: false },
  {
    key: "newsletters",
    sheets: ["NEWSLETTER GRANDS COMPTES", "NEWSLETTER INTERNE", "NEWSLETTER B2C", "NEWSLETTER SME"],
    editorial: false,
  },
  { key: "organisation", sheets: ["ORGANISATION"], editorial: false },
  { key: "planning", sheets: ["PLANNING INTEGRE"], editorial: false },
] as const;

export type RubriqueKey = (typeof RUBRIQUE_SHEETS)[number]["key"];

/** Rubriques the person can open, each with the first sheet they may see. */
export function visibleRubriqueEntries(
  allowed: string[] | null | undefined,
): { key: RubriqueKey; entry: string; editorial: boolean }[] {
  return RUBRIQUE_SHEETS.flatMap((r) => {
    const entry = r.sheets.find((s) => sheetAllowed(s, allowed));
    return entry ? [{ key: r.key, entry, editorial: r.editorial }] : [];
  });
}
