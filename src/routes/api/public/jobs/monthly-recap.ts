import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";
const SENDER = { name: "Digicom", email: "g.delabarre.alterna@gmail.com" };

type Step = { key: string; status?: string; date?: string };
type Article = {
  id: string;
  title?: string;
  finalLink?: string;
  audience?: string;
  steps?: Step[];
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_FR[m - 1]} ${y}`;
}

function buildHtml(p: { month: string; particulier: Article[]; pro: Article[]; total: number }): string {
  const section = (label: string, color: string, list: Article[]) =>
    list.length === 0
      ? ""
      : `<p style="margin:24px 0 8px;font-size:13px;color:${color};text-transform:uppercase;letter-spacing:.04em;font-weight:bold">${label}</p>` +
        list
          .map(
            (a) =>
              `<p style="margin:0 0 10px;font-size:15px;line-height:1.5">• ${
                a.finalLink
                  ? `<a href="${esc(a.finalLink)}" style="color:#047857;font-weight:bold;text-decoration:none">${esc(a.title || "Article")}</a>`
                  : `<strong>${esc(a.title || "Article")}</strong>`
              }</p>`,
          )
          .join("");
  return `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f4;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#047857;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">Digicom · Blog</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:16px"><strong>Merci et félicitations à toute l'équipe !</strong></p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.6">En <strong>${esc(p.month)}</strong>, nous avons publié <strong>${p.total} article${p.total > 1 ? "s" : ""}</strong> sur le blog. Bravo à toutes et tous pour ce travail.</p>
${section("Blog particulier", "#db2777", p.particulier)}
${section("Blog professionnel", "#2563eb", p.pro)}
<p style="margin:24px 0 0;font-size:15px;line-height:1.6">On continue sur cette lancée ce mois-ci !</p>
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#9ca3af">Récap automatique de Digicom, envoyé le 1er de chaque mois. Merci de ne pas répondre à ce mail.</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendBrevo(to: string[], subject: string, text: string, html: string, cc: string[] = []): Promise<void> {
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
      ...(cc.length ? { cc: cc.map((email) => ({ email })) } : {}),
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

export const Route = createFileRoute("/api/public/jobs/monthly-recap")({
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

        // Test mode: { testTo: "email", month: "YYYY-MM" } sends only to that address, no marker.
        let testTo: string | null = null;
        let testCc: string[] = [];
        let monthOverride: string | null = null;
        const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        try {
          const body = (await request.json()) as { testTo?: string; testCc?: string; month?: string };
          if (body?.testTo && (body.testTo === "all" || emailRe.test(body.testTo))) testTo = body.testTo;
          if (body?.testCc) testCc = body.testCc.split(",").map((e) => e.trim()).filter((e) => emailRe.test(e));
          if (body?.month && /^\d{4}-\d{2}$/.test(body.month)) monthOverride = body.month;
        } catch {
          // empty body: normal scheduled run
        }

        // Month to recap: previous month (or override in test mode).
        const now = new Date();
        let month: string;
        if (monthOverride) {
          month = monthOverride;
        } else {
          const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
          month = prev.toISOString().slice(0, 7);
        }

        // Dedup marker (skipped in test mode).
        const markerKey = `recap:${month}`;
        if (!testTo) {
          const { data: marker } = await supabaseAdmin
            .from("editorial_kv")
            .select("key")
            .eq("key", markerKey)
            .maybeSingle();
          if (marker) return Response.json({ status: "already_sent", month });
        }

        // Collect blog articles published (integration done) during the month.
        const { data: rows, error } = await supabaseAdmin
          .from("editorial_kv")
          .select("key, value")
          .like("key", "article:%");
        if (error) {
          console.error("articles read failed", error);
          return Response.json({ error: "read_failed" }, { status: 500 });
        }
        const particulier: Article[] = [];
        const pro: Article[] = [];
        for (const row of rows ?? []) {
          let a: Article;
          try {
            a = JSON.parse(row.value) as Article;
          } catch {
            continue;
          }
          const integration = a.steps?.find((s) => s.key === "integration");
          if (!integration || integration.status !== "done" || !integration.date) continue;
          if (!integration.date.startsWith(month)) continue;
          const aud = (a.audience || "").toLowerCase();
          if (aud.startsWith("pro")) pro.push(a);
          else particulier.push(a);
        }
        const byDate = (a: Article, b: Article) => {
          const da = a.steps?.find((s) => s.key === "integration")?.date ?? "";
          const db = b.steps?.find((s) => s.key === "integration")?.date ?? "";
          return da.localeCompare(db);
        };
        particulier.sort(byDate);
        pro.sort(byDate);
        const total = particulier.length + pro.length;

        // Recipients: every approved user (test mode overrides).
        let recipients: string[] = [];
        if (testTo && testTo !== "all") {
          recipients = [testTo];
        } else {
          const { data: users, error: usersError } = await supabaseAdmin.rpc("approved_users");
          if (usersError) {
            console.error("approved_users failed", usersError);
            return Response.json({ error: "users_failed" }, { status: 500 });
          }
          recipients = (users ?? []).map((u) => u.email).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
        }
        if (recipients.length === 0) return Response.json({ status: "no_recipients", month });

        const label = monthLabel(month);
        const subject = `Récap ${label} : ${total} article${total > 1 ? "s" : ""} publié${total > 1 ? "s" : ""} — merci à toute l'équipe !`;
        const line = (a: Article) => `- ${a.title || "Article"}${a.finalLink ? ` : ${a.finalLink}` : ""}`;
        const text = [
          `Bonjour à toute l'équipe,`,
          ``,
          `Merci et félicitations à toute l'équipe !`,
          `En ${label}, nous avons publié ${total} article${total > 1 ? "s" : ""} sur le blog.`,
          ``,
          particulier.length ? `Blog particulier :\n${particulier.map(line).join("\n")}` : null,
          pro.length ? `Blog professionnel :\n${pro.map(line).join("\n")}` : null,
          ``,
          `On continue sur cette lancée ce mois-ci !`,
        ]
          .filter((l): l is string => l !== null)
          .join("\r\n");
        const html = buildHtml({ month: label, particulier, pro, total });

        try {
          // Never CC someone who is already a direct recipient.
          const cc = testCc.filter((e) => !recipients.some((r) => r.toLowerCase() === e.toLowerCase()));
          await sendBrevo(recipients, subject, text, html, cc);
          if (!testTo) {
            await supabaseAdmin.from("editorial_kv").upsert({ key: markerKey, value: new Date().toISOString() });
          }
          return Response.json({ status: "sent", month, total, recipients: recipients.length });
        } catch (e) {
          console.error("recap send failed", e);
          return Response.json({ status: "send_failed", month }, { status: 502 });
        }
      },
    },
  },
});
