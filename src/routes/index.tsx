import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SheetSidebar } from "@/components/sheet-sidebar";
import { TreeView } from "@/components/tree-view";
import { TableView } from "@/components/table-view";
import { DetailPanel } from "@/components/detail-panel";
import { useEdits } from "@/lib/use-edits";
import { isStructureSheet, nextRowId, SHEET_META, sheetNames } from "@/lib/workbook";

const searchSchema = z.object({
  sheet: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  component: Index,
});

function Index() {
  const { sheet: sheetParam } = Route.useSearch();
  const sheet = sheetParam && sheetNames.includes(sheetParam) ? sheetParam : "Structure RES";
  const [selected, setSelected] = useState<number | null>(null);
  const { edits, setCell, loading } = useEdits();

  // reset selection when switching sheet
  const [lastSheet, setLastSheet] = useState(sheet);
  if (sheet !== lastSheet) {
    setLastSheet(sheet);
    setSelected(null);
  }

  const meta = SHEET_META[sheet];

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
      <SheetSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="px-8 py-6 border-b border-border bg-card/30">
          <div className="text-[11px] uppercase tracking-widest text-primary/80 font-semibold">
            {meta?.group ?? "Feuille"}
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {meta?.label ?? sheet}
          </h2>
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
            ) : (
              <TableView
                sheet={sheet}
                edits={edits}
                selected={selected}
                onSelect={setSelected}
                onAddRow={() => handleAddRow(0)}
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
