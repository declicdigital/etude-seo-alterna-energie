import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
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
  MemberAvatar,
  OrganisationCardDialog,
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
    return "Videz la colonne avant de la supprimer.";
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

  function openCard(id: string) {
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

  async function addCard(columnId: string, title: string) {
    const position = positionForDrop(cardsRef.current, "", columnId, Number.MAX_SAFE_INTEGER);
    const { data, error: err } = await supabase
      .from("org_cards")
      .insert({ column_id: columnId, title, position })
      .select(CARD_FIELDS)
      .single();
    if (err || !data) return setError(errorMessage(err));
    setCards((cs) => (cs.some((c) => c.id === data.id) ? cs : [...cs, data as OrgCard]));
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
    const title = window.prompt("Nom de la nouvelle colonne", "")?.trim();
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
      return setError("Videz la colonne avant de la supprimer.");
    if (!window.confirm(`Supprimer la colonne « ${col.title} » ?`)) return;
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-amber-500/25 bg-gradient-to-r from-amber-500/12 via-amber-500/5 to-transparent px-5 py-5 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <EditableText
              as="div"
              className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300"
              value={groupLabel}
              onCommit={onRenameGroup}
            />
            <EditableText
              as="h2"
              className="mt-1 text-2xl font-semibold tracking-tight text-amber-950 dark:text-amber-50"
              value={sheetLabel}
              onCommit={onRenameSheet}
            />
            <p className="mt-1 text-sm text-muted-foreground">
              Les fiches de l'équipe : cliquez sur une fiche pour l'ouvrir en note, glissez-la pour
              la déplacer.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void addColumn()}>
            <Plus /> Colonne
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Rechercher dans les fiches</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher dans les fiches…"
              className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-8 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>
          <div
            role="tablist"
            aria-label="Filtrer les fiches"
            className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
          >
            {(
              [
                ["all", "Toutes", cards.length],
                ["mine", "Assignées à moi", mineCount],
                ["tagged", "Où je suis tagué", taggedCount],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === key
                    ? "bg-card text-amber-800 shadow-sm dark:text-amber-200"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label} <span className="ml-0.5 tabular-nums opacity-60">{count}</span>
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded p-0.5 hover:bg-destructive/10"
              aria-label="Fermer"
            >
              <X className="size-3.5" />
            </button>
          </p>
        )}
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {loading ? (
          <div className="flex gap-4 p-5 md:px-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 w-72 shrink-0 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : (
          <div className="flex h-full snap-x snap-mandatory items-start gap-4 p-5 md:snap-none md:px-8">
            {sortedColumns.map((col, ci) => {
              const colCards = sortByPosition(visible.filter((c) => c.column_id === col.id));
              const total = cards.filter((c) => c.column_id === col.id).length;
              return (
                <BoardColumn
                  key={col.id}
                  column={col}
                  cards={colCards}
                  total={total}
                  isFirst={ci === 0}
                  isLast={ci === sortedColumns.length - 1}
                  members={byMember}
                  drag={drag}
                  setDrag={setDrag}
                  onDrop={() => onDrop(col.id)}
                  onOpen={openCard}
                  onAdd={(t) => void addCard(col.id, t)}
                  onRename={(t) => void updateColumn(col.id, { title: t.slice(0, 120) })}
                  onShift={(d) => shiftColumn(col.id, d)}
                  onDelete={() => void deleteColumn(col.id)}
                />
              );
            })}
            {!sortedColumns.length && (
              <div className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
                Aucune colonne. Ajoutez-en une pour commencer.
              </div>
            )}
            <div className="w-1 shrink-0" aria-hidden />
          </div>
        )}
      </div>

      <OrganisationCardDialog
        card={openCardData}
        columns={sortedColumns}
        members={members}
        me={me}
        open={!!openCardData}
        onClose={closeCard}
        onChange={updateCard}
        onDelete={(id) => void deleteCard(id)}
        notice={notice}
      />
    </div>
  );
}

