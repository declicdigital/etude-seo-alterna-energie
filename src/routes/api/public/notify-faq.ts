import { createFileRoute } from "@tanstack/react-router";
import { signHtml, signText } from "@/lib/mail-signature";
import { z } from "zod";
import { faqLink, type FaqRequest } from "@/lib/faq";
import { MAIL_SENDER } from "@/lib/mail-sender";
import { authenticateRequest } from "@/lib/route-auth.server";
const BodySchema = z.object({
  kind: z.enum(["new", "mention"]),
  id: z.string().min(1).max(60),
  request: z.object({
    subject: z.string().min(1).max(300),
    requester: z.string().max(200),
    type: z.string().max(40),
    content: z.string().max(60),
    category: z.string().max(120),
    target: z.string().max(40),
    channel: z.string().max(40).optional().default(""),
  }),
  message: z.string().max(4000).default(""),
  mentions: z.array(z.string().email()).max(20).optional(),
  authorName: z.string().max(200).optional(),
});

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";
const SENDER = MAIL_SENDER;
const GEOFFREY = "geoffrey.delabarre@alterna-energie.fr";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildHtml(intro: string, p: z.infer<typeof BodySchema>): string {
  const rows: [string, string][] = [
    ["Sujet", p.request.subject],
    ["Demandeur", p.request.requester],
    ["Type", p.request.type],
    ["Contenu", p.request.content],
    ["Cible", p.request.target],
    ...(p.request.channel ? ([["Zendesk ou Site Web", p.request.channel]] as [string, string][]) : []),
    ...(p.request.category ? ([["Catégorie", p.request.category]] as [string, string][]) : []),
  ];
  const msg = p.message
    ? `<div style="background:#f0fdf4;border-left:4px solid #047857;padding:14px 16px;border-radius:6px;font-size:15px;line-height:1.5;margin:0 0 24px">${esc(p.message).replace(/\n/g, "<br>")}</div>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f4;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#047857;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">Digicom · FAQ</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:16px">${intro}</p>
${rows.map(([k, v]) => `<p style="margin:0 0 2px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${k}</p><p style="margin:0 0 12px;font-size:15px;font-weight:bold">${esc(v)}</p>`).join("")}
${msg}
<a href="${faqLink(p.id, p.request.subject)}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Ouvrir la demande</a>
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#9ca3af">Notification automatique de Digicom. Merci de ne pas répondre à ce mail.</td></tr>
</table></td></tr></table></body></html>`;
}

export const Route = createFileRoute("/api/public/notify-faq")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let p: z.infer<typeof BodySchema>;
        try {
          p = BodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (auth.profile.status !== "approved") return Response.json({ error: "forbidden" }, { status: 403 });
        p.authorName = auth.profile.full_name || auth.profile.email;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // The request must exist in the tracker: prevents using this route as an open relay.
        const { data: row } = await supabaseAdmin.from("editorial_kv").select("value").eq("key", `faq:${p.id}`).maybeSingle();
        if (!row) return Response.json({ error: "unknown_request" }, { status: 404 });
        // Mail content and recipients come from the saved request, never from the caller.
        let saved: FaqRequest;
        try { saved = JSON.parse(row.value) as FaqRequest; } catch { return Response.json({ error: "unknown_request" }, { status: 404 }); }
        const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
        p.request = {
          subject: s(saved.subject, 300), requester: s(saved.requester, 200), type: s(saved.type, 40),
          content: s(saved.content, 60), category: s(saved.category, 120), target: s(saved.target, 40), channel: s(saved.channel, 40),
        };
        const me = auth.profile.email.toLowerCase();
        if (p.kind === "new") {
          if (String(saved.requesterEmail ?? "").toLowerCase() !== me) return Response.json({ error: "forbidden" }, { status: 403 });
          p.message = s(saved.comments?.[0]?.body, 4000);
        } else {
          const mine = (saved.comments ?? []).filter((c) => String(c.authorEmail ?? "").toLowerCase() === me && c.body === p.message);
          const c = mine[mine.length - 1];
          if (!c) return Response.json({ error: "unknown_comment" }, { status: 404 });
          const allowed = new Set((c.mentions ?? []).map((m) => String(m).toLowerCase()));
          p.mentions = (p.mentions ?? []).filter((m) => allowed.has(m.toLowerCase()));
        }

        let to: string[];
        let subject: string;
        let intro: string;
        if (p.kind === "new") {
          to = [GEOFFREY];
          subject = `Nouvelle demande FAQ : « ${p.request.subject} »`;
          intro = `<strong>${esc(p.request.requester)}</strong> a fait une nouvelle demande FAQ.`;
        } else {
          const list = p.mentions ?? [];
          if (!list.length) return Response.json({ sent: 0 });
          const { data: approved } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .eq("status", "approved")
            .in("email", [...new Set([...list, ...list.map((m) => m.toLowerCase())])]);
          to = (approved ?? []).map((a) => a.email as string);
          if (!to.length) return Response.json({ sent: 0 });
          const author = p.authorName || "Quelqu'un";
          subject = `${author} vous a mentionné dans la demande FAQ « ${p.request.subject} »`;
          intro = `<strong>${esc(author)}</strong> vous a mentionné.`;
        }

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const brevoKey = process.env["BREVO_API_KEY"];
        if (!lovableKey || !brevoKey) return Response.json({ error: "mail_not_configured" }, { status: 500 });
        const text = [
          intro.replace(/<[^>]+>/g, ""),
          ``,
          `Sujet : ${p.request.subject}`,
          `Demandeur : ${p.request.requester}`,
          `Type : ${p.request.type}`,
          `Contenu : ${p.request.content}`,
          `Cible : ${p.request.target}`,
          ...(p.request.channel ? [`Zendesk ou Site Web : ${p.request.channel}`] : []),
          ...(p.request.category ? [`Catégorie : ${p.request.category}`] : []),
          p.message ? `\nCommentaire :\n${p.message}` : "",
          ``,
          `Ouvrir la demande : ${faqLink(p.id, p.request.subject)}`,
        ].join("\r\n");
        const res = await fetch(`${GATEWAY_URL}/smtp/email`, {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": brevoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: SENDER,
            to: to.map((email) => ({ email })),
            ...(to.some((e) => e.toLowerCase() === GEOFFREY) ? {} : { cc: [{ email: GEOFFREY }] }),
            subject,
            textContent: signText(text),
            htmlContent: signHtml(buildHtml(intro, p)),
          }),
        });
        if (!res.ok) {
          const errorBody = await res.text();
          console.error(`Brevo send failed [${res.status}]: ${errorBody}`);
          return Response.json({ error: "send_failed", status: res.status }, { status: 502 });
        }
        return Response.json({ sent: to.length });
      },
    },
  },
});
