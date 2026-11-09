import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Archive, ArchiveRestore, BookOpen, Bot, FolderDown, Home, ChevronDown, ChevronRight, GripVertical, Minus, Plus, Trash2, RotateCcw } from "lucide-react";
import { SHEET_META, sheetNames } from "@/lib/workbook";
import { cn } from "@/lib/utils";
import digicomWordmark from "@/assets/digicom-wordmark.png";
import { EditableText } from "@/components/editable-text";
import { metaGet, type MetaMap } from "@/lib/use-meta";
import { sheetPath, resolvePath } from "@/lib/slugs";
import { grantedSections, sheetAllowed } from "@/lib/sections";

const DEFAULT_ORDER = ["Stratégie PAC", "Blog", "Parlons Planète", "FAQ", "Benchmark", "Calendriers newsletters", "Organisation", "Arborescence", "Suivi", "Docs", "Autres", "Archives"];
const REMOVED_GROUPS = new Set(["Arborescence", "Suivi", "Docs", "Archives", "Autres"]);
const ORDER_KEY = "sidebar.groupOrder.v1";
const PROMOTED_KEY = "sidebar.orderPromoted.v1";

// Move "Stratégie PAC" to the very top and "Blog" right after it, keeping the
// relative order of every other group.
const promotePac = (list: string[]) => [
  ...list.filter((g) => g === "Stratégie PAC"),
  ...list.filter((g) => g === "Blog"),
  ...list.filter((g) => g !== "Stratégie PAC" && g !== "Blog"),
];
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
    { name: "Particulier", subs: [] },
    { name: "Professionnel", subs: [] },
  ],
  // Same shape as Blog: "Suivi éditorial" stays on top, the article list sits
  // nested under it.
  "Stratégie PAC": [
    { name: "Contenus", subs: [] },
  ],
  // One single blog: "Suivi éditorial" on top, the "Blog" list under it.
  "Parlons Planète": [
    { name: "Blog", subs: [] },
  ],
  FAQ: [
    { name: "Particulier", subs: [] },
    { name: "Professionnel", subs: [] },
  ],
};