function BoardColumn({
  column,
  cards,
  total,
  isFirst,
  isLast,
  members,
  drag,
  setDrag,
  onDrop,
  onOpen,
  onAdd,
  onRename,
  onShift,
  onDelete,
}: {
  column: OrgColumn;
  cards: OrgCard[];
  total: number;
  isFirst: boolean;
  isLast: boolean;
  members: Map<string, OrgMember>;
  drag: { id: string; column: string | null; index: number } | null;
  setDrag: (d: { id: string; column: string | null; index: number } | null) => void;
  onDrop: () => void;
  onOpen: (id: string) => void;
  onAdd: (title: string) => void;
  onRename: (title: string) => void;
  onShift: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
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

  function submit() {
    const t = draft.trim();
    if (t) onAdd(t.slice(0, 300));
    setDraft("");
  }

  const shown = cards.filter((c) => c.id !== drag?.id || !over);

  return (
    <section
      aria-label={column.title}
      className={cn(
        "flex max-h-full w-[85vw] max-w-[19rem] shrink-0 snap-start flex-col rounded-xl border bg-muted/40 transition-colors sm:w-72",
        over ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20" : "border-border",
      )}
      onDragOver={(e) => {
        if (!drag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const index = indexAt(e.clientY);
        if (drag.column !== column.id || drag.index !== index)
          setDrag({ ...drag, column: column.id, index });
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
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <EditableText
          as="h3"
          value={column.title}
          onCommit={(v) => v.trim() && onRename(v.trim())}
          className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground"
          title="Double-cliquez pour renommer"
        />
        <span className="rounded-full bg-background px-1.5 text-xs tabular-nums text-muted-foreground">
          {total}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label={`Options de la colonne ${column.title}`}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={isFirst} onSelect={() => onShift(-1)}>
              <ArrowLeft /> Déplacer à gauche
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onSelect={() => onShift(1)}>
              <ArrowRight /> Déplacer à droite
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={total > 0}
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 /> {total > 0 ? "Videz la colonne pour la supprimer" : "Supprimer la colonne"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div ref={listRef} className="flex min-h-12 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {shown.map((card, i) => (
          <div key={card.id}>
            {over && drag?.index === i && <DropMarker />}
            <CardTile
              card={card}
              members={members}
              dragging={drag?.id === card.id}
              onOpen={() => onOpen(card.id)}
              onDragStart={() => setDrag({ id: card.id, column: null, index: 0 })}
              onDragEnd={() => setDrag(null)}
            />
          </div>
        ))}
        {over && (drag?.index ?? 0) >= shown.length && <DropMarker />}
      </div>

      <div className="px-2 pb-2">
        {adding ? (
          <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
            <textarea
              autoFocus
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              placeholder="Titre de la fiche…"
              aria-label="Titre de la nouvelle fiche"
              className="w-full resize-none bg-transparent text-sm outline-none"
            />
            <div className="mt-1 flex items-center gap-1">
              <Button
                size="sm"
                className="h-7 bg-amber-600 text-white hover:bg-amber-700"
                onClick={submit}
              >
                Ajouter
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => {
                  setAdding(false);
                  setDraft("");
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <Plus className="size-4" /> Ajouter une fiche
          </button>
        )}
      </div>
    </section>
  );
}

function DropMarker() {
  return <div className="mb-2 h-1 rounded-full bg-amber-500" aria-hidden />;
}

function CardTile({
  card,
  members,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  card: OrgCard;
  members: Map<string, OrgMember>;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const due = card.due_date ? dueState(card.due_date, new Date()) : null;
  const preview = excerpt(card.content);
  const tagged = card.tagged_ids.filter((id) => id !== card.assignee_id);
  return (
    <button
      type="button"
      data-card-id={card.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={cn(
        "group w-full cursor-pointer rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-shadow hover:border-amber-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:hover:border-amber-700",
        dragging && "opacity-40",
      )}
    >
      <p className="text-sm font-medium leading-snug text-foreground">{card.title}</p>
      {preview && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{preview}</p>
      )}
      {(due || preview || card.assignee_id || tagged.length > 0) && (
        <div className="mt-2.5 flex items-center gap-2">
          {card.due_date && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
                due === "overdue"
                  ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  : due === "today" || due === "soon"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <CalendarDays className="size-3" />
              {new Date(`${card.due_date}T00:00:00`).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
          {preview && (
            <NotebookPen
              className="size-3.5 text-muted-foreground"
              aria-label="Contient une note"
            />
          )}
          <span className="ml-auto flex items-center">
            {tagged.length > 0 && (
              <span
                className="flex -space-x-1"
                title={`Tagués : ${tagged.map((id) => memberName(members.get(id))).join(", ")}`}
              >
                {tagged.slice(0, 3).map((id) => (
                  <MemberAvatar key={id} member={members.get(id)} id={id} size="sm" />
                ))}
                {tagged.length > 3 && (
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                    +{tagged.length - 3}
                  </span>
                )}
              </span>
            )}
            {card.assignee_id && (
              <MemberAvatar
                member={members.get(card.assignee_id)}
                id={card.assignee_id}
                className={cn("outline outline-2 outline-amber-500", tagged.length > 0 && "ml-1.5")}
              />
            )}
          </span>
        </div>
      )}
    </button>
  );
}
