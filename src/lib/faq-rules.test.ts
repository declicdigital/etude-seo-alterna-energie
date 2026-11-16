import { describe, expect, it } from "vitest";
import {
  canDeleteFaqItem,
  canModerateFaq,
  faqCategories,
  faqStatus,
  matchFaqCategory,
  type FaqRequest,
} from "./faq";

describe("FAQ : modération et statuts", () => {
  it("Geoffrey (admin) et Matthieu modèrent, pas Marick", () => {
    expect(canModerateFaq(true, "geoffrey.delabarre@alterna-energie.fr")).toBe(true);
    expect(canModerateFaq(false, "Matthieu.Roux@alterna-energie.fr")).toBe(true);
    expect(canModerateFaq(false, "marick.navarro@soregies.fr")).toBe(false);
  });
  it("chacun supprime ses propres commentaires, les modérateurs tous", () => {
    expect(
      canDeleteFaqItem("coraline.prono@soregies.fr", "Coraline.Prono@soregies.fr", false),
    ).toBe(true);
    expect(
      canDeleteFaqItem("coraline.prono@soregies.fr", "marick.navarro@soregies.fr", false),
    ).toBe(false);
    expect(
      canDeleteFaqItem("coraline.prono@soregies.fr", "matthieu.roux@alterna-energie.fr", true),
    ).toBe(true);
    expect(canDeleteFaqItem(undefined, "", false)).toBe(false);
  });
  it("en cours → validée → réalisée", () => {
    expect(faqStatus({})).toBe("en-cours");
    expect(faqStatus({ approvedAt: "2026-11-16" })).toBe("validee");
    expect(faqStatus({ approvedAt: "2026-11-16", validatedAt: "2026-11-17" })).toBe("realisee");
    expect(faqStatus({ validatedAt: "2026-10-01" })).toBe("realisee");
  });
  it("garde les nouvelles catégories validées par Geoffrey ou Matthieu, sans doublon", () => {
    const req = (category: string, accepted?: string) =>
      ({ category, newCategory: true, categoryAcceptedAt: accepted }) as unknown as FaqRequest;
    const cats = faqCategories([
      req("Leasing PAC", "2026-11-16T14:37:00Z"),
      req("LEasing pac", "2026-11-16T14:39:00Z"),
      req("Landing page - Site Web"),
      req("souscription", "2026-11-16T15:00:00Z"),
    ]);
    expect(cats.filter((c) => /leasing/i.test(c))).toEqual(["Leasing PAC"]);
    expect(cats).not.toContain("Landing page - Site Web");
    expect(cats.filter((c) => /souscription/i.test(c))).toEqual(["Souscription"]);
    expect(matchFaqCategory("leasing  pac", cats)).toBe("Leasing PAC");
    expect(matchFaqCategory("Autre chose", cats)).toBeNull();
  });
});
