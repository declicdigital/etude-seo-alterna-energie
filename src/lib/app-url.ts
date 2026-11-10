/** Public address of Digicom, used in mails, invitations and links. Change it here only. */
export const APP_ORIGIN = "https://digicom.life";
export const appUrl = (path = "") => `${APP_ORIGIN}/${path.replace(/^\/+/, "")}`;

/** Former addresses of Digicom: every page there is sent, with its path, to the same page on APP_ORIGIN. */
export const LEGACY_HOSTS = [
  "www.digicom.life",
  "digicom-alterna-energie.lovable.app",
  "etude-seo-alterna-energie.lovable.app",
];

/** Former page addresses, sent to their new address (sub-paths included), on every host. */
export const LEGACY_PATHS: Record<string, string> = { "/planning-integre": "/radar" };

function movedPath(pathname: string): string | null {
  for (const [from, to] of Object.entries(LEGACY_PATHS)) {
    if (pathname === from || pathname === `${from}/`) return to;
    if (pathname.startsWith(`${from}/`)) return to + pathname.slice(from.length);
  }
  return null;
}

/** Redirect target for a request on a former address (host or page), or null. */
export function legacyRedirect(url: string): string | null {
  const u = new URL(url);
  const path = movedPath(u.pathname);
  const legacyHost = LEGACY_HOSTS.includes(u.hostname);
  if (!legacyHost && !path) return null;
  return `${legacyHost ? APP_ORIGIN : u.origin}${path ?? u.pathname}${u.search}${u.hash}`;
}
