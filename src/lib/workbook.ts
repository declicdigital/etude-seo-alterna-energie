import raw from "@/data/workbook.json";

export type Row = (string | number | null)[];
export type Workbook = Record<string, Row[]>;

export const workbook = raw as unknown as Workbook;
export const sheetNames = Object.keys(workbook);

/** A sheet key may be "base" or "base::scope". Returns { base, scope }. */
export function parseSheetKey(sheet: string): { base: string; scope: string | null } {
  const i = sheet.indexOf("::");
  if (i < 0) return { base: sheet, scope: null };
  return { base: sheet.slice(0, i), scope: sheet.slice(i + 2) };
}

export function baseSheetOf(sheet: string): string {
  return parseSheetKey(sheet).base;
}

/** Sheets whose base data is filtered by an "Audience" column into scoped views. */
const AUDIENCE_FILTER: Record<string, { col: number; particulier: string[]; pro: string[] }> = {
  "BLOG - IDEE": { col: 2, particulier: ["résident", "resident", "particulier"], pro: ["pro"] },
  "BLOG - ARTICLES": { col: 5, particulier: ["résident", "resident", "particulier"], pro: ["pro"] },
};

function scopeAudience(scope: string | null): "particulier" | "pro" | null {
  if (!scope) return null;
  const s = scope.toLowerCase();
  if (s.startsWith("particulier")) return "particulier";
  if (s.startsWith("pro")) return "pro";
  return null;
}

function rowMatchesScope(base: string, scope: string | null, row: Row | undefined): boolean {
  if (!scope || !row) return false;
  const filter = AUDIENCE_FILTER[base];
  if (!filter) return false;
  const aud = scopeAudience(scope);
  if (!aud) return false;
  const v = row[filter.col];
  if (v == null) return false;
  const s = String(v).toLowerCase();
  const list = aud === "particulier" ? filter.particulier : filter.pro;
  return list.some((k) => s.includes(k));
}

export type CellEdit = {
  sheet: string;
  row_id: number;
  col: number;
  value: string | null;
};

export type EditsMap = Record<string, Record<number, Record<number, string | null>>>;

export function buildEditsMap(edits: CellEdit[]): EditsMap {
  const m: EditsMap = {};
  for (const e of edits) {
    (m[e.sheet] ??= {})[e.row_id] ??= {};
    m[e.sheet][e.row_id][e.col] = e.value;
  }
  return m;
}

export function getCell(
  sheet: string,
  rowId: number,
  col: number,
  edits: EditsMap,
): string | number | null {
  const override = edits[sheet]?.[rowId]?.[col];
  if (override !== undefined) return override;
  const { base, scope } = parseSheetKey(sheet);
  if (scope) {
    const row = workbook[base]?.[rowId];
    if (row && rowMatchesScope(base, scope, row)) return row[col] ?? null;
    return null;
  }
  const row = workbook[base]?.[rowId];
  return row ? row[col] ?? null : null;
}

export function getRow(sheet: string, rowId: number, edits: EditsMap): Row {
  const { base: b, scope } = parseSheetKey(sheet);
  const baseRow = workbook[b]?.[rowId];
  const base =
    scope
      ? baseRow && rowMatchesScope(b, scope, baseRow) ? baseRow : []
      : (baseRow ?? []);
  const over = edits[sheet]?.[rowId];
  if (!over) return base;
  const width = Math.max(base.length, ...Object.keys(over).map((k) => Number(k) + 1));
  const out: (string | number | null)[] = [];
  for (let i = 0; i < width; i++) out.push(over[i] !== undefined ? over[i] : (base[i] ?? null));
  return out;
}

/** Sheets where columns N0..N7 encode a hierarchical tree. */
export const STRUCTURE_SHEETS = new Set([
  "Structure proposée (V2)",
  "Structure RES",
  "Structure PRO",
  "Structure (resi) (OLD V3)",
  "Structure pour migration AE-AEF",
]);

export function isStructureSheet(name: string) {
  return STRUCTURE_SHEETS.has(baseSheetOf(name));
}

/** Header row index for each sheet (auto-detected best guess). */
export const SHEET_META: Record<
  string,
  { headerRow: number; treeCols?: number; firstDataRow: number; label: string; group: string }
