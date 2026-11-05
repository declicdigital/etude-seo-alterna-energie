import { describe, expect, it } from "vitest";
import { visibleRubriqueEntries } from "@/lib/rubriques";

const keys = (allowed: string[] | null) => visibleRubriqueEntries(allowed).map((r) => r.key);

describe("rubriques visibles (accueil et guide)", () => {
  it("montre tout quand l'accès n'est pas restreint", () => {
    expect(keys(null)).toEqual([
      "pac",
      "blog",
      "planete",
      "faq",
      "benchmark",
      "newsletters",
      "organisation",
    ]);
  });

  it("ne montre que les rubriques ouvertes, Parlons Planète et Organisation restant fermées par défaut", () => {
    expect(keys(["Blog", "Blog/Particulier"])).toEqual(["blog", "benchmark", "newsletters"]);
    expect(keys(["!Benchmark", "!Calendriers newsletters", "FAQ", "FAQ/Professionnel"])).toEqual([
      "faq",
    ]);
    expect(keys(["Parlons Planète", "Parlons Planète/Blog", "Organisation"])).toEqual(
      expect.arrayContaining(["planete", "organisation"]),
    );
  });

  it("ouvre la première feuille autorisée de la rubrique", () => {
    const faq = visibleRubriqueEntries(["FAQ", "FAQ/Professionnel"]).find((r) => r.key === "faq");
    expect(faq?.entry).toBe("SUIVI FAQ");
    const nl = visibleRubriqueEntries([
      "Calendriers newsletters",
      "!Calendriers newsletters/Grands Comptes",
    ]).find((r) => r.key === "newsletters");
    expect(nl?.entry).toBe("NEWSLETTER INTERNE");
  });
});
