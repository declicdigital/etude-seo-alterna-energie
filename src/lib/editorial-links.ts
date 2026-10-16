const EDITORIAL_URL = "https://etude-seo-alterna-energie.lovable.app/?sheet=SUIVI+EDITORIAL";

export function editorialLink(id?: string, step?: string, focus?: string, todo = false): string {
  if (!id) return EDITORIAL_URL;
  const params = new URLSearchParams();
  if (step) params.set("step", step);
  if (focus) params.set("focus", focus);
  return `${EDITORIAL_URL}#${todo ? "todo" : "article"}-${encodeURIComponent(id)}${params.size ? `?${params}` : ""}`;
}

export function notificationLink(kind: string | undefined, id?: string, step?: string): string {
  if (kind === "relecture") return editorialLink(id, step || "validation", "images");
  if (kind === "integration") return editorialLink(id, "integration");
  if (kind === "published") return editorialLink(id, "integration");
  return editorialLink(id, step || "redaction");
}

const RETURN_KEY = "editorial-mail-destination";
export function rememberEditorialDestination(href: string): void {
  const url = new URL(href, window.location.origin);
  if (url.pathname === "/" && url.searchParams.get("sheet") === "SUIVI EDITORIAL" && /^#(article|todo)-/.test(url.hash)) {
    sessionStorage.setItem(RETURN_KEY, url.pathname + url.search + url.hash);
  }
}

export function pendingEditorialDestination() {
  const saved = sessionStorage.getItem(RETURN_KEY);
  const url = saved ? new URL(saved, window.location.origin) : null;
  if (url?.origin === window.location.origin && url.pathname === "/" && url.searchParams.get("sheet") === "SUIVI EDITORIAL" && /^#(article|todo)-/.test(url.hash)) {
    return { to: "/" as const, search: { sheet: "SUIVI EDITORIAL" }, hash: url.hash.slice(1) };
  }
  return { to: "/" as const };
}

export function clearEditorialDestination(): void {
  sessionStorage.removeItem(RETURN_KEY);
}