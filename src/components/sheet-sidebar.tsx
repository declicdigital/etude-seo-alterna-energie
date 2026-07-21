import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { GripVertical } from "lucide-react";
import { SHEET_META, sheetNames } from "@/lib/workbook";
import { cn } from "@/lib/utils";
import symbol from "@/assets/alterna-symbol.png.asset.json";

const DEFAULT_ORDER = ["Arborescence", "Blog", "Suivi", "Cocons", "Docs", "Autres"];
const ORDER_KEY = "sidebar.groupOrder.v1";

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
        {order.filter((g) => groups[g]?.length).map((g) => (
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
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-wide shadow-sm cursor-grab active:cursor-grabbing select-none"
              title="Glisser pour réorganiser"
            >
              <GripVertical className="size-4 opacity-70 shrink-0" />
              <span className="truncate">{g}</span>
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {groups[g].map((s) => (
                <li key={s}>
                  <Link
                    to="/"
                    search={{ sheet: s }}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm transition-colors",
                      active === s
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "hover:bg-muted text-foreground/80",
                    )}
                  >
                    {SHEET_META[s]?.label ?? s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="p-4 text-[11px] text-muted-foreground border-t border-border">
        Toutes vos modifications sont enregistrées automatiquement en ligne.
      </div>
    </aside>
  );
}