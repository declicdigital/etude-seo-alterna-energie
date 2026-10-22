/** « Relecture + image » is handled by the Service Communication: Fannie and Coraline. */
export const SERVICE_COMMUNICATION_EMAILS: readonly string[] = [
  "fannie.laurendin@soregies.fr",
  "coraline.prono@soregies.fr",
];

/** Review notifications always include the whole Communication team, even with legacy settings. */
export function notificationRecipients(kind: string | undefined, recipients: readonly string[]): string[] {
  return [...new Set((kind === "relecture" ? [...SERVICE_COMMUNICATION_EMAILS, ...recipients] : recipients).map(email => email.trim().toLowerCase()))];
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

/** The review step asks the Service Communication to add the image, so its button says exactly that. */
export function notificationCta(kind: string | undefined): string {
  return kind === "relecture" ? "Ajouter l'image" : "Ouvrir Digicom";
}
