/** Public address of Digicom, used in mails, invitations and links. Change it here only. */
export const APP_ORIGIN = "https://digicom-alterna-energie.lovable.app";
export const appUrl = (path = "") => `${APP_ORIGIN}/${path.replace(/^\/+/, "")}`;

/** Former addresses of Digicom: every page there is sent, with its path, to the same page on APP_ORIGIN. */
export const LEGACY_HOSTS = ["etude-seo-alterna-energie.lovable.app"];

/** Redirect target for a request on a former address, or null. */
export function legacyRedirect(url: string): string | null {
  const u = new URL(url);
  if (!LEGACY_HOSTS.includes(u.hostname)) return null;
  return `${APP_ORIGIN}${u.pathname}${u.search}${u.hash}`;
}
