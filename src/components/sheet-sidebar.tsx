import { Link, useRouterState } from "@tanstack/react-router";
import { SHEET_META, sheetNames } from "@/lib/workbook";
import { cn } from "@/lib/utils";

export function SheetSidebar() {
  const search = useRouterState({ select: (r) => r.location.search }) as { sheet?: string };
  const active = search.sheet ?? "Structure RES";

  const groups: Record<string, string[]> = {};
  for (const s of sheetNames) {
    const g = SHEET_META[s]?.group ?? "Autres";
    (groups[g] ??= []).push(s);
  }
  const order = ["Arborescence", "Blog", "Suivi", "Cocons", "Docs", "Autres"];

  return (
    <aside className="w-72 shrink-0 border-r border-border bg-card/50 backdrop-blur-sm h-screen sticky top-0 overflow-y-auto">
      <div className="p-5 border-b border-border">
        <div className="text-xs uppercase tracking-widest text-primary/80 font-semibold">Alterna Énergie</div>
        <h1 className="mt-1 text-lg font-semibold leading-tight">Étude SEO</h1>
        <p className="mt-1 text-xs text-muted-foreground">Arborescence & suivi éditorial</p>
      </div>
      <nav className="p-3 space-y-5">
        {order.filter((g) => groups[g]?.length).map((g) => (
          <div key={g}>
            <div className="px-2 pb-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {g}
            </div>
            <ul className="space-y-0.5">
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