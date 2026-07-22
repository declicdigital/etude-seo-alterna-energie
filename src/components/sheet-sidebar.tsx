import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Archive, ArchiveRestore, BookOpen, GripVertical, Minus, Plus } from "lucide-react";
import { SHEET_META, sheetNames } from "@/lib/workbook";
import { cn } from "@/lib/utils";
import symbol from "@/assets/alterna-symbol.png.asset.json";
import { EditableText } from "@/components/editable-text";
import { metaGet, type MetaMap } from "@/lib/use-meta";

const DEFAULT_ORDER = ["Arborescence", "Blog", "Suivi", "Stratégie édito", "Docs", "Autres", "Archives"];
const ORDER_KEY = "sidebar.groupOrder.v1";
const COLLAPSED_KEY = "sidebar.groupCollapsed.v1";
const GROUP_OVERRIDE_KEY = "sidebar.sheetGroup.v1";
const SUBPATH_KEY = "sidebar.sheetSubpath.v1";
const DEFAULT_GROUP_OVERRIDES: Record<string, string> = {
  "Structure (resi) (OLD V3)": "Archives",
};

// Nested substructure for specific groups. Each group has a list of
// subcategories (level 1) and each subcategory a list of sub-subs (level 2).
const SUB_STRUCTURE: Record<string, { name: string; subs: string[] }[]> = {
  Blog: [
    { name: "Particulier", subs: ["Électricité", "Gaz"] },
    { name: "Professionnel", subs: ["Électricité", "Gaz"] },
  ],
  "Stratégie édito": [
    { name: "Particulier", subs: ["Électricité", "Gaz"] },
    { name: "Professionnel", subs: ["Électricité", "Gaz"] },
  ],
  Arborescence: [
    { name: "Particulier", subs: [] },
    { name: "Professionnel", subs: [] },
  ],
};

// Default sub-path assignments for existing sheets. Format: "Subcat/Subsub".
// A value of "*" means the sheet should appear in every leaf of the group.
const DEFAULT_SUBPATHS: Record<string, string> = {
  "Articles cocon éléctricité": "Particulier/Électricité",
  "Articles cocon Gaz": "Particulier/Gaz",
  "BLOG - IDEE": "*",
  "BLOG - ARTICLES": "*",
  "Structure RES": "Particulier",
  "Structure PRO": "Professionnel",
};

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
    active: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 font-semibold ring-1 ring-inset ring-emerald-500/30",
    hover: "hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300",
    bar: "bg-emerald-500",
  },
  Blog: {
    header: "bg-sky-600 text-white",
    active: "bg-sky-500/15 text-sky-800 dark:text-sky-200 font-semibold ring-1 ring-inset ring-sky-500/30",
    hover: "hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-300",
    bar: "bg-sky-500",
  },
  Suivi: {
    header: "bg-amber-500 text-white",
    active: "bg-amber-500/20 text-amber-800 dark:text-amber-200 font-semibold ring-1 ring-inset ring-amber-500/40",
    hover: "hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300",
    bar: "bg-amber-500",
  },
  Cocons: {
    header: "bg-violet-600 text-white",
    active: "bg-violet-500/15 text-violet-800 dark:text-violet-200 font-semibold ring-1 ring-inset ring-violet-500/30",
    hover: "hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300",
    bar: "bg-violet-500",
  },
  "Stratégie édito": {
    header: "bg-violet-600 text-white",
    active: "bg-violet-500/15 text-violet-800 dark:text-violet-200 font-semibold ring-1 ring-inset ring-violet-500/30",
    hover: "hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300",
    bar: "bg-violet-500",
  },
  Docs: {
    header: "bg-rose-500 text-white",
    active: "bg-rose-500/15 text-rose-800 dark:text-rose-200 font-semibold ring-1 ring-inset ring-rose-500/30",
    hover: "hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300",
    bar: "bg-rose-500",
  },
  Autres: {
    header: "bg-slate-600 text-white",
    active: "bg-slate-500/15 text-slate-800 dark:text-slate-200 font-semibold ring-1 ring-inset ring-slate-500/30",
    hover: "hover:bg-slate-500/10 hover:text-slate-700 dark:hover:text-slate-300",
    bar: "bg-slate-500",
  },
  Archives: {
    header: "bg-stone-600 text-white",
    active: "bg-stone-500/15 text-stone-800 dark:text-stone-200 font-semibold ring-1 ring-inset ring-stone-500/30",
    hover: "hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-300",
    bar: "bg-stone-500",
  },
};
const FALLBACK_STYLE = GROUP_STYLES.Autres;

