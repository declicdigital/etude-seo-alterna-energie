import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assistantSystemPrompt,
  splitNoAnswer,
  zonesFor,
  type AssistantZone,
} from "./assistant-knowledge";
import {
  buildStatsBlock,
  LISTS,
  SPACES,
  type StatsInput,
  type TrackedArticle,
} from "./assistant-stats";
import { buildEditsMap, type CellEdit } from "./workbook";
import type { FaqRequest } from "./faq";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
/** Premier modèle disponible utilisé ; les suivants servent si un identifiant est refusé. */
const MODELS = ["google/gemini-3.7-flash", "google/gemini-2.5-flash"];

const inputSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
    .min(1)
    .max(24),
  page: z.string().max(200).optional(),
  name: z.string().max(80).optional(),
});

export type AssistantReply =
  | { ok: true; reply: string; unanswered: boolean }
  | { ok: false; reason: "ai_unavailable" | "forbidden" };

export type UnansweredQuestion = {
  id: string;
  created_at: string;
  user_name: string | null;
  question: string;
  reply: string | null;
  page: string | null;
  source: string;
};

type Ctx = {
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >;
  userId: string;
};

async function accessOf(context: Ctx) {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    context.supabase
      .from("profiles")
      .select("status, allowed_sections")
      .eq("id", context.userId)
      .maybeSingle(),
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
  ]);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  const approved = isAdmin || profile?.status === "approved";
  const allowed = isAdmin
    ? null
    : ((profile?.allowed_sections as string[] | null | undefined) ?? null);
  return { isAdmin, approved, allowed };
}

/** Toutes les lignes d'une requête, par pages de 1000 (limite de l'API). */
async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/** Chiffres en temps réel des rubriques ouvertes à la personne (lus avec ses propres droits). */
async function loadStats(context: Ctx, zones: AssistantZone[]): Promise<string | null> {
  try {
    const zoneIds = new Set(zones.map((z) => z.id));
    const db = context.supabase;
    const prefixes: Record<string, string> = { blog: "", strat: "strat:", planete: "planete:" };
    const spaces = (Object.keys(SPACES) as (keyof typeof SPACES)[]).filter((k) =>
      zoneIds.has(SPACES[k].id),
    );
    const lists = LISTS.filter((l) => zoneIds.has(l.id));
    const wantsFaq = ["faq-demandes", "faq-part", "faq-pro"].some((z) => zoneIds.has(z));
    const listBases = [...new Set(lists.map((l) => l.sheet.split("::")[0]))];

    const [kvArticles, kvTodos, kvFaq, cells] = await Promise.all([
      Promise.all(
        spaces.map((k) =>
          allRows<{ key: string; value: string }>((a, b) =>
            db
              .from("editorial_kv")
              .select("key, value")
              .like("key", `${prefixes[k]}article:%`)
              .range(a, b),
          ).then((rows) => [k, rows] as const),
        ),
      ),
      spaces.length
        ? db
            .from("editorial_kv")
            .select("key, value")
            .in(
              "key",
              spaces.map((k) => `${prefixes[k]}todo-redaction`),
            )
            .then((r) => r.data ?? [])
        : Promise.resolve([] as { key: string; value: string }[]),
      wantsFaq
        ? allRows<{ key: string; value: string }>((a, b) =>
            db.from("editorial_kv").select("key, value").like("key", "faq:%").range(a, b),
          )
        : Promise.resolve([] as { key: string; value: string }[]),
      Promise.all(
        listBases.map((base) =>
          allRows<CellEdit>((a, b) =>
            db
              .from("sheet_cells")
              .select("sheet, row_id, col, value")
              .like("sheet", `${base}%`)
              .order("sheet")
              .order("row_id")
              .order("col")
              .range(a, b),
          ),
        ),
      ).then((parts) => parts.flat()),
    ]);

    const parse = <T>(v: string): T | null => {
      try {
        return JSON.parse(v) as T;
      } catch {
        return null;
      }
    };
    const articles: StatsInput["articles"] = {};
    for (const [k, rows] of kvArticles) {
      // « article:… » sans préfixe = Blog ; on écarte les clés des autres espaces.
      const own = rows.filter((r) => (k === "blog" ? /^article:/.test(r.key) : true));
      articles[k] = own
        .map((r) => parse<TrackedArticle>(r.value))
        .filter((a): a is TrackedArticle => !!a);
    }
    const todos: StatsInput["todos"] = {};
    for (const k of spaces) {
      const row = kvTodos.find((r) => r.key === `${prefixes[k]}todo-redaction`);
      todos[k] = (row && parse<StatsInput["todos"]["blog"]>(row.value)) || [];
    }
    const faq = kvFaq.map((r) => parse<FaqRequest>(r.value)).filter((f): f is FaqRequest => !!f);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    return buildStatsBlock({ today, zoneIds, edits: buildEditsMap(cells), articles, todos, faq });
  } catch (e) {
    console.error("assistant stats", e);
    return null;
  }
}

