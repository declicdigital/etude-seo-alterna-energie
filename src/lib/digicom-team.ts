/**
 * Équipe Digicom : pilotes (droits réservés) et destinataire unique des mails « équipe ».
 * Geoffrey reste pilote/admin mais ne reçoit plus AUCUN mail : ses adresses sont
 * redirigées vers DIGICOM_TEAM_EMAIL au moment de l'envoi (`routeMailRecipients`).
 */
export const PILOT_EMAILS = [
  "geoffrey.delabarre@alterna-energie.fr",
  "matthieu.roux@alterna-energie.fr",
] as const;
export const DIGICOM_TEAM_EMAIL = "matthieu.roux@alterna-energie.fr";
export const DIGICOM_TEAM_NAME = "Matthieu";
/** Adresses qui ne doivent plus jamais recevoir de mail de l'app. */
export const NO_MAIL_EMAILS = ["geoffrey.delabarre@alterna-energie.fr", "geoffrey.delabarre@gmail.com"] as const;
/** Comptes approuvés (non admin) autorisés à modifier le Benchmark. */
export const BENCHMARK_EDITOR_EMAILS = ["charlotte.places@alterna-energie.fr"] as const;

const norm = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();
export function isPilotEmail(email: string | null | undefined): boolean {
  return (PILOT_EMAILS as readonly string[]).includes(norm(email));
}
export function isPilot(isAdmin: boolean, email: string | null | undefined): boolean {
  return isAdmin && isPilotEmail(email);
}
/** « Geoffrey » (ancien assignee) est un alias de l'équipe Digicom pour le routage. */
export function teamAssignee(name: string): string {
  return name.trim().toLowerCase() === "geoffrey" ? DIGICOM_TEAM_NAME : name;
}
/** Remplace les adresses bloquées par l'équipe Digicom, dédoublonne, retire les CC déjà en « to ». */
export function routeMailRecipients(to: readonly string[], cc: readonly string[] = []): { to: string[]; cc: string[] } {
  const map = (e: string) => ((NO_MAIL_EMAILS as readonly string[]).includes(norm(e)) ? DIGICOM_TEAM_EMAIL : e.trim());
  const seen = new Set<string>();
  const uniq = (list: readonly string[]) => list.map(map).filter((e) => {
    const k = norm(e);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const t = uniq(to);
  return { to: t, cc: uniq(cc) };
}
/** Champs Brevo `to` / `cc` déjà routés. */
export function brevoRecipients(to: readonly string[], cc: readonly string[] = []) {
  const r = routeMailRecipients(to, cc);
  return { to: r.to.map((email) => ({ email })), ...(r.cc.length ? { cc: r.cc.map((email) => ({ email })) } : {}) };
}
