import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  articleTitle: z.string().min(1).max(300),
  stepLabel: z.string().max(120).optional(),
  message: z.string().min(1).max(4000),
  authorName: z.string().max(120).optional(),
  authorEmail: z.string().email(),
  mentions: z.array(z.string().email()).min(1).max(20),
});

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const b64 = (s: string) =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));

// RFC 2047: split long non-ASCII headers into several short encoded-words (Outlook is strict).
function mimeHeader(v: string): string {
  if (/^[\x00-\x7F]*$/.test(v)) return v;
  const chunks: string[] = [];
  let cur = "";
  for (const ch of Array.from(v)) {
    if (new TextEncoder().encode(cur + ch).length > 42) { chunks.push(cur); cur = ""; }
    cur += ch;
  }
  if (cur) chunks.push(cur);
  return chunks.map((c) => `=?UTF-8?B?${b64(c)}?=`).join("\r\n ");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const APP_URL = "https://etude-seo-alterna-energie.lovable.app/?sheet=SUIVI+EDITORIAL";

function buildHtml(p: { author: string; title: string; step?: string; message: string }): string {
  const msg = esc(p.message).replace(/(@[^\s@]+(?:\s[A-ZÀ-Ý][\wà-ÿ-]+)?)/g, '<strong style="color:#047857">$1</strong>').replace(/\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f4;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#047857;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">Alterna Énergie · Suivi éditorial</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:16px"><strong>${esc(p.author)}</strong> vous a mentionné.</p>
<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Article</p>
<p style="margin:0 0 16px;font-size:16px;font-weight:bold">${esc(p.title)}</p>
${p.step ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Étape</p><p style="margin:0 0 16px">${esc(p.step)}</p>` : ""}
<div style="background:#f0fdf4;border-left:4px solid #047857;padding:14px 16px;border-radius:6px;font-size:15px;line-height:1.5;margin:0 0 24px">${msg}</div>
<a href="${APP_URL}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Voir le message</a>
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#9ca3af">Notification automatique de l'outil Alterna. Merci de ne pas répondre à ce mail.</td></tr>
</table></td></tr></table></body></html>`;
}

function createRawEmail(to: string, subject: string, text: string, html: string): string {
  const boundary = "alt_" + crypto.randomUUID().replace(/-/g, "");
  const wrap = (s: string) => b64(s).replace(/.{76}/g, "$&\r\n");
  const email = [
    `From: ${mimeHeader("Outil Alterna")} <g.delabarre.alterna@gmail.com>`,
    `To: ${to}`,
    `Subject: ${mimeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return b64(email).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const Route = createFileRoute("/api/public/notify-mention")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof BodySchema>;
        try {
          payload = BodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }

        // Only notify people whose access to the tool has been approved.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: approved, error: profilesError } = await supabaseAdmin
          .from("profiles")
          .select("email, full_name")
          .eq("status", "approved")
          .in("email", [...new Set([...payload.mentions, ...payload.mentions.map((m) => m.toLowerCase())])]);
        if (profilesError) {
          console.error("profiles lookup failed", profilesError);
          return Response.json({ error: "profiles_lookup_failed" }, { status: 500 });
        }
        const recipients = (approved ?? []).map((p) => p.email as string);
        if (!recipients.length) {
          return Response.json({ sent: 0, skipped: "no_approved_recipient" });
        }

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];
        if (!lovableKey || !gmailKey) {
          console.error("mail secrets missing");
          return Response.json({ error: "mail_not_configured" }, { status: 500 });
        }

        const author = payload.authorName || payload.authorEmail;
        const subject = `${author} vous a mentionné dans « ${payload.articleTitle} »`;
        const bodyLines = [
          `Bonjour,`,
          ``,
          `${author} vous a mentionné dans le suivi éditorial de l'outil Alterna.`,
          ``,
          `Article : ${payload.articleTitle}`,
          payload.stepLabel ? `Étape : ${payload.stepLabel}` : null,
          ``,
          `Message :`,
          payload.message,
          ``,
          `Voir le message : ${APP_URL}`,
        ].filter((l): l is string => l !== null);
        const html = buildHtml({ author, title: payload.articleTitle, step: payload.stepLabel, message: payload.message });
        const raw = createRawEmail(recipients.join(", "), subject, bodyLines.join("\r\n"), html);

        const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": gmailKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        });
        if (!res.ok) {
          const errorBody = await res.text();
          console.error(`Gmail send failed [${res.status}]: ${errorBody}`);
          return Response.json({ error: "send_failed", status: res.status }, { status: 502 });
        }
        return Response.json({ sent: recipients.length });
      },
    },
  },
});
