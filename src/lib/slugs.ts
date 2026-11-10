import { appUrl } from "@/lib/app-url";
/** Stable route names are independent of editable display labels. */
export const SHEET_PATHS: Record<string, string> = {
  __home: 'accueil', __guide: 'guide', __digipote: 'digipote',
  'SUIVI EDITORIAL': 'blog/suivi-editorial',
  'BLOG - ARTICLES': 'blog/articles',
  'SUIVI STRATEGIE': 'strategie-pac/suivi-editorial',
  'STRATEGIE - ARTICLES': 'strategie-pac/contenus',
  'SUIVI PLANETE': 'parlons-planete/suivi-editorial',
  'PLANETE - ARTICLES': 'parlons-planete/blog',
  'SUIVI FAQ': 'faq/demandes', 'FAQ - DEMANDES': 'faq/questions',
  BENCHMARK: 'benchmark', ORGANISATION: 'organisation', 'PLANNING INTEGRE': 'planning-integre',
  'NEWSLETTER GRANDS COMPTES': 'calendriers-newsletters/grands-comptes',
  'NEWSLETTER INTERNE': 'calendriers-newsletters/interne',
  'NEWSLETTER B2C': 'calendriers-newsletters/b2c',
  'NEWSLETTER SME': 'calendriers-newsletters/sme',
};
export function slugify(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fiche';
}
export function sheetPath(sheet: string): string {
  const [base, scope] = sheet.split('::');
  const path = SHEET_PATHS[base] ?? `feuilles/${encodeURIComponent(base)}`;
  if (!scope) return path;
  if (base === 'BLOG - ARTICLES' || base === 'FAQ - DEMANDES') {
    return `${base === 'BLOG - ARTICLES' ? 'blog' : 'faq'}/${scope.split('/').map(slugify).join('/')}`;
  }
  // Fixed single-list scopes don't need a second copy of the same label.
  if ((base === 'STRATEGIE - ARTICLES' && scope === 'Contenus') || (base === 'PLANETE - ARTICLES' && scope === 'Blog')) return path;
  return `${path}/sous-rubrique/${encodeURIComponent(scope)}`;
}
export function sheetFromPath(path: string): string | null {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const groups: Record<string, string> = { blog: 'SUIVI EDITORIAL', 'strategie-pac': 'SUIVI STRATEGIE', 'parlons-planete': 'SUIVI PLANETE', faq: 'SUIVI FAQ', 'calendriers-newsletters': 'NEWSLETTER GRANDS COMPTES' };
  if (groups[clean]) return groups[clean];
  for (const [sheet, value] of Object.entries(SHEET_PATHS)) if (value === clean) return sheet;
  const audience = /^(blog|faq)\/(particulier|professionnel)(.*)$/.exec(clean);
  if (audience) return `${audience[1] === 'blog' ? 'BLOG - ARTICLES' : 'FAQ - DEMANDES'}::${audience[2] === 'particulier' ? 'Particulier' : 'Professionnel'}${audience[3]}`;
  const scoped = clean.split('/sous-rubrique/');
  if (scoped.length === 2) {
    const base = sheetFromPath(scoped[0]);
    return base ? `${base}::${decodeURIComponent(scoped[1])}` : null;
  }
  if (clean.startsWith('feuilles/')) return decodeURIComponent(clean.slice(9));
  return null;
}
export type Destination = { sheet: string; hash: string };
export function resolvePath(path: string, search = new URLSearchParams()): Destination | null {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const match = /^(.*)\/(articles|a-rediger|fiches|demandes)\/([^/]+)$/.exec(clean);
  if (match) {
    const sheet = sheetFromPath(match[1]);
    if (!sheet) return null;
    const segment = decodeURIComponent(match[3]);
    const id = segment.includes('--') ? segment.slice(segment.lastIndexOf('--') + 2) : segment;
    const kind = match[2] === 'a-rediger' ? 'todo' : match[2] === 'fiches' ? 'card' : match[2] === 'demandes' ? 'faq' : 'article';
    const params = new URLSearchParams();
    for (const key of ['step', 'focus']) { const v = search.get(key); if (v) params.set(key, v); }
    return { sheet, hash: `#${kind}-${encodeURIComponent(id)}${params.size ? `?${params}` : ''}` };
  }
  const sheet = sheetFromPath(clean);
  return sheet ? { sheet, hash: '' } : null;
}
export function fichePath(sheet: string, kind: string, id: string, title?: string): string {
  return `${sheetPath(sheet)}/${kind}/${title ? `${slugify(title)}--` : ''}${encodeURIComponent(id)}`;
}
export function ficheLink(sheet: string, kind: string, id: string, title?: string): string {
  return appUrl(fichePath(sheet, kind, id, title));
}