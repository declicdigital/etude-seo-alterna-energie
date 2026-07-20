import { useMemo, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { dataRows, getRow, headersOf, type EditsMap } from "@/lib/workbook";
import { cn } from "@/lib/utils";

export function TableView({
  sheet,
  edits,
  selected,
  onSelect,
  onAddRow,
}: {
  sheet: string;
  edits: EditsMap;
  selected: number | null;
  onSelect: (rowId: number) => void;
  onAddRow: () => void;
}) {
  const headers = headersOf(sheet);
  const ids = useMemo(() => dataRows(sheet, edits), [sheet, edits]);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q) return ids;
    const ql = q.toLowerCase();
    return ids.filter((id) =>
      getRow(sheet, id, edits).some((c) => c != null && String(c).toLowerCase().includes(ql)),
    );
  }, [ids, q, sheet, edits]);

  // Only show columns that have any header text OR any data
  const visibleCols = useMemo(() => {
    const cols: number[] = [];
    const rows = ids.map((id) => getRow(sheet, id, edits));
    const width = Math.max(headers.length, ...rows.map((r) => r.length));
    for (let c = 0; c < width; c++) {
      const h = headers[c];
      const hasData = rows.some((r) => r[c] != null && String(r[c]).trim() !== "");
      if ((h && h.trim()) || hasData) cols.push(c);
    }
    return cols;
  }, [sheet, edits, ids, headers]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border bg-card/50 flex gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} lignes</span>
        <button
          onClick={onAddRow}
          className="h-9 px-3 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="size-3.5" /> Ajouter une ligne
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="text-sm w-full border-collapse">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              {visibleCols.map((c) => (
                <th
                  key={c}
                  className="text-left px-3 py-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                >
                  {headers[c] || `Col ${c + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((id) => {
              const row = getRow(sheet, id, edits);
              const isSel = selected === id;
              return (
                <tr
                  key={id}
                  onClick={() => onSelect(id)}
                  className={cn(
                    "border-b border-border/60 cursor-pointer hover:bg-muted/40 transition-colors",
                    isSel && "bg-primary/10 hover:bg-primary/15",
                  )}
                >
                  {visibleCols.map((c) => {
                    const v = row[c];
                    const s = v == null ? "" : String(v);
                    const isUrl = /^https?:\/\//i.test(s);
                    return (
                      <td key={c} className="px-3 py-2 align-top max-w-[320px]">
                        {isUrl ? (
                          <a
                            href={s}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline inline-flex items-center gap-1 text-xs break-all"
                          >
                            {s.replace(/^https?:\/\//, "").slice(0, 60)}
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="whitespace-pre-wrap break-words text-foreground/90">
                            {s.length > 240 ? s.slice(0, 240) + "…" : s}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">Aucun résultat.</div>
        )}
      </div>
    </div>
  );
}