// Default sub-path assignments for existing sheets. Format: "Subcat/Subsub".
// A value of "*" means the sheet should appear in every leaf of the group.
const DEFAULT_SUBPATHS: Record<string, string> = {
  "BLOG - ARTICLES": "*",
  "Structure RES": "Particulier",
  "Structure PRO": "Professionnel",
  "STRATEGIE - ARTICLES": "Contenus",
  "PLANETE - ARTICLES": "Blog",
  "FAQ - DEMANDES": "*",
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
  "Stratégie PAC": {
    header: "bg-violet-600 text-white",
    active: "bg-violet-500/15 text-violet-800 dark:text-violet-200 font-semibold ring-1 ring-inset ring-violet-500/30",
    hover: "hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300",
    bar: "bg-violet-500",
  },
  "Parlons Planète": {
    header: "bg-lime-700 text-white",
    active: "bg-lime-600/15 text-lime-900 dark:text-lime-100 font-semibold ring-1 ring-inset ring-lime-600/30",
    hover: "hover:bg-lime-600/10 hover:text-lime-800 dark:hover:text-lime-200",
    bar: "bg-lime-600",
  },
  FAQ: {
    header: "bg-teal-600 text-white",
    active: "bg-teal-500/15 text-teal-800 dark:text-teal-200 font-semibold ring-1 ring-inset ring-teal-500/30",
    hover: "hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-300",
    bar: "bg-teal-500",
  },
  Benchmark: {
    header: "bg-emerald-700 text-white",
    active: "bg-emerald-600/15 text-emerald-900 dark:text-emerald-100 font-semibold ring-1 ring-inset ring-emerald-600/30",
    hover: "hover:bg-emerald-600/10 hover:text-emerald-800 dark:hover:text-emerald-200",
    bar: "bg-emerald-600",
  },
  "Calendriers newsletters": {
    header: "bg-blue-700 text-white",
    active: "bg-blue-600/15 text-blue-900 dark:text-blue-100 font-semibold ring-1 ring-inset ring-blue-600/30",
    hover: "hover:bg-blue-600/10 hover:text-blue-800 dark:hover:text-blue-200",
    bar: "bg-blue-600",
  },
  Organisation: {
    header: "bg-amber-600 text-white",
    active: "bg-amber-500/15 text-amber-900 dark:text-amber-100 font-semibold ring-1 ring-inset ring-amber-500/30",
    hover: "hover:bg-amber-500/10 hover:text-amber-800 dark:hover:text-amber-200",
    bar: "bg-amber-500",
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
  allowed = null,
  showDigipote = false,
}: {
  allowed?: string[] | null;
  /** Geoffrey uniquement : historique des questions posées à D.I.G.I.P.O.T.E. */
  showDigipote?: boolean;
  meta: MetaMap;
  setMetaValue: (scope: string, key: string, value: string | null) => void;
}) {
  const search = useRouterState({ select: (r) => r.location.search }) as { sheet?: string };
  const pathname = useRouterState({ select: r => r.location.pathname });
  const active = resolvePath(pathname)?.sheet ?? search.sheet ?? "__home";
  const isKit = useRouterState({ select: (r) => r.location.pathname === "/kit-communication" });

  const hiddenSheets = useMemo(() => {
    const set = new Set<string>();
    const bag = meta["hidden_sheet"] ?? {};
    for (const k of Object.keys(bag)) if (bag[k] === "1") set.add(k);
    return set;
  }, [meta]);
  const [showHidden, setShowHidden] = useState(false);

  const [groupOverrides, setGroupOverrides] = useState<Record<string, string>>(DEFAULT_GROUP_OVERRIDES);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GROUP_OVERRIDE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        // Migrate old group label to "Stratégie PAC".
        for (const k of Object.keys(parsed)) {
          if (parsed[k] === "Stratégie édito") parsed[k] = "Stratégie PAC";
        }
        setGroupOverrides({ ...DEFAULT_GROUP_OVERRIDES, ...parsed });
      }
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
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        // Migrate old "Elec" label to "Électricité".
        for (const k of Object.keys(parsed)) {
          if (parsed[k]?.endsWith("/Elec")) parsed[k] = parsed[k].replace(/\/Elec$/, "/Électricité");
        }
        setSubpaths({ ...DEFAULT_SUBPATHS, ...parsed });
      }
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
      if (!showHidden && hiddenSheets.has(s)) continue;
      if (!sheetAllowed(s, allowed)) continue;
      const k = groupOverrides[s] ?? SHEET_META[s]?.group ?? "Autres";
      if (REMOVED_GROUPS.has(SHEET_META[s]?.group ?? "Autres") || REMOVED_GROUPS.has(k)) continue;
      (g[k] ??= []).push(s);
    }
    return g;
  }, [groupOverrides, hiddenSheets, showHidden, allowed]);

  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as string[];
        // Migrate old "Stratégie édito" label to "Stratégie PAC".
        const migrated = saved.map((g) => (g === "Stratégie édito" ? "Stratégie PAC" : g));
        // Merge saved order with any new groups discovered later.
        const known = new Set(migrated);
        const extras = DEFAULT_ORDER.filter((g) => !known.has(g));
        let next = [...migrated];
        for (const g of extras) {
          // New groups land right after their default predecessor (FAQ after Blog).
          const prev = DEFAULT_ORDER[DEFAULT_ORDER.indexOf(g) - 1];
          const at = prev ? next.indexOf(prev) : -1;
          if (at >= 0) next.splice(at + 1, 0, g); else next.push(g);
        }
        // One-time: bring "Stratégie PAC" to the top and "Blog" right after it.
        try {
          if (!localStorage.getItem(PROMOTED_KEY)) {
            next = promotePac(next);
            localStorage.setItem(ORDER_KEY, JSON.stringify(next));
            localStorage.setItem(PROMOTED_KEY, "1");
          }
        } catch { /* ignore */ }
        setOrder(next);
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
      if (raw) {
        // Migrate old "Stratégie édito" label to "Stratégie PAC".
        const saved = (JSON.parse(raw) as string[]).map((g) => (g === "Stratégie édito" ? "Stratégie PAC" : g));
        setCollapsed(new Set(saved));
      }
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
        <img
          src={digicomWordmark}
          alt="Digicom"
          loading="lazy"
          width={1281}
          height={359}
          className="h-9 w-auto"
        />
        <p className="mt-1.5 text-[13px] leading-snug font-medium text-primary">
          l'outil de suivi de la communication digitale
        </p>
      </div>
      <nav className="p-3 space-y-3">
        <Link
          to="/$"
          params={{ _splat: sheetPath("__home") }}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors border",
            active === "__home" && !isKit
              ? "bg-primary/10 text-primary border-primary/40"
              : "border-transparent text-foreground/80 hover:bg-primary/5 hover:text-primary",
          )}
        >
          <Home className="size-4" />
          Accueil
        </Link>
        <Link
          to="/$"
          params={{ _splat: sheetPath("__guide") }}
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
        <Link to="/kit-communication" className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors border", isKit ? "bg-primary/10 text-primary border-primary/40" : "border-transparent text-foreground/80 hover:bg-primary/5 hover:text-primary")}>
          <FolderDown className="size-4" /> Kit de communication
        </Link>
        {showDigipote && (
          <Link
            to="/$"
            params={{ _splat: sheetPath("__digipote") }}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors border",
              active === "__digipote"
                ? "bg-primary/10 text-primary border-primary/40"
                : "border-transparent text-foreground/80 hover:bg-primary/5 hover:text-primary",
            )}
          >
            <Bot className="size-4" /> Digipote
          </Link>
        )}
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
                hiddenSheets,
                allowed,
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
      {hiddenSheets.size > 0 && (
        <div className="px-4 pb-4 -mt-2">
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            {showHidden ? "Masquer les feuilles supprimées" : `Afficher les feuilles supprimées (${hiddenSheets.size})`}
          </button>
        </div>
      )}
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
  hiddenSheets: Set<string>;
  allowed: string[] | null;
};

