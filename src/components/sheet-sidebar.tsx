import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { GripVertical } from "lucide-react";
import { SHEET_META, sheetNames } from "@/lib/workbook";
import { cn } from "@/lib/utils";
import symbol from "@/assets/alterna-symbol.png.asset.json";

const DEFAULT_ORDER = ["Arborescence", "Blog", "Suivi", "Cocons", "Docs", "Autres"];
const ORDER_KEY = "sidebar.groupOrder.v1";

// Per-group color palette. Each entry drives:
// - the category header band
// - the active sheet pill
// - a discreet left-border accent on inactive sheets on hover
const GROUP_STYLES: Record<string, {
  header: string;
  active: string;
  hover: string;
  bar: string;
}> = {
  Arborescence: {
    header: "bg-emerald-600 text-white",
    active: "bg-emerald-600 text-white shadow-sm",
    hover: "hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300",
    bar: "bg-emerald-500",
  },
  Blog: {
    header: "bg-sky-600 text-white",
    active: "bg-sky-600 text-white shadow-sm",
    hover: "hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-300",
    bar: "bg-sky-500",
  },
  Suivi: {
    header: "bg-amber-500 text-white",
    active: "bg-amber-500 text-white shadow-sm",
    hover: "hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300",
    bar: "bg-amber-500",
  },
  Cocons: {
    header: "bg-violet-600 text-white",
    active: "bg-violet-600 text-white shadow-sm",
    hover: "hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300",
    bar: "bg-violet-500",
  },
  Docs: {
    header: "bg-rose-500 text-white",
    active: "bg-rose-500 text-white shadow-sm",
    hover: "hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300",
    bar: "bg-rose-500",
  },
  Autres: {
    header: "bg-slate-600 text-white",
    active: "bg-slate-600 text-white shadow-sm",
    hover: "hover:bg-slate-500/10 hover:text-slate-700 dark:hover:text-slate-300",
    bar: "bg-slate-500",
  },
};
const FALLBACK_STYLE = GROUP_STYLES.Autres;

export function SheetSidebar() {
  const search = useRouterState({ select: (r) => r.location.search }) as { sheet?: string };
  const active = search.sheet ?? "Structure RES";

  const groups = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const s of sheetNames) {
      const k = SHEET_META[s]?.group ?? "Autres";
      (g[k] ??= []).push(s);
    }
    return g;
  }, []);

  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as string[];
        // Merge saved order with any new groups discovered later.
        const known = new Set(saved);
        const extras = DEFAULT_ORDER.filter((g) => !known.has(g));
        setOrder([...saved, ...extras]);
      }
    } catch { /* ignore */ }
  }, []);

  const persist = (next: string[]) => {
    setOrder(next);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const onDrop = (target: string) => {
    if (!dragging || dragging === target) { setDragging(null); setDragOver(null); return; }
    const next = order.filter((g) => g !== dragging);
    const idx = next.indexOf(target);
    next.splice(idx, 0, dragging);
    persist(next);
    setDragging(null);
    setDragOver(null);
  };

  return (
    <aside className="w-72 shrink-0 border-r border-border bg-card/50 backdrop-blur-sm h-screen sticky top-0 overflow-y-auto">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <img src={symbol.url} alt="Alterna Énergie" className="size-10 rounded-full shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-primary/80 font-semibold">Alterna Énergie</div>
            <h1 className="text-base font-semibold leading-tight">Étude SEO</h1>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Arborescence & suivi éditorial</p>
      </div>
      <nav className="p-3 space-y-3">
        {order.filter((g) => groups[g]?.length).map((g) => {
          const style = GROUP_STYLES[g] ?? FALLBACK_STYLE;
          return (
          <div
            key={g}
            onDragOver={(e) => { if (dragging) { e.preventDefault(); setDragOver(g); } }}
            onDragLeave={() => { if (dragOver === g) setDragOver(null); }}
            onDrop={() => onDrop(g)}
            className={cn(
              "rounded-lg transition-colors",
              dragging === g && "opacity-50",
              dragOver === g && dragging !== g && "ring-2 ring-primary/60",
            )}
          >
            <div
              draggable
              onDragStart={(e) => { setDragging(g); e.dataTransfer.effectAllowed = "move"; }}
              onDragEnd={() => { setDragging(null); setDragOver(null); }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold uppercase tracking-wide shadow-sm cursor-grab active:cursor-grabbing select-none",
                style.header,
              )}
              title="Glisser pour réorganiser"
            >
              <GripVertical className="size-4 opacity-70 shrink-0" />
              <span className="truncate">{g}</span>
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {groups[g].map((s) => {
                const isActive = active === s;
                return (
                  <li key={s}>
                    <Link
                      to="/"
                      search={{ sheet: s }}
                      className={cn(
                        "group/item relative flex items-center rounded-md pl-4 pr-3 py-2 text-sm transition-colors",
                        isActive
                          ? cn("font-medium", style.active)
                          : cn("text-foreground/80", style.hover),
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-1 top-1.5 bottom-1.5 w-1 rounded-full transition-opacity",
                          style.bar,
                          isActive
                            ? "opacity-0"
                            : "opacity-30 group-hover/item:opacity-90",
                        )}
                      />
                      <span className="truncate">{SHEET_META[s]?.label ?? s}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          );
        })}
      </nav>
      <div className="p-4 text-[11px] text-muted-foreground border-t border-border">
        Toutes vos modifications sont enregistrées automatiquement en ligne.
      </div>
    </aside>
  );
}