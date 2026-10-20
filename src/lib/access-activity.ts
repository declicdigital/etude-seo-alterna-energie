export type AccessActivity = {
  user_id: string;
  last_sign_in_at: string | null;
  invited_at: string | null;
  invitation_accepted: boolean;
};

export function invitationState(activity?: AccessActivity): "accepted" | "pending" | null {
  if (!activity?.invited_at) return null;
  return activity.invitation_accepted ? "accepted" : "pending";
}

export function formatLastConnection(timestamp: string | null | undefined) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short",
  }).format(date);
}