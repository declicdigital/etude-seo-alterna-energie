const FANNIE_EMAIL = "fannie.laurendin@soregies.fr";

/** Keep deadlines out of review notifications and any mail addressed to Fannie. */
export function notificationDeadline(
  deadline: string | undefined,
  kind: string | undefined,
  recipients: readonly string[],
): string | undefined {
  if (kind === "relecture" || recipients.some((email) => email.trim().toLowerCase() === FANNIE_EMAIL)) {
    return undefined;
  }
  return deadline;
}