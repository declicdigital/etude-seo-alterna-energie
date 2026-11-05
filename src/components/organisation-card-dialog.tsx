import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Columns3,
  Mail,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  avatarColour,
  dueState,
  initials,
  memberName,
  type OrgCard,
  type OrgColumn,
  type OrgMember,
} from "@/lib/organisation";

export type CardPatch = Partial<
  Pick<OrgCard, "title" | "content" | "column_id" | "assignee_id" | "tagged_ids" | "due_date">
>;

const SAVE_DELAY = 700;

export function MemberAvatar({
  member,
  id,
  size = "md",
  className,
}: {
  member: OrgMember | undefined;
  id: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      title={memberName(member)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-card",
        size === "sm" ? "size-6 text-[10px]" : "size-7 text-[11px]",
        avatarColour(id),
        className,
      )}
    >
      {initials(member)}
    </span>
  );
}

export function OrganisationCardDialog({
  card,
  columns,
  members,
  me,
  open,
  onClose,
  onChange,
  onDelete,
  notice,
}: {
  card: OrgCard | null;
  columns: OrgColumn[];
  members: OrgMember[];
  me: string | null;
  open: boolean;
  onClose: () => void;
  onChange: (id: string, patch: CardPatch) => Promise<boolean>;
  onDelete: (id: string) => void;
  notice: string | null;
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const [title, setTitle] = useState(card?.title ?? "");
  const [content, setContent] = useState(card?.content ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const cardId = card?.id ?? null;

  // A different card opened: start from its saved values.
  useEffect(() => {
    setTitle(card?.title ?? "");
    setContent(card?.content ?? "");
    dirty.current = false;
    setSaveState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  // Someone else edited this card: follow along unless I'm typing.
  useEffect(() => {
    if (!card || dirty.current) return;
    setContent(card.content);
  }, [card?.content]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (card) setTitle(card.title);
  }, [card?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // Grow the note with its text: no inner scrollbar, the dialog scrolls.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content, open]);

  async function flush() {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (!card || !dirty.current) return;
    const value = textRef.current?.value ?? content;
    setSaveState("saving");
    const ok = await onChange(card.id, { content: value });
    if (ok && (textRef.current?.value ?? value) === value) dirty.current = false;
    setSaveState(ok ? "saved" : "error");
  }

  function onContentChange(v: string) {
    setContent(v);
    dirty.current = true;
    setSaveState("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY);
  }

  function commitTitle() {
    const v = title.trim();
    if (!card) return;
    if (!v) return setTitle(card.title);
    if (v !== card.title) void onChange(card.id, { title: v });
  }

  async function close() {
    commitTitle();
    await flush();
    onClose();
  }

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!card) return null;
  const due = card.due_date ? dueState(card.due_date, new Date()) : null;
  const creator = card.created_by ? byId.get(card.created_by) : undefined;
  const editor = card.updated_by ? byId.get(card.updated_by) : undefined;
  const stamp = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) void close();
      }}
    >
      <DialogContent
        className="flex h-[100dvh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:h-[min(88vh,900px)] sm:w-[calc(100%-2rem)]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (!card.content) textRef.current?.focus();
        }}
      >
        <DialogDescription className="sr-only">
          Fiche Organisation : note, assignation et personnes taguées.
        </DialogDescription>
        <div className="border-b border-border px-5 pb-4 pt-5 pr-12 sm:px-8">
          <DialogTitle asChild>
            <textarea
              value={title}
              rows={1}
              aria-label="Titre de la fiche"
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              className="w-full resize-none bg-transparent text-xl font-semibold leading-snug tracking-tight text-foreground outline-none [field-sizing:content] sm:text-2xl"
            />
          </DialogTitle>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ColumnPicker
              columns={columns}
              value={card.column_id}
              onChange={(column_id) => void onChange(card.id, { column_id })}
            />
            <AssigneePicker
              members={members}
              me={me}
              value={card.assignee_id}
              onChange={(assignee_id) => void onChange(card.id, { assignee_id })}
            />
            <TagPicker
              members={members}
              value={card.tagged_ids}
              onChange={(tagged_ids) => void onChange(card.id, { tagged_ids })}
            />
            <label
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium",
                due === "overdue"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                  : due === "today" || due === "soon"
                    ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarDays className="size-3.5" />
              <span className="sr-only">Échéance</span>
              <input
                type="date"
                value={card.due_date ?? ""}
                onChange={(e) => void onChange(card.id, { due_date: e.target.value || null })}
                className="w-[7.5rem] bg-transparent text-xs outline-none [color-scheme:light] dark:[color-scheme:dark]"
              />
              {card.due_date && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    void onChange(card.id, { due_date: null });
                  }}
                  aria-label="Retirer l'échéance"
                  className="rounded p-0.5 hover:bg-black/5"
                >
                  <X className="size-3" />
                </button>
              )}
            </label>
          </div>
          {notice && (
            <p
              role="status"
              className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"
            >
              <Mail className="size-3.5" /> {notice}
            </p>
          )}
        </div>

        <div
          className="flex-1 overflow-y-auto px-5 py-5 sm:px-8"
          onClick={() => textRef.current?.focus()}
        >
          <textarea
            ref={textRef}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onBlur={() => void flush()}
            onClick={(e) => e.stopPropagation()}
            placeholder="Écrivez votre note : contexte, idées, liens, comptes rendus…"
            aria-label="Note"
            className="min-h-[40vh] w-full resize-none overflow-hidden bg-transparent text-[15px] leading-7 text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground sm:px-8">
          <span>
            Créée{" "}
            {creator ? (
              <>
                par <span className="font-medium text-foreground">{memberName(creator)}</span>{" "}
              </>
            ) : (
              ""
            )}
            le {stamp(card.created_at)}
          </span>
          <span>
            Modifiée{" "}
            {editor ? (
              <>
                par <span className="font-medium text-foreground">{memberName(editor)}</span>{" "}
              </>
            ) : (
              ""
            )}
            le {stamp(card.updated_at)}
          </span>
          <span className="ml-auto flex items-center gap-3">
            <span aria-live="polite" className={cn(saveState === "error" && "text-destructive")}>
              {saveState === "saving"
                ? "Enregistrement…"
                : saveState === "saved"
                  ? "Enregistré"
                  : saveState === "error"
                    ? "Échec de l'enregistrement"
                    : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(card.id)}
            >
              <Trash2 /> Supprimer
            </Button>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const pill =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=open]:ring-2 data-[state=open]:ring-amber-500/40";

