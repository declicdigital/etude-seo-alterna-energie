import { describe, expect, it } from "vitest";
import { notificationDeadline } from "./article-notification";

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