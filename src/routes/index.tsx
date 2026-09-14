import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SheetSidebar } from "@/components/sheet-sidebar";
import { TreeView } from "@/components/tree-view";
import { TableView } from "@/components/table-view";
import { WebflowView } from "@/components/webflow-view";
import { GuideView } from "@/components/guide-view";
import { DetailPanel } from "@/components/detail-panel";
import { useEdits } from "@/lib/use-edits";
import { baseSheetOf, embedSrcOf, isStructureSheet, nextRowId, SHEET_META, sheetNames } from "@/lib/workbook";
import { groupColorForSheet } from "@/lib/group-colors";
import { cn } from "@/lib/utils";
import { useMeta, metaGet } from "@/lib/use-meta";
import { EditableText } from "@/components/editable-text";
import { useNavigate } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import symbol from "@/assets/alterna-symbol.png.asset.json";
import { isUnlocked } from "@/lib/gate.functions";

const searchSchema = z.object({
  sheet: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { unlocked } = await isUnlocked();
    if (!unlocked) throw redirect({ to: "/unlock" });
  },
  component: Index,
});

function Index() {
  const { sheet: sheetParam } = Route.useSearch();
  const navigate = useNavigate();
  const isGuide = sheetParam === "__guide";
  const sheet = isGuide
    ? "__guide"
    : sheetParam && sheetNames.includes(baseSheetOf(sheetParam))
      ? sheetParam
      : "Structure RES";
  const [selected, setSelected] = useState<number | null>(null);
  const { edits, setCell, deleteRow, loading } = useEdits();
  const { meta: metaOverrides, setMetaValue } = useMeta();
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);

  // reset selection when switching sheet
  const [lastSheet, setLastSheet] = useState(sheet);
  if (sheet !== lastSheet) {
    setLastSheet(sheet);
    setSelected(null);
    setNavOpen(false);
  }

  const sheetInfo = SHEET_META[baseSheetOf(sheet)];
  const gc = isGuide ? groupColorForSheet("Structure RES") : groupColorForSheet(sheet);
  const groupName = isGuide ? "Guide" : (sheetInfo?.group ?? "Feuille");
  const groupLabel = metaGet(metaOverrides, "group", groupName, groupName);
  const baseSheet = baseSheetOf(sheet);
  const scope = sheet.includes("::") ? sheet.split("::")[1] : null;
  const baseLabel = metaGet(metaOverrides, "sheet", baseSheet, sheetInfo?.label ?? baseSheet);
  const scopeLabel = scope ? scope.replace("/", " › ") : "";
  const sheetLabel = isGuide
    ? "Guide de l'outil"
    : scope
      ? `${baseLabel} — ${scopeLabel}`
      : baseLabel;

  const handleAddRow = async (treeLevel = 0) => {
    const id = nextRowId(sheet, edits);
    await setCell(sheet, id, treeLevel, "Nouvelle page");
    setSelected(id);
  };

  // Create a table row from the "Nouvelle ligne" form (Valider).
  const handleCreateRow = async (values: Record<number, string>) => {
    const id = nextRowId(sheet, edits);
    const entries = Object.entries(values).filter(([, v]) => v.trim() !== "");
    if (entries.length === 0) {
      await setCell(sheet, id, 0, "");
      return;
    }
    for (const [c, v] of entries) await setCell(sheet, id, Number(c), v);
  };

  const embedSrc = isGuide ? null : embedSrcOf(sheet);

  const sidebar = <SheetSidebar meta={metaOverrides} setMetaValue={setMetaValue} />;

  const detailPanel = selected != null && !isGuide ? (
    <DetailPanel
      sheet={sheet}
      rowId={selected}
      edits={edits}
      onChange={(col, value) => setCell(sheet, selected, col, value)}
      onClose={() => setSelected(null)}
      onDelete={() => { deleteRow(sheet, selected); setSelected(null); }}
    />
  ) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden md:block">{sidebar}</div>

      {/* Mobile off-canvas sidebar */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="p-0 w-[86%] max-w-sm sm:max-w-sm">
          {sidebar}
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0">
        {/* iOS-style mobile top bar */}
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-3 h-14 px-3 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70">
          <button
            onClick={() => setNavOpen(true)}
            className="size-10 rounded-full flex items-center justify-center active:bg-muted -ml-1"
            aria-label="Ouvrir le menu"
          >
            <Menu className="size-5" />
          </button>
          <img src={symbol.url} alt="" className="size-7 rounded-full shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
              {groupLabel}
            </div>
            <div className="text-sm font-semibold leading-tight truncate">{sheetLabel}</div>
          </div>
        </div>

        {isGuide ? (
          <GuideView
            onOpenSheet={(s) => navigate({ to: "/", search: { sheet: s } })}
          />
        ) : embedSrc ? (
          <iframe
            src={embedSrc}
            title={sheetLabel}
            className="flex-1 w-full border-0 min-h-0"
          />
        ) : (
        <>
        <header className={cn("hidden md:block px-8 py-6 border-b", gc.header)}>
          <EditableText
            as="div"
            className={cn("text-[11px] uppercase tracking-widest font-semibold", gc.chip)}
            value={groupLabel}
            onCommit={(v) => setMetaValue("group", groupName, v)}
          />
          <EditableText
            as="h2"
            className={cn("mt-1 text-2xl font-semibold tracking-tight", gc.title)}
            value={sheetLabel}
            onCommit={(v) => setMetaValue("sheet", sheet, v)}
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {isStructureSheet(sheet)
              ? "Cliquez sur une page dans l'arborescence pour voir et éditer ses détails."
              : "Cliquez sur une ligne pour l'éditer."}
            {loading && " · Chargement des modifications…"}
          </p>
        </header>
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0 flex flex-col">
            {isStructureSheet(sheet) ? (
              <TreeView
                sheet={sheet}
                edits={edits}
                selected={selected}
                onSelect={setSelected}
                onAddRow={handleAddRow}
                onDeleteRow={(id) => { deleteRow(sheet, id); if (selected === id) setSelected(null); }}
              />
            ) : sheet === "Webflow - fonctionnement" ? (
              <WebflowView
                edits={edits}
                selected={selected}
                onSelect={setSelected}
              />
            ) : (
              <TableView
                sheet={sheet}
                edits={edits}
                selected={selected}
                onSelect={setSelected}
                onCreateRow={handleCreateRow}
                onToggle={(rowId, col, value) => setCell(sheet, rowId, col, value)}
                onDeleteRow={(id) => { deleteRow(sheet, id); if (selected === id) setSelected(null); }}
              />
            )}
          </div>
          {/* Desktop detail panel */}
          <div className="hidden md:block">{detailPanel}</div>
        </div>
        </>
        )}
      </main>

      {/* Mobile detail panel: iOS-style bottom sheet */}
      <Sheet
        open={isMobile && selected != null && !isGuide}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
      >
        <SheetContent
          side="bottom"
          className="p-0 h-[92vh] rounded-t-2xl border-t"
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          {detailPanel}
        </SheetContent>
      </Sheet>
    </div>
  );
}
