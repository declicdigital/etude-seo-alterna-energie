import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditableText } from "@/components/editable-text";
import {
  CardNote,
  MemberAvatar,
  NOTE_FONT,
  OrganisationCardDialog,
  StatusMark,
  type CardPatch,
} from "@/components/organisation-card-dialog";
import type { Access } from "@/lib/access";
import { cn } from "@/lib/utils";
import {
  cardHash,
  cardIdFromHash,
  dueState,
  excerpt,
  matchesFilter,
  memberName,
  newlyInvolved,
  positionBetween,
  positionForDrop,
  sortByPosition,
  type CardFilter,
  type OrgCard,
  type OrgColumn,
  type OrgMember,
} from "@/lib/organisation";

const CARD_FIELDS =
  "id, column_id, title, content, position, assignee_id, tagged_ids, due_date, created_by, created_at, updated_by, updated_at";

function errorMessage(e: { message?: string } | null): string {
  const m = e?.message ?? "";
  if (m.includes("assignee_without_access")) return "Cette personne n'a pas accès à Organisation.";
  if (m.includes("tagged_without_access"))
    return "Une personne taguée n'a pas accès à Organisation.";
  if (m.includes("foreign key") || m.includes("violates"))
    return "Videz la section avant de la supprimer.";
  return "L'enregistrement a échoué. Vérifiez votre connexion et réessayez.";
}

async function notifyInvolved(cardId: string, involved: { assigned: string[]; tagged: string[] }) {
  if (!involved.assigned.length && !involved.tagged.length) return 0;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch("/api/public/notify-organisation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ cardId, ...involved }),
    });
    if (!res.ok) return 0;
    return ((await res.json()) as { sent?: number }).sent ?? 0;
  } catch {
    return 0;
  }
}

