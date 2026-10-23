import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { canEditBenchmark } from "@/lib/benchmark";

/**
 * Données de l'outil Benchmark Énergie (rubrique Benchmark de Digicom).
 * Lecture : tout compte Digicom validé. Écriture : Geoffrey uniquement
 * (rôle admin + son e-mail), vérifié côté serveur à chaque requête.
 */

const SaveSchema = z.object({
  action: z.literal("save"),
  monthKey: z.string().min(1).max(120),
  label: z.string().max(120).optional(),
  savedAt: z.string().max(60).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});
const DeleteSchema = z.object({
  action: z.literal("delete"),
  monthKey: z.string().min(1).max(120),
});
const RenameSchema = z.object({
  action: z.literal("rename"),
  monthKey: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
});
const BodySchema = z.discriminatedUnion("action", [SaveSchema, DeleteSchema, RenameSchema]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Vérifie le jeton Digicom et renvoie l'utilisateur + son droit d'édition. */
async function authenticate(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.status !== "approved") return null;
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  return { user, editor: canEditBenchmark(isAdmin === true, user.email) };
}

export const Route = createFileRoute("/api/public/benchmark-months")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "unauthorized" }, 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("benchmark_months")
          .select("month_key,label,saved_at,data")
          .order("saved_at", { ascending: true });
        if (error) return json({ error: error.message }, 500);
        return json({ months: data ?? [], editor: auth.editor });
      },
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "unauthorized" }, 401);
        if (!auth.editor) return json({ error: "Seul Geoffrey peut modifier le benchmark." }, 403);

        let raw: unknown;
        try { raw = await request.json(); } catch { return json({ error: "invalid json" }, 400); }
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) return json({ error: "invalid body" }, 400);
        const body = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (body.action === "delete") {
          const { error } = await supabaseAdmin.from("benchmark_months").delete().eq("month_key", body.monthKey);
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true });
        }

        if (body.action === "save") {
          const { error } = await supabaseAdmin
            .from("benchmark_months")
            .upsert(
              {
                month_key: body.monthKey,
                label: body.label ?? body.monthKey,
                saved_at: body.savedAt ?? new Date().toISOString(),
                data: body.data,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "month_key" },
            );
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true });
        }

        // rename
        const { error } = await supabaseAdmin
          .from("benchmark_months")
          .update({ label: body.label, updated_at: new Date().toISOString() })
          .eq("month_key", body.monthKey);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      },
    },
  },
});
