import { describe, expect, it } from "vitest";
import { MAIL_SENDER } from "./mail-sender";

describe("MAIL_SENDER", () => {
  it("shows the brand and the tool name, with a lowercase accent on énergie", () => {
    expect(MAIL_SENDER.name).toBe("Alterna énergie - Digicom");
  });

  it("sends from the Digicom mailbox", () => {
    expect(MAIL_SENDER.email).toBe("g.delabarre.alterna@gmail.com");
  });
});
