import { z } from "zod";
import { editorialLink } from "./editorial-links";
import { notificationCta, notificationDeadline, notificationRecipients } from "./article-notification";

export const GEOFFREY_EMAIL = "geoffrey.delabarre@alterna-energie.fr";
export const stepReminderSchema = z.object({
  articleId: z.string().min(1).max(200),
  stepKey: z.string().min(1).max(120),
  space: z.enum(["strategie"]).optional(),
});
export function canSendStepReminder(isAdmin: boolean, email: string | null | undefined) {
  return isAdmin && email?.toLowerCase() === GEOFFREY_EMAIL;
}
const stepSchema = z.object({ key: z.string(), assignee: z.string().optional(), status: z.string().optional() });
export const reminderArticleSchema = z.object({
  title: z.string(), audience: z.string().optional(), type: z.string().optional(),
  subject: z.string().optional(), deadline: z.string().optional(), docxLink: z.string().optional(),
  steps: z.array(stepSchema),
});
export const reminderConfigSchema = z.array(z.object({
  key: z.string(), label: z.string(), assignee: z.string().optional(),
  emails: z.record(z.string(), z.string()).optional(),
}));
const defaults: Record<string, Record<string, string>> = {
  redaction: { Aurorae: "caroline@aurorae-editorial.com, elodie@aurorae-editorial.com", Marina: "contact@marinatravert.com" },
  integration: { Marick: "marick.navarro.ext@soregies.fr" },
  brief: { Geoffrey: GEOFFREY_EMAIL },
};
export function buildStepReminder(
  input: z.infer<typeof stepReminderSchema>,
  article: z.infer<typeof reminderArticleSchema>,
  config: z.infer<typeof reminderConfigSchema>,
  users: { email: string; full_name: string | null }[] = [],
) {
  const review = ["validation", "relecture"].includes(input.stepKey);
  const pro = !input.space && article.audience === "Professionnel";
   if ((input.space === "strategie" && article.type === "Réécriture" && (review || input.stepKey === "image")) || (!pro && input.stepKey === "expert") || input.stepKey === "validation") {
    throw new Error("Cette étape n’existe pas pour cet article.");
  }
  const step = article.steps.find(s => s.key === input.stepKey);
  const cfg = config.find(c => c.key === input.stepKey);
  if (!step || !cfg) throw new Error("Cette étape n’existe plus. Rechargez la page.");
  const assignee = step.assignee?.trim() || cfg.assignee?.trim() || (input.stepKey === "brief" ? "Geoffrey" : "");
  const raw = cfg.emails?.[assignee] || defaults[input.stepKey]?.[assignee] || "";
  const configured = raw.split(/[,;\s]+/).filter(Boolean);
  const matched = users.filter(u => u.full_name?.trim().toLowerCase() === assignee.toLowerCase()).map(u => u.email);
  const kind = input.stepKey === "image" ? "image" : review ? "relecture" : undefined;
  const recipients = notificationRecipients(kind, configured.length ? configured : matched);
  if (!recipients.length || recipients.some(email => !z.string().email().safeParse(email).success)) {
    throw new Error("Renseignez l’adresse mail de ce responsable dans les réglages du pipeline.");
  }
  const label = pro && input.stepKey === "redaction" ? "Édition" : cfg.label;
  const message = input.stepKey === "image"
    ? "Rappel : cet article a été rédigé. Merci de lui trouver une image, de l’ajouter dans la carte et de valider l’étape Image."
    : review ? "Rappel : cet article a été rédigé et son image a été ajoutée. Merci de le relire et de valider l’étape Relecture dans la carte."
    : input.stepKey === "redaction" ? "Rappel : cet article attend sa rédaction. Merci de compléter le document et de valider l’étape Édition dans la carte."
    : input.stepKey === "expert" ? "Rappel : cet article a été rédigé et attend votre relecture métier. Merci de le relire et de valider cette étape dans la carte."
    : input.stepKey === "integration" ? "Rappel : cet article attend son intégration dans le site. Merci de l’intégrer, de renseigner le lien publié et de valider cette étape dans la carte."
    : input.stepKey === "brief" ? "Rappel : le brief de cet article reste à compléter. Merci de compléter les informations et de valider cette étape dans la carte."
    : `Rappel : cet article attend votre intervention à l’étape « ${label} ». Merci de compléter et de valider cette étape dans la carte.`;
  return {
    recipients, label, message, subject: `Rappel · ${label} : « ${article.title} »`,
    cta: notificationCta(kind),
    url: editorialLink(input.articleId, input.stepKey, kind === "image" ? "images" : undefined, false, input.space),
    deadline: notificationDeadline(article.deadline, kind, recipients),
  };
}