/** Public address of Digicom, used in mails, invitations and links. Change it here only. */
export const APP_ORIGIN = "https://etude-seo-alterna-energie.lovable.app";
export const appUrl = (path = "") => `${APP_ORIGIN}/${path.replace(/^\/+/, "")}`;
