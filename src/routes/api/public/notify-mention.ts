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
const mimeHeader = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

function createRawEmail(to: string, subject: string, body: string): string {
  const email = [
    `To: ${to}`,
    `Subject: ${mimeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
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
          .in("email", payload.mentions);
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
          `Connectez-vous à l'outil pour consulter l'article et répondre.`,
        ].filter((l): l is string => l !== null);
        const raw = createRawEmail(recipients.join(", "), subject, bodyLines.join("\n"));

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
