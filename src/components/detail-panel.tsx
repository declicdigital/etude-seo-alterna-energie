import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { getRow, headersOf, SHEET_META, type EditsMap } from "@/lib/workbook";
import { linkHref } from "@/lib/links";

export function DetailPanel({
  sheet,
  rowId,
  edits,
  onChange,
  onClose,
}: {
  sheet: string;
  rowId: number;
  edits: EditsMap;
  onChange: (col: number, value: string | null) => void;
  onClose: () => void;
}) {
  const headers = headersOf(sheet, edits);
  const row = getRow(sheet, rowId, edits);
  const meta = SHEET_META[sheet];
  const treeCols = meta?.treeCols ?? 0;

  // Determine title from tree level or first non-empty cell
  let title = "";
  let level = -1;
  if (treeCols) {
    for (let c = 0; c < treeCols; c++) {
      if (row[c] != null && String(row[c]).trim() !== "") {
        title = String(row[c]);
        level = c;
        break;
      }
    }
  }
  if (!title) title = String(row.find((v) => v != null && String(v).trim() !== "") ?? "Ligne " + rowId);

  return (
    <aside className="w-[440px] shrink-0 border-l border-border bg-card h-screen sticky top-0 overflow-y-auto">
      <div className="p-5 border-b border-border sticky top-0 bg-card z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {level >= 0 && (
              <div className="text-[10px] uppercase tracking-wider font-semibold text-primary/80 mb-1">
                Niveau N{level}
              </div>
            )}
            <h2 className="text-base font-semibold leading-tight break-words">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-md hover:bg-muted flex items-center justify-center shrink-0"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {headers.map((h, idx) => {
          // Skip tree columns after the level column - they represent hierarchy not fields
          if (treeCols && idx < treeCols && idx !== level) return null;
          if (!h && (row[idx] == null || String(row[idx]).trim() === "")) return null;
          return (
            <Field
              key={idx}
              label={h || `Colonne ${idx + 1}`}
              value={row[idx]}
              onChange={(v) => onChange(idx, v)}
            />
          );
        })}
      </div>
    </aside>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | number | null;
  onChange: (v: string | null) => void;
}) {
  const [local, setLocal] = useState<string>(value == null ? "" : String(value));
  useEffect(() => setLocal(value == null ? "" : String(value)), [value]);

  const commit = () => {
    const clean = local.trim() === "" ? null : local;
    const orig = value == null ? "" : String(value);
    if ((clean ?? "") !== orig) onChange(clean);
  };

  const isLong = local.length > 60 || local.includes("\n");
  const href = linkHref(local);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          {label}
        </label>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
          >
            Ouvrir <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      {isLong ? (
        <textarea
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          rows={Math.min(10, Math.max(3, local.split("\n").length + 1))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </div>
  );
}