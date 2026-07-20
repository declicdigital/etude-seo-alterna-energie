import { useMemo, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { dataRows, getRow, headersOf, type EditsMap } from "@/lib/workbook";
import { cn } from "@/lib/utils";

const TRUTHY = new Set([
  "x", "✓", "✔", "oui", "yes", "y", "ok", "done", "fait", "true", "1",
]);
const FALSY = new Set([
  "", "-", "–", "—", "✗", "✘", "non", "no", "n", "ko", "todo", "à faire", "a faire", "false", "0",
]);

function normalize(s: string) {
  return s.trim().toLowerCase();
}
function isTruthy(s: string) {
  return TRUTHY.has(normalize(s));
}
function isBooleanLike(s: string) {
  const n = normalize(s);
  return TRUTHY.has(n) || FALSY.has(n);
}

export function TableView({
  sheet,
  edits,
  selected,
  onSelect,
  onAddRow,
  onToggle,
}: {
  sheet: string;
  edits: EditsMap;
  selected: number | null;
  onSelect: (rowId: number) => void;
  onAddRow: () => void;
  onToggle: (rowId: number, col: number, value: string | null) => void;
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

  // Detect which visible columns are boolean-like (checkbox candidates).
  // A column qualifies if it has at least one non-empty value AND every
  // non-empty value matches our truthy/falsy vocabulary.
  const boolCols = useMemo(() => {
    const set = new Set<number>();
    const rows = ids.map((id) => getRow(sheet, id, edits));
    for (const c of visibleCols) {
      let nonEmpty = 0;
      let allBool = true;
      let truthyCount = 0;
      for (const r of rows) {
        const s = r[c] == null ? "" : String(r[c]);
        if (s.trim() === "") continue;
        nonEmpty++;
        if (!isBooleanLike(s)) {
          allBool = false;
          break;
        }
        if (isTruthy(s)) truthyCount++;
      }
      // Require at least one truthy value so purely-empty or purely-dash
      // columns don't get turned into checkboxes.
      if (allBool && nonEmpty > 0 && truthyCount > 0) set.add(c);
    }
    return set;
  }, [visibleCols, ids, sheet, edits]);

  // For each boolean column, pick the most common truthy marker so toggling
  // ON preserves the column's convention ("x", "✓", "oui"…).
  const truthyMarker = useMemo(() => {
    const map = new Map<number, string>();
    const rows = ids.map((id) => getRow(sheet, id, edits));
    for (const c of boolCols) {
      const counts = new Map<string, number>();
      for (const r of rows) {
        const s = r[c] == null ? "" : String(r[c]);
        if (isTruthy(s)) counts.set(s.trim(), (counts.get(s.trim()) ?? 0) + 1);
      }
      let best = "x";
      let bestN = 0;
      for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
      map.set(c, best);
    }
    return map;
  }, [boolCols, ids, sheet, edits]);

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
                  className="text-left px-2 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap leading-tight"
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
                    if (boolCols.has(c)) {
                      const checked = isTruthy(s);
                      return (
                        <td key={c} className="px-2 py-1 align-middle w-10">
                          <input
                            type="checkbox"
                            checked={checked}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              onToggle(id, c, e.target.checked ? (truthyMarker.get(c) ?? "x") : null)
                            }
                            className="size-4 accent-primary cursor-pointer"
                            aria-label={headers[c] || `Col ${c + 1}`}
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={c} className="px-2 py-1 align-top max-w-[320px] leading-tight">
                        {isUrl ? (
                          <a
                            href={s}
                            target="_blank"
                            rel="noreferrer"
                            title={s}
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline flex items-center gap-1 text-xs max-w-[300px]"
                          >
                            <span className="truncate">{s.replace(/^https?:\/\//, "")}</span>
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