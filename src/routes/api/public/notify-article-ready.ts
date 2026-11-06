import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { notificationLink } from "@/lib/editorial-links";
import { notificationCta, notificationDeadline, notificationRecipients, SERVICE_COMMUNICATION_EMAILS } from "@/lib/article-notification";
import { MAIL_SENDER } from "@/lib/mail-sender";
import { editorialMailHtml } from "@/lib/mail-layout";
import { EDITORIAL_SPACES, spaceLabel, spacePrefix } from "@/lib/editorial-spaces";
const BodySchema = z.object({
  space: z.enum(EDITORIAL_SPACES).optional(),
  type: z.enum(["Réécriture", "Création"]).optional(),
  articleId: z.string().max(200).optional(),
  stepKey: z.string().max(120).optional(),
  kind: z.enum(["ready", "image", "relecture", "integration", "published"]).optional(),
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
const RELECTURE_EMAILS: readonly string[] = SERVICE_COMMUNICATION_EMAILS;
const INTEGRATION_EMAIL = "marick.navarro.ext@soregies.fr";

function buildHtml(p: z.infer<typeof BodySchema>): string {
  const introHtml = p.kind === "image"
  ? `Bonjour Geoffrey,<br><br>L'article a été rédigé${p.cible === 'Professionnel' && !p.space ? ' et relu par l’expert métier' : ''}. Merci de <strong>trouver une image</strong>, de l'<strong>ajouter</strong> dans la carte et de valider l'étape <strong>Image</strong>.`
  : p.kind === "relecture"
  ? `Bonjour,<br><br>L'article a été rédigé et son image a été ajoutée. Merci de <strong>relire l'article</strong> et de valider l'étape <strong>Relecture</strong>.`
  : p.kind === "integration"
   ? (p.space === "planete"
     ? `Bonjour Geoffrey,<br><br>L'article ci-dessous a été <strong>rédigé</strong>. Il est prêt à être <strong>intégré dans le site</strong>.`
     : p.space === "strategie" && p.type === "Réécriture"
     ? `Bonjour,<br><br>La <strong>réécriture est terminée</strong>. L'article ci-dessous est prêt à être <strong>intégré dans le site</strong>.`
     : `Bonjour,<br><br>L'article ci-dessous est prêt : la <strong>relecture est faite</strong> et <strong>l'image est validée</strong> (visible dans la carte de l'article). Il ne vous reste plus qu'à <strong>l'intégrer dans le site</strong>.`)
  : p.kind === "published"
  ? `Bonjour Geoffrey,<br><br>L'article ci-dessous a été <strong>intégré dans le site</strong> : toutes les étapes sont terminées et il a été ajouté au blog.`
  : `Un nouvel article est <strong>prêt à être rédigé</strong> : la ligne « À rédiger » a été enregistrée et l'article a été créé dans le suivi.`;
  return editorialMailHtml({
    heading: `Digicom · ${spaceLabel(p.space)}`,
    introHtml,
    fields: [
      ["Sujet", p.sujet],
      ["Nom de l'article (H1)", p.h1],
      ["Édition", p.editrice],
      ["Cible", p.cible],
      ["Catégorie", p.categorie],
      ["Énergie", p.energie],
      ["Deadline", p.deadline],
      ["Lien du doc", p.docx],
    ],
    cta: { label: notificationCta(p.kind), url: notificationLink(p.kind, p.articleId, p.stepKey, p.space) },
  });
}

export const Route = createFileRoute("/api/public/notify-article-ready")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
        if(!token) return Response.json({error:'unauthorized'}, {status:401});
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const {data: {user}, error: authError} = await supabaseAdmin.auth.getUser(token);
        if(authError || !user) return Response.json({error:'unauthorized'}, {status:401});
        const {data: profile} = await supabaseAdmin.from('profiles').select('status').eq('id',user.id).maybeSingle();
        if(profile?.status !== 'approved') return Response.json({error:'forbidden'}, {status:403});
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
        const isImage = payload.kind === "image";
        const isRel = payload.kind === "relecture";
        const isInt = payload.kind === "integration";
        const isPub = payload.kind === "published";
        // Parlons Planète: Geoffrey integrates the articles himself.
        const defaultTo: readonly string[] = isRel ? RELECTURE_EMAILS : isInt && payload.space !== "planete" ? [INTEGRATION_EMAIL] : [ADMIN_EMAIL];
        // Custom recipients are only allowed if they're configured in the pipeline settings.
        let allowedTo: string[] = [];
        if (!isPub && !isImage && !isRel && payload.to && payload.to.length) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: cfgRow } = await supabaseAdmin.from("editorial_kv").select("value").eq("key", `${spacePrefix(payload.space)}pipeline-config`).maybeSingle();
          const known = new Set<string>();
          try {
            const cfg = cfgRow?.value ? (JSON.parse(cfgRow.value) as { emails?: Record<string, string> }[]) : [];
            for (const c of cfg) for (const raw of Object.values(c.emails ?? {}))
              String(raw).split(/[,;\s]+/).forEach((m) => m.trim() && known.add(m.trim().toLowerCase()));
          } catch { /* ignore */ }
          allowedTo = [...new Set(payload.to.filter((m) => known.has(m.toLowerCase())))];
        }
        const recipients = notificationRecipients(payload.kind, allowedTo.length ? allowedTo : defaultTo);
        payload = { ...payload, deadline: notificationDeadline(payload.deadline, payload.kind, recipients) };
        const subject = isImage ? `Image à ajouter : « ${payload.h1} »` : isRel
          ? `Relecture à faire : « ${payload.h1} »`
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
        ].join("\r\n") : isImage ? [
          "Bonjour Geoffrey,", "",
          "L'article a été rédigé. Merci de trouver une image, de l'ajouter dans la carte et de valider l'étape Image.",
          `Nom de l'article (H1) : ${payload.h1}`, `Sujet : ${payload.sujet}`,
          payload.docx ? `Lien du doc : ${payload.docx}` : null,
          `${notificationCta("image")} : ${appUrl}`,
        ].filter((l): l is string => l !== null).join("\r\n") : isRel ? [
          "Bonjour,",
          "",
          "L'article a été rédigé et son image a été ajoutée.",
          "Merci de relire l'article et de valider l'étape Relecture dans la carte.",
          "",
          `Nom de l'article (H1) : ${payload.h1}`,
          `Sujet : ${payload.sujet}`,
          payload.docx ? `Lien du doc : ${payload.docx}` : null,
          "",
          `${notificationCta("relecture")} : ${appUrl}`,
        ].filter((l): l is string => l !== null).join("\r\n") : isInt ? [
          "Bonjour,",
          "",
          payload.space === "planete" ? "L'article ci-dessous a été rédigé. Il est prêt à être intégré dans le site." : payload.space === "strategie" && payload.type === "Réécriture" ? "La réécriture est terminée. L'article ci-dessous est prêt à être intégré dans le site." : "L'article ci-dessous est prêt : la relecture est faite et l'image est validée (visible dans la carte de l'article).",
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
