const APP = "https://etude-seo-alterna-energie.lovable.app/";
const EDITORIAL_URL = `${APP}?sheet=SUIVI+EDITORIAL`;
const STRATEGIE_URL = `${APP}?sheet=SUIVI+STRATEGIE`;
const SHEETS = ["SUIVI EDITORIAL", "SUIVI STRATEGIE"];

export function editorialLink(id?: string, step?: string, focus?: string, todo = false, space?: string): string {
  const base = space === "strategie" ? STRATEGIE_URL : EDITORIAL_URL;
  if (!id) return base;
  const params = new URLSearchParams();
  if (step) params.set("step", step);
  if (focus) params.set("focus", focus);
  return `${base}#${todo ? "todo" : "article"}-${encodeURIComponent(id)}${params.size ? `?${params}` : ""}`;
}

export function notificationLink(kind: string | undefined, id?: string, step?: string, space?: string): string {
  if (kind === "image") return editorialLink(id, "image", "images", false, space);
  if (kind === "relecture") return editorialLink(id, "relecture", undefined, false, space);
  if (kind === "integration" || kind === "published") return editorialLink(id, "integration", undefined, false, space);
  return editorialLink(id, step || "redaction", undefined, false, space);
}

const RETURN_KEY = "editorial-mail-destination";
export function rememberEditorialDestination(href: string): void {
  const url = new URL(href, window.location.origin);
  if (url.pathname === "/" && SHEETS.includes(url.searchParams.get("sheet") ?? "") && /^#(article|todo)-/.test(url.hash)) {
    sessionStorage.setItem(RETURN_KEY, url.pathname + url.search + url.hash);
  }
}

export function pendingEditorialDestination() {
  const saved = sessionStorage.getItem(RETURN_KEY);
  const url = saved ? new URL(saved, window.location.origin) : null;
  const sheet = url?.searchParams.get("sheet");
  if (url?.origin === window.location.origin && url.pathname === "/" && sheet && SHEETS.includes(sheet) && /^#(article|todo)-/.test(url.hash)) {
    return { to: "/" as const, search: { sheet }, hash: url.hash.slice(1) };
  }
  return { to: "/" as const };
}

export function clearEditorialDestination(): void {
  sessionStorage.removeItem(RETURN_KEY);
}