function ColumnPicker({
  columns,
  value,
  onChange,
}: {
  columns: OrgColumn[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = columns.find((c) => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={pill}>
        <Columns3 className="size-3.5" />
        <span className="text-foreground">{current?.title ?? "Colonne"}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {columns.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setOpen(false);
              if (c.id !== value) onChange(c.id);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            <Check className={cn("size-4", c.id === value ? "opacity-100" : "opacity-0")} />
            {c.title}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function AssigneePicker({
  members,
  me,
  value,
  onChange,
}: {
  members: OrgMember[];
  me: string | null;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = members.find((m) => m.id === value);
  const sorted = me
    ? [...members].sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : 0))
    : members;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={pill}>
        {value ? (
          <MemberAvatar member={current} id={value} size="sm" className="-ml-1 ring-0" />
        ) : (
          <UserRound className="size-3.5" />
        )}
        <span className={cn(value && "text-foreground")}>
          {value ? memberName(current) : "Assigner"}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Rechercher une personne…" />
          <CommandList>
            <CommandEmpty>Personne avec accès à Organisation.</CommandEmpty>
            {value && (
              <CommandItem
                value="__none"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <X className="size-4" /> Retirer l'assignation
              </CommandItem>
            )}
            {sorted.map((m) => (
              <CommandItem
                key={m.id}
                value={`${memberName(m)} ${m.email}`}
                onSelect={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
              >
                <MemberAvatar member={m} id={m.id} size="sm" className="ring-0" />
                <span className="min-w-0 flex-1 truncate">
                  {memberName(m)}
                  {m.id === me && <span className="text-muted-foreground"> (moi)</span>}
                </span>
                {m.id === value && <Check className="size-4" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TagPicker({
  members,
  value,
  onChange,
}: {
  members: OrgMember[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  return (
    <Popover>
      <PopoverTrigger className={pill}>
        {value.length ? (
          <span className="-ml-1 flex -space-x-1">
            {value.slice(0, 4).map((id) => (
              <MemberAvatar key={id} member={byId.get(id)} id={id} size="sm" />
            ))}
          </span>
        ) : (
          <UserPlus className="size-3.5" />
        )}
        <span className={cn(value.length && "text-foreground")}>
          {value.length ? `${value.length} tagué${value.length > 1 ? "s" : ""}` : "Taguer"}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Taguer une personne…" />
          <CommandList>
            <CommandEmpty>Personne avec accès à Organisation.</CommandEmpty>
            {members.map((m) => {
              const on = value.includes(m.id);
              return (
                <CommandItem
                  key={m.id}
                  value={`${memberName(m)} ${m.email}`}
                  onSelect={() =>
                    onChange(on ? value.filter((id) => id !== m.id) : [...value, m.id])
                  }
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded border",
                      on
                        ? "border-amber-600 bg-amber-600 text-white"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {on && <Check className="size-3" />}
                  </span>
                  <MemberAvatar member={m} id={m.id} size="sm" className="ring-0" />
                  <span className="min-w-0 flex-1 truncate">{memberName(m)}</span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
        <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <Users className="size-3.5" /> Les personnes ajoutées sont prévenues par mail.
        </p>
      </PopoverContent>
    </Popover>
  );
}
