import { useMemo, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { dataRows, getRow, headersOf, SHEET_META, type EditsMap } from "@/lib/workbook";
import { cn } from "@/lib/utils";
import { linkHref, linkify } from "@/lib/links";
import { EditableText } from "@/components/editable-text";

const TRUTHY = new Set([
  "x", "✓", "✔", "oui", "yes", "y", "ok", "done", "fait", "true", "1",
]);
const FALSY = new Set([
  "", "-", "–", "-", "✗", "✘", "non", "no", "n", "ko", "todo", "à faire", "a faire", "false", "0",
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

// Status vocabulary: normalized value -> canonical state key.
// Any column whose non-empty values ALL live in this vocabulary AND that
// contains at least one multi-state marker (i.e. beyond simple yes/no)
// renders as a dropdown with colored badges.
type StatusKey =
  | "todo" | "in_progress" | "done" | "pending" | "blocked" | "canceled";
const STATUS_MAP: Record<string, StatusKey> = {
  // to do
  "todo": "todo", "à faire": "todo", "a faire": "todo", "not started": "todo",
  "pas commencé": "todo", "pas commence": "todo",
  // in progress
  "en cours": "in_progress", "wip": "in_progress", "in progress": "in_progress",
  "doing": "in_progress", "en cours…": "in_progress",
  // done
  "terminé": "done", "termine": "done", "fait": "done", "done": "done",
  "ok": "done", "validé": "done", "valide": "done", "publié": "done", "publie": "done",
  "✓": "done", "✔": "done", "x": "done", "oui": "done", "yes": "done",
  // pending / review
  "en attente": "pending", "pending": "pending", "à valider": "pending",
  "a valider": "pending", "review": "pending", "relecture": "pending",
  "en revue": "pending",
  // blocked
  "bloqué": "blocked", "bloque": "blocked", "blocked": "blocked", "ko": "blocked",
  // canceled
  "annulé": "canceled", "annule": "canceled", "abandonné": "canceled",
  "abandonne": "canceled", "canceled": "canceled", "cancelled": "canceled",
};
const MULTI_STATE_KEYS: Set<StatusKey> = new Set([
  "in_progress", "pending", "blocked", "canceled",
]);
const STATUS_STYLE: Record<StatusKey, string> = {
  todo: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
  done: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  blocked: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300",
  canceled: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30 dark:text-zinc-300",
};
function statusKey(s: string): StatusKey | null {
  return STATUS_MAP[normalize(s)] ?? null;
}

// Effort vocabulary: normalized value -> canonical level.
type EffortKey = "low" | "medium" | "high";
const EFFORT_MAP: Record<string, EffortKey> = {
  "faible": "low", "low": "low", "petit": "low", "small": "low", "s": "low",
  "bas": "low", "léger": "low", "leger": "low",
  "moyen": "medium", "medium": "medium", "moyenne": "medium", "med": "medium",
  "m": "medium", "normal": "medium",
  "fort": "high", "élevé": "high", "eleve": "high", "haut": "high", "high": "high",
  "grand": "high", "large": "high", "l": "high", "important": "high",
};
const EFFORT_STYLE: Record<EffortKey, string> = {
  low: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  medium: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  high: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300",
};
function effortKey(s: string): EffortKey | null {
  return EFFORT_MAP[normalize(s)] ?? null;
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
  const headers = headersOf(sheet, edits);
  const headerRow = SHEET_META[sheet]?.headerRow ?? 0;
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

  // Classify each visible column to pick a sensible width. This keeps
  // narrow columns from stealing space from prose columns and vice-versa.
  type ColKind = "bool" | "url" | "short" | "medium" | "long";
  const colKind = useMemo(() => {
    const map = new Map<number, ColKind>();
    const rows = ids.map((id) => getRow(sheet, id, edits));
    for (const c of visibleCols) {
      let maxLen = 0;
      let sum = 0;
      let n = 0;
      let urlHits = 0;
      for (const r of rows) {
        const s = r[c] == null ? "" : String(r[c]);
        if (s.trim() === "") continue;
        n++;
        sum += s.length;
        if (s.length > maxLen) maxLen = s.length;
        if (/^https?:\/\//i.test(s.trim())) urlHits++;
      }
      const avg = n ? sum / n : 0;
      let kind: ColKind;
      if (n > 0 && urlHits / n > 0.5) kind = "url";
      else if (maxLen <= 6) kind = "short";
      else if (maxLen <= 24 && avg <= 18) kind = "short";
      else if (maxLen <= 60) kind = "medium";
      else kind = "long";
      map.set(c, kind);
    }
    // Boolean cols override to a compact width.
    return map;
  }, [visibleCols, ids, sheet, edits]);

  const widthFor = (c: number): { min: number; max: number } => {
    if (boolCols.has(c)) return { min: 44, max: 56 };
    if (priorityCols.has(c)) return { min: 56, max: 72 };
    if (statusCols.has(c)) return { min: 120, max: 160 };
    if (effortCols.has(c)) return { min: 100, max: 140 };
    const k = colKind.get(c);
    switch (k) {
      case "url": return { min: 200, max: 320 };
      case "short": return { min: 90, max: 160 };
      case "medium": return { min: 160, max: 260 };
      case "long": return { min: 260, max: 460 };
      default: return { min: 140, max: 320 };
    }
  };

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

  // Detect status-like columns: every non-empty value must map to a known
  // status key AND at least one value must be a multi-state marker (so we
  // don't hijack pure yes/no columns already handled as checkboxes).
  // Each entry maps the column index to the ordered list of option labels
  // to show in the dropdown, preserving the user's original casing.
  const statusCols = useMemo(() => {
    const map = new Map<number, string[]>();
    const rows = ids.map((id) => getRow(sheet, id, edits));
    for (const c of visibleCols) {
      let nonEmpty = 0;
      let allStatus = true;
      let hasMulti = false;
      const seen = new Map<StatusKey, string>(); // canonical -> first-seen label
      for (const r of rows) {
        const s = r[c] == null ? "" : String(r[c]);
        if (s.trim() === "") continue;
        nonEmpty++;
        const k = statusKey(s);
        if (!k) { allStatus = false; break; }
        if (MULTI_STATE_KEYS.has(k)) hasMulti = true;
        if (!seen.has(k)) seen.set(k, s.trim());
      }
      if (allStatus && nonEmpty > 0 && hasMulti) {
        // Build option list: ordered canonical states, using seen label when
        // available or a sensible French default otherwise.
        const DEFAULTS: Record<StatusKey, string> = {
          todo: "À faire",
          in_progress: "En cours",
          pending: "En attente",
          done: "Terminé",
          blocked: "Bloqué",
          canceled: "Annulé",
        };
        const order: StatusKey[] = [
          "todo", "in_progress", "pending", "done", "blocked", "canceled",
        ];
        const opts = order.map((k) => seen.get(k) ?? DEFAULTS[k]);
        map.set(c, opts);
      }
    }
    return map;
  }, [visibleCols, ids, sheet, edits]);

  // Status columns take precedence over the boolean checkbox rendering.
  for (const c of statusCols.keys()) boolCols.delete(c);

  // Detect effort-like columns: every non-empty value maps to an effort
  // level AND the column contains at least two distinct levels (so we
  // don't turn a single-value column into a dropdown).
  const effortCols = useMemo(() => {
    const map = new Map<number, string[]>();
    const rows = ids.map((id) => getRow(sheet, id, edits));
    for (const c of visibleCols) {
      let nonEmpty = 0;
      let allEffort = true;
      const seen = new Map<EffortKey, string>();
      for (const r of rows) {
        const s = r[c] == null ? "" : String(r[c]);
        if (s.trim() === "") continue;
        nonEmpty++;
        const k = effortKey(s);
        if (!k) { allEffort = false; break; }
        if (!seen.has(k)) seen.set(k, s.trim());
      }
      if (allEffort && nonEmpty > 0 && seen.size >= 2) {
        const DEFAULTS: Record<EffortKey, string> = {
          low: "Faible", medium: "Moyen", high: "Fort",
        };
        const order: EffortKey[] = ["low", "medium", "high"];
        map.set(c, order.map((k) => seen.get(k) ?? DEFAULTS[k]));
      }
    }
    return map;
  }, [visibleCols, ids, sheet, edits]);

  // Effort columns override the other renderers.
  for (const c of effortCols.keys()) { boolCols.delete(c); statusCols.delete(c); }

  // Detect priority columns by header (e.g. "à prioriser", "priorité").
  // Renders as a red "!" toggle vs "-", and prioritized rows float to top.
  const priorityCols = useMemo(() => {
    const set = new Set<number>();
    for (const c of visibleCols) {
      const h = (headers[c] || "").toLowerCase();
      if (/(priorit|prioris)/.test(h)) set.add(c);
    }
    return set;
  }, [visibleCols, headers]);
  for (const c of priorityCols) { boolCols.delete(c); statusCols.delete(c); effortCols.delete(c); }
  const isPriority = (s: string) => {
    const n = s.trim().toLowerCase();
    if (!n) return false;
    return /!/.test(n) || ["oui","yes","x","✓","✔","1","true","high","haute","urgent","urgente","prioritaire"].includes(n);
  };

  const parseDate = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    let m = t.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
    m = t.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (m) {
      const d = new Date(+m[3], +m[2] - 1, +m[1]);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
    return null;
  };

  // Detect date-like columns and sort filtered rows from most recent to oldest.
  const dateCols = useMemo(() => {
    const set = new Set<number>();
    const rows = ids.map((id) => getRow(sheet, id, edits));
    for (const c of visibleCols) {
      let nonEmpty = 0;
      let parsed = 0;
      for (const r of rows) {
        const s = r[c] == null ? "" : String(r[c]);
        if (s.trim() === "") continue;
        nonEmpty++;
        if (parseDate(s) != null) parsed++;
      }
      // Full match: every non-empty cell is a date.
      if (nonEmpty >= 2 && parsed === nonEmpty) set.add(c);
      // Partial match: at least 2 cells contain an embedded date
      // (e.g. "publié le 29/01/2026"). Rows without a date sort last.
      else if (parsed >= 2 && parsed / nonEmpty >= 0.3) set.add(c);
    }
    return set;
  }, [visibleCols, ids, sheet, edits]);

  // Sort rows: prioritized rows first, then by first date column (most recent).
  const sortedFiltered = useMemo(() => {
    const priCol = priorityCols.size > 0 ? Math.min(...priorityCols) : -1;
    const dateCol = dateCols.size > 0 ? Math.min(...dateCols) : -1;
    if (priCol < 0 && dateCol < 0) return filtered;
    const priKey = (id: number): number => {
      if (priCol < 0) return 0;
      const r = getRow(sheet, id, edits);
      const s = r[priCol] == null ? "" : String(r[priCol]);
      return isPriority(s) ? 1 : 0;
    };
    const dateKey = (id: number): number => {
      if (dateCol < 0) return 0;
      const r = getRow(sheet, id, edits);
      const s = r[dateCol] == null ? "" : String(r[dateCol]);
      const t = parseDate(s);
      return t == null ? -Infinity : t;
    };
    return [...filtered].sort((a, b) => {
      const dp = priKey(b) - priKey(a);
      if (dp !== 0) return dp;
      return dateKey(b) - dateKey(a);
    });
  }, [filtered, dateCols, priorityCols, sheet, edits]);

  // Forward-fill "group" columns (Année/Mois-like) so each row displays
  // the current group even when the source only fills the first row.
  const MONTHS = new Set([
    "janvier","fevrier","février","mars","avril","mai","juin","juillet",
    "aout","août","septembre","octobre","novembre","decembre","décembre",
    "january","february","march","april","june","july","august","september",
    "october","november","december",
  ]);
  const filledValues = useMemo(() => {
    const map = new Map<number, Map<number, string>>();
    const rows = ids.map((id) => getRow(sheet, id, edits));
    for (const c of visibleCols) {
      const header = (headers[c] || "").toLowerCase();
      const headerHit = /(année|annee|mois|year|month)/.test(header);
      let nonEmpty = 0;
      let yearOrMonth = 0;
      for (const r of rows) {
        const s = r[c] == null ? "" : String(r[c]).trim();
        if (!s) continue;
        nonEmpty++;
        if (/^\d{4}$/.test(s) && +s >= 1900 && +s <= 2100) yearOrMonth++;
        else if (MONTHS.has(s.toLowerCase())) yearOrMonth++;
      }
      const contentHit = nonEmpty >= 2 && yearOrMonth === nonEmpty;
      if (!headerHit && !contentHit) continue;
      // Forward-fill in original id order.
      const perRow = new Map<number, string>();
      let last = "";
      for (let i = 0; i < ids.length; i++) {
        const s = rows[i][c] == null ? "" : String(rows[i][c]);
        if (s.trim() !== "") last = s;
        else if (last) perRow.set(ids[i], last);
      }
      if (perRow.size > 0) map.set(c, perRow);
    }
    return map;
  }, [visibleCols, ids, sheet, edits, headers]);

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
        <table className="text-sm min-w-full border-collapse table-fixed">
          <colgroup>
            {visibleCols.map((c) => {
              const w = widthFor(c);
              return (
                <col
                  key={c}
                  style={{ width: `${w.max}px` }}
                />
              );
            })}
          </colgroup>
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              {visibleCols.map((c) => (
                <th
                  key={c}
                  className="text-left px-2 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground leading-tight"
                >
                  <EditableText
                    className="block truncate"
                    inputClassName="text-[11px] uppercase tracking-wider"
                    value={headers[c] || ""}
                    placeholder={`Col ${c + 1}`}
                    onCommit={(v) => onToggle(headerRow, c, v.trim() === "" ? null : v)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.map((id) => {
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
                    let s = v == null ? "" : String(v);
                    if (!s.trim()) {
                      const fill = filledValues.get(c)?.get(id);
                      if (fill) s = fill;
                    }
                    const href = linkHref(s);
                    if (priorityCols.has(c)) {
                      const on = isPriority(s);
                      return (
                        <td key={c} className="px-2 py-1 align-middle text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggle(id, c, on ? null : "!");
                            }}
                            aria-label={on ? "Retirer la priorité" : "Marquer prioritaire"}
                            className={cn(
                              "inline-flex items-center justify-center h-6 w-8 rounded-md border text-sm font-bold transition-colors",
                              on
                                ? "bg-red-500/15 text-red-600 border-red-500/40 hover:bg-red-500/25 dark:text-red-300"
                                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted",
                            )}
                          >
                            {on ? "!" : "-"}
                          </button>
                        </td>
                      );
                    }
                    if (boolCols.has(c)) {
                      const checked = isTruthy(s);
                      return (
                        <td key={c} className="px-2 py-1 align-middle text-center">
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
                    if (statusCols.has(c)) {
                      const opts = statusCols.get(c)!;
                      const k = statusKey(s);
                      const style = k ? STATUS_STYLE[k] : "bg-muted text-muted-foreground border-border";
                      return (
                        <td key={c} className="px-2 py-1 align-middle">
                          <select
                            value={s}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              onToggle(id, c, e.target.value === "" ? null : e.target.value)
                            }
                            className={cn(
                              "w-full text-xs rounded-md border px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer font-medium",
                              style,
                            )}
                            aria-label={headers[c] || `Col ${c + 1}`}
                          >
                            <option value="">-</option>
                            {opts.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                            {s && !opts.includes(s) && (
                              <option value={s}>{s}</option>
                            )}
                          </select>
                        </td>
                      );
                    }
                    if (effortCols.has(c)) {
                      const opts = effortCols.get(c)!;
                      const k = effortKey(s);
                      const style = k ? EFFORT_STYLE[k] : "bg-muted text-muted-foreground border-border";
                      return (
                        <td key={c} className="px-2 py-1 align-middle">
                          <select
                            value={s}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              onToggle(id, c, e.target.value === "" ? null : e.target.value)
                            }
                            className={cn(
                              "w-full text-xs rounded-md border px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer font-medium",
                              style,
                            )}
                            aria-label={headers[c] || `Col ${c + 1}`}
                          >
                            <option value="">-</option>
                            {opts.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                            {s && !opts.includes(s) && (
                              <option value={s}>{s}</option>
                            )}
                          </select>
                        </td>
                      );
                    }
                    return (
                      <td key={c} className="px-2 py-1 align-top leading-tight">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            title={s}
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline flex items-center gap-1 text-xs"
                          >
                            <span className="truncate">{s.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                        ) : (
                          <span
                            title={s}
                            className={cn(
                              "text-foreground/90 block whitespace-pre-wrap break-words",
                            )}
                          >
                            {linkify(s).map((seg, i) =>
                              seg.href ? (
                                <a
                                  key={i}
                                  href={seg.href}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-primary hover:underline break-all"
                                >
                                  {seg.text}
                                </a>
                              ) : (
                                <span key={i}>{seg.text}</span>
                              ),
                            )}
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