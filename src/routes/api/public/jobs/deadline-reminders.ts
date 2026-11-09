import { createFileRoute } from "@tanstack/react-router";
import { editorialLink } from "@/lib/editorial-links";
import { ALL_SPACES, spaceLabel, spacePrefix } from "@/lib/editorial-spaces";
import { MAIL_SENDER } from "@/lib/mail-sender";
import { buildStepDeadlineMail, dueStepDeadlines, stepDeadlineMarker } from "@/lib/step-deadlines";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";
const SENDER = MAIL_SENDER;
const CC_EMAIL = "geoffrey.delabarre@alterna-energie.fr";

const EDITOR_EMAILS: Record<string, string[]> = {
  aurorae: ["caroline@aurorae-editorial.com", "elodie@aurorae-editorial.com"],
  marina: ["contact@marinatravert.com"],
};


type Todo = {
  id: string;
  sujet?: string;
  h1?: string;
  editrice?: string;
  deadline?: string;
  articleId?: string | null;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildHtml(p: { days: number; space: string; id: string; sujet: string; h1: string; deadline: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f4;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#047857;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">Digicom · ${spaceLabel(p.space)}</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:16px"><strong>Rappel de deadline</strong></p>
<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Sujet</p>
<p style="margin:0 0 16px;font-size:16px;font-weight:bold">${esc(p.sujet)}</p>
${p.h1 ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Article</p><p style="margin:0 0 16px">${esc(p.h1)}</p>` : ""}
<div style="background:#fef3c7;border-left:4px solid #d97706;padding:14px 16px;border-radius:6px;font-size:15px;line-height:1.5;margin:0 0 24px">${p.days === 0 ? `C'est <strong>aujourd'hui</strong> la deadline pour livrer l'article (<strong>${esc(p.deadline)}</strong>).` : `Il vous reste <strong>${p.days} jours</strong> pour livrer l'article (deadline : <strong>${esc(p.deadline)}</strong>).`}</div>
<a href="${editorialLink(p.id, undefined, undefined, true, p.space, p.h1 || p.sujet)}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Ouvrir Digicom</a>
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#9ca3af">Rappel automatique de Digicom. Merci de ne pas répondre à ce mail.</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendBrevo(to: string[], subject: string, text: string, html: string): Promise<void> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const brevoKey = process.env["BREVO_API_KEY"];
  if (!lovableKey || !brevoKey) throw new Error("mail secrets missing");
  const res = await fetch(`${GATEWAY_URL}/smtp/email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": brevoKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: SENDER,
      to: to.map((email) => ({ email })),
      ...(!to.includes(CC_EMAIL) ? { cc: [{ email: CC_EMAIL }] } : {}),
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Brevo send failed [${res.status}]: ${errorBody}`);
    throw new Error(`Provider request failed [${res.status}]: ${errorBody}`);
  }
}

export const Route = createFileRoute("/api/public/jobs/deadline-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Auth: shared token stored in editorial_kv (read by the scheduled job and sent as header).
        const { data: tokenRow } = await supabaseAdmin
          .from("editorial_kv")
          .select("value")
          .eq("key", "cron-token")
          .maybeSingle();
        const expected = tokenRow?.value;
        const provided = request.headers.get("x-cron-token");
        if (!expected || !provided || provided !== expected) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        // Each editorial space (Blog, Stratégie PAC, Parlons Planète) has its own todo list and pipeline settings.
        const todos: (Todo & { space: string; emails: Record<string, string[]> })[] = [];
        for (const space of ALL_SPACES) {
          const pfx = spacePrefix(space);
          const { data: todoRow, error: todoError } = await supabaseAdmin
            .from("editorial_kv").select("value").eq("key", pfx + "todo-redaction").maybeSingle();
          if (todoError) {
            console.error("todo-redaction read failed", todoError);
            return Response.json({ error: "read_failed" }, { status: 500 });
          }
          let list: Todo[] = [];
          try { list = todoRow?.value ? (JSON.parse(todoRow.value) as Todo[]) : []; } catch { list = []; }
          const editorEmails: Record<string, string[]> = { ...EDITOR_EMAILS };
          try {
            const { data: cfgRow } = await supabaseAdmin.from("editorial_kv").select("value").eq("key", pfx + "pipeline-config").maybeSingle();
            const cfg = cfgRow?.value ? (JSON.parse(cfgRow.value) as { key: string; emails?: Record<string, string> }[]) : [];
            const red = cfg.find((c) => c.key === "redaction");
            for (const [name, raw] of Object.entries(red?.emails ?? {})) {
              const ml = String(raw).split(/[,;\s]+/).map((m) => m.trim()).filter((m) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m));
              if (ml.length) editorEmails[name.trim().toLowerCase()] = ml;
            }
          } catch (e) {
            console.error("pipeline-config read failed", e);
          }
          for (const t of list) todos.push({ ...t, space, emails: editorEmails });
        }

        const results: { id: string; days: number; status: string }[] = [];
        // Weekly reminder: sent on the Monday before the deadline (covers deadlines of the coming week).
        // Day-J reminder: sent on the deadline day itself.
        const today = new Date().toISOString().slice(0, 10);
        const isMonday = new Date(today + "T00:00:00Z").getUTCDay() === 1;
        for (const mode of ["week", "day0"] as const) {

                for (const todo of todos) {
          if (!todo.deadline || todo.articleId) continue; // already saved as an article, no longer pending
          const days = Math.round((Date.parse(todo.deadline) - Date.parse(today)) / 86400000);
          if (mode === "day0" ? days !== 0 : !(isMonday && days >= 1 && days <= 7)) continue;
          const editorKey = (todo.editrice || "").trim().toLowerCase();
          const recipients = todo.emails[editorKey];
          if (!recipients) continue;

          const markerKey = mode === "day0" ? `reminder0:${todo.id}` : `reminderMon:${todo.id}`;
          const { data: marker } = await supabaseAdmin
            .from("editorial_kv")
            .select("key")
            .eq("key", markerKey)
            .maybeSingle();
          if (marker) {
            results.push({ id: todo.id, days, status: "already_sent" });
            continue;
          }

          const sujet = todo.sujet || todo.h1 || "Article";
          const msg = mode === "day0" ? "c'est aujourd'hui la deadline pour livrer l'article" : "la deadline est cette semaine, pensez à livrer l'article";
          const subject = `Rappel : « ${sujet} » — ${msg}`;
          const text = [
            `Bonjour,`,
            ``,
            `Rappel de deadline pour l'article :`,
            `Sujet : ${sujet}`,
            todo.h1 ? `Article : ${todo.h1}` : null,
            `Deadline : ${todo.deadline}`,
            ``,
            msg.charAt(0).toUpperCase() + msg.slice(1) + ".",
            ``,
            `Ouvrir Digicom : ${editorialLink(todo.id, undefined, undefined, true, todo.space, todo.h1 || todo.sujet)}`,
          ]
            .filter((l): l is string => l !== null)
            .join("\r\n");
          const html = buildHtml({ days, space: todo.space, id: todo.id, sujet, h1: todo.h1 || "", deadline: todo.deadline });

          try {
            await sendBrevo(recipients, subject, text, html);
            await supabaseAdmin.from("editorial_kv").upsert({ key: markerKey, value: new Date().toISOString() });
            results.push({ id: todo.id, days, status: "sent" });
          } catch (e) {
            console.error("reminder send failed", e);
            results.push({ id: todo.id, days, status: "send_failed" });
          }
        }
        }

        // Deadlines par étape (posées par Geoffrey) : le responsable de l'étape est prévenu 2 jours ouvrés avant.
        const stepResults: { article: string; step: string; status: string }[] = [];
        let users: { email: string; full_name: string | null }[] = [];
        try {
          const { data: u } = await supabaseAdmin.rpc("approved_users");
          users = (u ?? []) as typeof users;
        } catch {
          users = [];
        }
        for (const space of ALL_SPACES) {
          const pfx = spacePrefix(space);
          const { data: base } = await supabaseAdmin
            .from("editorial_kv")
            .select("key,value")
            .in("key", [pfx + "articles-index", pfx + "pipeline-config"]);
          const baseMap = new Map((base ?? []).map((r) => [r.key, r.value]));
          let ids: string[] = [];
          let config: unknown = null;
          try {
            const parsed: unknown = JSON.parse(baseMap.get(pfx + "articles-index") || "[]");
            ids = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
            config = JSON.parse(baseMap.get(pfx + "pipeline-config") || "null");
          } catch {
            continue;
          }
          if (!ids.length || !config) continue;
          const { data: rows } = await supabaseAdmin
            .from("editorial_kv")
            .select("key,value")
            .in("key", ids.map((id) => pfx + "article:" + id));
          for (const row of rows ?? []) {
            const articleId = row.key.slice((pfx + "article:").length);
            let article: { steps?: unknown } | null = null;
            try {
              article = JSON.parse(row.value);
            } catch {
              continue;
            }
            for (const due of dueStepDeadlines(article?.steps, today)) {
              const marker = stepDeadlineMarker(space, articleId, due.key, due.deadline);
              const { data: sent } = await supabaseAdmin.from("editorial_kv").select("key").eq("key", marker).maybeSingle();
              if (sent) {
                stepResults.push({ article: articleId, step: due.key, status: "already_sent" });
                continue;
              }
              try {
                const mail = buildStepDeadlineMail({ space, articleId, stepKey: due.key, deadline: due.deadline, today, article, config, users });
                await sendBrevo(mail.recipients, mail.subject, mail.text, mail.html);
                await supabaseAdmin.from("editorial_kv").upsert({ key: marker, value: new Date().toISOString() });
                stepResults.push({ article: articleId, step: due.key, status: "sent" });
              } catch (e) {
                console.error("step deadline reminder failed", articleId, due.key, e);
                stepResults.push({ article: articleId, step: due.key, status: "failed" });
              }
            }
          }
        }

        return Response.json({ checked: todos.length, results, stepResults });
      },
    },
  },
});
