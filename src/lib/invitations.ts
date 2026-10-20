import { z } from "zod";

export const invitationSchema = z.object({
  fullName: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

export function approvedInvitationProfile(fullName: string, reviewedBy: string) {
  return { full_name: fullName, status: "approved" as const, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() };
}

export function canInvite(isAdmin: boolean) {
  return isAdmin === true;
}