import { describe, expect, it } from "vitest";
import {
  ASSISTANT_ZONES,
  assistantSystemPrompt,
  localAnswer,
  zonesFor,
} from "./assistant-knowledge";
import { sheetFromPath } from "./slugs";

describe("assistant Digicom", () => {
  it("ne propose que les zones ouvertes à la personne", () => {
    const ids = zonesFor(
      ["Blog", "Blog/Particulier", "!Benchmark", "!Calendriers newsletters"],
      false,
    ).map((z) => z.id);
    expect(ids).toContain("blog-suivi");
    expect(ids).not.toContain("organisation");
    expect(ids).not.toContain("demandes");
    expect(zonesFor(null, true).map((z) => z.id)).toContain("demandes");
  });

  it("n'utilise que des chemins qui ouvrent une vraie page", () => {
    const routes = new Set(["/kit-communication", "/demandes"]);
    for (const z of ASSISTANT_ZONES) {
      expect(routes.has(z.path) || sheetFromPath(z.path.slice(1)) !== null, z.path).toBe(true);
    }
  });

  it("répond sans IA avec la fiche la plus proche et un lien, en commençant par Bonjour", () => {
    const zones = zonesFor(null, true);
    const a = localAnswer("comment j'ajoute les images 1500 ?", zones, "Coraline");
    expect(a.startsWith("Bonjour Coraline")).toBe(true);
    expect(a).toContain("1500 × 700");
    expect(a).toContain("(/blog/suivi-editorial)");
    expect(localAnswer("xyzzy", zones)).toContain("[Guide de l'outil](/guide)");
  });

  it("donne au modèle les règles et les seules zones accessibles", () => {
    const p = assistantSystemPrompt({
      zones: zonesFor(["FAQ", "FAQ/Particulier"], false),
      name: "Marick",
    });
    expect(p).toContain("commence par « Bonjour Marick »");
    expect(p).toContain("/faq/demandes");
    expect(p).not.toContain("/organisation");
  });
});
