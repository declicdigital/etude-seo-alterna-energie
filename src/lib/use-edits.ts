import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildEditsMap, type CellEdit, type EditsMap } from "@/lib/workbook";

const PAGE = 1000;

export function useEdits() {
  const [edits, setEdits] = useState<EditsMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      // L'API renvoie au plus 1000 lignes par requête : on charge tout, page par page, dans un
      // ordre stable (sans ça, les cases au-delà des 1000 premières — souvent les derniers
      // contenus ajoutés — n'apparaissaient dans aucune liste).
      const all: CellEdit[] = [];
      let complete = true;
      for (let from = 0; from < 200000; from += PAGE) {
        const { data, error } = await supabase
          .from("sheet_cells" as never)
          .select("sheet, row_id, col, value")
          .order("sheet" as never)
          .order("row_id" as never)
          .order("col" as never)
          .range(from, from + PAGE - 1);
        if (!alive) return;
        if (error) {
          console.error("sheet_cells", error.message);
          complete = false;
          break;
        }
        const rows = (data ?? []) as unknown as CellEdit[];
        all.push(...rows);
        if (rows.length < PAGE) break;
      }
      if (!alive) return;
      if (all.length || complete) setEdits(buildEditsMap(all));
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

  const deleteRow = useCallback(
    async (sheet: string, rowId: number) => {
      // Sentinel marker on col=-1 hides the row from every view.
      setEdits((prev) => {
        const next: EditsMap = { ...prev, [sheet]: { ...(prev[sheet] ?? {}) } };
        next[sheet][rowId] = { ...(next[sheet][rowId] ?? {}), [-1]: "__deleted__" };
        return next;
      });
      await supabase
        .from("sheet_cells" as never)
        .upsert(
          { sheet, row_id: rowId, col: -1, value: "__deleted__", updated_at: new Date().toISOString() } as never,
          { onConflict: "sheet,row_id,col" },
        );
    },
    [],
  );

  return { edits, setCell, deleteRow, loading };
}