import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SheetSidebar } from "@/components/sheet-sidebar";
import { TreeView } from "@/components/tree-view";
import { TableView } from "@/components/table-view";
import { WebflowView } from "@/components/webflow-view";
import { GuideView } from "@/components/guide-view";
import { DetailPanel } from "@/components/detail-panel";
import { useEdits } from "@/lib/use-edits";
import { isStructureSheet, nextRowId, SHEET_META, sheetNames } from "@/lib/workbook";
import { groupColorForSheet } from "@/lib/group-colors";
import { cn } from "@/lib/utils";
import { useMeta, metaGet } from "@/lib/use-meta";
import { EditableText } from "@/components/editable-text";
import { useNavigate } from "@tanstack/react-router";

const searchSchema = z.object({
  sheet: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  component: Index,
});

function Index() {
  const { sheet: sheetParam } = Route.useSearch();
  const navigate = useNavigate();
  const isGuide = sheetParam === "__guide";
  const sheet = isGuide
    ? "__guide"
    : sheetParam && sheetNames.includes(sheetParam)
      ? sheetParam
      : "Structure RES";
  const [selected, setSelected] = useState<number | null>(null);
  const { edits, setCell, loading } = useEdits();
  const { meta: metaOverrides, setMetaValue } = useMeta();

  // reset selection when switching sheet
  const [lastSheet, setLastSheet] = useState(sheet);
  if (sheet !== lastSheet) {
    setLastSheet(sheet);
    setSelected(null);
  }

  if (isGuide) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <SheetSidebar meta={metaOverrides} setMetaValue={setMetaValue} />
        <main className="flex-1 flex flex-col min-w-0">
          <GuideView
            onOpenSheet={(s) => navigate({ to: "/", search: { sheet: s } })}
          />
        </main>
      </div>
    );
  }

  const sheetInfo = SHEET_META[sheet];
  const gc = groupColorForSheet(sheet);
  const groupName = sheetInfo?.group ?? "Feuille";
  const groupLabel = metaGet(metaOverrides, "group", groupName, groupName);
  const sheetLabel = metaGet(metaOverrides, "sheet", sheet, sheetInfo?.label ?? sheet);

  const handleAddRow = async (treeLevel = 0) => {
    const id = nextRowId(sheet, edits);
    if (isStructureSheet(sheet)) {
      await setCell(sheet, id, treeLevel, "Nouvelle page");
    } else {
      await setCell(sheet, id, 0, "Nouvelle ligne");
    }
    setSelected(id);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <SheetSidebar meta={metaOverrides} setMetaValue={setMetaValue} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className={cn("px-8 py-6 border-b", gc.header)}>
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
                onAddRow={() => handleAddRow(0)}
                onToggle={(rowId, col, value) => setCell(sheet, rowId, col, value)}
              />
            )}
          </div>
          {selected != null && (
            <DetailPanel
              sheet={sheet}
              rowId={selected}
              edits={edits}
              onChange={(col, value) => setCell(sheet, selected, col, value)}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
