import { describe, expect, it } from "vitest";
import { formatLastConnection, invitationState, type AccessActivity } from "./access-activity";

const invited: AccessActivity = {
  user_id: "person", invited_at: "2026-10-20T08:00:00Z",
  last_sign_in_at: null, invitation_accepted: false,
};

describe("Access activity", () => {
  it("keeps an invitation pending even if its link initiated a session", () => {
    expect(invitationState({ ...invited, last_sign_in_at: "2026-10-20T09:00:00Z" })).toBe("pending");
  });
  it("marks an invited account accepted only after password completion", () => {
    expect(invitationState({ ...invited, invitation_accepted: true })).toBe("accepted");
  });
  it("does not label regular accounts as invited", () => {
    expect(invitationState({ ...invited, invited_at: null })).toBeNull();
  });
  it("shows the connection date and time in Paris time", () => {
    expect(formatLastConnection("2026-10-20T09:52:00Z")).toBe("20/10/2026 11:52");
    expect(formatLastConnection("2026-12-20T09:52:00Z")).toBe("20/12/2026 10:52");
  });
  it("never invents a date for accounts without a recorded connection", () => {
    expect(formatLastConnection(null)).toBeNull();
  });
});