import { describe, expect, it } from "vitest";
import { legacyRedirect } from "./app-url";
import { resolvePath, sheetPath } from "./slugs";

describe("legacyRedirect", () => {
  it("sends former hosts to the custom domain with the same page", () => {
    expect(legacyRedirect("https://www.digicom.life/blog/suivi-editorial?x=1")).toBe("https://digicom.life/blog/suivi-editorial?x=1");
  });
  it("leaves current pages alone", () => {
    expect(legacyRedirect("https://digicom.life/radar")).toBeNull();
    expect(legacyRedirect("https://digicom.life/planning-integre.html")).toBeNull();
  });
  it("sends the former Planning intégré address to the Radar, on every host", () => {
    expect(legacyRedirect("https://digicom.life/planning-integre")).toBe("https://digicom.life/radar");
    expect(legacyRedirect("https://digicom.life/planning-integre/?view=1")).toBe("https://digicom.life/radar?view=1");
    expect(legacyRedirect("https://digicom-alterna-energie.lovable.app/planning-integre")).toBe("https://digicom.life/radar");
    expect(legacyRedirect("https://id-preview--abc.lovable.app/planning-integre")).toBe("https://id-preview--abc.lovable.app/radar");
  });
});

describe("Radar path", () => {
  it("lives at /radar and still understands the former path", () => {
    expect(sheetPath("PLANNING INTEGRE")).toBe("radar");
    expect(resolvePath("radar")?.sheet).toBe("PLANNING INTEGRE");
    expect(resolvePath("planning-integre")?.sheet).toBe("PLANNING INTEGRE");
  });
});
