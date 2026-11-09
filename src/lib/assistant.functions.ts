import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assistantSystemPrompt, zonesFor } from "./assistant-knowledge";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
/** Premier modèle disponible utilisé ; les suivants servent si un identifiant est refusé. */
const MODELS = ["google/gemini-3.7-flash", "google/gemini-2.5-flash"];

const inputSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(24),
  page: z.string().max(200).optional(),
  name: z.string().max(80).optional(),
});

export type AssistantReply =
  { ok: true; reply: string } | { ok: false; reason: "ai_unavailable" | "forbidden" };

/** Répond à une question sur l'usage de Digicom, dans les limites des rubriques ouvertes à la personne. */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AssistantReply> => {
    const [{ data: profile }, { data: roles }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("status, allowed_sections")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin && profile?.status !== "approved") return { ok: false, reason: "forbidden" };
    const allowed = isAdmin
      ? null
      : ((profile?.allowed_sections as string[] | null | undefined) ?? null);
    const zones = zonesFor(allowed, isAdmin);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false, reason: "ai_unavailable" };
    const system = assistantSystemPrompt({ zones, name: data.name, page: data.page });
    const messages = [{ role: "system", content: system }, ...data.messages.slice(-12)];

    for (const model of MODELS) {
      try {
        const res = await fetch(AI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 700 }),
        });
        if (res.status === 400 || res.status === 404) continue; // modèle inconnu : essayer le suivant
        if (!res.ok) {
          console.error("assistant gateway", res.status, (await res.text()).slice(0, 300));
          return { ok: false, reason: "ai_unavailable" };
        }
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const reply = json.choices?.[0]?.message?.content?.trim();
        if (reply) return { ok: true, reply: reply.slice(0, 4000) };
      } catch (e) {
        console.error("assistant gateway error", e);
        return { ok: false, reason: "ai_unavailable" };
      }
    }
    return { ok: false, reason: "ai_unavailable" };
  });