/** Garde la question pour Geoffrey (RLS : chacun n'écrit que ses propres questions). */
async function logQuestion(
  context: Ctx,
  row: { question: string; reply?: string; page?: string; name?: string; source: "ia" | "local" },
) {
  const { error } = await context.supabase.from("assistant_questions").insert({
    user_id: context.userId,
    user_name: row.name?.slice(0, 80) || null,
    question: row.question.slice(0, 2000),
    reply: row.reply ? row.reply.slice(0, 4000) : null,
    page: row.page?.slice(0, 200) || null,
    source: row.source,
  });
  if (error) console.error("assistant_questions insert", error.message);
}

/** Répond à une question sur l'usage de Digicom, dans les limites des rubriques ouvertes à la personne. */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<AssistantReply> => {
    const access = await accessOf(context);
    if (!access.approved) return { ok: false, reason: "forbidden" };
    const zones = zonesFor(access.allowed, access.isAdmin);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false, reason: "ai_unavailable" };
    const email = (context as { claims?: { email?: string } }).claims?.email ?? null;
    const stats = await loadStats(context, zones);
    const system = assistantSystemPrompt({ zones, name: data.name, page: data.page, email, stats });
    const history = data.messages.slice(-12).map((m) => ({
      role: m.role,
      content: m.role === "assistant" ? splitNoAnswer(m.content).text : m.content,
    }));
    const messages = [{ role: "system", content: system }, ...history];

    for (const model of MODELS) {
      try {
        const res = await fetch(AI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 4096 }),
        });
        if (res.status === 400 || res.status === 404) continue; // modèle inconnu : essayer le suivant
        if (!res.ok) {
          console.error("assistant gateway", res.status, (await res.text()).slice(0, 300));
          return { ok: false, reason: "ai_unavailable" };
        }
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = json.choices?.[0]?.message?.content?.trim();
        if (!raw) continue;
        const { text, unanswered } = splitNoAnswer(raw);
        if (unanswered) {
          const question = [...data.messages].reverse().find((m) => m.role === "user")?.content;
          if (question)
            await logQuestion(context, {
              question,
              reply: text,
              page: data.page,
              name: data.name,
              source: "ia",
            });
        }
        return { ok: true, reply: text.slice(0, 8000), unanswered };
      } catch (e) {
        console.error("assistant gateway error", e);
        return { ok: false, reason: "ai_unavailable" };
      }
    }
    return { ok: false, reason: "ai_unavailable" };
  });

/** Question restée sans réponse avec le mode d'emploi intégré (IA indisponible). */
export const logUnansweredQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().min(1).max(2000),
        reply: z.string().max(4000).optional(),
        page: z.string().max(200).optional(),
        name: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const access = await accessOf(context);
    if (!access.approved) return { ok: false };
    await logQuestion(context, { ...data, source: "local" });
    return { ok: true };
  });

/** Liste des questions sans réponse (administrateur : Geoffrey). */
export const listUnansweredQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; items: UnansweredQuestion[] }> => {
    const access = await accessOf(context);
    if (!access.isAdmin) return { ok: false, items: [] };
    const { data, error } = await context.supabase
      .from("assistant_questions")
      .select("id, created_at, user_name, question, reply, page, source")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("assistant_questions list", error.message);
      return { ok: false, items: [] };
    }
    return { ok: true, items: (data ?? []) as UnansweredQuestion[] };
  });

/** Marque des questions comme traitées (elles sortent de la liste). */
export const resolveUnansweredQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const access = await accessOf(context);
    if (!access.isAdmin) return { ok: false };
    const { error } = await context.supabase
      .from("assistant_questions")
      .update({ resolved_at: new Date().toISOString() })
      .in("id", data.ids);
    if (error) console.error("assistant_questions resolve", error.message);
    return { ok: !error };
  });
