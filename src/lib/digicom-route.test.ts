import { describe, expect, it } from "vitest";
import { pageLabelFromPath, titleCaseWords } from "./digicom-route";

describe("tab titles", () => {
  it("capitalises every word", () => {
    expect(titleCaseWords("suivi éditorial")).toBe("Suivi Éditorial");
    expect(titleCaseWords("Stratégie PAC")).toBe("Stratégie PAC");
  });
  it("uses the real rubrique names", () => {
    expect(pageLabelFromPath("radar")).toBe("Radar");
    expect(pageLabelFromPath("strategie-pac/suivi-editorial")).toBe("Stratégie PAC · Suivi Éditorial");
    expect(pageLabelFromPath("strategie-pac/contenus")).toBe("Stratégie PAC · Contenus");
    expect(pageLabelFromPath("blog/particulier")).toBe("Blog · Particulier");
    expect(pageLabelFromPath("calendriers-newsletters/b2c")).toBe("Calendriers Newsletters · B2C");
    expect(pageLabelFromPath("accueil")).toBe("Accueil");
    expect(pageLabelFromPath("guide")).toBe("Guide");
  });
});
