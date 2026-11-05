import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { editorialLink, notificationLink } from "@/lib/editorial-links";
import { spaceLabel, spacePrefix } from "@/lib/editorial-spaces";
import { buildStepReminder } from "@/lib/step-reminders";
import { sheetAllowed } from "@/lib/sections";
import { extraColumnsOf, extraOptionsFor, headersOf } from "@/lib/workbook";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scope: any = {};
runInNewContext(readFileSync("public/editorial-pipeline.js", "utf8"), scope);
const pipeline = scope.EditorialPipeline;

const BLOG_CONFIG = [
  { key: "redaction", label: "Rédaction", assignee: "", options: ["Aurorae", "Marina"] },
  { key: "image", label: "Image", assignee: "Geoffrey" },
  { key: "relecture", label: "Relecture", assignee: "Service Communication" },
  { key: "integration", label: "Intégration", assignee: "Marick" },
];

describe("Parlons Planète", () => {
  it("only has Rédaction (Aurorae) then Intégration (Geoffrey)", () => {
    const cfg = pipeline.normalizeConfig(BLOG_CONFIG, "planete");
    expect(cfg.map((c: { key: string }) => c.key)).toEqual(["redaction", "integration"]);
    expect(cfg[1].assignee).toBe("Geoffrey");
    expect(cfg[1].emails.Geoffrey).toBe("geoffrey.delabarre@alterna-energie.fr");
    const fresh = pipeline.normalizeConfig([], "planete");
    expect(fresh[0].options).toEqual(["Aurorae"]);
  });

  it("keeps the Blog pipeline unchanged", () => {
    const cfg = pipeline.normalizeConfig(BLOG_CONFIG);
    expect(cfg.map((c: { key: string }) => c.key)).toEqual([
      "redaction",
      "image",
      "relecture",
      "integration",
    ]);
  });

  it("drops any image or review step from existing articles", () => {
    const article = {
      audience: "Particulier",
      steps: [
        {
          key: "redaction",
          status: "done",
          assignee: "Aurorae",
          date: "2026-11-05",
          attachments: [],
        },
        {
          key: "relecture",
          status: "pending",
          assignee: "Service Communication",
          date: "",
          attachments: [],
        },
      ],
    };
    pipeline.sync(article, BLOG_CONFIG, "planete");
    expect(article.steps.map((s) => `${s.key}:${s.assignee}:${s.status}`)).toEqual([
      "redaction:Aurorae:done",
      "integration:Geoffrey:pending",
    ]);
  });

  it("mails Geoffrey to integrate once written, and nobody after", () => {
    expect(pipeline.nextNotification({}, "redaction", "planete")).toMatchObject({
      kind: "integration",
      next: "integration",
    });
    expect(pipeline.nextNotification({}, "integration", "planete")).toBeNull();
  });

  it("has its own storage, label and links", () => {
    expect(spacePrefix("planete")).toBe("planete:");
    expect(spaceLabel("planete")).toBe("Parlons Planète");
    expect(editorialLink("a1", "integration", undefined, false, "planete")).toBe(
      "https://etude-seo-alterna-energie.lovable.app/?sheet=SUIVI+PLANETE#article-a1?step=integration",
    );
    expect(editorialLink()).toBe(
      "https://etude-seo-alterna-energie.lovable.app/?sheet=SUIVI+EDITORIAL",
    );
    expect(notificationLink("integration", "a1", undefined, "planete")).toContain("SUIVI+PLANETE");
  });

  it("sends integration reminders to Geoffrey", () => {
    const reminder = buildStepReminder(
      { articleId: "a1", stepKey: "integration", space: "planete" },
      {
        title: "Planète",
        steps: [{ key: "integration", assignee: "Geoffrey", status: "pending" }],
      },
      [{ key: "integration", label: "Intégration", assignee: "Geoffrey" }],
    );
    expect(reminder.recipients).toEqual(["geoffrey.delabarre@alterna-energie.fr"]);
    expect(() =>
      buildStepReminder(
        { articleId: "a1", stepKey: "relecture", space: "planete" },
        { title: "Planète", steps: [{ key: "relecture" }] },
        [{ key: "relecture", label: "Relecture" }],
      ),
    ).toThrow();
  });

  it("lists articles in a single « Blog » with categories but no audience", () => {
    const headers = headersOf("PLANETE - ARTICLES");
    expect(headers[1]).toBe("Articles");
    expect(headers[2]).toBe("");
    expect(headers[3]).toBe("");
    expect(headers[4]).toBe("Date de publication");
    expect(headers[5]).toBe("");
    expect(headers[6]).toBe("Catégorie");
    expect(headers[7]).toBe("Sous-catégorie");
    expect(extraColumnsOf("PLANETE - ARTICLES").find((c) => c.col === 6)?.options).toContain(
      "Énergies vertes",
    );
    expect(headers[10] ?? "").toBe("");
    expect(extraColumnsOf("PLANETE - ARTICLES").some((c) => c.label === "Énergie")).toBe(false);
  });

  it("narrows the Blog's sub-categories to the row's category", () => {
    const sub = extraColumnsOf("PLANETE - ARTICLES").find((c) => c.col === 7);
    const row: string[] = [];
    row[6] = "Énergies vertes";
    expect(extraOptionsFor(sub, row)).toEqual([
      "Éoliennes",
      "Gaz",
      "Hydraulique",
      "Hydrogène",
      "Solaire",
    ]);
    expect(extraOptionsFor(sub, [])).toContain("Biodiversité");
  });

  it("is closed by default and opened per account", () => {
    expect(sheetAllowed("SUIVI PLANETE", ["Blog"])).toBe(false);
    expect(sheetAllowed("PLANETE - ARTICLES", ["Parlons Planète"])).toBe(false);
    expect(sheetAllowed("PLANETE - ARTICLES", ["Parlons Planète", "Parlons Planète/Blog"])).toBe(
      true,
    );
    expect(sheetAllowed("SUIVI PLANETE", ["Parlons Planète"])).toBe(true);
  });
});
