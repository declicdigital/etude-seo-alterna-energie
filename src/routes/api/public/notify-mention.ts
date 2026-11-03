import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { editorialLink } from "@/lib/editorial-links";
import { MAIL_SENDER } from "@/lib/mail-sender";
import { authenticateRequest } from "@/lib/route-auth.server";
const BodySchema = z.object({
  space: z.enum(["strategie"]).optional(),
  articleId: z.string().max(200).optional(),
  articleTitle: z.string().min(1).max(300),
  stepLabel: z.string().max(120).optional(),
  message: z.string().min(1).max(4000),
  authorName: z.string().max(120).optional(),
  authorEmail: z.string().email(),
  mentions: z.array(z.string().email()).min(1).max(20),
});

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";
const SENDER = MAIL_SENDER;
const CC_EMAIL = "geoffrey.delabarre@alterna-energie.fr";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");



function buildHtml(p: { author: string; title: string; step?: string; message: string; articleId?: string; space?: string }): string {
  const msg = esc(p.message).replace(/(@[^\s@]+(?:\s[A-ZÀ-Ý][\wà-ÿ-]+)?)/g, '<strong style="color:#047857">$1</strong>').replace(/\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f4;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#047857;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">Digicom · ${p.space === "strategie" ? "Stratégie PAC" : "Blog"}</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:16px"><strong>${esc(p.author)}</strong> vous a mentionné.</p>
<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Article</p>
<p style="margin:0 0 16px;font-size:16px;font-weight:bold">${esc(p.title)}</p>
${p.step ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Étape</p><p style="margin:0 0 16px">${esc(p.step)}</p>` : ""}
<div style="background:#f0fdf4;border-left:4px solid #047857;padding:14px 16px;border-radius:6px;font-size:15px;line-height:1.5;margin:0 0 24px">${msg}</div>
<a href="${editorialLink(p.articleId, undefined, "comments", !!p.articleId?.startsWith("__todo"), p.space)}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Voir le message</a>
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#9ca3af">Notification automatique de Digicom. Merci de ne pas répondre à ce mail.</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendBrevo(to: string[], subject: string, text: string, html: string): Promise<Response> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const brevoKey = process.env["BREVO_API_KEY"];
  if (!lovableKey || !brevoKey) {
    console.error("mail secrets missing");
    return Response.json({ error: "mail_not_configured" }, { status: 500 });
  }
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
      ...(to.some((e) => e.toLowerCase() === CC_EMAIL) ? {} : { cc: [{ email: CC_EMAIL }] }),
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Brevo send failed [${res.status}]: ${errorBody}`);
    return Response.json({ error: "send_failed", status: res.status }, { status: 502 });
  }
  return Response.json({ sent: to.length });
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
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (auth.profile.status !== "approved") return Response.json({ error: "forbidden" }, { status: 403 });
        // The author is always the verified caller, never a client-supplied value.
        payload.authorEmail = auth.profile.email;
        payload.authorName = auth.profile.full_name || payload.authorName;

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

        const author = payload.authorName || payload.authorEmail;
        const subject = `${author} vous a mentionné dans « ${payload.articleTitle} »`;
        const bodyLines = [
          `Bonjour,`,
          ``,
          `${author} vous a mentionné dans Digicom.`,
          ``,
          `Article : ${payload.articleTitle}`,
          payload.stepLabel ? `Étape : ${payload.stepLabel}` : null,
          ``,
          `Message :`,
          payload.message,
          ``,
          `Voir le message : ${editorialLink(payload.articleId, undefined, "comments", !!payload.articleId?.startsWith("__todo"), payload.space)}`,
        ].filter((l): l is string => l !== null);
        const html = buildHtml({ space: payload.space, articleId: payload.articleId, author, title: payload.articleTitle, step: payload.stepLabel, message: payload.message });
        return sendBrevo(recipients, subject, bodyLines.join("\r\n"), html);
      },
    },
  },
});
