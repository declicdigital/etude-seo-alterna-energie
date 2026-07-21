import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type MetaRow = { scope: string; key: string; value: string | null };
export type MetaMap = Record<string, Record<string, string | null>>;

export function useMeta() {
  const [meta, setMeta] = useState<MetaMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("sheet_meta" as never).select("*");
      if (!alive) return;
      if (data) {
        const m: MetaMap = {};
        for (const r of data as unknown as MetaRow[]) {
          (m[r.scope] ??= {})[r.key] = r.value;
        }
        setMeta(m);
      }
      setLoading(false);
    })();
    const channel = supabase
      .channel("sheet_meta_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sheet_meta" },
        (payload) => {
          const row = (payload.new ?? payload.old) as MetaRow;
          setMeta((prev) => {
            const next: MetaMap = { ...prev, [row.scope]: { ...(prev[row.scope] ?? {}) } };
            if (payload.eventType === "DELETE") delete next[row.scope][row.key];
            else next[row.scope][row.key] = row.value;
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const setMetaValue = useCallback(
    async (scope: string, key: string, value: string | null) => {
      setMeta((prev) => {
        const next: MetaMap = { ...prev, [scope]: { ...(prev[scope] ?? {}) } };
        next[scope][key] = value;
        return next;
      });
      await supabase
        .from("sheet_meta" as never)
        .upsert(
          { scope, key, value, updated_at: new Date().toISOString() } as never,
          { onConflict: "scope,key" },
        );
    },
    [],
  );

  return { meta, setMetaValue, loading };
}

export function metaGet(meta: MetaMap, scope: string, key: string, fallback: string): string {
  const v = meta[scope]?.[key];
  return v != null && v !== "" ? v : fallback;
}