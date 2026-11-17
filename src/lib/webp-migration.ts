import { supabase } from "@/integrations/supabase/client";
import { toWebp, webpName } from "@/lib/webp";

/**
 * Conversion unique des images déjà présentes dans Digicom en WebP, lancée par un
 * administrateur depuis la page « Demandes d'accès » (dans son navigateur : c'est lui qui a les
 * droits sur le stockage). Relançable sans risque : ce qui est déjà en WebP est ignoré.
 * - Suivis éditoriaux : images des étapes (bucket « editorial-images ») ; chaque article est
 *   relu juste avant d'être enregistré, et l'ancien fichier n'est supprimé qu'ensuite.
 * - Le Radar : images encore hébergées par l'ancien outil (liens signés) → copiées en WebP dans
 *   « planning-images » et les liens remplacés dans le planning.
 */

export type MigrationProgress = { done: number; total: number; label: string };
export type MigrationReport = {
  editorial: number;
  radar: number;
  skipped: string[];
  failed: string[];
};

const RASTER = /\.(png|jpe?g|bmp|avif)$/i;
const isImageRef = (o: Record<string, unknown>) =>
  typeof o.path === "string" && RASTER.test(o.path) && (o.type === "image" || o.type === undefined);

function walk(node: unknown, visit: (o: Record<string, unknown>) => void) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === "object") {
    visit(node as Record<string, unknown>);
    Object.values(node).forEach((n) => walk(n, visit));
  }
}

async function convertBlob(blob: Blob, name: string): Promise<File> {
  const file = new File([blob], name, { type: blob.type || "image/png" });
  const webp = await toWebp(file);
  if (webp.type !== "image/webp") {
    throw new Error(
      "Ce navigateur ne sait pas créer de WebP : lancez la conversion depuis Chrome ou Edge.",
    );
  }
  return webp;
}

async function allArticleRows(): Promise<{ key: string; value: string }[]> {
  const out: { key: string; value: string }[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase
      .from("editorial_kv")
      .select("key, value")
      .like("key", "%article:%")
      .range(from, from + 999);
    if (error) throw new Error("Lecture des articles impossible.");
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

export async function convertExistingImages(
  onProgress: (p: MigrationProgress) => void,
): Promise<MigrationReport> {
  const report: MigrationReport = { editorial: 0, radar: 0, skipped: [], failed: [] };
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.id;
  if (!userId) throw new Error("Session expirée : reconnectez-vous.");

  // ——— Inventaire ———
  const rows = await allArticleRows();
  const perArticle = new Map<string, { path: string; name: string }[]>();
  for (const row of rows) {
    let doc: unknown;
    try {
      doc = JSON.parse(row.value);
    } catch {
      continue;
    }
    const refs: { path: string; name: string }[] = [];
    walk(doc, (o) => {
      if (isImageRef(o) && !refs.some((r) => r.path === o.path))
        refs.push({
          path: o.path as string,
          name: String(o.name ?? (o.path as string).split("/").pop()),
        });
    });
    if (refs.length) perArticle.set(row.key, refs);
  }
  const { data: planningRow } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            k: string,
            v: number,
          ) => { maybeSingle: () => Promise<{ data: { data: unknown } | null }> };
        };
      };
    }
  )
    .from("planning_state")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  const planningText = planningRow ? JSON.stringify(planningRow.data) : "";
  const radarUrls = [
    ...new Set(
      planningText.match(
        /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/sign\/[^"\\]+/g,
      ) ?? [],
    ),
  ].filter((u) => RASTER.test(u.split("?")[0]));

  const total = [...perArticle.values()].reduce((n, l) => n + l.length, 0) + radarUrls.length;
  let done = 0;
  const step = (label: string) => onProgress({ done: ++done, total, label });
  onProgress({ done: 0, total, label: "Préparation…" });

  // ——— Suivis éditoriaux ———
  for (const [key, refs] of perArticle) {
    const moved = new Map<string, { path: string; name: string }>();
    for (const ref of refs) {
      try {
        const { data: signed, error } = await supabase.storage
          .from("editorial-images")
          .createSignedUrl(ref.path, 600);
        if (error || !signed?.signedUrl) {
          report.skipped.push(ref.name);
          step(ref.name);
          continue;
        }
        const res = await fetch(signed.signedUrl);
        if (!res.ok) throw new Error("téléchargement");
        const webp = await convertBlob(await res.blob(), ref.name);
        const newPath = ref.path.replace(/\.[^./]+$/, ".webp");
        const up = await supabase.storage
          .from("editorial-images")
          .upload(newPath, webp, { contentType: "image/webp", upsert: true });
        if (up.error) throw new Error("envoi");
        moved.set(ref.path, { path: newPath, name: webpName(ref.name) });
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Ce navigateur")) throw e;
        report.failed.push(ref.name);
      }
      step(ref.name);
    }
    if (!moved.size) continue;
    // Relire l'article juste avant d'enregistrer, pour ne rien écraser.
    const { data: latest } = await supabase
      .from("editorial_kv")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (!latest) continue;
    const doc = JSON.parse(latest.value);
    walk(doc, (o) => {
      const m = typeof o.path === "string" ? moved.get(o.path) : undefined;
      if (m) {
        o.path = m.path;
        if (typeof o.name === "string") o.name = webpName(o.name);
      }
    });
    const { error: saveErr } = await supabase
      .from("editorial_kv")
      .upsert({ key, value: JSON.stringify(doc), updated_at: new Date().toISOString() });
    if (saveErr) {
      report.failed.push(...[...moved.values()].map((m) => m.name));
      await supabase.storage
        .from("editorial-images")
        .remove([...moved.values()].map((m) => m.path));
      continue;
    }
    report.editorial += moved.size;
    await supabase.storage.from("editorial-images").remove([...moved.keys()]);
  }

  // ——— Le Radar ———
  if (radarUrls.length) {
    const replace = new Map<string, string>();
    for (const url of radarUrls) {
      const name = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "image.png");
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("téléchargement");
        const webp = await convertBlob(await res.blob(), name);
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.webp`;
        const up = await supabase.storage
          .from("planning-images")
          .upload(path, webp, { contentType: "image/webp", upsert: false });
        if (up.error) throw new Error("envoi");
        const { data: signed, error } = await supabase.storage
          .from("planning-images")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 20);
        if (error || !signed?.signedUrl) throw new Error("lien");
        replace.set(url, signed.signedUrl);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Ce navigateur")) throw e;
        report.failed.push(`Le Radar : ${name}`);
      }
      step(`Le Radar : ${name}`);
    }
    if (replace.size) {
      const db = supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              k: string,
              v: number,
            ) => { maybeSingle: () => Promise<{ data: { data: unknown } | null }> };
          };
          update: (v: Record<string, unknown>) => {
            eq: (k: string, v: number) => Promise<{ error: unknown }>;
          };
        };
      };
      const { data: fresh } = await db
        .from("planning_state")
        .select("data")
        .eq("id", 1)
        .maybeSingle();
      let text = JSON.stringify(fresh?.data ?? {});
      for (const [from, to] of replace) text = text.split(from).join(to);
      const next = { ...JSON.parse(text), __lastAction: "Images converties en WebP" };
      const { error } = await db
        .from("planning_state")
        .update({ data: next, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) report.failed.push(...[...replace.keys()].map(() => "Le Radar (enregistrement)"));
      else report.radar = replace.size;
    }
  }
  return report;
}