export function OrganisationBoard({
  access,
  hash,
  groupLabel,
  sheetLabel,
  onRenameGroup,
  onRenameSheet,
}: {
  access: Access;
  hash: string;
  groupLabel: string;
  sheetLabel: string;
  onRenameGroup: (v: string) => void;
  onRenameSheet: (v: string) => void;
}) {
  const me = access.userId;
  const [columns, setColumns] = useState<OrgColumn[]>([]);
  const [cards, setCards] = useState<OrgCard[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CardFilter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(() => cardIdFromHash(hash));
  const [notice, setNotice] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; column: string | null; index: number } | null>(
    null,
  );
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const wide = useWideScreen();
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const byMember = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const sortedColumns = useMemo(() => sortByPosition(columns), [columns]);

  const load = useCallback(async () => {
    const [cols, crds, mems] = await Promise.all([
      supabase.from("org_columns").select("id, title, position"),
      supabase.from("org_cards").select(CARD_FIELDS),
      supabase.rpc("organisation_members"),
    ]);
    if (cols.error || crds.error) {
      setError("Impossible de charger le tableau.");
    } else {
      setColumns(cols.data ?? []);
      setCards((crds.data ?? []) as OrgCard[]);
      setMembers((mems.data ?? []) as OrgMember[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    // Live updates from the rest of the team.
    const channel = supabase
      .channel("organisation-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "org_cards" }, (p) => {
        if (p.eventType === "DELETE") {
          const id = (p.old as { id?: string }).id;
          setCards((cs) => cs.filter((c) => c.id !== id));
        } else {
          const row = p.new as OrgCard;
          setCards((cs) =>
            cs.some((c) => c.id === row.id)
              ? cs.map((c) => (c.id === row.id ? row : c))
              : [...cs, row],
          );
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "org_columns" }, (p) => {
        if (p.eventType === "DELETE") {
          const id = (p.old as { id?: string }).id;
          setColumns((cs) => cs.filter((c) => c.id !== id));
        } else {
          const row = p.new as OrgColumn;
          setColumns((cs) =>
            cs.some((c) => c.id === row.id)
              ? cs.map((c) => (c.id === row.id ? row : c))
              : [...cs, row],
          );
        }
      })
      .subscribe();
    // Catch up after the tab was in the background.
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  // Links like …?sheet=ORGANISATION#card-<id> open the card.
  useEffect(() => {
    const id = cardIdFromHash(hash);
    if (id) setOpenId(id);
  }, [hash]);

  async function openCard(id: string) {
    if (id === openId) return;
    // Save what was being typed in the note we leave.
    await flushRef.current?.();
    setOpenId(id);
    setNotice(null);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${cardHash(id)}`,
    );
  }
  function closeCard() {
    setOpenId(null);
    setNotice(null);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }

  async function updateCard(id: string, patch: CardPatch): Promise<boolean> {
    const before = cardsRef.current.find((c) => c.id === id);
    if (!before) return false;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const extra: { position?: number } = {};
    if (patch.column_id && patch.column_id !== before.column_id) {
      // Moved from the note: goes to the bottom of its new column.
      extra.position = positionForDrop(
        cardsRef.current,
        id,
        patch.column_id,
        Number.MAX_SAFE_INTEGER,
      );
    }
    const { data, error: err } = await supabase
      .from("org_cards")
      .update({ ...patch, ...extra })
      .eq("id", id)
      .select(CARD_FIELDS)
      .single();
    if (err || !data) {
      setCards((cs) => cs.map((c) => (c.id === id ? before : c)));
      setError(errorMessage(err));
      return false;
    }
    setCards((cs) => cs.map((c) => (c.id === id ? (data as OrgCard) : c)));
    if ("assignee_id" in patch || "tagged_ids" in patch) {
      const involved = newlyInvolved(before, data as OrgCard, me);
      const sent = await notifyInvolved(id, involved);
      if (sent) {
        const names = [...involved.assigned, ...involved.tagged].map((p) =>
          memberName(byMember.get(p)),
        );
        setNotice(
          `${names.join(", ")} ${sent > 1 ? "ont été prévenus" : "a été prévenu(e)"} par mail.`,
        );
      }
    }
    return true;
  }

  async function addCard(columnId: string, title: string): Promise<OrgCard | null> {
    const position = positionForDrop(cardsRef.current, "", columnId, Number.MAX_SAFE_INTEGER);
    const { data, error: err } = await supabase
      .from("org_cards")
      .insert({ column_id: columnId, title, position })
      .select(CARD_FIELDS)
      .single();
    if (err || !data) {
      setError(errorMessage(err));
      return null;
    }
    setCards((cs) => (cs.some((c) => c.id === data.id) ? cs : [...cs, data as OrgCard]));
    return data as OrgCard;
  }

  async function moveCard(id: string, columnId: string, position: number) {
    const before = cardsRef.current.find((c) => c.id === id);
    if (!before || (before.column_id === columnId && before.position === position)) return;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, column_id: columnId, position } : c)));
    const { error: err } = await supabase
      .from("org_cards")
      .update({ column_id: columnId, position })
      .eq("id", id);
    if (err) {
      setCards((cs) => cs.map((c) => (c.id === id ? before : c)));
      setError(errorMessage(err));
    }
  }

  async function deleteCard(id: string) {
    const card = cardsRef.current.find((c) => c.id === id);
    if (!card || !window.confirm(`Supprimer la fiche « ${card.title} » ? Sa note sera perdue.`))
      return;
    closeCard();
    setCards((cs) => cs.filter((c) => c.id !== id));
    const { error: err } = await supabase.from("org_cards").delete().eq("id", id);
    if (err) {
      setCards((cs) => [...cs, card]);
      setError(errorMessage(err));
    }
  }

  async function addColumn() {
    const title = window
      .prompt("Nom de la nouvelle section (par exemple « En attente »)", "")
      ?.trim();
    if (!title) return;
    const last = sortedColumns[sortedColumns.length - 1];
    const { data, error: err } = await supabase
      .from("org_columns")
      .insert({
        title: title.slice(0, 120),
        position: positionBetween(last?.position ?? null, null),
      })
      .select("id, title, position")
      .single();
    if (err || !data) return setError(errorMessage(err));
    setColumns((cs) => (cs.some((c) => c.id === data.id) ? cs : [...cs, data]));
  }

  async function updateColumn(id: string, patch: Partial<Pick<OrgColumn, "title" | "position">>) {
    const before = columns.find((c) => c.id === id);
    if (!before) return;
    setColumns((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const { error: err } = await supabase.from("org_columns").update(patch).eq("id", id);
    if (err) {
      setColumns((cs) => cs.map((c) => (c.id === id ? before : c)));
      setError(errorMessage(err));
    }
  }

  function shiftColumn(id: string, dir: -1 | 1) {
    const i = sortedColumns.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sortedColumns.length) return;
    const others = sortedColumns.filter((c) => c.id !== id);
    // Insertion index among the other columns: just after (right) or before (left) the neighbour.
    const at = dir === 1 ? i + 1 : i - 1;
    void updateColumn(id, {
      position: positionBetween(others[at - 1]?.position ?? null, others[at]?.position ?? null),
    });
  }

  async function deleteColumn(id: string) {
    const col = columns.find((c) => c.id === id);
    if (!col) return;
    if (cards.some((c) => c.column_id === id))
      return setError("Videz la section avant de la supprimer.");
    if (!window.confirm(`Supprimer la section « ${col.title} » ?`)) return;
    setColumns((cs) => cs.filter((c) => c.id !== id));
    const { error: err } = await supabase.from("org_columns").delete().eq("id", id);
    if (err) {
      setColumns((cs) => [...cs, col]);
      setError(errorMessage(err));
    }
  }

  const visible = useMemo(
    () => cards.filter((c) => matchesFilter(c, filter, me, query)),
    [cards, filter, me, query],
  );
  const openCardData = cards.find((c) => c.id === openId) ?? null;
  const mineCount = cards.filter((c) => c.assignee_id === me).length;
  const taggedCount = cards.filter((c) => me && c.tagged_ids.includes(me)).length;
  const lastColumn = sortedColumns[sortedColumns.length - 1];

  function onDrop(columnId: string) {
    if (!drag) return;
    const list = sortByPosition(
      visible.filter((c) => c.column_id === columnId && c.id !== drag.id),
    );
    const i = Math.max(0, Math.min(drag.index, list.length));
    void moveCard(
      drag.id,
      columnId,
      positionBetween(list[i - 1]?.position ?? null, list[i]?.position ?? null),
    );
    setDrag(null);
  }

  /** The round mark moves a card one step forward; from the last step it starts over. */
  function advance(card: OrgCard) {
    const i = sortedColumns.findIndex((c) => c.id === card.column_id);
    const next = sortedColumns[(i + 1) % sortedColumns.length];
    if (next && next.id !== card.column_id) void updateCard(card.id, { column_id: next.id });
  }

  async function newCard() {
    const first = sortedColumns[0];
    if (!first) return;
    setFilter("all");
    setQuery("");
    const card = await addCard(first.id, "Nouvelle fiche");
    if (card) void openCard(card.id);
  }

  const noteProps = {
    columns: sortedColumns,
    members,
    me,
    onChange: updateCard,
    onDelete: (id: string) => void deleteCard(id),
    notice,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border px-5 pb-4 pt-6 md:px-8">
        <div className="min-w-0">
          <EditableText
            as="div"
            className="text-sm font-medium text-amber-700 dark:text-amber-300"
            value={groupLabel}
            onCommit={onRenameGroup}
          />
          <EditableText
            as="h2"
            className={cn("text-3xl font-semibold tracking-tight text-foreground", NOTE_FONT)}
            value={sheetLabel}
            onCommit={onRenameSheet}
          />
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Rechercher dans les fiches</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher"
              className="h-9 w-full rounded-full border border-border bg-background pl-8 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>
          <Button
            size="sm"
            className="h-9 rounded-full bg-amber-700 px-4 text-white hover:bg-amber-800"
            onClick={() => void newCard()}
          >
            <Plus /> Nouvelle fiche
          </Button>
        </div>
        <nav aria-label="Filtrer les fiches" className="-mb-4 flex w-full gap-5 text-sm">
          {(
            [
              ["all", "Toutes", cards.length],
              ["mine", "Mes fiches", mineCount],
              ["tagged", "Où je suis tagué", taggedCount],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              aria-current={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "border-b-2 pb-3 transition-colors",
                filter === key
                  ? "border-amber-600 font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label} <span className="tabular-nums text-muted-foreground">{count}</span>
            </button>
          ))}
        </nav>
      </header>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-5 py-2 text-sm text-destructive md:px-8"
        >
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto rounded p-0.5 hover:bg-destructive/10"
            aria-label="Fermer"
          >
            <X className="size-3.5" />
          </button>
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "min-h-0 overflow-y-auto",
            wide ? "w-[28rem] shrink-0 border-r border-border xl:w-[32rem]" : "flex-1",
          )}
        >
          {loading ? (
            <div className="space-y-3 p-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-muted/70" />
              ))}
            </div>
          ) : (
            <div className="pb-10">
              {sortedColumns.map((col, ci) => (
                <Section
                  key={col.id}
                  column={col}
                  index={ci}
                  total={sortedColumns.length}
                  cards={sortByPosition(visible.filter((c) => c.column_id === col.id))}
                  count={cards.filter((c) => c.column_id === col.id).length}
                  folded={folded.has(col.id)}
                  onFold={() =>
                    setFolded((f) => {
                      const n = new Set(f);
                      if (n.has(col.id)) n.delete(col.id);
                      else n.add(col.id);
                      return n;
                    })
                  }
                  members={byMember}
                  selected={openId}
                  drag={drag}
                  setDrag={setDrag}
                  onDrop={() => onDrop(col.id)}
                  onOpen={(id) => void openCard(id)}
                  onAdvance={advance}
                  onAdd={(t) => void addCard(col.id, t)}
                  onRename={(t) => void updateColumn(col.id, { title: t.slice(0, 120) })}
                  onShift={(d) => shiftColumn(col.id, d)}
                  onDelete={() => void deleteColumn(col.id)}
                  isDone={col.id === lastColumn?.id && sortedColumns.length > 1}
                />
              ))}
              <button
                type="button"
                onClick={() => void addColumn()}
                className="mx-5 mt-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground md:mx-8"
              >
                <Plus className="size-4" /> Ajouter une section
              </button>
            </div>
          )}
        </div>

        {wide && (
          <div className="min-h-0 flex-1 overflow-y-auto bg-amber-50/40 dark:bg-muted/20">
            {openCardData ? (
              <div className="mx-auto max-w-3xl">
                <CardNote
                  key={openCardData.id}
                  card={openCardData}
                  flushRef={flushRef}
                  {...noteProps}
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                <NotebookPen className="size-8 text-amber-700/40" />
                <p className={cn("max-w-xs text-lg text-muted-foreground", NOTE_FONT)}>
                  Ouvrez une fiche pour lire ou écrire sa note.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => void newCard()}
                >
                  <Plus /> Nouvelle fiche
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {!wide && (
        <OrganisationCardDialog
          card={openCardData}
          open={!!openCardData}
          onClose={closeCard}
          {...noteProps}
        />
      )}
    </div>
  );
}

/** Two panes from 1024 px; below, the note opens full screen. */
function useWideScreen() {
  const query = "(min-width: 1024px)";
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

type DragState = { id: string; column: string | null; index: number } | null;

function Section({
  column,
  index,
  total,
  cards,
  count,
  folded,
  onFold,
  members,
  selected,
  drag,
  setDrag,
  onDrop,
  onOpen,
  onAdvance,
  onAdd,
  onRename,
  onShift,
  onDelete,
  isDone,
}: {
  column: OrgColumn;
  index: number;
  total: number;
  cards: OrgCard[];
  count: number;
  folded: boolean;
  onFold: () => void;
  members: Map<string, OrgMember>;
  selected: string | null;
  drag: DragState;
  setDrag: (d: DragState) => void;
  onDrop: () => void;
  onOpen: (id: string) => void;
  onAdvance: (card: OrgCard) => void;
  onAdd: (title: string) => void;
  onRename: (title: string) => void;
  onShift: (dir: -1 | 1) => void;
  onDelete: () => void;
  isDone: boolean;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const over = drag?.column === column.id;

  function indexAt(clientY: number): number {
    const items = [
      ...(listRef.current?.querySelectorAll<HTMLElement>("[data-card-id]") ?? []),
    ].filter((el) => el.dataset.cardId !== drag?.id);
    const i = items.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return clientY < r.top + r.height / 2;
    });
    return i === -1 ? items.length : i;
  }

  const shown = cards.filter((c) => c.id !== drag?.id || !over);

  return (
    <section
      aria-label={column.title}
      className={cn(
        "mt-6 transition-colors first:mt-4",
        over && "bg-amber-50/70 dark:bg-amber-950/20",
      )}
      onDragOver={(e) => {
        if (!drag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const i = folded ? count : indexAt(e.clientY);
        if (drag.column !== column.id || drag.index !== i)
          setDrag({ ...drag, column: column.id, index: i });
      }}
      onDragLeave={(e) => {
        if (drag?.column === column.id && !e.currentTarget.contains(e.relatedTarget as Node)) {
          setDrag({ ...drag, column: null });
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <div className="group/head flex items-center gap-2 px-5 md:px-8">
        <button
          type="button"
          onClick={onFold}
          aria-expanded={!folded}
          aria-label={folded ? `Afficher ${column.title}` : `Replier ${column.title}`}
          className="-ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className={cn("size-4 transition-transform", folded && "-rotate-90")} />
        </button>
        <StatusMark index={index} total={total} className="size-4" />
        <EditableText
          as="h3"
          value={column.title}
          onCommit={(v) => v.trim() && onRename(v.trim())}
          className={cn("min-w-0 truncate text-[1.05rem] font-semibold text-foreground", NOTE_FONT)}
          title="Double-cliquez pour renommer"
        />
        <span className="text-sm tabular-nums text-muted-foreground">{count}</span>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="ml-auto rounded-md p-1 text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground group-hover/head:opacity-100 focus-visible:opacity-100"
            aria-label={`Options de la section ${column.title}`}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={index === 0} onSelect={() => onShift(-1)}>
              <ArrowUp /> Monter
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === total - 1} onSelect={() => onShift(1)}>
              <ArrowDown /> Descendre
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={count > 0}
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 /> {count > 0 ? "Videz la section pour la supprimer" : "Supprimer la section"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!folded && (
        <>
          <ul ref={listRef} className="mt-2">
            {shown.map((card, i) => (
              <li key={card.id}>
                {over && drag?.index === i && <DropMarker />}
                <CardRow
                  card={card}
                  index={index}
                  total={total}
                  members={members}
                  selected={selected === card.id}
                  done={isDone}
                  dragging={drag?.id === card.id}
                  onOpen={() => onOpen(card.id)}
                  onAdvance={() => onAdvance(card)}
                  onDragStart={() => setDrag({ id: card.id, column: null, index: 0 })}
                  onDragEnd={() => setDrag(null)}
                />
              </li>
            ))}
            {over && (drag?.index ?? 0) >= shown.length && <DropMarker />}
          </ul>
          <form
            className="flex items-center gap-3 px-5 py-1.5 md:px-8"
            onSubmit={(e) => {
              e.preventDefault();
              const t = draft.trim();
              if (t) onAdd(t.slice(0, 300));
              setDraft("");
            }}
          >
            <Plus className="ml-0.5 size-4 shrink-0 text-muted-foreground/70" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setDraft("")}
              placeholder="Ajouter une fiche"
              aria-label={`Ajouter une fiche dans ${column.title}`}
              className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </form>
        </>
      )}
    </section>
  );
}

function DropMarker() {
  return <div className="mx-5 h-0.5 rounded-full bg-amber-500 md:mx-8" aria-hidden />;
}

function CardRow({
  card,
  index,
  total,
  members,
  selected,
  done,
  dragging,
  onOpen,
  onAdvance,
  onDragStart,
  onDragEnd,
}: {
  card: OrgCard;
  index: number;
  total: number;
  members: Map<string, OrgMember>;
  selected: boolean;
  done: boolean;
  dragging: boolean;
  onOpen: () => void;
  onAdvance: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const due = card.due_date ? dueState(card.due_date, new Date()) : null;
  const preview = excerpt(card.content, 90);
  const people = [
    card.assignee_id,
    ...card.tagged_ids.filter((id) => id !== card.assignee_id),
  ].filter((id): id is string => !!id);
  return (
    <div
      data-card-id={card.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative flex items-start gap-3 px-5 py-2.5 transition-colors md:px-8",
        selected ? "bg-amber-100/60 dark:bg-amber-900/25" : "hover:bg-muted/60",
        dragging && "opacity-40",
      )}
    >
      {selected && (
        <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-amber-600" aria-hidden />
      )}
      <button
        type="button"
        onClick={onAdvance}
        title="Passer à l'étape suivante"
        aria-label={`Faire avancer « ${card.title} »`}
        className="mt-0.5 rounded-full p-0.5 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
      >
        <StatusMark index={index} total={total} />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left focus-visible:outline-none"
      >
        <span
          className={cn(
            "block text-[15px] leading-snug",
            done
              ? "text-muted-foreground line-through decoration-muted-foreground/40"
              : "text-foreground",
          )}
        >
          {card.title}
        </span>
        {(preview || card.due_date) && (
          <span className="mt-0.5 flex items-baseline gap-2 text-[13px] text-muted-foreground">
            {card.due_date && (
              <span
                className={cn(
                  "shrink-0 tabular-nums",
                  !done && due === "overdue" && "font-medium text-red-600 dark:text-red-400",
                  !done &&
                    (due === "today" || due === "soon") &&
                    "font-medium text-amber-700 dark:text-amber-300",
                )}
              >
                {due === "today"
                  ? "Aujourd'hui"
                  : new Date(`${card.due_date}T00:00:00`).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })}
              </span>
            )}
            {preview && <span className="truncate">{preview}</span>}
          </span>
        )}
      </button>
      {people.length > 0 && (
        <span
          className="mt-0.5 flex shrink-0 -space-x-0.5"
          title={people.map((id) => memberName(members.get(id))).join(", ")}
        >
          {people.slice(0, 3).map((id) => (
            <MemberAvatar key={id} member={members.get(id)} id={id} size="xs" />
          ))}
          {people.length > 3 && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-background">
              +{people.length - 3}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
