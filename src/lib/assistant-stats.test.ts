import { describe, expect, it } from "vitest";
import { buildStatsBlock, cellDate, listRows, LISTS } from "./assistant-stats";
import { zonesFor } from "./assistant-knowledge";
import type { EditsMap } from "./workbook";

const planete = LISTS.find((l) => l.id === "planete-blog")!;
const edits = {
  "PLANETE - ARTICLES": {
    1: { 0: "x", 1: "Plante", 4: "2026-11-03", 6: "Planète", 7: "Biodiversité", 9: "https://p" },
    2: { 0: "x", 1: "Canicule", 4: "20/10/2026", 6: "Planète" },
    3: { [-1]: "__deleted__", 1: "Supprimé", 4: "2026-11-04" },
    4: { 1: "", 4: "2026-11-05" },
  },
} as unknown as EditsMap;

describe("chiffres de D.I.G.I.P.O.T.E", () => {
  it("lit les dates sous toutes leurs formes", () => {
    expect(cellDate("2026-11-03")).toBe("2026-11-03");
    expect(cellDate("publié le 29/01/2026")).toBe("2026-01-29");
    expect(cellDate(45000)).toBe("2023-03-15");
    expect(cellDate("bientôt")).toBeNull();
  });

  it("compte les lignes réelles d'une liste (sans les supprimées ni les vides)", () => {
    const rows = listRows(planete, edits);
    expect(rows.map((r) => r.title)).toEqual(["Plante", "Canicule"]);
  });

  it("calcule ce mois-ci, par mois, le suivi et « À rédiger »", () => {
    const zoneIds = new Set(
      zonesFor(
        [
          "Parlons Planète",
          "Parlons Planète/Blog",
          "Blog",
          "Blog/Particulier",
          "Blog/Professionnel",
        ],
        false,
      ).map((z) => z.id),
    );
    const block = buildStatsBlock({
      today: "2026-11-09",
      zoneIds,
      edits,
      faq: [],
      articles: {
        blog: [
          {
            title: "A",
            steps: [
              { key: "redaction", status: "done", date: "2026-11-02" },
              { key: "relecture", status: "pending", deadline: "2026-11-06" },
            ],
          },
          {
            title: "B",
            blogRowId: 500,
            steps: [
              { key: "redaction", status: "done", date: "2026-10-02" },
              { key: "integration", status: "done", date: "2026-11-05" },
            ],
          },
        ],
      },
      todos: {
        blog: [
          { sujet: "x", editrice: "Aurorae", deadline: "2026-11-11" },
          { sujet: "y", articleId: "z" },
        ],
      },
    });
    expect(block).toContain("Parlons Planète · Blog : 2 articles");
    expect(block).toContain("ce mois-ci (novembre 2026) : 1");
    expect(block).toContain("par mois : novembre 2026 : 1 · octobre 2026 : 1");
    expect(block).toContain(
      "Blog · Suivi éditorial : 2 articles suivis, 1 publié (intégration validée), 1 en cours",
    );
    expect(block).toContain("deadlines d'étape dépassées : 1");
    expect(block).toContain("« À rédiger » : 1 sujet pas encore enregistré");
    expect(block).toMatch(
      /Total Blog \(Particulier \+ Professionnel\) : \d+ \+ \d+ = \d+ articles/,
    );
    expect(block).toContain("Newsletter Grands Comptes : prochain envoi"); // ouvertes par défaut
    expect(block).not.toContain("Stratégie PAC");
  });
});
