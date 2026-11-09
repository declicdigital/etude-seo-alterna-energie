import { spaceSuiviSheet, SUIVI_SHEET_NAMES } from "./editorial-spaces";
import { ficheLink, resolvePath, sheetPath } from './slugs';

const APP = "https://etude-seo-alterna-energie.lovable.app/";
const SHEETS = SUIVI_SHEET_NAMES;

export function editorialLink(id?: string, step?: string, focus?: string, todo = false, space?: string, title?: string): string {
  const sheet = spaceSuiviSheet(space);
  const base = `${APP}${sheetPath(sheet)}`;
  if (!id) return base;
  const params = new URLSearchParams();
  if (step) params.set("step", step);
  if (focus) params.set("focus", focus);
  return `${ficheLink(sheet, todo ? 'a-rediger' : 'articles', id, title)}${params.size ? `?${params}` : ""}`;
}

export function notificationLink(kind: string | undefined, id?: string, step?: string, space?: string, title?: string): string {
  if (kind === "image") return editorialLink(id, "image", "images", false, space, title);
  if (kind === "relecture") return editorialLink(id, "relecture", undefined, false, space, title);
  if (kind === "integration" || kind === "published") return editorialLink(id, "integration", undefined, false, space, title);
  return editorialLink(id, step || "redaction", undefined, false, space, title);
}

const RETURN_KEY = "editorial-mail-destination";
export function rememberEditorialDestination(href: string): void {
  const url = new URL(href, window.location.origin);
  if (url.origin === window.location.origin && (resolvePath(url.pathname) || (url.pathname === "/" && SHEETS.includes(url.searchParams.get("sheet") ?? "") && /^#(article|todo)-/.test(url.hash)))) {
    sessionStorage.setItem(RETURN_KEY, url.pathname + url.search + url.hash);
  }
}

export function pendingEditorialDestination() {
  const saved = sessionStorage.getItem(RETURN_KEY);
  const url = saved ? new URL(saved, window.location.origin) : null;
  const sheet = url?.searchParams.get("sheet");
  if (url?.origin === window.location.origin && resolvePath(url.pathname)) {
    return { to: '/$' as const, params: { _splat: url.pathname.slice(1) }, search: { step: url.searchParams.get('step') ?? undefined, focus: url.searchParams.get('focus') ?? undefined }, hash: url.hash.slice(1) };
  }
  if (url?.origin === window.location.origin && url.pathname === "/" && sheet && SHEETS.includes(sheet) && /^#(article|todo)-/.test(url.hash)) {
    return { to: "/" as const, search: { sheet }, hash: url.hash.slice(1) };
  }
  return { to: "/" as const };
}

export function clearEditorialDestination(): void {
  sessionStorage.removeItem(RETURN_KEY);
}