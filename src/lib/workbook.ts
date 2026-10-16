import raw from "@/data/workbook.json";

export type Row = (string | number | null)[];
export type Workbook = Record<string, Row[]>;

export const workbook = raw as unknown as Workbook;

/** Stratégie PAC articles: same columns as the blog, filled by its own editorial pipeline. */
export const STRATEGIE_SHEET = "STRATEGIE - ARTICLES";
workbook[STRATEGIE_SHEET] ??= [[...(workbook["BLOG - ARTICLES"]?.[0] ?? [])]];

/** Sheets retired from the tool (kept in the raw data, hidden everywhere). */
export const RETIRED_SHEETS = new Set(["BLOG - IDEE"]);

/** Sheets that aren't Excel data but standalone tools embedded in the app. */
export const EMBED_SHEETS: Record<string, string> = {
  "SUIVI EDITORIAL": "/suivi-editorial.html",
  "SUIVI STRATEGIE": "/suivi-editorial.html?space=strategie",
};

export const sheetNames = [
  ...Object.keys(workbook).filter((n) => !RETIRED_SHEETS.has(n)),
  ...Object.keys(EMBED_SHEETS),
];

export function embedSrcOf(sheet: string): string | null {
  return EMBED_SHEETS[sheet.split("::")[0]] ?? null;
}

/**
 * Columns that don't exist in the Excel source but are added by the tool.
 * `col` is the index right after the last source column of the sheet.
 */
export const EXTRA_COLUMNS: Record<
  string,
  { col: number; label: string; options: string[] }[]
> = {
  "BLOG - ARTICLES": [
    {
      col: 6,
      label: "Catégorie",
      options: [
        "Actualités",
        "Le B.A-BA de l'énergie",
        "Guide pratique",
        "Aides et réglementations",
        "Économies d'énergie",
        "Transition bas carbone",
        "Vert l'avenir",
        "Comprendre l'énergie",
        "Transition énergétique",
        "Comprendre votre facture",

      ],
    },
    { col: 10, label: "Énergie", options: ["Électricité", "Gaz", "Les deux"] },
  ],
  "STRATEGIE - ARTICLES": [
    { col: 10, label: "Énergie", options: ["Électricité", "Gaz", "Les deux"] },
  ],
};

/** Catégories du blog par audience. */
const BLOG_CATEGORIES_PARTICULIER = [
  "Actualités",
  "Le B.A-BA de l'énergie",
  "Guide pratique",
  "Aides et réglementations",
  "Économies d'énergie",
  "Transition bas carbone",
  "Vert l'avenir",
];

const BLOG_CATEGORIES_PRO = [
  "Comprendre l'énergie",
  "Transition énergétique",
  "Comprendre votre facture",
];

export function extraColumnsOf(sheet: string) {
  const { base, scope } = parseSheetKey(sheet);
  const cols = EXTRA_COLUMNS[base] ?? [];
  if (base !== "BLOG - ARTICLES" || !scope) return cols;
  const isPro = scope.toLowerCase().startsWith("pro");
  return cols.map((c) =>
    c.label === "Catégorie"
      ? { ...c, options: isPro ? BLOG_CATEGORIES_PRO : BLOG_CATEGORIES_PARTICULIER }
      : c,
  );
}

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

/**
 * Sheets that don't have an "Audience" column but whose Excel content already
 * targets a specific audience. When the scope matches, the full base sheet
 * is shown; other scopes start empty (user fills them from scratch, edits
 * remain scoped independently).
 */
const DEFAULT_AUDIENCE: Record<string, "particulier" | "pro"> = {
  "Articles cocon éléctricité": "particulier",
  "Articles cocon Gaz": "particulier",
};

function scopeAudience(scope: string | null): "particulier" | "pro" | null {
  if (!scope) return null;
  const s = scope.toLowerCase();
  if (s.startsWith("particulier")) return "particulier";
  if (s.startsWith("pro")) return "pro";
  return null;
}

