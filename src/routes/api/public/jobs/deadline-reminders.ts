import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";
const SENDER = { name: "Outil Alterna", email: "g.delabarre.alterna@gmail.com" };
const APP_URL = "https://etude-seo-alterna-energie.lovable.app/?sheet=SUIVI+EDITORIAL";
const CC_EMAIL = "geoffrey.delabarre@alterna-energie.fr";

const EDITOR_EMAILS: Record<string, string[]> = {
  aurorae: ["caroline@aurorae-editorial.com", "elodie@aurorae-editorial.com"],
  marina: ["contact@marinatravert.com"],
};

const REMIND_DAYS = 5;

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

function buildHtml(p: { sujet: string; h1: string; deadline: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f4;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#047857;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">Alterna Énergie · Suivi éditorial</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:16px"><strong>Rappel de deadline</strong></p>
<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Sujet</p>
<p style="margin:0 0 16px;font-size:16px;font-weight:bold">${esc(p.sujet)}</p>
${p.h1 ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Article</p><p style="margin:0 0 16px">${esc(p.h1)}</p>` : ""}
<div style="background:#fef3c7;border-left:4px solid #d97706;padding:14px 16px;border-radius:6px;font-size:15px;line-height:1.5;margin:0 0 24px">Il vous reste <strong>${REMIND_DAYS} jours</strong> pour livrer l'article (deadline : <strong>${esc(p.deadline)}</strong>).</div>
<a href="${APP_URL}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Ouvrir le suivi éditorial</a>
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#9ca3af">Rappel automatique de l'outil Alterna. Merci de ne pas répondre à ce mail.</td></tr>
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
      cc: [{ email: CC_EMAIL }],
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

        const { data: todoRow, error: todoError } = await supabaseAdmin
          .from("editorial_kv")
          .select("value")
          .eq("key", "todo-redaction")
          .maybeSingle();
        if (todoError) {
          console.error("todo-redaction read failed", todoError);
          return Response.json({ error: "read_failed" }, { status: 500 });
        }

        let todos: Todo[] = [];
        try {
          todos = todoRow?.value ? (JSON.parse(todoRow.value) as Todo[]) : [];
        } catch {
          todos = [];
        }

        // Target date: today + REMIND_DAYS (UTC), as YYYY-MM-DD
        const target = new Date(Date.now() + REMIND_DAYS * 86400000).toISOString().slice(0, 10);

        const results: { id: string; status: string }[] = [];
        for (const todo of todos) {
          if (!todo.deadline || todo.deadline !== target) continue;
          if (todo.articleId) continue; // already saved as an article, no longer pending
          const editorKey = (todo.editrice || "").trim().toLowerCase();
          const recipients = EDITOR_EMAILS[editorKey];
          if (!recipients) continue;

          const markerKey = `reminder5:${todo.id}`;
          const { data: marker } = await supabaseAdmin
            .from("editorial_kv")
            .select("key")
            .eq("key", markerKey)
            .maybeSingle();
          if (marker) {
            results.push({ id: todo.id, status: "already_sent" });
            continue;
          }

          const sujet = todo.sujet || todo.h1 || "Article";
          const subject = `Rappel : « ${sujet} » — il vous reste ${REMIND_DAYS} jours pour livrer l'article`;
          const text = [
            `Bonjour,`,
            ``,
            `Rappel de deadline pour l'article :`,
            `Sujet : ${sujet}`,
            todo.h1 ? `Article : ${todo.h1}` : null,
            `Deadline : ${todo.deadline}`,
            ``,
            `Il vous reste ${REMIND_DAYS} jours pour livrer l'article.`,
            ``,
            `Ouvrir le suivi éditorial : ${APP_URL}`,
          ]
            .filter((l): l is string => l !== null)
            .join("\r\n");
          const html = buildHtml({ sujet, h1: todo.h1 || "", deadline: todo.deadline });

          try {
            await sendBrevo(recipients, subject, text, html);
            await supabaseAdmin.from("editorial_kv").upsert({ key: markerKey, value: new Date().toISOString() });
            results.push({ id: todo.id, status: "sent" });
          } catch (e) {
            console.error("reminder send failed", e);
            results.push({ id: todo.id, status: "send_failed" });
          }
        }

        return Response.json({ target, checked: todos.length, results });
      },
    },
  },
});
