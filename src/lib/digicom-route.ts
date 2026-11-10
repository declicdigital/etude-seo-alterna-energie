import { resolvePath } from "@/lib/slugs";
import { groupDisplayName } from "@/lib/sections";
import { parseSheetKey, SHEET_META } from "@/lib/workbook";

/** Majuscule au début de chaque mot (le reste du mot est gardé : « PAC », « B2C » restent tels quels). */
export function titleCaseWords(text: string): string {
  return text
    .split(/(\s+)/)
    .map((w) => (w.trim() ? w.charAt(0).toLocaleUpperCase("fr-FR") + w.slice(1) : w))
    .join("");
}

const SPECIAL: Record<string, string> = { __home: "Accueil", __guide: "Guide", __digipote: "Digipote" };
/** Rubriques dont la page unique porte déjà le nom de la rubrique (pas de « Radar · Planning »). */
const SINGLE_PAGE = new Set(["PLANNING INTEGRE", "ORGANISATION", "BENCHMARK"]);

/** Nom de l'onglet pour une adresse Digicom : « Stratégie PAC · Suivi Éditorial », « Radar »… */
export function pageLabelFromPath(path: string): string {
  const dest = resolvePath(path);
  if (!dest) {
    const raw = path.split("/").filter(Boolean).map((s) => s.replace(/-/g, " ")).join(" · ");
    return titleCaseWords(raw || "Accueil");
  }
  const { base, scope } = parseSheetKey(dest.sheet);
  if (SPECIAL[base]) return SPECIAL[base];
  const meta = SHEET_META[base];
  if (!meta) return titleCaseWords(base.toLowerCase());
  const group = groupDisplayName(meta.group);
  const parts = [group];
  if (scope) parts.push(scope.replace("/", " › "));
  else if (!SINGLE_PAGE.has(base) && meta.label && meta.label !== meta.group) parts.push(meta.label);
  return titleCaseWords(parts.join(" · "));
}

export function digicomHead(label: string) {
  const title = `${label} — Digicom`;
  const description = `${label} : suivi de la communication digitale dans Digicom.`;
  return { meta: [
    { title }, { name: 'description', content: description },
    { property: 'og:title', content: title }, { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] };
}
