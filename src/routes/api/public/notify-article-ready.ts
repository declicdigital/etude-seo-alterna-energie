import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { notificationLink } from "@/lib/editorial-links";
import { notificationCta, notificationDeadline } from "@/lib/article-notification";
import { MAIL_SENDER } from "@/lib/mail-sender";
const BodySchema = z.object({
  space: z.enum(["strategie"]).optional(),
  articleId: z.string().max(200).optional(),
  stepKey: z.string().max(120).optional(),
  kind: z.enum(["ready", "relecture", "integration", "published"]).optional(),
  to: z.array(z.string().email()).max(10).optional(),
  sujet: z.string().max(300).optional().default(""),
  h1: z.string().max(300).optional().default(""),
  editrice: z.string().max(120).optional().default(""),
  cible: z.string().max(60).optional(),
  categorie: z.string().max(120).optional(),
  energie: z.string().max(120).optional(),
  deadline: z.string().max(40).optional(),
  docx: z.string().max(1000).optional(),
});

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";
const SENDER = MAIL_SENDER;
const ADMIN_EMAIL = "geoffrey.delabarre@alterna-energie.fr";
const CC_EMAIL = "geoffrey.delabarre@alterna-energie.fr";
const RELECTURE_EMAIL = "fannie.laurendin@soregies.fr";
const INTEGRATION_EMAIL = "marick.navarro.ext@soregies.fr";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildHtml(p: z.infer<typeof BodySchema>): string {
  const cta = notificationCta(p.kind);
  const row = (label: string, value?: string) =>
    value
      ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${label}</p><p style="margin:0 0 14px;font-size:15px">${esc(value)}</p>`
      : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f4;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#047857;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">Digicom · ${p.space === "strategie" ? "Stratégie PAC" : "Blog"}</td></tr>
<tr><td style="padding:28px">
${p.kind === "relecture"
  ? `<p style="margin:0 0 18px;font-size:16px">Bonjour,<br><br>L'article ci-dessous est passé à l'étape <strong>Relecture + Image</strong>. Merci de le <strong>relire</strong>, de <strong>trouver une image</strong> adaptée et de l'<strong>ajouter</strong> dans la carte de l'article.</p>`
  : p.kind === "integration"
  ? `<p style="margin:0 0 18px;font-size:16px">Bonjour,<br><br>L'article ci-dessous est prêt : la <strong>relecture est faite</strong> et <strong>l'image est validée</strong> (visible dans la carte de l'article). Il ne vous reste plus qu'à <strong>l'intégrer dans le site</strong>.</p>`
  : p.kind === "published"
  ? `<p style="margin:0 0 18px;font-size:16px">Bonjour Geoffrey,<br><br>L'article ci-dessous a été <strong>intégré dans le site</strong> : toutes les étapes sont terminées et il a été ajouté au blog.</p>`
  : `<p style="margin:0 0 18px;font-size:16px">Un nouvel article est <strong>prêt à être rédigé</strong> : toutes les informations de la ligne « À rédiger » sont remplies et l'article a été créé dans le suivi.</p>`}
${row("Sujet", p.sujet)}
${row("Nom de l'article (H1)", p.h1)}
${row("Édition", p.editrice)}
${row("Cible", p.cible)}
${row("Catégorie", p.categorie)}
${row("Énergie", p.energie)}
${row("Deadline", p.deadline)}
${row("Lien du doc", p.docx)}
<a href="${notificationLink(p.kind, p.articleId, p.stepKey, p.space)}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">${cta}</a>
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#9ca3af">Notification automatique de Digicom. Merci de ne pas répondre à ce mail.</td></tr>
</table></td></tr></table></body></html>`;
}

export const Route = createFileRoute("/api/public/notify-article-ready")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof BodySchema>;
        try {
          payload = BodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const brevoKey = process.env["BREVO_API_KEY"];
        if (!lovableKey || !brevoKey) {
          console.error("mail secrets missing");
          return Response.json({ error: "mail_not_configured" }, { status: 500 });
        }

        const appUrl = notificationLink(payload.kind, payload.articleId, payload.stepKey, payload.space);
        const isRel = payload.kind === "relecture";
        const isInt = payload.kind === "integration";
        const isPub = payload.kind === "published";
        const toEmail = isRel ? RELECTURE_EMAIL : isInt ? INTEGRATION_EMAIL : ADMIN_EMAIL;
        // Custom recipients are only allowed if they're configured in the pipeline settings.
        let allowedTo: string[] = [];
        if (!isPub && payload.to && payload.to.length) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: cfgRow } = await supabaseAdmin.from("editorial_kv").select("value").eq("key", "pipeline-config").maybeSingle();
          const known = new Set<string>();
          try {
            const cfg = cfgRow?.value ? (JSON.parse(cfgRow.value) as { emails?: Record<string, string> }[]) : [];
            for (const c of cfg) for (const raw of Object.values(c.emails ?? {}))
              String(raw).split(/[,;\s]+/).forEach((m) => m.trim() && known.add(m.trim().toLowerCase()));
          } catch { /* ignore */ }
          allowedTo = [...new Set(payload.to.filter((m) => known.has(m.toLowerCase())))];
        }
        const recipients = allowedTo.length ? allowedTo : [toEmail];
        payload = { ...payload, deadline: notificationDeadline(payload.deadline, payload.kind, recipients) };
        const subject = isRel
          ? `Relecture + image à faire : « ${payload.h1} »`
          : isInt
          ? `À intégrer dans le site : « ${payload.h1} »`
          : isPub
          ? `Article intégré et publié : « ${payload.h1} »`
          : `Article prêt à rédiger : « ${payload.h1} »`;
        const text = isPub ? [
          "Bonjour Geoffrey,",
          "",
          "L'article ci-dessous a été intégré dans le site : toutes les étapes sont terminées et il a été ajouté au blog.",
          "",
          `Nom de l'article (H1) : ${payload.h1}`,
          `Sujet : ${payload.sujet}`,
          "",
          `Ouvrir Digicom : ${appUrl}`,
        ].join("\r\n") : isRel ? [
          "Bonjour,",
          "",
          "L'article ci-dessous est passé à l'étape Relecture + Image.",
          "Merci de le relire, de trouver une image et de l'ajouter dans la carte de l'article.",
          "",
          `Nom de l'article (H1) : ${payload.h1}`,
          `Sujet : ${payload.sujet}`,
          payload.docx ? `Lien du doc : ${payload.docx}` : null,
          "",
          `${notificationCta("relecture")} : ${appUrl}`,
        ].filter((l): l is string => l !== null).join("\r\n") : isInt ? [
          "Bonjour,",
          "",
          "L'article ci-dessous est prêt : la relecture est faite et l'image est validée (visible dans la carte de l'article).",
          "Il ne vous reste plus qu'à l'intégrer dans le site.",
          "",
          `Nom de l'article (H1) : ${payload.h1}`,
          `Sujet : ${payload.sujet}`,
          payload.docx ? `Lien du doc : ${payload.docx}` : null,
          "",
          `Ouvrir Digicom : ${appUrl}`,
        ].filter((l): l is string => l !== null).join("\r\n") : [
          "Bonjour Geoffrey,",
          "",
          "Un nouvel article est prêt à être rédigé (ligne « À rédiger » enregistrée) :",
          "",
          `Sujet : ${payload.sujet}`,
          `Nom de l'article (H1) : ${payload.h1}`,
          `Édition : ${payload.editrice}`,
          payload.cible ? `Cible : ${payload.cible}` : null,
          payload.categorie ? `Catégorie : ${payload.categorie}` : null,
          payload.energie ? `Énergie : ${payload.energie}` : null,
          payload.deadline ? `Deadline : ${payload.deadline}` : null,
          payload.docx ? `Lien du doc : ${payload.docx}` : null,
          "",
          `Ouvrir Digicom : ${appUrl}`,
        ]
          .filter((l): l is string => l !== null)
          .join("\r\n");

        const res = await fetch(`${GATEWAY_URL}/smtp/email`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": brevoKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: SENDER,
            to: recipients.map((email) => ({ email })),
            ...(!recipients.includes(CC_EMAIL) ? { cc: [{ email: CC_EMAIL }] } : {}),
            subject,
            textContent: text,
            htmlContent: buildHtml(payload),
          }),
        });
        if (!res.ok) {
          const errorBody = await res.text();
          console.error(`Brevo send failed [${res.status}]: ${errorBody}`);
          return Response.json({ error: "send_failed", status: res.status }, { status: 502 });
        }
        return Response.json({ sent: 1 });
      },
    },
  },
});
