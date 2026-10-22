import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAIL_SENDER } from "./mail-sender";
import { buildStepReminder, canSendStepReminder, GEOFFREY_EMAIL, reminderArticleSchema, reminderConfigSchema, stepReminderSchema } from "./step-reminders";

export const sendStepReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => stepReminderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !canSendStepReminder(isAdmin === true, typeof context.claims.email === "string" ? context.claims.email : undefined)) {
      return { ok: false, error: "Seul Geoffrey peut envoyer ces rappels." };
    }
    const prefix = data.space === "strategie" ? "strat:" : "";
    const keys = [`${prefix}article:${data.articleId}`, `${prefix}pipeline-config`, `${prefix}articles-index`];
    const { data: rows, error } = await context.supabase.from("editorial_kv").select("key,value").in("key", keys);
    if (error || !rows) return { ok: false, error: "L’article n’a pas pu être chargé." };
    try {
      const values = new Map(rows.map(row => [row.key, row.value]));
      const ids: unknown = JSON.parse(values.get(keys[2]) || "[]");
      if (!Array.isArray(ids) || !ids.includes(data.articleId)) return { ok: false, error: "Cet article n’est plus dans le suivi." };
      const article = reminderArticleSchema.parse(JSON.parse(values.get(keys[0]) || "null"));
      const config = reminderConfigSchema.parse(JSON.parse(values.get(keys[1]) || "null"));
      const { data: users } = await context.supabase.rpc("approved_users");
      const reminder = buildStepReminder(data, article, config, users ?? []);
      const lovableKey = process.env.LOVABLE_API_KEY;
      const brevoKey = process.env.BREVO_API_KEY;
      if (!lovableKey || !brevoKey) return { ok: false, error: "L’envoi des mails n’est pas configuré." };
      const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const details = [article.title, article.subject, reminder.deadline ? `Deadline : ${reminder.deadline}` : undefined, article.docxLink].filter((s): s is string => !!s);
      const textContent = ["Bonjour,", "", reminder.message, "", ...details, "", `${reminder.cta} : ${reminder.url}`, "", "Notification de Digicom."].join("\r\n");
      const htmlContent = `<html><body style="font-family:Arial,sans-serif"><h2>Digicom · ${data.space === "strategie" ? "Stratégie PAC" : "Blog"}</h2><p>Bonjour,</p><p>${escape(reminder.message)}</p>${details.map(line => `<p>${escape(line)}</p>`).join("")}<p><a href="${escape(reminder.url)}">${escape(reminder.cta)}</a></p><p>Notification de Digicom.</p></body></html>`;
      const response = await fetch("https://connector-gateway.lovable.dev/brevo/smtp/email", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({ sender: MAIL_SENDER, to: reminder.recipients.map(email => ({ email })),
          ...(!reminder.recipients.includes(GEOFFREY_EMAIL) ? { cc: [{ email: GEOFFREY_EMAIL }] } : {}),
          subject: reminder.subject, textContent, htmlContent }),
      });
      if (!response.ok) {
        const body = await response.text();
        console.error(`Brevo reminder failed [${response.status}]: ${body}`);
        return { ok: false, error: `Le rappel n’a pas pu partir (${response.status}) : ${body}` };
      }
      return { ok: true, error: "" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Le rappel n’a pas pu être envoyé." };
    }
  });