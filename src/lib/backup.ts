import { supabase } from "@/integrations/supabase/client";

const TABLES = ["sheet_cells", "sheet_meta", "editorial_kv", "article_comments"] as const;

async function fetchAll(table: (typeof TABLES)[number]) {
  const rows: unknown[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + size - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return rows;
}

export async function downloadBackup() {
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
  for (const t of TABLES) out[t] = await fetchAll(t);
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sauvegarde-digicom-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
