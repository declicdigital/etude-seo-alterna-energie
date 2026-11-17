import { beforeEach, describe, expect, it, vi } from "vitest";

const kv = new Map<string, string>();
let planning: Record<string, unknown> = {};
const stored = new Set<string>();
const removed: string[] = [];
const OLD = "https://moqfnmdijqxzrjlekkvr.supabase.co/storage/v1/object/sign/planning-images/2026/a.png?token=abc";

vi.mock("@/lib/webp", () => ({
  webpName: (n: string) => n.replace(/\.[^.]+$/, "") + ".webp",
  toWebp: async (f: File) => new File(["w"], f.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const table = (name: string) => {
    const q: Record<string, unknown> = {};
    let key = "";
    Object.assign(q, {
      select: () => q,
      like: () => q,
      range: async () => ({ data: [...kv].map(([k, v]) => ({ key: k, value: v })), error: null }),
      eq: (_c: string, v: string) => {
        key = v;
        return q;
      },
      maybeSingle: async () =>
        name === "planning_state" ? { data: { data: planning } } : { data: kv.has(key) ? { value: kv.get(key) } : null },
      upsert: async (row: { key: string; value: string }) => {
        kv.set(row.key, row.value);
        return { error: null };
      },
      update: (row: { data: Record<string, unknown> }) => ({
        eq: async () => {
          planning = row.data;
          return { error: null };
        },
      }),
    });
    return q;
  };
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: "admin" } } } }) },
      from: table,
      storage: {
        from: (bucket: string) => ({
          createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://signed/${bucket}/${p}` }, error: null }),
          upload: async (p: string) => {
            stored.add(`${bucket}/${p}`);
            return { error: null };
          },
          remove: async (paths: string[]) => {
            removed.push(...paths);
            return {};
          },
        }),
      },
    },
  };
});

beforeEach(() => {
  kv.clear();
  stored.clear();
  removed.length = 0;
  vi.stubGlobal("fetch", async () => new Response(new Blob(["png"], { type: "image/png" })));
});

describe("conversion des images existantes", () => {
  it("convertit les images des suivis et du Radar et met à jour les liens", async () => {
    kv.set(
      "strat:article:a1",
      JSON.stringify({
        id: "a1",
        title: "MaPrimeRénov'",
        steps: [{ key: "image", attachments: [{ id: "x", type: "image", path: "a1/v-1500x700.png", name: "1500x700.png", format: "large" }] }],
      }),
    );
    kv.set("article:a2", JSON.stringify({ id: "a2", steps: [{ key: "image", attachments: [{ type: "image", path: "a2/deja.webp", name: "deja.webp" }] }] }));
    planning = { years: { 2026: { actions: [{ imageDatas: [OLD] }] } } };
    const { convertExistingImages } = await import("./webp-migration");
    const report = await convertExistingImages(() => undefined);
    expect(report).toMatchObject({ editorial: 1, radar: 1, failed: [] });
    const a1 = JSON.parse(kv.get("strat:article:a1")!);
    expect(a1.steps[0].attachments[0]).toMatchObject({ path: "a1/v-1500x700.webp", name: "1500x700.webp", format: "large" });
    expect(removed).toContain("a1/v-1500x700.png");
    expect(JSON.stringify(planning)).not.toContain("moqfnmdijqxzrjlekkvr");
    expect(planning.__lastAction).toBe("Images converties en WebP");
    // Le WebP déjà présent n'est pas touché.
    expect(JSON.parse(kv.get("article:a2")!).steps[0].attachments[0].path).toBe("a2/deja.webp");
  });
});