function renderGroupBody(group: string, sheets: string[], ctx: RenderCtx) {
  const granted = ctx.allowed ? grantedSections(ctx.allowed) : null;
  const structure = SUB_STRUCTURE[group]?.filter((sc) => !granted || granted.has(`${group}/${sc.name}`));
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
        if (sc.subs.length === 0) pushBucket(sc.name, `${s}::${sc.name}`);
        else for (const ss of sc.subs) pushBucket(`${sc.name}/${ss}`, `${s}::${sc.name}/${ss}`);
      }
    } else if (p && p.startsWith("*/")) {
      const suffix = p.slice(2);
      for (const sc of structure) {
        if (sc.subs.includes(suffix)) pushBucket(`${sc.name}/${suffix}`, `${s}::${sc.name}/${suffix}`);
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
        <SubGroup
          key={sub.name}
          group={group}
          sub={sub}
          buckets={buckets}
          ctx={ctx}
          structure={structure}
        />
      ))}
    </div>
  );
}

function SubGroup({
  group,
  sub,
  buckets,
  ctx,
  structure,
}: {
  group: string;
  sub: { name: string; subs: string[] };
  buckets: Map<string, string[]>;
  ctx: RenderCtx;
  structure: { name: string; subs: string[] }[];
}) {
  // Auto-open when the active sheet belongs to this subcategory.
  const activeScope = ctx.active.includes("::") ? ctx.active.split("::")[1] : "";
  const activeSub = activeScope.split("/")[0] ?? "";
  const [open, setOpen] = useState(activeSub === sub.name);
  useEffect(() => {
    if (activeSub === sub.name) setOpen(true);
  }, [activeSub, sub.name]);

  // A subcategory holding exactly one sheet becomes a direct link: no
  // extra level to unfold.
  const direct = sub.subs.length === 0 ? (buckets.get(sub.name) ?? []) : [];
  if (direct.length === 1) {
    const target = direct[0];
    const isActive = ctx.active === target;
    return (
      <div className="ml-1">
        <Link
          to="/$"
          params={{ _splat: sheetPath(target) }}
          className={cn(
            "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wide transition-colors",
            isActive ? ctx.style.active : cn("text-foreground/70", ctx.style.hover),
          )}
        >
          <span className="truncate">{sub.name}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="ml-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide cursor-pointer",
          ctx.style.active,
        )}
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span className="truncate">{sub.name}</span>
      </button>
      {open && (sub.subs.length === 0 ? (
        <ul className="mt-1 ml-2 space-y-0.5 border-l border-border/60 pl-2">
          {(buckets.get(sub.name) ?? []).map((s) => (
            <SheetItem key={s} sheet={s} group={group} ctx={ctx} showSubMove structure={structure} />
          ))}
          {(buckets.get(sub.name) ?? []).length === 0 && (
            <li className="px-3 py-1 text-[11px] text-muted-foreground/60 italic">Vide</li>
          )}
        </ul>
      ) : (
        <div className="mt-1 ml-2 space-y-1 border-l border-border/60 pl-2">
          {sub.subs.map((ss) => (
            <SubSubGroup
              key={ss}
              group={group}
              subName={sub.name}
              ss={ss}
              items={buckets.get(`${sub.name}/${ss}`) ?? []}
              ctx={ctx}
              structure={structure}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SubSubGroup({
  group,
  subName,
  ss,
  items,
  ctx,
  structure,
}: {
  group: string;
  subName: string;
  ss: string;
  items: string[];
  ctx: RenderCtx;
  structure: { name: string; subs: string[] }[];
}) {
  const activeScope = ctx.active.includes("::") ? ctx.active.split("::")[1] : "";
  const activeSubSub = activeScope.split("/")[1] ?? "";
  const activeSub = activeScope.split("/")[0] ?? "";
  const [open, setOpen] = useState(activeSub === subName && activeSubSub === ss);
  useEffect(() => {
    if (activeSub === subName && activeSubSub === ss) setOpen(true);
  }, [activeSub, activeSubSub, subName, ss]);
  // When a single sheet lives under this leaf, its label already matches
  // the header name — collapse into a direct link.
  const singleLeaf = items.length === 1;
  return (
    <div>
      {singleLeaf ? (
        <ul className="space-y-0.5">
          <SheetItem sheet={items[0]} group={group} ctx={ctx} showSubMove structure={structure} />
        </ul>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/50 cursor-pointer"
          >
            {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            <span className="truncate">{ss}</span>
          </button>
          {open && (
            <ul className="space-y-0.5 ml-2 border-l border-border/60 pl-2">
              {items.map((s) => (
                <SheetItem key={s} sheet={s} group={group} ctx={ctx} showSubMove structure={structure} />
              ))}
              {items.length === 0 && (
                <li className="px-3 py-1 text-[11px] text-muted-foreground/60 italic">Vide</li>
              )}
            </ul>
          )}
        </>
      )}
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
        // Already on this sheet: don't navigate again (it re-runs the access
        // check and refreshes the page, which breaks double-click to rename).
        onClick={(e) => { if (isActive) e.preventDefault(); }}
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
          value={metaGet(ctx.meta, "sheet", sheet, SHEET_META[sheet.split("::")[0]]?.label ?? sheet)}
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
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); ctx.setSheetGroup(sheet.split("::")[0], null); }}
            className="ml-1 shrink-0 size-6 rounded-md flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-foreground/10"
            aria-label="Sortir des archives"
            title="Sortir des archives"
          >
            <ArchiveRestore className="size-3.5" />
          </button>
        ) : (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); ctx.setSheetGroup(sheet.split("::")[0], "Archives"); }}
            className="ml-1 shrink-0 size-6 rounded-md flex items-center justify-center opacity-0 group-hover/item:opacity-60 hover:!opacity-100 hover:bg-foreground/10"
            aria-label="Archiver"
            title="Archiver"
          >
            <Archive className="size-3.5" />
          </button>
        )}
        {ctx.hiddenSheets.has(sheet) ? (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); ctx.setMetaValue("hidden_sheet", sheet.split("::")[0], null); }}
            className="ml-1 shrink-0 size-6 rounded-md flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-foreground/10"
            aria-label="Restaurer"
            title="Restaurer cette feuille"
          >
            <RotateCcw className="size-3.5" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const base = sheet.split("::")[0];
              const label = SHEET_META[base]?.label ?? base;
              if (confirm(`Supprimer la feuille "${label}" ? Vous pourrez la restaurer via "Afficher masquées".`)) {
                ctx.setMetaValue("hidden_sheet", base, "1");
              }
            }}
            className="ml-1 shrink-0 size-6 rounded-md flex items-center justify-center opacity-0 group-hover/item:opacity-60 hover:!opacity-100 hover:bg-red-500/10 hover:text-red-600"
            aria-label="Supprimer"
            title="Supprimer cette feuille"
          >
            <Trash2 className="size-3.5" />
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