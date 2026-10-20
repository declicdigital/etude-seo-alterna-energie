import { describe, expect, it } from "vitest";
import { approvedInvitationProfile, canInvite, invitationSchema } from "./invitations";

describe("Invitations", () => {
  it("requires a name and valid email", () => {
    expect(invitationSchema.safeParse({ fullName: "", email: "person@example.com" }).success).toBe(false);
    expect(invitationSchema.safeParse({ fullName: "Personne", email: "invalid" }).success).toBe(false);
    expect(invitationSchema.parse({ fullName: " Personne Invitée ", email: "person@example.com" }).fullName).toBe("Personne Invitée");
  });
  it("approves an invited person directly", () => {
    expect(approvedInvitationProfile("Personne Invitée", "admin-id")).toMatchObject({ full_name: "Personne Invitée", status: "approved", reviewed_by: "admin-id" });
  });
  it("allows only administrators to invite", () => {
    expect(canInvite(false)).toBe(false);
    expect(canInvite(true)).toBe(true);
  });
});