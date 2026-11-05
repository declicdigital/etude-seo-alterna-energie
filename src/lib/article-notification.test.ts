import { describe, expect, it } from "vitest";
import { notificationCta, notificationDeadline, notificationRecipients, SERVICE_COMMUNICATION_EMAILS } from "./article-notification";

describe("notificationDeadline", () => {
  it("removes the deadline from every notification addressed to Fannie", () => {
    for (const kind of ["ready", "relecture", "integration", "published", undefined]) {
      expect(notificationDeadline("2026-10-23", kind, ["fannie.laurendin@soregies.fr"])).toBeUndefined();
    }
  });

  it("removes the deadline from review notifications even with configured recipients", () => {
    expect(notificationDeadline("2026-10-23", "relecture", ["review@example.org"])).toBeUndefined();
  });

  it("preserves the deadline for other recipients and notification stages", () => {
    expect(notificationDeadline("2026-10-23", "ready", ["geoffrey.delabarre@alterna-energie.fr"])).toBe("2026-10-23");
  });
});

describe("Service Communication", () => {
  it("includes Fannie and Coraline together for PAC review with a legacy Fannie-only setting", () => {
    expect(notificationRecipients("relecture", ["fannie.laurendin@soregies.fr"])).toEqual([
      "fannie.laurendin@soregies.fr", "coraline.prono@soregies.fr",
    ]);
  });
  it("includes Fannie when an old review setting only contains Coraline", () => {
    expect(notificationRecipients("relecture", ["coraline.prono@soregies.fr"])).toEqual([
      "fannie.laurendin@soregies.fr", "coraline.prono@soregies.fr",
    ]);
  });
  it("does not add the Communication team to integration notifications", () => {
    expect(notificationRecipients("integration", ["marick.navarro.ext@soregies.fr"])).toEqual(["marick.navarro.ext@soregies.fr"]);
  });
  it("lists Fannie and Coraline as the people behind relecture + image", () => {
    expect(SERVICE_COMMUNICATION_EMAILS).toContain("fannie.laurendin@soregies.fr");
    expect(SERVICE_COMMUNICATION_EMAILS).toContain("coraline.prono@soregies.fr");
  });

  it("keeps the deadline out of every mail addressed to the Service Communication", () => {
    for (const email of SERVICE_COMMUNICATION_EMAILS) {
      expect(notificationDeadline("2026-10-23", "image", [email])).toBeUndefined();
    }
    expect(notificationDeadline("2026-10-23", "image", ["geoffrey.delabarre@alterna-energie.fr"])).toBe("2026-10-23");
  });
});

describe("notificationCta", () => {
  it("asks for the image on the review step", () => {
    expect(notificationCta("image")).toBe("Ajouter l'image");
  });

  it("keeps the generic label on every other stage", () => {
    for (const kind of ["ready", "integration", "published", undefined]) {
      expect(notificationCta(kind)).toBe("Ouvrir Digicom");
    }
  });
});
describe('split notification recipients', () => {
  it('sends Image only to Geoffrey even with a legacy Communication destination', () => {
    expect(notificationRecipients('image', SERVICE_COMMUNICATION_EMAILS)).toEqual(['geoffrey.delabarre@alterna-energie.fr']);
  });
  it('sends Relecture only to Fannie and Coraline even with another configured recipient', () => {
    expect(notificationRecipients('relecture', ['other@example.org'])).toEqual([...SERVICE_COMMUNICATION_EMAILS]);
  });
});
