import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  kind: z.enum(["ready", "relecture", "integration"]).optional(),
  sujet: z.string().min(1).max(300),
  h1: z.string().min(1).max(300),
  editrice: z.string().min(1).max(120),
  categorie: z.string().max(120).optional(),
  energie: z.string().max(120).optional(),
  deadline: z.string().max(40).optional(),
  docx: z.string().max(1000).optional(),
});

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";
const SENDER = { name: "Outil Alterna", email: "g.delabarre.alterna@gmail.com" };
const ADMIN_EMAIL = "geoffrey.delabarre@alterna-energie.fr";
const RELECTURE_EMAIL = "fannie.laurendin@soregies.fr";
const INTEGRATION_EMAIL = "marick.navarro.ext@soregies.fr";
const APP_URL = "https://etude-seo-alterna-energie.lovable.app/?sheet=SUIVI+EDITORIAL";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildHtml(p: z.infer<typeof BodySchema>): string {
  const row = (label: string, value?: string) =>
    value
      ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${label}</p><p style="margin:0 0 14px;font-size:15px">${esc(value)}</p>`
      : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f4;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#047857;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">Alterna Énergie · Suivi éditorial</td></tr>
<tr><td style="padding:28px">
${p.kind === "relecture"
  ? `<p style="margin:0 0 18px;font-size:16px">Bonjour Fannie,<br><br>L'article ci-dessous est passé à l'étape <strong>Relecture + Image</strong>. Merci de le <strong>relire</strong>, de <strong>trouver une image</strong> adaptée et de l'<strong>insérer en pièce jointe</strong> dans la carte de l'article du suivi éditorial.</p>`
  : p.kind === "integration"
  ? `<p style="margin:0 0 18px;font-size:16px">Bonjour Marick,<br><br>L'article ci-dessous est prêt : la <strong>relecture est faite</strong> et <strong>l'image est validée</strong> (pièce jointe de la carte de l'article). Il ne vous reste plus qu'à <strong>l'intégrer dans le site</strong>.</p>`
  : `<p style="margin:0 0 18px;font-size:16px">Un nouvel article est <strong>prêt à être rédigé</strong> : toutes les informations de la ligne « À rédiger » sont remplies et l'article a été créé dans le suivi.</p>`}
${row("Sujet", p.sujet)}
${row("Nom de l'article (H1)", p.h1)}
${row("Éditrice", p.editrice)}
${row("Catégorie", p.categorie)}
${row("Énergie", p.energie)}
${row("Deadline", p.deadline)}
${row("Lien du doc", p.docx)}
<a href="${APP_URL}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Ouvrir le suivi éditorial</a>
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#9ca3af">Notification automatique de l'outil Alterna. Merci de ne pas répondre à ce mail.</td></tr>
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

        const isRel = payload.kind === "relecture";
        const subject = isRel
          ? `Relecture + image à faire : « ${payload.h1} »`
          : `Article prêt à rédiger : « ${payload.h1} »`;
        const text = isRel ? [
          "Bonjour Fannie,",
          "",
          "L'article ci-dessous est passé à l'étape Relecture + Image.",
          "Merci de le relire, de trouver une image et de l'insérer en pièce jointe dans la carte de l'article.",
          "",
          `Nom de l'article (H1) : ${payload.h1}`,
          `Sujet : ${payload.sujet}`,
          payload.docx ? `Lien du doc : ${payload.docx}` : null,
          "",
          `Ouvrir le suivi éditorial : ${APP_URL}`,
        ].filter((l): l is string => l !== null).join("\r\n") : [
          "Bonjour Geoffrey,",
          "",
          "Un nouvel article est prêt à être rédigé (ligne « À rédiger » enregistrée) :",
          "",
          `Sujet : ${payload.sujet}`,
          `Nom de l'article (H1) : ${payload.h1}`,
          `Éditrice : ${payload.editrice}`,
          payload.categorie ? `Catégorie : ${payload.categorie}` : null,
          payload.energie ? `Énergie : ${payload.energie}` : null,
          payload.deadline ? `Deadline : ${payload.deadline}` : null,
          payload.docx ? `Lien du doc : ${payload.docx}` : null,
          "",
          `Ouvrir le suivi éditorial : ${APP_URL}`,
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
            to: [{ email: isRel ? RELECTURE_EMAIL : ADMIN_EMAIL }],
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
