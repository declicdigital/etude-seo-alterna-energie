import { SHEET_META } from "@/lib/workbook";

export type GroupColor = {
  header: string; // main page header band
  chip: string; // small uppercase group chip
  title: string; // page title color
  rowTint: string; // subtle row background tint by level (tree)
  activeRow: string; // selected row bg in tree
  accent: string; // left bar accent
};

const MAP: Record<string, GroupColor> = {
  Arborescence: {
    header:
      "bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30",
    chip: "text-emerald-700 dark:text-emerald-300",
    title: "text-emerald-900 dark:text-emerald-100",
    rowTint: "hover:bg-emerald-500/10",
    activeRow: "bg-emerald-500/15 hover:bg-emerald-500/20",
    accent: "bg-emerald-500",
  },
  Blog: {
    header:
      "bg-gradient-to-r from-sky-500/15 via-sky-500/5 to-transparent border-sky-500/30",
    chip: "text-sky-700 dark:text-sky-300",
    title: "text-sky-900 dark:text-sky-100",
    rowTint: "hover:bg-sky-500/10",
    activeRow: "bg-sky-500/15 hover:bg-sky-500/20",
    accent: "bg-sky-500",
  },
  Suivi: {
    header:
      "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/30",
    chip: "text-amber-700 dark:text-amber-300",
    title: "text-amber-900 dark:text-amber-100",
    rowTint: "hover:bg-amber-500/10",
    activeRow: "bg-amber-500/15 hover:bg-amber-500/20",
    accent: "bg-amber-500",
  },
  Cocons: {
    header:
      "bg-gradient-to-r from-violet-500/15 via-violet-500/5 to-transparent border-violet-500/30",
    chip: "text-violet-700 dark:text-violet-300",
    title: "text-violet-900 dark:text-violet-100",
    rowTint: "hover:bg-violet-500/10",
    activeRow: "bg-violet-500/15 hover:bg-violet-500/20",
    accent: "bg-violet-500",
  },
  Docs: {
    header:
      "bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-transparent border-rose-500/30",
    chip: "text-rose-700 dark:text-rose-300",
    title: "text-rose-900 dark:text-rose-100",
    rowTint: "hover:bg-rose-500/10",
    activeRow: "bg-rose-500/15 hover:bg-rose-500/20",
    accent: "bg-rose-500",
  },
  Autres: {
    header:
      "bg-gradient-to-r from-slate-500/15 via-slate-500/5 to-transparent border-slate-500/30",
    chip: "text-slate-700 dark:text-slate-300",
    title: "text-slate-900 dark:text-slate-100",
    rowTint: "hover:bg-slate-500/10",
    activeRow: "bg-slate-500/15 hover:bg-slate-500/20",
    accent: "bg-slate-500",
  },
};

export function groupColorForSheet(sheet: string): GroupColor {
  const g = SHEET_META[sheet]?.group ?? "Autres";
  return MAP[g] ?? MAP.Autres;
}

// Level tints for tree rows (subtle backgrounds so hierarchy reads visually).
// Ordered by N0 → N7.
export const LEVEL_TINTS: string[] = [
  "bg-emerald-500/10",
  "bg-sky-500/8",
  "bg-violet-500/8",
  "bg-amber-500/8",
  "bg-rose-500/8",
  "bg-teal-500/8",
  "bg-indigo-500/8",
  "bg-slate-500/8",
];

export const LEVEL_ACCENTS: string[] = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-slate-500",
];