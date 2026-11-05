/** Relecture is handled by the Service Communication; Image belongs to Geoffrey. */
export const IMAGE_EMAIL = "geoffrey.delabarre@alterna-energie.fr";
export const SERVICE_COMMUNICATION_EMAILS: readonly string[] = [
  "fannie.laurendin@soregies.fr",
  "coraline.prono@soregies.fr",
];

/** Review notifications always include the whole Communication team, even with legacy settings. */
export function notificationRecipients(kind: string | undefined, recipients: readonly string[]): string[] {
  const selected = kind === "image" ? [IMAGE_EMAIL] : kind === "relecture" ? SERVICE_COMMUNICATION_EMAILS : recipients;
  return [...new Set(selected.map(email => email.trim().toLowerCase()))];
}

/** Keep deadlines out of review notifications and any mail addressed to the Service Communication. */
export function notificationDeadline(
  deadline: string | undefined,
  kind: string | undefined,
  recipients: readonly string[],
): string | undefined {
  if (kind === "relecture" || recipients.some((email) => SERVICE_COMMUNICATION_EMAILS.includes(email.trim().toLowerCase()))) {
    return undefined;
  }
  return deadline;
}

/** Each CTA names the work expected at its own step. */
export function notificationCta(kind: string | undefined): string {
  return kind === "image" ? "Ajouter l'image" : kind === "relecture" ? "Relire l'article" : "Ouvrir Digicom";
}
