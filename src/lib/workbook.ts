import raw from "@/data/workbook.json";

export type Row = (string | number | null)[];
export type Workbook = Record<string, Row[]>;

export const workbook = raw as unknown as Workbook;
export const sheetNames = Object.keys(workbook);

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
  const row = workbook[sheet]?.[rowId];
  return row ? row[col] ?? null : null;
}

export function getRow(sheet: string, rowId: number, edits: EditsMap): Row {
  const base = workbook[sheet]?.[rowId] ?? [];
  const over = edits[sheet]?.[rowId];
  if (!over) return base;
  return base.map((v, i) => (over[i] !== undefined ? over[i] : v));
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
  return STRUCTURE_SHEETS.has(name);
}

/** Header row index for each sheet (auto-detected best guess). */
export const SHEET_META: Record<
  string,
  { headerRow: number; treeCols?: number; firstDataRow: number; label: string; group: string }
> = {
  "Structure proposée (V2)": { headerRow: 4, treeCols: 8, firstDataRow: 6, label: "Structure proposée V2", group: "Arborescence" },
  "Structure RES": { headerRow: 0, treeCols: 8, firstDataRow: 2, label: "Structure Résidentiels", group: "Arborescence" },
  "Structure PRO": { headerRow: 5, treeCols: 8, firstDataRow: 7, label: "Structure Pros", group: "Arborescence" },
  "Structure (resi) (OLD V3)": { headerRow: 0, treeCols: 8, firstDataRow: 2, label: "Structure Résidentiels (V3 archivée)", group: "Arborescence" },
  "Structure pour migration AE-AEF": { headerRow: 0, treeCols: 8, firstDataRow: 2, label: "Migration AE → AEF", group: "Arborescence" },
  "TODO GENERALE": { headerRow: 0, firstDataRow: 1, label: "TODO générale", group: "Suivi" },
  "BLOG - IDEE": { headerRow: 1, firstDataRow: 2, label: "Blog — Idées", group: "Blog" },
  "BLOG - ARTICLES": { headerRow: 0, firstDataRow: 1, label: "Blog — Articles", group: "Blog" },
  "BLOG - Suivi publication": { headerRow: 0, firstDataRow: 1, label: "Blog — Publication", group: "Blog" },
  "Netlinking": { headerRow: 1, firstDataRow: 2, label: "Netlinking", group: "Suivi" },
  "Roadmap 2026 - WIP": { headerRow: 1, firstDataRow: 2, label: "Roadmap 2026", group: "Suivi" },
  "Temps passé": { headerRow: 0, firstDataRow: 1, label: "Temps passé", group: "Suivi" },
  "Articles cocon éléctricité": { headerRow: 0, firstDataRow: 1, label: "Cocon Électricité", group: "Cocons" },
  "Articles cocon Gaz": { headerRow: 0, firstDataRow: 1, label: "Cocon Gaz", group: "Cocons" },
  "Webflow - fonctionnement": { headerRow: 0, firstDataRow: 1, label: "Webflow — fonctionnement", group: "Docs" },
};

export function headersOf(sheet: string): string[] {
  const meta = SHEET_META[sheet];
  if (!meta) return [];
  const row = workbook[sheet]?.[meta.headerRow] ?? [];
  return row.map((c) => (c == null ? "" : String(c)));
}

export function dataRows(sheet: string): number[] {
  const meta = SHEET_META[sheet];
  const rows = workbook[sheet] ?? [];
  if (!meta) return rows.map((_, i) => i);
  const out: number[] = [];
  for (let i = meta.firstDataRow; i < rows.length; i++) {
    if (rows[i].some((c) => c != null && String(c).trim() !== "")) out.push(i);
  }
  return out;
}

export type TreeNode = {
  rowId: number;
  level: number;
  label: string;
  children: TreeNode[];
};

export function buildTree(sheet: string, edits: EditsMap): TreeNode[] {
  const meta = SHEET_META[sheet];
  const cols = meta?.treeCols ?? 8;
  const ids = dataRows(sheet);
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