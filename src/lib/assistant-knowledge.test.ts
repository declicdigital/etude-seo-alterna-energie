import { describe, expect, it } from "vitest";
import {
  ASSISTANT_TOPICS,
  ASSISTANT_ZONES,
  assistantSystemPrompt,
  formatUnansweredForCopy,
  localAnswer,
  localAnswerResult,
  splitNoAnswer,
  zonesFor,
  correctionsFor,
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
    expect(p).toContain("« Bonjour Marick 👋 Bip-boup");
    expect(p).toContain("/faq/demandes");
    expect(p).not.toContain("/organisation");
  });

  it("parle comme un robot et ne redit bonjour qu'au premier message", () => {
    const zones = zonesFor(["Blog"], false);
    const first = localAnswer("où mettre les images ?", zones, "Fannie");
    expect(first.startsWith("Bonjour Fannie ! ")).toBe(true);
    expect(first).toMatch(/Bip|Bzzt/);
    const next = localAnswer("où mettre les images ?", zones, "Fannie", { greet: false });
    expect(next.startsWith("Bonjour")).toBe(false);
    expect(next).toMatch(/^(Bip|Bzzt)/);
    expect(assistantSystemPrompt({ zones, name: "Fannie" })).toContain("petit robot sympathique");
  });

  it("repère et retire la balise « sans réponse » du modèle", () => {
    expect(splitNoAnswer("Bzzt… je ne sais pas.\n[[SANS_REPONSE]]")).toEqual({
      text: "Bzzt… je ne sais pas.",
      unanswered: true,
    });
    expect(splitNoAnswer("Bip ! Voilà.").unanswered).toBe(false);
  });

  it("signale les questions sans réponse locale", () => {
    const zones = zonesFor(["Blog"], false);
    expect(localAnswerResult("xyzzy quantique", zones).answered).toBe(false);
    expect(localAnswerResult("comment ajouter les images 1500 ?", zones).answered).toBe(true);
  });

  it("prépare un texte à copier-coller pour Geoffrey", () => {
    const text = formatUnansweredForCopy([
      {
        created_at: "2026-11-09T14:00:00Z",
        user_name: "Fannie",
        question: "Combien d'articles ?",
        reply: null,
        page: "Suivi éditorial",
      },
    ]);
    expect(text).toContain("Questions sans réponse de D.I.G.I.P.O.T.E (1)");
    expect(text).toContain("1. Combien d'articles ?");
    expect(text).toContain("Fannie · page Suivi éditorial");
    expect(text).toContain("Réponse à intégrer :");
  });

  it("donne au modèle le vrai rôle de la personne et le nom d'Alterna Énergie", () => {
    const zones = zonesFor(["Parlons Planète", "Parlons Planète/Blog"], false);
    const p = assistantSystemPrompt({
      zones,
      name: "Caroline",
      email: "Caroline@aurorae-editorial.com",
    });
    expect(p).toContain("Son rôle : rédactrice (Aurorae)");
    expect(p).toContain("Alterna Énergie");
    expect(p).toContain("[[SANS_REPONSE]]");
    expect(assistantSystemPrompt({ zones, email: "inconnu@x.fr" })).toContain("ne le suppose pas");
  });

  it("chaque fiche pointe vers une zone existante", () => {
    const ids = new Set(ASSISTANT_ZONES.map((z) => z.id));
    for (const t of ASSISTANT_TOPICS)
      for (const z of Array.isArray(t.zone) ? t.zone : [t.zone])
        expect(z === "all" || ids.has(z)).toBe(true);
  });

  it("met les corrections de Geoffrey en priorité dans le contexte", () => {
    const zones = zonesFor(null, true);
    const p = assistantSystemPrompt({
      zones,
      corrections: [{ question: "ça veut dire quoi pac ?", correction: "Pompe à chaleur." }],
    });
    expect(p).toContain("Réponses corrigées par Geoffrey");
    expect(p).toContain("Bonne réponse : Pompe à chaleur.");
    expect(assistantSystemPrompt({ zones })).not.toContain("Réponses corrigées par Geoffrey");
  });

  it("ne dit jamais rien des rubriques fermées", () => {
    // Benchmark et newsletters sont ouverts par défaut : on les ferme explicitement ici.
    const zones = zonesFor(
      ["FAQ", "FAQ/Particulier", "!Benchmark", "!Calendriers newsletters"],
      false,
    );
    const ids = zones.map((z) => z.id);
    expect(ids).toContain("faq-part");
    expect(ids).not.toContain("faq-pro");
    const p = assistantSystemPrompt({
      zones,
      name: "Fannie",
      email: "fannie.laurendin@soregies.fr",
    });
    for (const word of [
      "Parlons Planète",
      "Stratégie PAC",
      "Benchmark",
      "Organisation",
      "Grands Comptes",
      "Blog Particulier",
      "FAQ › Professionnel",
      // Marick valide aussi les FAQ : seul son rôle sur le blog doit rester caché.
      "intègre les articles",
    ])
      expect(p).not.toContain(word);
    const local = localAnswer("c'est quoi digicom ?", zones);
    expect(local).not.toMatch(/Parlons Planète|Stratégie PAC|benchmark|newsletters|tâches/);
  });

  it("une seule newsletter ouverte ne montre que celle-là", () => {
    const zones = zonesFor(
      [
        "Calendriers newsletters",
        "Calendriers newsletters/Interne",
        "!Calendriers newsletters/Grands Comptes",
        "!Calendriers newsletters/B2C",
        "!Calendriers newsletters/SME",
      ],
      false,
    );
    expect(zones.map((z) => z.id).filter((id) => id.startsWith("nl-"))).toEqual(["nl-interne"]);
  });

  it("filtre les corrections qui parlent d'une rubrique fermée", () => {
    const zones = zonesFor(["FAQ", "FAQ/Particulier"], false);
    const kept = correctionsFor(
      [
        {
          question: "ça veut dire quoi pac ?",
          correction: "PAC veut dire pompe à chaleur : la rubrique Stratégie PAC…",
        },
        {
          question: "comment demander une faq ?",
          correction: "Dans FAQ › Demandes, remplis le formulaire.",
        },
      ],
      zones,
    );
    expect(kept.map((c) => c.question)).toEqual(["comment demander une faq ?"]);
  });

  it("donne les réponses générales à tout le monde, même si elles citent une rubrique", () => {
    const zones = zonesFor(["FAQ", "FAQ/Particulier"], false);
    const kept = correctionsFor(
      [
        { question: "c'est quoi une PAC ?", correction: "Une pompe à chaleur.", isPublic: true },
        { question: "où sont les contenus PAC ?", correction: "Dans Stratégie PAC › Contenus." },
      ],
      zones,
    );
    expect(kept.map((c) => c.question)).toEqual(["c'est quoi une PAC ?"]);
  });
});
