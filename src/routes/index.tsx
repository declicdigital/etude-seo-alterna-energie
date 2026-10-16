import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { getAccess, signOutAndGoToAuth } from "@/lib/access";
import { LogOut, ShieldCheck, Lock, Download } from "lucide-react";
import { downloadBackup } from "@/lib/backup";
import { Link } from "@tanstack/react-router";
import { rememberEditorialDestination, clearEditorialDestination } from "@/lib/editorial-links";

const searchSchema = z.object({
  sheet: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  ssr: false,
  head: () => ({ meta: [
    { title: "Outil contenus - Alterna Énergie" },
    { name: "description", content: "Suivi éditorial et gestion des contenus Particulier et Professionnel d’Alterna Énergie." },
    { property: "og:title", content: "Outil contenus - Alterna Énergie" },
    { property: "og:description", content: "Suivi éditorial et gestion des contenus Particulier et Professionnel d’Alterna Énergie." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: async ({ location }) => {
    rememberEditorialDestination(location.href);
    const access = await getAccess();
    if (!access.userId) throw redirect({ to: "/auth" });
    if (access.status !== "approved") throw redirect({ to: "/en-attente" });
    clearEditorialDestination();
    return { access };
  },
  component: Index,
});

function Index() {
  const { sheet: sheetParam } = Route.useSearch();
  const { access } = Route.useRouteContext();
  const navigate = useNavigate();
  const isGuide = sheetParam === "__guide";
  const sheet = isGuide
    ? "__guide"
    : sheetParam && sheetNames.includes(baseSheetOf(sheetParam))
      ? sheetParam
      : access.isAdmin ? "Structure RES" : "BLOG - ARTICLES::Particulier";
  const [selected, setSelected] = useState<number | null>(null);
  const { edits, setCell, deleteRow, loading } = useEdits();
  const { meta: metaOverrides, setMetaValue } = useMeta();
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    if (!access.isAdmin) return;
    const load = async () => {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending");
      setPendingCount(count ?? 0);
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [access.isAdmin]);

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

  const locked =
    !access.isAdmin &&
    !baseSheet.toUpperCase().startsWith("BLOG") &&
    !baseSheet.toUpperCase().startsWith("SUIVI ") &&
    !baseSheet.toUpperCase().startsWith("STRATEGIE") &&
    sheetInfo?.group !== "Stratégie édito";
  const embedSrc = isGuide ? null : embedSrcOf(sheet);
  const [pageHash, setPageHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setPageHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

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

      <div className="fixed top-2 right-3 z-50 flex items-center gap-1.5">
        {access.isAdmin && (
          <Link
            to="/demandes"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-muted"
            title="Demandes d'accès"
          >
            <ShieldCheck className="size-3.5" />
            <span className="hidden sm:inline">Demandes</span>
            {pendingCount > 0 && (
              <span className="ml-0.5 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {pendingCount}
              </span>
            )}
          </Link>
        )}
        {access.isAdmin && (
          <button
            onClick={async (e) => {
              const b = e.currentTarget;
              b.disabled = true;
              try { await downloadBackup(); } catch (err) { alert("Échec de la sauvegarde : " + (err as Error).message); }
              b.disabled = false;
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-muted disabled:opacity-50"
            title="Télécharger une sauvegarde de toutes les données"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Sauvegarde</span>
          </button>
        )}
        <button
          onClick={signOutAndGoToAuth}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-muted"
          title="Se déconnecter"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>

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

        {locked ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center">
              <Lock className="size-7 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold">Vous n'avez pas les accès pour le moment.</p>
            <p className="text-sm text-muted-foreground">Seule la section Blog est disponible.</p>
          </div>
        ) : isGuide ? (
          <GuideView
            onOpenSheet={(s) => navigate({ to: "/", search: { sheet: s } })}
          />
        ) : embedSrc ? (
          <iframe
            src={embedSrc + pageHash}
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
