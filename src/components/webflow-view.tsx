import { useMemo } from "react";
import { ChevronRight, FileText, Layers, Home, BookOpen } from "lucide-react";
import { buildTree, getRow, headersOf, type EditsMap, type TreeNode } from "@/lib/workbook";
import { cn } from "@/lib/utils";

const SHEET = "Webflow - fonctionnement";

// One color per hierarchical level. Kept in Tailwind arbitrary classes so the
// palette is legible on both light and dark themes.
const LEVEL_STYLE: Record<number, {
  ring: string; bg: string; text: string; dot: string; border: string; name: string;
}> = {
  0: { ring: "ring-emerald-500/30", bg: "bg-emerald-500/10",   text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", border: "border-l-emerald-500", name: "Home" },
  1: { ring: "ring-sky-500/30",     bg: "bg-sky-500/10",       text: "text-sky-700 dark:text-sky-300",         dot: "bg-sky-500",     border: "border-l-sky-500",     name: "Univers" },
  2: { ring: "ring-violet-500/30",  bg: "bg-violet-500/10",    text: "text-violet-700 dark:text-violet-300",   dot: "bg-violet-500",  border: "border-l-violet-500",  name: "Niveau 2" },
  3: { ring: "ring-amber-500/30",   bg: "bg-amber-500/10",     text: "text-amber-700 dark:text-amber-300",     dot: "bg-amber-500",   border: "border-l-amber-500",   name: "Niveau 3" },
  4: { ring: "ring-rose-500/30",    bg: "bg-rose-500/10",      text: "text-rose-700 dark:text-rose-300",       dot: "bg-rose-500",    border: "border-l-rose-500",    name: "Niveau 4" },
};

type Kind = "page" | "collection" | "article";
function classifyKind(technical: string): Kind {
  const t = technical.toLowerCase();
  if (t.startsWith("page")) return "page";
  if (t.includes("article")) return "article";
  if (t.includes("collection")) return "collection";
  return "page";
}
const KIND_META: Record<Kind, { label: string; Icon: typeof FileText; cls: string }> = {
  page:       { label: "Page",       Icon: Home,     cls: "bg-primary/10 text-primary border-primary/30" },
  collection: { label: "Collection", Icon: Layers,   cls: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30" },
  article:    { label: "Article",    Icon: BookOpen, cls: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30" },
};

export function WebflowView({
  edits,
  selected,
  onSelect,
}: {
  edits: EditsMap;
  selected: number | null;
  onSelect: (rowId: number) => void;
}) {
  const headers = headersOf(SHEET);
  const tree = useMemo(() => buildTree(SHEET, edits), [edits]);
  const intro = useMemo(() => {
    // Row 0 holds the sheet title ("Exemple pour l'univers…")
    const r = getRow(SHEET, 0, edits);
    return r[0] ? String(r[0]) : "";
  }, [edits]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Intro / legend */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {intro && (
            <div className="text-xs uppercase tracking-widest text-primary/80 font-semibold">
              {intro}
            </div>
          )}
          <h3 className="mt-1 text-lg font-semibold tracking-tight">
            Comment les pages s'imbriquent dans Webflow
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque bloc représente une page ou un item de collection Webflow. La couleur indique
            le niveau hiérarchique, l'icône indique le type technique, et le fil d'Ariane montre
            le chemin complet vu par l'utilisateur.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((lv) => {
              const s = LEVEL_STYLE[lv];
              return (
                <span
                  key={lv}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                    s.bg, s.text, "border-transparent ring-1", s.ring,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", s.dot)} />
                  N{lv} · {s.name}
                </span>
              );
            })}
            <span className="mx-2 h-6 w-px bg-border" />
            {(Object.keys(KIND_META) as Kind[]).map((k) => {
              const { label, Icon, cls } = KIND_META[k];
              return (
                <span key={k} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", cls)}>
                  <Icon className="size-3.5" /> {label}
                </span>
              );
            })}
          </div>
        </section>

        {/* Tree */}
        <section className="space-y-3">
          {tree.map((node) => (
            <NodeCard
              key={node.rowId}
              node={node}
              edits={edits}
              selected={selected}
              onSelect={onSelect}
              headers={headers}
            />
          ))}
        </section>
      </div>
    </div>
  );
}

function NodeCard({
  node, edits, selected, onSelect, headers,
}: {
  node: TreeNode;
  edits: EditsMap;
  selected: number | null;
  onSelect: (rowId: number) => void;
  headers: string[];
}) {
  const row = getRow(SHEET, node.rowId, edits);
  const technical = (row[5] == null ? "" : String(row[5])).trim();
  const breadcrumb = (row[6] == null ? "" : String(row[6])).trim();
  const kind = classifyKind(technical);
  const kindMeta = KIND_META[kind];
  const style = LEVEL_STYLE[node.level] ?? LEVEL_STYLE[0];
  const isSel = selected === node.rowId;

  // A breadcrumb may include an "OU\n\n" alternative - split it out so both
  // paths are readable and each ">" separator becomes an actual arrow.
  const crumbs = breadcrumb
    .split(/\n{1,}OU\n{1,}/i)
    .map((chain) => chain.split(">").map((s) => s.trim()).filter(Boolean));

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.rowId)}
        className={cn(
          "group w-full text-left rounded-lg border bg-card p-4 shadow-sm transition-all",
          "border-l-4", style.border,
          "hover:shadow-md hover:-translate-y-px",
          isSel ? "ring-2 ring-primary/50" : "ring-0",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
              style.bg, style.text,
            )}
          >
            N{node.level}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold text-[15px] leading-tight">{node.label}</h4>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  kindMeta.cls,
                )}
              >
                <kindMeta.Icon className="size-3" /> {kindMeta.label}
              </span>
            </div>
            {technical && (
              <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap">
                {technical}
              </p>
            )}
            {crumbs.some((c) => c.length > 0) && (
              <div className="mt-2.5 space-y-1">
                {crumbs.map((chain, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1">
                    {i > 0 && (
                      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        ou
                      </span>
                    )}
                    {chain.map((seg, j) => (
                      <span key={j} className="inline-flex items-center gap-1">
                        {j > 0 && (
                          <ChevronRight className="size-3 text-muted-foreground/60" />
                        )}
                        <span
                          className={cn(
                            "rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[11px]",
                            j === chain.length - 1 && "font-medium text-foreground",
                          )}
                        >
                          {seg}
                        </span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </button>
      {node.children.length > 0 && (
        <div className="relative mt-3 ml-6 space-y-3 pl-6 border-l-2 border-dashed border-border/70">
          {node.children.map((child) => (
            <div key={child.rowId} className="relative">
              <span className="absolute -left-6 top-6 h-px w-6 bg-border/70" />
              <NodeCard
                node={child}
                edits={edits}
                selected={selected}
                onSelect={onSelect}
                headers={headers}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
