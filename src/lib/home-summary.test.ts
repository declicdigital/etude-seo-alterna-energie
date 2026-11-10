import { describe, expect, it } from "vitest";
import { buildHomeSummary, teamNamesOf, type StepConfig } from "./home-summary";

const config: StepConfig[] = [
  {
    key: "redaction",
    label: "Rédaction",
    emails: { Aurorae: "caroline@aurorae-editorial.com, elodie@aurorae-editorial.com" },
  },
  {
    key: "relecture",
    label: "Relecture",
    assignee: "Service Communication",
    emails: { "Service Communication": "fannie.laurendin@soregies.fr, coraline.prono@soregies.fr" },
  },
  {
    key: "integration",
    label: "Intégration",
    assignee: "Marick",
    emails: { Marick: "marick.navarro.ext@soregies.fr" },
  },
];

describe("teamNamesOf", () => {
  it("finds the team names of a person from the tracker settings", () => {
    expect(teamNamesOf("coraline.prono@soregies.fr", "Coraline", [config])).toEqual([
      "Coraline",
      "Service Communication",
    ]);
    expect(teamNamesOf("elodie@aurorae-editorial.com", null, [config])).toEqual(["Aurorae"]);
    expect(teamNamesOf("marick.navarro@soregies.fr", "Marick", [config])).toEqual(["Marick"]);
  });
});

describe("buildHomeSummary", () => {
  const summary = buildHomeSummary({
    today: "2026-11-10",
    me: ["Service Communication"],
    spaces: [
      {
        space: "blog",
        config,
        todos: [
          {
            id: "t1",
            sujet: "Recharge bidirectionnelle",
            editrice: "Aurorae",
            deadline: "2026-11-20",
          },
        ],
        articles: [
          {
            id: "a1",
            title: "À relire",
            steps: [
              { key: "redaction", status: "done" },
              { key: "relecture", status: "pending", deadline: "2026-11-08" },
            ],
          },
          {
            id: "a2",
            title: "À intégrer",
            steps: [
              { key: "relecture", status: "done" },
              { key: "integration", status: "pending", deadline: "2026-11-12" },
            ],
          },
          {
            id: "a3",
            title: "Publié",
            finalLink: "https://x.fr/a",
            steps: [{ key: "integration", status: "done", date: "2026-11-02" }],
          },
          {
            id: "a4",
            title: "Loin",
            steps: [{ key: "integration", status: "pending", deadline: "2027-01-30" }],
          },
        ],
      },
    ],
    radarYear: {
      campaigns: [
        {
          title: "Parrainage",
          startDate: "2026-11-01",
          endDate: "2026-12-31",
          campaignType: "Parrainage",
        },
        { title: "Offre PAC", startDate: "2026-09-28", endDate: "2026-12-31" },
        { title: "Été", startDate: "2026-06-29", endDate: "2026-07-08" },
      ],
      milestones: [
        { title: "Black Friday", date: "2026-11-27", icon: "🛍" },
        { title: "Fête nationale", date: "2026-07-14" },
      ],
    },
  });

  it("lists what is waiting for me, late first", () => {
    expect(summary.mine.map((t) => [t.title, t.step, t.late])).toEqual([
      ["À relire", "Relecture", true],
    ]);
    expect(summary.mine[0].path).toBe("/blog/suivi-editorial/articles/a-relire--a1?step=relecture");
  });
  it("shows the team's deadlines of the next two weeks, not later ones", () => {
    expect(summary.upcoming.map((t) => `${t.title} · ${t.assignee}`)).toEqual([
      "À intégrer · Marick",
      "Recharge bidirectionnelle · Aurorae",
    ]);
  });
  it("lists published contents with their online link", () => {
    expect(summary.published).toEqual([
      {
        space: "Blog",
        title: "Publié",
        date: "2026-11-02",
        url: "https://x.fr/a",
        path: "/blog/suivi-editorial/articles/publie--a3",
      },
    ]);
  });
  it("gives Le Radar of the current month", () => {
    expect(summary.radar?.month).toBe("novembre 2026");
    expect(summary.radar?.campaigns.map((c) => c.title)).toEqual(["Parrainage", "Offre PAC"]);
    expect(summary.radar?.milestones.map((m) => m.title)).toEqual(["Black Friday"]);
  });
  it("gives no Radar block to people without access", () => {
    expect(buildHomeSummary({ today: "2026-11-10", me: [], spaces: [] }).radar).toBeNull();
  });
});