> = {
  "Structure proposée (V2)": { headerRow: 4, treeCols: 8, firstDataRow: 6, label: "Structure proposée V2", group: "Arborescence" },
  "Structure RES": { headerRow: 0, treeCols: 8, firstDataRow: 2, label: "Particulier", group: "Arborescence" },
  "Structure PRO": { headerRow: 5, treeCols: 8, firstDataRow: 7, label: "Professionnel", group: "Arborescence" },
  "Structure (resi) (OLD V3)": { headerRow: 0, treeCols: 8, firstDataRow: 2, label: "Structure Particulier (V3 archivée)", group: "Arborescence" },
  "Structure pour migration AE-AEF": { headerRow: 0, treeCols: 8, firstDataRow: 2, label: "Migration AE → AEF", group: "Arborescence" },
  "TODO GENERALE": { headerRow: 0, firstDataRow: 1, label: "TODO générale", group: "Suivi" },
  "BLOG - IDEE": { headerRow: 1, firstDataRow: 2, label: "Idées", group: "Blog" },
  "BLOG - ARTICLES": { headerRow: 0, firstDataRow: 1, label: "Articles & publication", group: "Blog" },
  "Netlinking": { headerRow: 1, firstDataRow: 2, label: "Netlinking", group: "Suivi" },
  "Roadmap 2026 - WIP": { headerRow: 1, firstDataRow: 2, label: "Roadmap 2026", group: "Suivi" },
  "Temps passé": { headerRow: 0, firstDataRow: 1, label: "Temps passé", group: "Suivi" },
  "Articles cocon éléctricité": { headerRow: 0, firstDataRow: 1, label: "Électricité", group: "Stratégie édito" },
  "Articles cocon Gaz": { headerRow: 0, firstDataRow: 1, label: "Gaz", group: "Stratégie édito" },
  "Webflow - fonctionnement": { headerRow: 1, treeCols: 5, firstDataRow: 2, label: "Webflow - fonctionnement", group: "Docs" },
};

export function headersOf(sheet: string, edits?: EditsMap): string[] {
  const { base: bs, scope } = parseSheetKey(sheet);
  const meta = SHEET_META[bs];
  if (!meta) return [];
  const row = workbook[bs]?.[meta.headerRow] ?? [];
  const base = row.map((c) => (c == null ? "" : String(c)));
  const over = edits?.[bs]?.[meta.headerRow] ?? (scope ? edits?.[sheet]?.[meta.headerRow] : undefined);
  if (!over) return base;
  const width = Math.max(base.length, ...Object.keys(over).map((k) => Number(k) + 1));
  const out: string[] = [];
  for (let c = 0; c < width; c++) {
    if (c in over) out.push(over[c] == null ? "" : String(over[c]));
    else out.push(base[c] ?? "");
  }
  return out;
}

export function dataRows(sheet: string, edits?: EditsMap): number[] {
  const { base: bs, scope } = parseSheetKey(sheet);
  const meta = SHEET_META[bs];
  const allRows = workbook[bs] ?? [];
  const scopedFilter = scope && AUDIENCE_FILTER[bs] ? true : false;
  const rows = scope ? (scopedFilter ? allRows : []) : allRows;
  const out: number[] = [];
  if (meta && (!scope || scopedFilter)) {
    for (let i = meta.firstDataRow; i < rows.length; i++) {
      if (!rows[i].some((c) => c != null && String(c).trim() !== "")) continue;
      if (scope && !rowMatchesScope(bs, scope, rows[i])) continue;
      out.push(i);
    }
  } else if (!scope) {
    for (let i = 0; i < rows.length; i++) out.push(i);
  }
  // Include extra rows added via edits (row_id >= base length) with any non-empty cell
  const over = edits?.[sheet];
  if (over) {
    const baseLen = scope && !scopedFilter ? 0 : allRows.length;
    const extras: number[] = [];
    for (const key of Object.keys(over)) {
      const id = Number(key);
      if (id >= baseLen) {
        const cells = over[id];
        // Include added rows even when values are empty strings, so newly
        // created rows show up immediately for inline editing.
        if (Object.values(cells).some((v) => v !== null && v !== undefined)) extras.push(id);
      }
    }
    extras.sort((a, b) => a - b);
    out.push(...extras);
  }
  return out;
}

export function nextRowId(sheet: string, edits: EditsMap): number {
  const { base: bs, scope } = parseSheetKey(sheet);
  const scopedFilter = scope && AUDIENCE_FILTER[bs] ? true : false;
  const baseLen = scope && !scopedFilter ? 0 : (workbook[bs]?.length ?? 0);
  let max = baseLen - 1;
  const over = edits[sheet];
  if (over) for (const k of Object.keys(over)) max = Math.max(max, Number(k));
  return Math.max(baseLen, max + 1);
}

export type TreeNode = {
  rowId: number;
  level: number;
  label: string;
  children: TreeNode[];
};

export function buildTree(sheet: string, edits: EditsMap): TreeNode[] {
  const meta = SHEET_META[baseSheetOf(sheet)];
  const cols = meta?.treeCols ?? 8;
  const ids = dataRows(sheet, edits);
  const roots: TreeNode[] = [];
  const stack: TreeNode[] = [];
  for (const id of ids) {
    const row = getRow(sheet, id, edits);
    let level = -1;
    let label = "";
    for (let c = 0; c < cols; c++) {
      const v = row[c];
      if (v != null && String(v).trim() !== "") {
        level = c;
        label = String(v);
        break;
      }
    }
    if (level < 0) continue;
    const node: TreeNode = { rowId: id, level, label, children: [] };
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return roots;
}