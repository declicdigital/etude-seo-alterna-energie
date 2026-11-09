import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MAIL_SENDER } from "@/lib/mail-sender";
import { authenticateRequest } from "@/lib/route-auth.server";
import { cardHash, excerpt, ORGANISATION_SHEET } from "@/lib/organisation";
import { ficheLink } from '@/lib/slugs';

/**
 * Prévient par mail les personnes nouvellement assignées ou taguées sur une
 * fiche Organisation. Le contenu et les destinataires viennent de la fiche
 * enregistrée en base : le client ne fournit que des identifiants, filtrés
 * ici (assigné / tagué réellement sur la fiche, accès à Organisation).
 */
const BodySchema = z.object({
  cardId: z.string().uuid(),
  assigned: z.array(z.string().uuid()).max(1).default([]),
  tagged: z.array(z.string().uuid()).max(30).default([]),
});

const APP = "https://etude-seo-alterna-energie.lovable.app/";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function cardLink(cardId: string, title: string): string {
  return ficheLink(ORGANISATION_SHEET, 'fiches', cardId, title);
}

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function buildHtml(p: {
  intro: string;
  title: string;
  column: string;
  due: string | null;
  preview: string;
  link: string;
}) {
  return `<!doctype html><html><body style="margin:0;background:#f7f5f0;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#b45309;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">Digicom · Organisation</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:16px">${esc(p.intro)}</p>
<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Fiche</p>
<p style="margin:0 0 16px;font-size:17px;font-weight:bold">${esc(p.title)}</p>
<p style="margin:0 0 16px;font-size:14px;color:#374151">Colonne : <strong>${esc(p.column)}</strong>${p.due ? ` · Échéance : <strong>${esc(p.due)}</strong>` : ""}</p>
${p.preview ? `<div style="background:#fffbeb;border-left:4px solid #d97706;padding:14px 16px;border-radius:6px;font-size:15px;line-height:1.5;margin:0 0 24px">${esc(p.preview)}</div>` : ""}
<a href="${p.link}" style="display:inline-block;background:#b45309;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Ouvrir la fiche</a>
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#9ca3af">Notification automatique de Digicom. Merci de ne pas répondre à ce mail.</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendOne(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const brevoKey = process.env["BREVO_API_KEY"];
  if (!lovableKey || !brevoKey) {
    console.error("mail secrets missing");
    return false;
  }
  const res = await fetch(`${GATEWAY_URL}/smtp/email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": brevoKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: MAIL_SENDER,
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) console.error(`Brevo send failed [${res.status}]: ${await res.text()}`);
  return res.ok;
}

export const Route = createFileRoute("/api/public/notify-organisation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: allowed } = await supabaseAdmin.rpc("can_use_organisation", {
          _user_id: auth.user.id,
        });
        if (allowed !== true) return Response.json({ error: "forbidden" }, { status: 403 });

        const { data: card } = await supabaseAdmin
          .from("org_cards")
          .select("id, title, content, due_date, assignee_id, tagged_ids, org_columns(title)")
          .eq("id", body.cardId)
          .maybeSingle();
        if (!card) return Response.json({ error: "not_found" }, { status: 404 });

        // Keep only people really assigned / tagged on the saved card, never the author.
        const assigned = body.assigned.filter(
          (id) => id === card.assignee_id && id !== auth.user.id,
        );
        const tagged = body.tagged.filter(
          (id) => card.tagged_ids.includes(id) && id !== auth.user.id && !assigned.includes(id),
        );
        const ids = [...assigned, ...tagged];
        if (!ids.length) return Response.json({ sent: 0 });

        const { data: people } = await supabaseAdmin
          .from("profiles")
          .select("id, email, status")
          .in("id", ids)
          .eq("status", "approved");
        const author = auth.profile.full_name || auth.profile.email;
        const column = (card.org_columns as { title: string } | null)?.title ?? "";
        const due = formatDue(card.due_date);
        const preview = excerpt(card.content, 400);
        const link = cardLink(card.id, card.title);

        let sent = 0;
        for (const person of people ?? []) {
          const { data: canUse } = await supabaseAdmin.rpc("can_use_organisation", {
            _user_id: person.id,
          });
          if (canUse !== true || !person.email) continue;
          const isAssigned = assigned.includes(person.id);
          const intro = isAssigned
            ? `${author} vous a assigné une fiche dans Organisation.`
            : `${author} vous a tagué sur une fiche dans Organisation.`;
          const subject = isAssigned
            ? `${author} vous a assigné « ${card.title} »`
            : `${author} vous a tagué sur « ${card.title} »`;
          const text = [
            "Bonjour,",
            "",
            intro,
            "",
            `Fiche : ${card.title}`,
            `Colonne : ${column}`,
            due ? `Échéance : ${due}` : null,
            preview ? `\n${preview}` : null,
            "",
            `Ouvrir la fiche : ${link}`,
          ]
            .filter((l) => l !== null)
            .join("\n");
          if (
            await sendOne(
              person.email,
              subject,
              text,
              buildHtml({ intro, title: card.title, column, due, preview, link }),
            )
          ) {
            sent++;
          }
        }
        return Response.json({ sent });
      },
    },
  },
});
