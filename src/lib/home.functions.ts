import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { roleFor, zonesFor } from "./assistant-knowledge";
import {
  buildHomeSummary,
  HOME_SPACES,
  teamNamesOf,
  type HomeArticle,
  type HomeSpaceId,
  type HomeSummary,
  type HomeTodo,
  type SpaceData,
  type StepConfig,
} from "./home-summary";

type Db = import("@supabase/supabase-js").SupabaseClient<
  import("@/integrations/supabase/types").Database
>;

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

const parse = <T>(v: string | null | undefined): T | null => {
  try {
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};

const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** Résumé de la page d'accueil, lu avec les droits de la personne, pour ses rubriques ouvertes uniquement. */
export const getHomeSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; summary: HomeSummary | null }> => {
    const db = context.supabase as Db;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      db
        .from("profiles")
        .select("status, allowed_sections, full_name, email")
        .eq("id", context.userId)
        .maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin && profile?.status !== "approved") return { ok: false, summary: null };
    const allowed = isAdmin
      ? null
      : ((profile?.allowed_sections as string[] | null | undefined) ?? null);
    const zoneIds = new Set(zonesFor(allowed, isAdmin).map((z) => z.id));
    const email = (
      (context as { claims?: { email?: string } }).claims?.email ??
      profile?.email ??
      ""
    ).toLowerCase();

    const spaces = (Object.keys(HOME_SPACES) as HomeSpaceId[]).filter((k) =>
      zoneIds.has(HOME_SPACES[k].zone),
    );
    const spaceData: SpaceData[] = await Promise.all(
      spaces.map(async (space) => {
        const prefix = HOME_SPACES[space].prefix;
        const [rows, meta] = await Promise.all([
          allRows<{ key: string; value: string }>((a, b) =>
            db
              .from("editorial_kv")
              .select("key, value")
              .like("key", `${prefix}article:%`)
              .range(a, b),
          ),
          db
            .from("editorial_kv")
            .select("key, value")
            .in("key", [
              `${prefix}articles-index`,
              `${prefix}todo-redaction`,
              `${prefix}pipeline-config`,
            ])
            .then((r) => r.data ?? []),
        ]);
        const kv = (k: string) => meta.find((m) => m.key === `${prefix}${k}`)?.value;
        const index = parse<string[]>(kv("articles-index"));
        const known = index ? new Set(index) : null;
        const articles = rows
          // « article:% » attrape aussi les autres espaces dans le Blog (préfixe vide) : on les écarte.
          .filter(
            (r) =>
              r.key.startsWith(`${prefix}article:`) && (prefix || !/^[a-z]+:article:/.test(r.key)),
          )
          .map((r) => parse<HomeArticle>(r.value))
          .filter((a): a is HomeArticle => !!a && !!a.id && (!known || known.has(a.id)));
        return {
          space,
          articles,
          todos: parse<HomeTodo[]>(kv("todo-redaction")) ?? [],
          config: parse<StepConfig[]>(kv("pipeline-config")) ?? [],
        };
      }),
    );

    let radarYear: { campaigns?: unknown[]; milestones?: unknown[] } | null = null;
    const today = parisToday();
    if (zoneIds.has("planning")) {
      const { data } = await (db as unknown as { from: (t: string) => ReturnType<Db["from"]> })
        .from("planning_state")
        .select("data")
        .eq("id", 1)
        .maybeSingle();
      const years = (
        ((data as { data?: unknown } | null)?.data ?? {}) as {
          years?: Record<string, { campaigns?: unknown[]; milestones?: unknown[] }>;
        }
      ).years;
      radarYear = years?.[today.slice(0, 4)] ?? { campaigns: [], milestones: [] };
    }

    const firstName =
      roleFor(email)?.name ?? ((profile?.full_name ?? "").trim().split(/\s+/)[0] || null);
    const me = teamNamesOf(
      email,
      firstName,
      spaceData.map((s) => s.config),
    );
    return { ok: true, summary: buildHomeSummary({ today, me, spaces: spaceData, radarYear }) };
  });
