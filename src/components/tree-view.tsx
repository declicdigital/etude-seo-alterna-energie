import { useMemo, useState } from "react";
import { ChevronRight, FileText, Folder } from "lucide-react";
import { buildTree, type EditsMap, type TreeNode } from "@/lib/workbook";
import { cn } from "@/lib/utils";

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
}: {
  sheet: string;
  edits: EditsMap;
  selected: number | null;
  onSelect: (rowId: number) => void;
}) {
  const tree = useMemo(() => buildTree(sheet, edits), [sheet, edits]);
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
      <div className="p-4 border-b border-border bg-card/50 flex gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une page…"
          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={expandAll}
          className="h-9 px-3 rounded-md text-xs font-medium border border-input hover:bg-muted"
        >
          Tout déplier
        </button>
        <button
          onClick={() => setExpanded(new Set())}
          className="h-9 px-3 rounded-md text-xs font-medium border border-input hover:bg-muted"
        >
          Tout replier
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
}: {
  node: TreeNode;
  expanded: Set<number>;
  toggle: (id: number) => void;
  selected: number | null;
  onSelect: (id: number) => void;
  forceExpand: boolean;
}) {
  const isOpen = forceExpand || expanded.has(node.rowId);
  const hasChildren = node.children.length > 0;
  const isSel = selected === node.rowId;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 py-1.5 pr-3 cursor-pointer text-sm hover:bg-muted/50 transition-colors",
          isSel && "bg-primary/10 hover:bg-primary/15",
        )}
        style={{ paddingLeft: 8 + node.level * 18 }}
        onClick={() => onSelect(node.rowId)}
      >
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
        >
          {node.label}
        </span>
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
          />
        ))}
    </div>
  );
}