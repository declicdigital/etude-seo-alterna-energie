import { useMemo, useState } from "react";
import { ChevronRight, FileText, Folder, Layers, Plus } from "lucide-react";
import { buildTree, getRow, type EditsMap, type TreeNode } from "@/lib/workbook";
import { cn } from "@/lib/utils";
import { LEVEL_TINTS, LEVEL_ACCENTS, groupColorForSheet } from "@/lib/group-colors";

type RowMeta = { badge?: { label: string; tone: "page" | "collection" | "article" }; breadcrumb?: string };

function webflowMeta(sheet: string, rowId: number, edits: EditsMap): RowMeta {
  if (sheet !== "Webflow - fonctionnement") return {};
  const row = getRow(sheet, rowId, edits);
  const tech = row[5] == null ? "" : String(row[5]);
  const bread = row[6] == null ? "" : String(row[6]);
  const t = tech.toLowerCase();
  let badge: RowMeta["badge"];
  const niveau = tech.match(/niveau\s*(\d+)/i)?.[1];
  if (t.includes("collection")) {
    badge = { label: niveau ? `Collection · N${niveau}` : "Collection", tone: "collection" };
  } else if (t.includes("article")) {
    badge = { label: "Article", tone: "article" };
  } else if (t.startsWith("page") || t === "page") {
    badge = { label: "Page", tone: "page" };
  } else if (niveau) {
    badge = { label: `Collection · N${niveau}`, tone: "collection" };
  }
  return { badge, breadcrumb: bread || undefined };
}

function collectAll(nodes: TreeNode[], set: Set<number>) {
  for (const n of nodes) {
    set.add(n.rowId);
    collectAll(n.children, set);
  }
}

function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  if (!q) return nodes;
  const ql = q.toLowerCase();
  const out: TreeNode[] = [];
  for (const n of nodes) {
    const kids = filterTree(n.children, q);
    if (n.label.toLowerCase().includes(ql) || kids.length) {
      out.push({ ...n, children: kids });
    }
  }
  return out;
}

export function TreeView({
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
  onAddRow: (parentLevel: number) => void;
}) {
  const tree = useMemo(() => buildTree(sheet, edits), [sheet, edits]);
  const isWebflow = sheet === "Webflow - fonctionnement";
  const [q, setQ] = useState("");
  const filtered = useMemo(() => filterTree(tree, q), [tree, q]);
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (const r of tree) s.add(r.rowId);
    return s;
  });

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const expandAll = () => {
    const s = new Set<number>();
    collectAll(tree, s);
    setExpanded(s);
  };

  return (
    <div className="flex flex-col h-full">
      {isWebflow && (
        <div className="px-6 pt-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-foreground/80 flex gap-3 items-start">
            <Layers className="size-4 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-foreground mb-1">Comment lire cette arborescence Webflow</div>
              <div className="flex flex-wrap gap-2 mt-1">
                <LegendPill tone="page">Page</LegendPill>
                <LegendPill tone="collection">Collection (CMS)</LegendPill>
                <LegendPill tone="article">Article</LegendPill>
              </div>
              <p className="mt-2 text-muted-foreground">
                Cliquez sur une entrée pour voir le fil d'Ariane complet et la structure technique dans Webflow.
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="p-3 sm:p-4 border-b border-border bg-card/50 flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une page…"
          className="flex-1 min-w-0 basis-full sm:basis-auto h-10 sm:h-9 rounded-full sm:rounded-md border border-input bg-background px-4 sm:px-3 text-[15px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={expandAll}
          className="h-10 sm:h-9 px-3 rounded-full sm:rounded-md text-xs font-medium border border-input hover:bg-muted"
        >
          Tout déplier
        </button>
        <button
          onClick={() => setExpanded(new Set())}
          className="h-10 sm:h-9 px-3 rounded-full sm:rounded-md text-xs font-medium border border-input hover:bg-muted"
        >
          Tout replier
        </button>
        <button
          onClick={() => onAddRow(0)}
          className="h-10 sm:h-9 px-3 rounded-full sm:rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 shadow-sm ml-auto sm:ml-0"
        >
          <Plus className="size-4 sm:size-3.5" /> Ajouter
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {filtered.map((n) => (
          <TreeRow
            key={n.rowId}
            node={n}
            expanded={expanded}
            toggle={toggle}
            selected={selected}
            onSelect={onSelect}
            forceExpand={!!q}
            sheet={sheet}
            edits={edits}
          />
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">Aucune page trouvée.</div>
        )}
      </div>
    </div>
  );
}

function TreeRow({
  node,
  expanded,
  toggle,
  selected,
  onSelect,
  forceExpand,
  sheet,
  edits,
}: {
  node: TreeNode;
  expanded: Set<number>;
  toggle: (id: number) => void;
  selected: number | null;
  onSelect: (id: number) => void;
  forceExpand: boolean;
  sheet: string;
  edits: EditsMap;
}) {
  const isOpen = forceExpand || expanded.has(node.rowId);
  const hasChildren = node.children.length > 0;
  const isSel = selected === node.rowId;
  const meta = webflowMeta(sheet, node.rowId, edits);
  const tint = LEVEL_TINTS[Math.min(node.level, LEVEL_TINTS.length - 1)];
  const accent = LEVEL_ACCENTS[Math.min(node.level, LEVEL_ACCENTS.length - 1)];
  const gc = groupColorForSheet(sheet);

  return (
    <div>
      <div
        className={cn(
          "group relative flex items-center gap-1 py-2 sm:py-1.5 pr-3 cursor-pointer text-sm transition-colors",
          isSel ? gc.activeRow : cn(tint, gc.rowTint),
        )}
        style={{ paddingLeft: 8 + node.level * 14 }}
        onClick={() => onSelect(node.rowId)}
      >
        <span
          className={cn("absolute left-0 top-1 bottom-1 w-1 rounded-r", accent, isSel ? "opacity-100" : "opacity-60")}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggle(node.rowId);
          }}
          className={cn(
            "size-5 flex items-center justify-center rounded hover:bg-muted",
            !hasChildren && "invisible",
          )}
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
          />
        </button>
        {hasChildren ? (
          <Folder className="size-3.5 text-primary/70 shrink-0" />
        ) : (
          <FileText className="size-3.5 text-muted-foreground shrink-0" />
        )}
        <span
          className={cn(
            "truncate",
            isSel && "font-semibold text-primary",
            node.level === 0 && "font-medium",
          )}
          title={meta.breadcrumb}
        >
          {node.label}
        </span>
        {meta.badge && (
          <span
            className={cn(
              "ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium border",
              meta.badge.tone === "page" &&
                "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
              meta.badge.tone === "collection" &&
                "bg-primary/10 text-primary border-primary/30",
              meta.badge.tone === "article" &&
                "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
            )}
          >
            {meta.badge.label}
          </span>
        )}
      </div>
      {isOpen &&
        node.children.map((c) => (
          <TreeRow
            key={c.rowId}
            node={c}
            expanded={expanded}
            toggle={toggle}
            selected={selected}
            onSelect={onSelect}
            forceExpand={forceExpand}
            sheet={sheet}
            edits={edits}
          />
        ))}
    </div>
  );
}

function LegendPill({
  tone,
  children,
}: {
  tone: "page" | "collection" | "article";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium border",
        tone === "page" && "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
        tone === "collection" && "bg-primary/10 text-primary border-primary/30",
        tone === "article" && "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
      )}
    >
      {children}
    </span>
  );
}