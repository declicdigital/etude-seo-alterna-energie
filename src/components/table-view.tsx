import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { dataRows, extraColumnsOf, extraOptionsFor, getRow, headersOf, SHEET_META, type EditsMap } from "@/lib/workbook";
import { cn } from "@/lib/utils";
import { linkHref, linkify } from "@/lib/links";
import { EditableText } from "@/components/editable-text";
import { DateCell } from "@/components/date-cell";
import { workbook, baseSheetOf } from "@/lib/workbook";

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
  onCreateRow,
  onToggle,
  onDeleteRow,
}: {
  sheet: string;
  edits: EditsMap;
  selected: number | null;
  onSelect: (rowId: number) => void;
  onCreateRow: (values: Record<number, string>) => void | Promise<void>;
  onToggle: (rowId: number, col: number, value: string | null) => void;
  onDeleteRow?: (rowId: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const headers = headersOf(sheet, edits);
  const headerRow = SHEET_META[sheet.split("::")[0]]?.headerRow ?? 0;
  const ids = useMemo(() => dataRows(sheet, edits), [sheet, edits]);
  const [q, setQ] = useState("");

  // ---------- Excel-like resizable columns (per-sheet, persisted) ----------
  const widthsKey = `col-widths::${sheet}`;
  const [userWidths, setUserWidths] = useState<Record<number, number>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(widthsKey);
      setUserWidths(raw ? JSON.parse(raw) : {});
    } catch {
      setUserWidths({});
    }
  }, [widthsKey]);
  const dragRef = useRef<{ col: number; startX: number; startW: number } | null>(null);
  const startResize = (col: number, startW: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { col, startX: e.clientX, startW };
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const next = Math.max(48, Math.round(d.startW + (ev.clientX - d.startX)));
      setUserWidths((prev) => ({ ...prev, [d.col]: next }));
    };
    const onUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (d) {
        setUserWidths((prev) => {
          try { localStorage.setItem(widthsKey, JSON.stringify(prev)); } catch {}
          return prev;
        });
      }
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const resetColumn = (col: number) => {
    setUserWidths((prev) => {
      const next = { ...prev };
      delete next[col];
      try { localStorage.setItem(widthsKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const [colFilters, setColFilters] = useState<Record<number, string>>({});
  useEffect(() => { setColFilters({}); }, [sheet]);

  const searched = useMemo(() => {
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
    const isScoped = sheet.includes("::");
    for (let c = 0; c < width; c++) {
      const h = headers[c];
      // In a scoped view, hide the "Audience" column — the scope already
      // isolates the audience, so the column would be redundant.
      if (isScoped && (h || "").trim().toLowerCase() === "audience") continue;
      // Hide the "Tags" and "Noindex" columns everywhere — not useful in this tool.
      const hn = (h || "").trim().toLowerCase();
      if (hn === "tags" || hn === "noindex") continue;
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
      const header = (headers[c] || "").toString().trim().toLowerCase();
      const headerIsLink = /^(lien|liens|url|link|address|adresse)$/.test(header);
      let kind: ColKind;
      if (headerIsLink) kind = "url";
      else if (n > 0 && urlHits / n > 0.5) kind = "url";
      else if (maxLen <= 6) kind = "short";
      else if (maxLen <= 24 && avg <= 18) kind = "short";
      else if (maxLen <= 60) kind = "medium";
      else kind = "long";
      map.set(c, kind);
    }
    // Boolean cols override to a compact width.
    return map;
  }, [visibleCols, ids, sheet, edits, headers]);

  const widthFor = (c: number): { min: number; max: number } => {
    if (boolCols.has(c)) return { min: 44, max: 56 };
    if (priorityCols.has(c)) return { min: 56, max: 72 };
    if (statusCols.has(c)) return { min: 120, max: 160 };
    if (effortCols.has(c)) return { min: 100, max: 140 };
    const k = colKind.get(c);
    switch (k) {
      case "url": return { min: 70, max: 110 };
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
      const h = (headers[c] || "").trim().toLowerCase();
      const headerIsBool = /^(publi(é|e)|publish(ed)?|en\s*ligne|fait|done|actif|active|coch(é|e))$/.test(h);
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
      // Header-based detection always wins (empty checkbox columns).
      if (headerIsBool && allBool) set.add(c);
      // Otherwise require at least one truthy value so purely-empty or purely-dash
      // columns don't get turned into checkboxes.
      else if (allBool && nonEmpty > 0 && truthyCount > 0) set.add(c);
    }
    return set;
  }, [visibleCols, ids, sheet, edits, headers]);

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

  // Tool-defined choice columns (e.g. "Énergie": Électricité / Gaz / Les deux).
  const extraCols = useMemo(() => extraColumnsOf(sheet), [sheet]);
  const optionCols = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const ec of extraCols) map.set(ec.col, ec.options);
    return map;
  }, [extraCols]);
  for (const c of optionCols.keys()) {
    boolCols.delete(c); statusCols.delete(c); effortCols.delete(c); priorityCols.delete(c);
  }

  // Columns the user can filter on (choice-like columns: catégorie, énergie,
  // statut, effort). Options combine the declared list and the values in use.
  const filterCols = useMemo(() => {
    const out: { col: number; label: string; options: string[] }[] = [];
    const declared = new Map<number, string[]>([
      ...[...optionCols].map(([c, o]) => [c, o] as [number, string[]]),
      ...[...statusCols].map(([c, o]) => [c, o] as [number, string[]]),
      ...[...effortCols].map(([c, o]) => [c, o] as [number, string[]]),
    ]);
    for (const c of visibleCols) {
      if (!declared.has(c)) continue;
      const seen = new Set<string>();
      for (const id of ids) {
        const v = getRow(sheet, id, edits)[c];
        const s = v == null ? "" : String(v).trim();
        if (s) seen.add(s);
      }
      const options = [...new Set([...(declared.get(c) ?? []), ...seen])].sort((a, b) =>
        a.localeCompare(b, "fr"),
      );
      if (options.length > 1) out.push({ col: c, label: headers[c] || `Colonne ${c + 1}`, options });
    }
    return out;
  }, [visibleCols, optionCols, statusCols, effortCols, ids, sheet, edits, headers, searched]);

  const filtered = useMemo(() => {
    const active = Object.entries(colFilters).filter(([, v]) => v);
    if (active.length === 0) return searched;
    return searched.filter((id) => {
      const row = getRow(sheet, id, edits);
      return active.every(([c, v]) => {
        const cell = row[Number(c)];
        const s = cell == null ? "" : String(cell).trim().toLowerCase();
        return v === "__empty__" ? s === "" : s === v.toLowerCase();
      });
    });
  }, [searched, colFilters, sheet, edits]);

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

  // Sort rows: prioritized rows first, then by the most relevant date column.
  // Prefer a "dernière maj / last update / publi" column when present, else
  // fall back to the left-most detected date column.
  const sortedFiltered = useMemo(() => {
    const baseLen = workbook[baseSheetOf(sheet)]?.length ?? 0;
    const isAdded = (id: number) => id >= baseLen;
    const priCol = priorityCols.size > 0 ? Math.min(...priorityCols) : -1;
    const dateColsArr = [...dateCols];
    const pickPreferred = (): number => {
      const scored = dateColsArr.map((c) => {
        const h = (headers[c] || "").toLowerCase();
        let score = 0;
        if (/derni[eè]re\s*maj|last\s*update|updated?/.test(h)) score = 3;
        else if (/\bmaj\b|mise\s*à\s*jour|mise\s*a\s*jour/.test(h)) score = 2;
        else if (/publi/.test(h)) score = 1;
        return { c, score };
      });
      scored.sort((a, b) => b.score - a.score || a.c - b.c);
      return scored.length ? scored[0].c : -1;
    };
    const dateCol = dateColsArr.length ? pickPreferred() : -1;
    if (priCol < 0 && dateCol < 0) {
      return [...filtered].sort((a, b) => Number(isAdded(b)) - Number(isAdded(a)));
    }
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
      // Newly added rows always float to the very top.
      const na = Number(isAdded(b)) - Number(isAdded(a));
      if (na !== 0) return na;
      const dp = priKey(b) - priKey(a);
      if (dp !== 0) return dp;
      return dateKey(b) - dateKey(a);
    });
  }, [filtered, dateCols, priorityCols, sheet, edits, headers]);

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
      <div className="p-3 sm:p-4 border-b border-border bg-card/50 flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          className="flex-1 min-w-0 h-10 sm:h-9 rounded-full sm:rounded-md border border-input bg-background px-4 sm:px-3 text-[15px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="hidden sm:inline text-xs text-muted-foreground">{filtered.length} lignes</span>
        <button
          onClick={() => setAdding(true)}
          className="h-10 sm:h-9 px-3 rounded-full sm:rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <Plus className="size-4 sm:size-3.5" /> <span className="hidden sm:inline">Ajouter une ligne</span><span className="sm:hidden">Ajouter</span>
        </button>
      </div>
      {filterCols.length > 0 && (
        <div className="px-3 sm:px-4 py-2 border-b border-border bg-card/30 flex flex-wrap gap-2 items-center">
          {filterCols.map((f) => (
            <select
              key={f.col}
              value={colFilters[f.col] ?? ""}
              onChange={(e) =>
                setColFilters((prev) => ({ ...prev, [f.col]: e.target.value }))
              }
              className={cn(
                "h-9 rounded-full border px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring",
                colFilters[f.col]
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background text-muted-foreground",
              )}
            >
              <option value="">{f.label} : tout</option>
              {f.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
              <option value="__empty__">(vide)</option>
            </select>
          ))}
          {Object.values(colFilters).some(Boolean) && (
            <button
              onClick={() => setColFilters({})}
              className="h-9 px-3 rounded-full text-xs font-medium border border-input hover:bg-muted"
            >
              Réinitialiser
            </button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} lignes</span>
        </div>
      )}
      {adding && (
        <AddRowForm
          headers={headers}
          cols={visibleCols}
          boolCols={boolCols}
          choiceCols={
            new Map<number, string[]>([
              ...[...statusCols].map(([c, o]) => [c, o] as [number, string[]]),
              ...[...effortCols].map(([c, o]) => [c, o] as [number, string[]]),
              ...[...optionCols].map(([c, o]) => [c, o] as [number, string[]]),
            ])
          }
          onCancel={() => setAdding(false)}
          onSubmit={async (values) => {
            await onCreateRow(values);
            setAdding(false);
          }}
        />
      )}
      {/* Mobile card list — avoids horizontal scrolling on phones */}
      <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-2 bg-muted/20">
        {sortedFiltered.map((id) => {
          const row = getRow(sheet, id, edits);
          const isSel = selected === id;
          // Pick a title: first meaningful text column that isn't a widget col
          const isWidgetCol = (c: number) =>
            boolCols.has(c) || statusCols.has(c) || effortCols.has(c) || priorityCols.has(c);
          let titleIdx = -1;
          for (const c of visibleCols) {
            if (isWidgetCol(c)) continue;
            const s = row[c] == null ? "" : String(row[c]).trim();
            if (s && colKind.get(c) !== "url") { titleIdx = c; break; }
          }
          const title = titleIdx >= 0 ? String(row[titleIdx]) : `Ligne ${id}`;

          // Build up to 4 secondary fields (non-empty, non-title, non-widget-empty)
          const secondary: { c: number; label: string; value: string }[] = [];
          for (const c of visibleCols) {
            if (c === titleIdx) continue;
            const raw = row[c];
            let s = raw == null ? "" : String(raw);
            if (!s.trim()) {
              const fill = filledValues.get(c)?.get(id);
              if (fill) s = fill;
            }
            if (!s.trim() && !isWidgetCol(c)) continue;
            secondary.push({ c, label: headers[c] || `Col ${c + 1}`, value: s });
            if (secondary.length >= 5) break;
          }

          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(id); } }}
              className={cn(
                "relative w-full text-left rounded-2xl bg-card border border-border/70 p-3 shadow-sm active:scale-[0.99] transition-transform cursor-pointer",
                isSel && "ring-2 ring-primary/50 border-primary/40",
              )}
            >
              {onDeleteRow && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Supprimer cette ligne ?")) onDeleteRow(id);
                  }}
                  className="absolute top-2 right-2 size-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                  aria-label="Supprimer"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold leading-snug break-words">
                    {title}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 justify-end shrink-0">
                  {secondary
                    .filter((f) => priorityCols.has(f.c) && isPriority(f.value))
                    .map((f) => (
                      <span key={f.c} className="rounded-full bg-red-500/15 text-red-600 border border-red-500/40 text-[10px] font-bold px-2 py-0.5">!</span>
                    ))}
                  {secondary
                    .filter((f) => statusCols.has(f.c) && f.value.trim())
                    .map((f) => {
                      const k = statusKey(f.value);
                      const style = k ? STATUS_STYLE[k] : "bg-muted text-muted-foreground border-border";
                      return (
                        <span key={f.c} className={cn("rounded-full border text-[10px] font-medium px-2 py-0.5", style)}>{f.value}</span>
                      );
                    })}
                  {secondary
                    .filter((f) => effortCols.has(f.c) && f.value.trim())
                    .map((f) => {
                      const k = effortKey(f.value);
                      const style = k ? EFFORT_STYLE[k] : "bg-muted text-muted-foreground border-border";
                      return (
                        <span key={f.c} className={cn("rounded-full border text-[10px] font-medium px-2 py-0.5", style)}>{f.value}</span>
                      );
                    })}
                  {secondary
                    .filter((f) => boolCols.has(f.c) && isTruthy(f.value))
                    .map((f) => (
                      <span key={f.c} className="rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/40 text-[10px] font-medium px-2 py-0.5">
                        {headers[f.c] || "✓"}
                      </span>
                    ))}
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {secondary
                  .filter((f) => !boolCols.has(f.c) && !statusCols.has(f.c) && !effortCols.has(f.c) && !priorityCols.has(f.c))
                  .slice(0, 4)
                  .map((f) => {
                    const href = linkHref(f.value);
                    const isUrl = colKind.get(f.c) === "url" || !!href;
                    return (
                      <div key={f.c} className="text-[12px] leading-tight">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1.5">
                          {f.label}
                        </span>
                        {isUrl && href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary underline break-all"
                          >
                            {f.value.replace(/^https?:\/\//, "").slice(0, 60)}
                          </a>
                        ) : (
                          <span className="text-foreground/85 break-words whitespace-pre-wrap">
                            {f.value.length > 140 ? f.value.slice(0, 140) + "…" : f.value}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">Aucun résultat.</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block flex-1 overflow-auto">
        <table className="text-sm w-full border-collapse table-fixed">
          <colgroup>
            {visibleCols.map((c) => {
              const w = widthFor(c);
              const eff = userWidths[c] ?? w.max;
              return (
                <col
                  key={c}
                  style={{ width: `${eff}px` }}
                />
              );
            })}
            {onDeleteRow && <col style={{ width: "36px" }} />}
          </colgroup>
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              {visibleCols.map((c) => (
                <th
                  key={c}
                  className="relative text-left px-2 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground leading-tight"
                >
                  <EditableText
                    className="block truncate"
                    inputClassName="text-[11px] uppercase tracking-wider"
                    value={headers[c] || ""}
                    placeholder={`Col ${c + 1}`}
                    onCommit={(v) => onToggle(headerRow, c, v.trim() === "" ? null : v)}
                  />
                  <span
                    role="separator"
                    aria-label="Redimensionner la colonne"
                    title="Glisser pour redimensionner · double-clic pour réinitialiser"
                    onMouseDown={startResize(c, userWidths[c] ?? widthFor(c).max)}
                    onDoubleClick={(e) => { e.stopPropagation(); resetColumn(c); }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-0 right-0 h-full w-1.5 -mr-[3px] cursor-col-resize select-none group z-10"
                  >
                    <span className="block h-full w-px mx-auto bg-border group-hover:bg-primary group-hover:w-[2px] transition-colors" />
                  </span>
                </th>
              ))}
              {onDeleteRow && <th aria-label="Actions" className="w-9" />}
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
                    "group border-b border-border/60 cursor-pointer hover:bg-muted/40 transition-colors",
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
                    if (optionCols.has(c)) {
                      const opts =
                        extraOptionsFor(extraCols.find((e) => e.col === c), row) ?? optionCols.get(c)!;
                      return (
                        <td key={c} className="px-2 py-1 align-middle">
                          <select
                            value={s}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onToggle(id, c, e.target.value === "" ? null : e.target.value)}
                            className="w-full text-xs rounded-md border border-border bg-background px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer font-medium"
                            aria-label={headers[c] || `Col ${c + 1}`}
                          >
                            <option value="">-</option>
                            {opts.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                            {s && !opts.includes(s) && <option value={s}>{s}</option>}
                          </select>
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
                    if (dateCols.has(c) && !boolCols.has(c) && !statusCols.has(c) && !effortCols.has(c) && !priorityCols.has(c)) {
                      return (
                        <td key={c} className="px-2 py-1 align-middle">
                          <DateCell
                            value={s}
                            compact
                            onChange={(iso) => onToggle(id, c, iso)}
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={c} className="px-2 py-1 align-top leading-tight overflow-hidden">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            title={s}
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline inline-flex items-center gap-1 text-xs max-w-full min-w-0"
                          >
                            <span className="truncate min-w-0">{s.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                        ) : (
                          s.trim() === "" || !/https?:\/\//i.test(s) ? (
                            <EditableText
                              value={s}
                              onCommit={(v) => onToggle(id, c, v === "" ? null : v)}
                              className="text-foreground/90 block whitespace-pre-wrap break-words cursor-text"
                              placeholder="—"
                              title={s || "Double-cliquez pour éditer"}
                            />
                          ) : (
                            <span
                              title={s}
                              className="text-foreground/90 block whitespace-pre-wrap break-words"
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
                          )
                        )}
                      </td>
                    );
                  })}
                  {onDeleteRow && (
                    <td className="px-1 align-middle text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Supprimer cette ligne ?")) onDeleteRow(id);
                        }}
                        className="size-7 rounded-md inline-flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-red-500/10 hover:text-red-600"
                        aria-label="Supprimer"
                        title="Supprimer cette ligne"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  )}
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
/** Modal form used to create a new row: fill the fields, then click Valider. */
function AddRowForm({
  headers,
  cols,
  boolCols,
  choiceCols,
  onSubmit,
  onCancel,
}: {
  headers: string[];
  cols: number[];
  boolCols: Set<number>;
  choiceCols: Map<number, string[]>;
  onSubmit: (values: Record<number, string>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (c: number, v: string) => setValues((p) => ({ ...p, [c]: v }));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await onSubmit(values);
          setBusy(false);
        }}
        className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl border border-border shadow-xl max-h-[90vh] flex flex-col"
      >
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold">Nouvelle ligne</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Remplissez les champs puis cliquez sur Valider.
          </p>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          {cols.map((c) => {
            const label = headers[c] || `Colonne ${c + 1}`;
            const v = values[c] ?? "";
            return (
              <div key={c}>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {label}
                </label>
                {boolCols.has(c) ? (
                  <div className="mt-1">
                    <input
                      type="checkbox"
                      checked={v !== ""}
                      onChange={(e) => set(c, e.target.checked ? "x" : "")}
                      className="size-4 accent-primary cursor-pointer"
                    />
                  </div>
                ) : choiceCols.has(c) ? (
                  <select
                    value={v}
                    onChange={(e) => set(c, e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">-</option>
                    {choiceCols.get(c)!.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={v}
                    onChange={(e) => set(c, e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-md text-sm border border-border hover:bg-muted"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Enregistrement…" : "Valider"}
          </button>
        </div>
      </form>
    </div>
  );
}
