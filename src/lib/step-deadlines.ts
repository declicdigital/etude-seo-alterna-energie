/**
 * Deadlines par étape (posées par Geoffrey dans la carte) : le responsable de l'étape
 * reçoit un mail 2 jours ouvrés avant la deadline. Fonctions pures, testées ; l'envoi
 * se fait dans le job quotidien /api/public/jobs/deadline-reminders.
 */
import { z } from "zod";
import { editorialMailHtml, escapeHtml } from "./mail-layout";
import { spaceLabel } from "./editorial-spaces";
import { buildStepReminder, reminderArticleSchema, reminderConfigSchema } from "./step-reminders";

export const STEP_DEADLINE_NOTICE_DAYS = 2;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const isWeekday = (iso: string) => dayOf(iso) !== 0 && dayOf(iso) !== 6;

/** Date du rappel : `n` jours ouvrés avant la deadline (lundi → jeudi précédent pour n = 2). */
export function reminderDay(deadline: string, n = STEP_DEADLINE_NOTICE_DAYS): string {
  let d = deadline;
  let left = n;
  while (left > 0) {
    d = shift(d, -1);
    if (isWeekday(d)) left--;
  }
  return d;
}

const stepWithDeadline = z.object({
  key: z.string(),
  status: z.string().optional(),
  assignee: z.string().optional(),
  deadline: z.string().optional(),
});

/** Étapes en attente dont le rappel est dû aujourd'hui (ou a été manqué, tant que la deadline n'est pas passée). */
export function dueStepDeadlines(
  steps: unknown,
  today: string,
): { key: string; deadline: string }[] {
  if (!isWeekday(today) || !Array.isArray(steps)) return [];
  return steps.flatMap((raw) => {
    const step = stepWithDeadline.safeParse(raw);
    if (!step.success) return [];
    const { key, status, deadline } = step.data;
    if ((status ?? "pending") !== "pending" || !deadline || !ISO.test(deadline)) return [];
    return today >= reminderDay(deadline) && today <= deadline ? [{ key, deadline }] : [];
  });
}

const frDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  });

function whenText(deadline: string, today: string): string {
  const days = Math.round((Date.parse(deadline) - Date.parse(today)) / 86400000);
  return days <= 0 ? "aujourd'hui" : days === 1 ? "demain" : `dans ${days} jours`;
}

/** Mail « deadline dans 2 jours » pour une étape, au format des mails d'étape. */
export function buildStepDeadlineMail(opts: {
  space: string;
  articleId: string;
  stepKey: string;
  deadline: string;
  today: string;
  article: unknown;
  config: unknown;
  users?: { email: string; full_name: string | null }[];
}) {
  const article = reminderArticleSchema.parse(opts.article);
  const config = reminderConfigSchema.parse(opts.config);
  const space = (opts.space || undefined) as "strategie" | "planete" | undefined;
  const r = buildStepReminder(
    { articleId: opts.articleId, stepKey: opts.stepKey, space },
    article,
    config,
    opts.users ?? [],
  );
  const when = whenText(opts.deadline, opts.today);
  const date = frDate(opts.deadline);
  // Reprend la consigne de l'étape (« Merci de relire l'article… ») sans le mot « Rappel ».
  const action = r.introHtml.replace(/^Bonjour,<br><br><strong>Rappel<\/strong> : /, "");
  const actionText = r.message.replace(/^Rappel : /, "");
  const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const introHtml =
    `Bonjour,<br><br><strong>Deadline ${escapeHtml(when)}</strong> : l’étape « <strong>${escapeHtml(r.label)}</strong> » ` +
    `de cet article est à valider pour le <strong>${escapeHtml(date)}</strong>.<br><br>${capital(action)}`;
  const subject = `Deadline ${when} · ${r.label} : « ${article.title} »`;
  const text = [
    "Bonjour,",
    "",
    `Deadline ${when} : l’étape « ${r.label} » de cet article est à valider pour le ${date}.`,
    "",
    capital(actionText),
    "",
    `Nom de l'article (H1) : ${article.title}`,
    article.subject ? `Sujet : ${article.subject}` : null,
    `Deadline de l'étape : ${date}`,
    article.docxLink ? `Lien du doc : ${article.docxLink}` : null,
    "",
    `${r.cta} : ${r.url}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\r\n");
  const html = editorialMailHtml({
    heading: `Digicom · ${spaceLabel(opts.space)}`,
    introHtml,
    fields: [
      ["Nom de l'article (H1)", article.title],
      ["Sujet", article.subject],
      ["Deadline de l'étape", date],
      ["Lien du doc", article.docxLink],
    ],
    cta: { label: r.cta, url: r.url },
  });
  return { recipients: r.recipients, subject, text, html, label: r.label };
}

/** Clé du marqueur « déjà envoyé » (une nouvelle deadline relance un rappel). */
export const stepDeadlineMarker = (
  space: string,
  articleId: string,
  stepKey: string,
  deadline: string,
) => `reminderStep:${space || "blog"}:${articleId}:${stepKey}:${deadline}`;