/** True when the scoped view should surface the base sheet's rows. */
function scopeShowsBase(base: string, scope: string | null): boolean {
  if (!scope) return true;
  if (AUDIENCE_FILTER[base]) return true; // filtered per row
  const def = DEFAULT_AUDIENCE[base];
  if (def && scopeAudience(scope) === def) return true;
  return false;
}

function rowMatchesScope(base: string, scope: string | null, row: Row | undefined): boolean {
  if (!scope || !row) return false;
  const filter = AUDIENCE_FILTER[base];
  if (!filter) {
    // No audience column: either the scope matches the default audience
    // (show every base row) or it doesn't (base is hidden).
    return scopeShowsBase(base, scope);
  }
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
  "Webflow - fonctionnement": { headerRow: 1, treeCols: 5, firstDataRow: 2, label: "Webflow - fonctionnement", group: "Docs" },
  "SUIVI EDITORIAL": { headerRow: 0, firstDataRow: 0, label: "Suivi éditorial", group: "Blog" },
  "SUIVI STRATEGIE": { headerRow: 0, firstDataRow: 0, label: "Suivi éditorial", group: "Stratégie PAC" },
  "STRATEGIE - ARTICLES": { headerRow: 0, firstDataRow: 1, label: "Articles & publication", group: "Stratégie PAC" },
  "Articles cocon éléctricité": { headerRow: 0, firstDataRow: 1, label: "Cocon électricité", group: "Archives" },
  "Articles cocon Gaz": { headerRow: 0, firstDataRow: 1, label: "Cocon gaz", group: "Archives" },
};

export function headersOf(sheet: string, edits?: EditsMap): string[] {
  const { base: bs, scope } = parseSheetKey(sheet);
  const meta = SHEET_META[bs];
  if (!meta) return [];
  const row = workbook[bs]?.[meta.headerRow] ?? [];
  const base = row.map((c) => (c == null ? "" : String(c)));
  const over = edits?.[bs]?.[meta.headerRow] ?? (scope ? edits?.[sheet]?.[meta.headerRow] : undefined);
  const width = Math.max(base.length, ...Object.keys(over ?? {}).map((k) => Number(k) + 1));
  const out: string[] = [];
  for (let c = 0; c < width; c++) {
    if (over && c in over) out.push(over[c] == null ? "" : String(over[c]));
    else out.push(base[c] ?? "");
  }
  for (const ec of extraColumnsOf(sheet)) {
    while (out.length <= ec.col) out.push("");
    if (!out[ec.col].trim()) out[ec.col] = ec.label;
  }
  return out;
}

export function dataRows(sheet: string, edits?: EditsMap): number[] {
  const { base: bs, scope } = parseSheetKey(sheet);
  const meta = SHEET_META[bs];
  const allRows = workbook[bs] ?? [];
  const showsBase = scopeShowsBase(bs, scope);
  const scopedFilter = scope && AUDIENCE_FILTER[bs] ? true : false;
  const rows = showsBase ? allRows : [];
  const out: number[] = [];
  if (meta && showsBase) {
    for (let i = meta.firstDataRow; i < rows.length; i++) {
      if (!rows[i].some((c) => c != null && String(c).trim() !== "")) continue;
      if (scope && scopedFilter && !rowMatchesScope(bs, scope, rows[i])) continue;
      if (edits?.[sheet]?.[i]?.[-1] === "__deleted__") continue;
      out.push(i);
    }
  } else if (!scope) {
    for (let i = 0; i < rows.length; i++) {
      if (edits?.[sheet]?.[i]?.[-1] === "__deleted__") continue;
      out.push(i);
    }
  }
  // Include extra rows added via edits (row_id >= base length) with any non-empty cell
  const over = edits?.[sheet];
  if (over) {
    const baseLen = showsBase ? allRows.length : 0;
    const extras: number[] = [];
    for (const key of Object.keys(over)) {
      const id = Number(key);
      if (id >= baseLen) {
        const cells = over[id];
        if (cells[-1] === "__deleted__") continue;
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
  const showsBase = scopeShowsBase(bs, scope);
  const baseLen = showsBase ? (workbook[bs]?.length ?? 0) : 0;
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