export function SheetSidebar({
  meta,
  setMetaValue,
}: {
  meta: MetaMap;
  setMetaValue: (scope: string, key: string, value: string | null) => void;
}) {
  const search = useRouterState({ select: (r) => r.location.search }) as { sheet?: string };
  const active = search.sheet ?? "Structure RES";

  const [groupOverrides, setGroupOverrides] = useState<Record<string, string>>(DEFAULT_GROUP_OVERRIDES);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GROUP_OVERRIDE_KEY);
      if (raw) setGroupOverrides({ ...DEFAULT_GROUP_OVERRIDES, ...(JSON.parse(raw) as Record<string, string>) });
    } catch { /* ignore */ }
  }, []);
  const setSheetGroup = (sheet: string, group: string | null) => {
    setGroupOverrides((prev) => {
      const n = { ...prev };
      if (group == null) delete n[sheet];
      else n[sheet] = group;
      try { localStorage.setItem(GROUP_OVERRIDE_KEY, JSON.stringify(n)); } catch { /* ignore */ }
      return n;
    });
  };

  const [subpaths, setSubpaths] = useState<Record<string, string>>(DEFAULT_SUBPATHS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SUBPATH_KEY);
      if (raw) setSubpaths({ ...DEFAULT_SUBPATHS, ...(JSON.parse(raw) as Record<string, string>) });
    } catch { /* ignore */ }
  }, []);
  const setSheetSubpath = (sheet: string, path: string | null) => {
    setSubpaths((prev) => {
      const n = { ...prev };
      if (!path) delete n[sheet];
      else n[sheet] = path;
      try { localStorage.setItem(SUBPATH_KEY, JSON.stringify(n)); } catch { /* ignore */ }
      return n;
    });
  };

  const groups = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const s of sheetNames) {
      const k = groupOverrides[s] ?? SHEET_META[s]?.group ?? "Autres";
      (g[k] ??= []).push(s);
    }
    return g;
  }, [groupOverrides]);

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

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore */ }
  }, []);
  const toggleCollapsed = (g: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev);
      n.has(g) ? n.delete(g) : n.add(g);
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...n])); } catch { /* ignore */ }
      return n;
    });
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
    <aside className="w-full md:w-72 shrink-0 border-r border-border bg-card/50 backdrop-blur-sm md:h-screen md:sticky md:top-0 overflow-y-auto">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <img src={symbol.url} alt="Alterna Énergie" className="size-10 rounded-full shrink-0" />
          <div className="min-w-0">
            <EditableText
              as="div"
              className="text-[10px] uppercase tracking-widest text-primary/80 font-semibold"
              value={metaGet(meta, "brand", "eyebrow", "Alterna Énergie")}
              onCommit={(v) => setMetaValue("brand", "eyebrow", v)}
            />
            <EditableText
              as="h1"
              className="text-base font-semibold leading-tight"
              value={metaGet(meta, "brand", "title", "Étude SEO")}
              onCommit={(v) => setMetaValue("brand", "title", v)}
            />
          </div>
        </div>
        <EditableText
          as="div"
          className="mt-3 text-xs text-muted-foreground"
          value={metaGet(meta, "brand", "tagline", "Arborescence & suivi éditorial")}
          onCommit={(v) => setMetaValue("brand", "tagline", v)}
        />
      </div>
      <nav className="p-3 space-y-3">
        <Link
          to="/"
          search={{ sheet: "__guide" }}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors border",
            active === "__guide"
              ? "bg-primary/10 text-primary border-primary/40"
              : "border-transparent text-foreground/80 hover:bg-primary/5 hover:text-primary",
          )}
        >
          <BookOpen className="size-4" />
          Guide de l'outil
        </Link>
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
              <EditableText
                className="truncate flex-1"
                inputClassName="uppercase tracking-wide text-sm font-semibold text-foreground"
                value={metaGet(meta, "group", g, g)}
                onCommit={(v) => setMetaValue("group", g, v)}
              />
              <button
                onClick={(e) => { e.stopPropagation(); toggleCollapsed(g); }}
                onMouseDown={(e) => e.stopPropagation()}
                draggable={false}
                className="ml-auto size-5 rounded-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label={collapsed.has(g) ? "Déplier" : "Replier"}
                title={collapsed.has(g) ? "Déplier" : "Replier"}
              >
                {collapsed.has(g) ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
              </button>
            </div>
            {!collapsed.has(g) && (
            <div className="mt-1.5">
              {renderGroupBody(g, groups[g], {
                style,
                active,
                meta,
                setMetaValue,
                subpaths,
                setSheetSubpath,
                setSheetGroup,
              })}
            </div>
            )}
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

type RenderCtx = {
  style: (typeof GROUP_STYLES)[string];
  active: string;
  meta: MetaMap;
  setMetaValue: (scope: string, key: string, value: string | null) => void;
  subpaths: Record<string, string>;
  setSheetSubpath: (sheet: string, path: string | null) => void;
  setSheetGroup: (sheet: string, group: string | null) => void;
};

function renderGroupBody(group: string, sheets: string[], ctx: RenderCtx) {
  const structure = SUB_STRUCTURE[group];
  if (!structure) {
    return (
      <ul className="space-y-0.5">
        {sheets.map((s) => (
          <SheetItem key={s} sheet={s} group={group} ctx={ctx} />
        ))}
      </ul>
    );
  }
  // Split sheets: unassigned first, then buckets by "Sub/SubSub"
  const buckets = new Map<string, string[]>();
  const unassigned: string[] = [];
  const pushBucket = (key: string, sheet: string) => {
    const arr = buckets.get(key) ?? [];
    arr.push(sheet);
    buckets.set(key, arr);
  };
  for (const s of sheets) {
    const p = ctx.subpaths[s];
    if (p === "*") {
      for (const sc of structure) {
        if (sc.subs.length === 0) pushBucket(sc.name, s);
        else for (const ss of sc.subs) pushBucket(`${sc.name}/${ss}`, s);
      }
    } else if (p && structure.some((sc) => p === sc.name || p.startsWith(sc.name + "/"))) {
      pushBucket(p, s);
    } else {
      unassigned.push(s);
    }
  }
  return (
    <div className="space-y-2">
      {unassigned.length > 0 && (
        <ul className="space-y-0.5">
          {unassigned.map((s) => (
            <SheetItem key={s} sheet={s} group={group} ctx={ctx} showSubMove structure={structure} />
          ))}
        </ul>
      )}
      {structure.map((sub) => (
        <div key={sub.name} className="ml-1">
          <div className={cn(
            "px-2 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide",
            ctx.style.active,
          )}>
            {sub.name}
          </div>
          {sub.subs.length === 0 ? (
            <ul className="mt-1 ml-2 space-y-0.5 border-l border-border/60 pl-2">
              {(buckets.get(sub.name) ?? []).map((s) => (
                <SheetItem key={s} sheet={s} group={group} ctx={ctx} showSubMove structure={structure} />
              ))}
              {(buckets.get(sub.name) ?? []).length === 0 && (
                <li className="px-3 py-1 text-[11px] text-muted-foreground/60 italic">Vide</li>
              )}
            </ul>
          ) : (
          <div className="mt-1 ml-2 space-y-1.5 border-l border-border/60 pl-2">
            {sub.subs.map((ss) => {
              const key = `${sub.name}/${ss}`;
              const items = buckets.get(key) ?? [];
              return (
                <div key={ss}>
                  <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {ss}
                  </div>
                  <ul className="space-y-0.5">
                    {items.map((s) => (
                      <SheetItem key={s} sheet={s} group={group} ctx={ctx} showSubMove structure={structure} />
                    ))}
                    {items.length === 0 && (
                      <li className="px-3 py-1 text-[11px] text-muted-foreground/60 italic">Vide</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SheetItem({
  sheet,
  group,
  ctx,
  showSubMove,
  structure,
}: {
  sheet: string;
  group: string;
  ctx: RenderCtx;
  showSubMove?: boolean;
  structure?: { name: string; subs: string[] }[];
}) {
  const isActive = ctx.active === sheet;
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <li className="relative">
      <Link
        to="/"
        search={{ sheet }}
        className={cn(
          "group/item relative flex items-center rounded-md pl-4 pr-2 py-2 text-sm transition-colors",
          isActive ? cn("font-medium", ctx.style.active) : cn("text-foreground/80", ctx.style.hover),
        )}
      >
        <span
          className={cn(
            "absolute left-1 top-1.5 bottom-1.5 w-1 rounded-full transition-opacity",
            ctx.style.bar,
            isActive ? "opacity-0" : "opacity-30 group-hover/item:opacity-90",
          )}
        />
        <EditableText
          className="truncate flex-1"
          value={metaGet(ctx.meta, "sheet", sheet, SHEET_META[sheet]?.label ?? sheet)}
          onCommit={(v) => ctx.setMetaValue("sheet", sheet, v)}
        />
        {showSubMove && structure && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="ml-1 shrink-0 size-6 rounded-md flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-foreground/10 text-xs"
            aria-label="Déplacer"
            title="Déplacer dans une sous-catégorie"
          >
            ⋯
          </button>
        )}
        {group === "Archives" ? (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); ctx.setSheetGroup(sheet, null); }}
            className="ml-1 shrink-0 size-6 rounded-md flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-foreground/10"
            aria-label="Sortir des archives"
            title="Sortir des archives"
          >
            <ArchiveRestore className="size-3.5" />
          </button>
        ) : (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); ctx.setSheetGroup(sheet, "Archives"); }}
            className="ml-1 shrink-0 size-6 rounded-md flex items-center justify-center opacity-0 group-hover/item:opacity-60 hover:!opacity-100 hover:bg-foreground/10"
            aria-label="Archiver"
            title="Archiver"
          >
            <Archive className="size-3.5" />
          </button>
        )}
      </Link>
      {menuOpen && structure && (
        <div
          className="absolute right-2 top-full mt-1 z-30 rounded-md border border-border bg-popover shadow-lg py-1 min-w-[160px] text-xs"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-muted"
            onClick={() => { ctx.setSheetSubpath(sheet, null); setMenuOpen(false); }}
          >
            (Aucune)
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-muted"
            onClick={() => { ctx.setSheetSubpath(sheet, "*"); setMenuOpen(false); }}
          >
            Partout
          </button>
          {structure.flatMap((sub) =>
            sub.subs.length === 0 ? [(
              <button
                key={sub.name}
                className="w-full text-left px-3 py-1.5 hover:bg-muted"
                onClick={() => { ctx.setSheetSubpath(sheet, sub.name); setMenuOpen(false); }}
              >
                {sub.name}
              </button>
            )] : sub.subs.map((ss) => (
              <button
                key={`${sub.name}/${ss}`}
                className="w-full text-left px-3 py-1.5 hover:bg-muted"
                onClick={() => { ctx.setSheetSubpath(sheet, `${sub.name}/${ss}`); setMenuOpen(false); }}
              >
                {sub.name} › {ss}
              </button>
            )),
          )}
        </div>
      )}
    </li>
  );
}