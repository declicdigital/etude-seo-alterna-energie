import { describe, expect, it } from "vitest";
import {
  buildStepDeadlineMail,
  dueStepDeadlines,
  reminderDay,
  stepDeadlineMarker,
} from "./step-deadlines";

const config = [
  {
    key: "redaction",
    label: "Rédaction",
    assignee: "",
    emails: { Aurorae: "caroline@aurorae-editorial.com, elodie@aurorae-editorial.com" },
  },
  {
    key: "image",
    label: "Image",
    assignee: "Geoffrey",
    emails: { Geoffrey: "geoffrey.delabarre@alterna-energie.fr" },
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

describe("deadlines par étape", () => {
  it("prévient 2 jours ouvrés avant, sans tomber le week-end", () => {
    expect(reminderDay("2026-11-12")).toBe("2026-11-10"); // jeudi → mardi
    expect(reminderDay("2026-11-16")).toBe("2026-11-12"); // lundi → jeudi
    expect(reminderDay("2026-11-17")).toBe("2026-11-13"); // mardi → vendredi
  });

  it("ne retient que les étapes en attente dont le rappel est dû", () => {
    const steps = [
      { key: "redaction", status: "done", deadline: "2026-11-12" },
      { key: "image", status: "pending", deadline: "2026-11-12" },
      { key: "relecture", status: "pending", deadline: "2026-11-20" },
      { key: "integration", status: "pending" },
    ];
    expect(dueStepDeadlines(steps, "2026-11-09")).toEqual([]);
    expect(dueStepDeadlines(steps, "2026-11-10")).toEqual([
      { key: "image", deadline: "2026-11-12" },
    ]);
    expect(dueStepDeadlines(steps, "2026-11-11")).toEqual([
      { key: "image", deadline: "2026-11-12" },
    ]);
    expect(dueStepDeadlines(steps, "2026-11-13")).toEqual([]); // deadline passée
    expect(dueStepDeadlines(steps, "2026-11-14")).toEqual([]); // samedi
  });

  it("écrit au responsable de l'étape, au format des mails d'étape", () => {
    const mail = buildStepDeadlineMail({
      space: "",
      articleId: "a1",
      stepKey: "relecture",
      deadline: "2026-11-12",
      today: "2026-11-10",
      article: {
        title: "Heures creuses",
        audience: "Particulier",
        steps: [
          { key: "redaction", status: "done" },
          { key: "image", status: "done" },
          { key: "relecture", status: "pending", assignee: "Service Communication" },
          { key: "integration", status: "pending" },
        ],
      },
      config,
    });
    expect(mail.recipients).toEqual(["fannie.laurendin@soregies.fr", "coraline.prono@soregies.fr"]);
    expect(mail.subject).toBe("Deadline dans 2 jours · Relecture : « Heures creuses »");
    expect(mail.html).toContain("<strong>Deadline dans 2 jours</strong>");
    expect(mail.html).toContain("jeudi 12 novembre");
    expect(mail.html).toContain("Merci de <strong>relire l’article</strong>");
    expect(mail.html).toContain("background:#047857");
    expect(stepDeadlineMarker("", "a1", "relecture", "2026-11-12")).toBe(
      "reminderStep:blog:a1:relecture:2026-11-12",
    );
  });
});
