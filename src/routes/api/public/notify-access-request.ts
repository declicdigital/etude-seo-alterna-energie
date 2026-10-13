import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({ userId: z.string().uuid() });
const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";
const ADMIN_EMAIL = "geoffrey.delabarre@gmail.com";
const APP_URL = "https://etude-seo-alterna-energie.lovable.app/demandes";
const SENDER = { name: "Outil Alterna", email: "g.delabarre.alterna@gmail.com" };
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const Route = createFileRoute("/api/public/notify-access-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof BodySchema>;
        try { payload = BodySchema.parse(await request.json()); }
        catch { return Response.json({ error: "invalid_body" }, { status: 400 }); }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await supabaseAdmin
          .from("profiles").select("email, full_name, status").eq("id", payload.userId).maybeSingle();
        if (!profile || profile.status !== "pending") return Response.json({ sent: 0 });

        // Only one mail per request.
        const key = `access-notified:${payload.userId}`;
        const { data: already } = await supabaseAdmin.from("editorial_kv").select("key").eq("key", key).maybeSingle();
        if (already) return Response.json({ sent: 0, skipped: "already_notified" });

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const brevoKey = process.env["BREVO_API_KEY"];
        if (!lovableKey || !brevoKey) return Response.json({ error: "mail_not_configured" }, { status: 500 });

        const who = profile.full_name ? `${profile.full_name} (${profile.email})` : profile.email;
        const subject = `Nouvelle demande d'accès : ${profile.full_name || profile.email}`;
        const text = `Bonjour,\r\n\r\n${who} demande l'accès à l'outil Alterna.\r\n\r\nValider ou refuser : ${APP_URL}`;
        const html = `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#047857;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">Alterna Énergie · Demande d'accès</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:16px">Une nouvelle personne demande l'accès à l'outil :</p>
<div style="background:#f0fdf4;border-left:4px solid #047857;padding:14px 16px;border-radius:6px;font-size:15px;margin:0 0 24px">
${profile.full_name ? `<strong>${esc(profile.full_name)}</strong><br>` : ""}${esc(profile.email)}</div>
<a href="${APP_URL}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Valider ou refuser</a>
</td></tr></table></td></tr></table></body></html>`;

        const boundary = "alt_" + crypto.randomUUID().replace(/-/g, "");
        const wrap = (s: string) => b64(s).replace(/.{76}/g, "$&\r\n");
        const email = [
          `From: ${mimeHeader("Outil Alterna")} <g.delabarre.alterna@gmail.com>`,
          `To: ${ADMIN_EMAIL}`,
          `Subject: ${mimeHeader(subject)}`,
          "MIME-Version: 1.0",
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          "",
          `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", wrap(text),
          `--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", wrap(html),
          `--${boundary}--`, "",
        ].join("\r\n");
        const raw = b64(email).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmailKey, "Content-Type": "application/json" },
          body: JSON.stringify({ raw }),
        });
        if (!res.ok) {
          console.error(`Gmail send failed [${res.status}]: ${await res.text()}`);
          return Response.json({ error: "send_failed" }, { status: 502 });
        }
        await supabaseAdmin.from("editorial_kv").upsert({ key, value: new Date().toISOString() });
        return Response.json({ sent: 1 });
      },
    },
  },
});
