import { describe, expect, it } from "vitest";
import { buildStepReminder, canSendStepReminder, GEOFFREY_EMAIL } from "./step-reminders";

const config: Parameters<typeof buildStepReminder>[2] = [
  { key: "image", label: "Image", assignee: "Geoffrey" },
  { key: "redaction", label: "Rédaction" }, { key: "expert", label: "Relecture métier", emails: { Clément: "clement@example.org" } },
  { key: "relecture", label: "Relecture", emails: { "Service Communication": "fannie.laurendin@soregies.fr" } },
  { key: "integration", label: "Intégration", assignee: "Marick" }, { key: "brief", label: "Brief" },
];
const article = { title: "Article réel", deadline: "2026-10-23", audience: "Professionnel", type: "Création", steps: [
  { key: "image", assignee: "Geoffrey" },
  { key: "redaction", assignee: "Aurorae" }, { key: "expert", assignee: "Clément" },
  { key: "relecture", assignee: "Service Communication" }, { key: "integration", assignee: "Marick" }, { key: "brief" },
] };
describe("manual reminders", () => {
  it("allows Geoffrey only when his verified account is admin", () => {
    expect(canSendStepReminder(true, GEOFFREY_EMAIL)).toBe(true);
    expect(canSendStepReminder(false, GEOFFREY_EMAIL)).toBe(false);
    expect(canSendStepReminder(true, "fannie.laurendin@soregies.fr")).toBe(false);
    expect(canSendStepReminder(true, undefined)).toBe(false);
  });
  it("sends PAC review reminders to Fannie and Coraline together without a deadline", () => {
    const mail = buildStepReminder({ articleId: "test", stepKey: "relecture", space: "strategie" }, article, config);
    expect(mail.recipients).toEqual(["fannie.laurendin@soregies.fr", "coraline.prono@soregies.fr"]);
    expect(mail.deadline).toBeUndefined();
    expect(mail.url).toContain("step=relecture");
  });
  it("does not allow a review reminder for a PAC rewrite", () => {
    expect(() => buildStepReminder({ articleId: "test", stepKey: "relecture", space: "strategie" }, { ...article, type: "Réécriture" }, config)).toThrow();
  });
  it("resolves both Aurorae recipients for edition", () => {
    expect(buildStepReminder({ articleId: "test", stepKey: "redaction" }, article, config).recipients).toEqual(["caroline@aurorae-editorial.com", "elodie@aurorae-editorial.com"]);
  });
  it("sends the expert reminder to the individually assigned expert", () => {
    const mail = buildStepReminder({ articleId: "test", stepKey: "expert" }, article, config);
    expect(mail.recipients).toEqual(["clement@example.org"]);
    expect(mail.url).toContain("step=expert");
  });
  it("sends the integration reminder to Marick without changing the article", () => {
    const before = JSON.stringify(article);
    expect(buildStepReminder({ articleId: "test", stepKey: "integration" }, article, config).recipients).toEqual(["marick.navarro.ext@soregies.fr"]);
    expect(JSON.stringify(article)).toBe(before);
  });
  it("does not substitute a different responsible person when their email is missing", () => {
    expect(() => buildStepReminder({ articleId: "test", stepKey: "redaction" }, { ...article, steps: [{ key: "redaction", assignee: "Unconfigured" }] }, config)).toThrow();
  });
  it("routes brief reminders to Geoffrey", () => {
    expect(buildStepReminder({ articleId: "test", stepKey: "brief", space: "strategie" }, article, config).recipients).toEqual([GEOFFREY_EMAIL]);
  });
});
it('routes Image reminders only to Geoffrey with the image destination', () => {
  const mail = buildStepReminder({articleId:'test',stepKey:'image'},article,config);
  expect(mail.recipients).toEqual([GEOFFREY_EMAIL]);
  expect(mail.url).toContain('step=image&focus=images');
});
it('rejects Image reminders on PAC rewrites', () => {
  expect(() => buildStepReminder({articleId:'test',stepKey:'image',space:'strategie'},{...article,type:'Réécriture'},config)).toThrow();
});
