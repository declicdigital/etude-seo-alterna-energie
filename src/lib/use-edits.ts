import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildEditsMap, type CellEdit, type EditsMap } from "@/lib/workbook";

export function useEdits() {
  const [edits, setEdits] = useState<EditsMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("sheet_cells" as never).select("*");
      if (!alive) return;
      if (data) setEdits(buildEditsMap(data as unknown as CellEdit[]));
      setLoading(false);
    })();
    const channel = supabase
      .channel("sheet_cells_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sheet_cells" },
        (payload) => {
          setEdits((prev) => {
            const next: EditsMap = JSON.parse(JSON.stringify(prev));
            const row = (payload.new ?? payload.old) as CellEdit;
            if (payload.eventType === "DELETE") {
              delete next[row.sheet]?.[row.row_id]?.[row.col];
            } else {
              (next[row.sheet] ??= {})[row.row_id] ??= {};
              next[row.sheet][row.row_id][row.col] = row.value;
            }
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

  const setCell = useCallback(
    async (sheet: string, rowId: number, col: number, value: string | null) => {
      setEdits((prev) => {
        const next: EditsMap = { ...prev, [sheet]: { ...(prev[sheet] ?? {}) } };
        next[sheet][rowId] = { ...(next[sheet][rowId] ?? {}), [col]: value };
        return next;
      });
      await supabase
        .from("sheet_cells" as never)
        .upsert(
          { sheet, row_id: rowId, col, value, updated_at: new Date().toISOString() } as never,
          { onConflict: "sheet,row_id,col" },
        );
    },
    [],
  );

  return { edits, setCell, loading };
}