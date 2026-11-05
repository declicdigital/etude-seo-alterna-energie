import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, Check, Mail, Trash2, UserPlus, UserRound, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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

/** Serif reading face for notes: system fonts only, nothing to download. */
export const NOTE_FONT =
  "font-[Charter,'Bitstream_Charter','Iowan_Old_Style','Sitka_Text',Georgia,serif]";

export function MemberAvatar({
  member,
  id,
  size = "md",
  className,
}: {
  member: OrgMember | undefined;
  id: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  return (
    <span
      title={memberName(member)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-background",
        size === "xs"
          ? "size-5 text-[9px]"
          : size === "sm"
            ? "size-6 text-[10px]"
            : "size-7 text-[11px]",
        avatarColour(id),
        className,
      )}
    >
      {initials(member)}
    </span>
  );
}

/** Status mark derived from the column's place: first = to do, last = done, between = in progress. */
export function StatusMark({
  index,
  total,
  className,
}: {
  index: number;
  total: number;
  className?: string;
}) {
  const done = total > 1 && index === total - 1;
  const started = !done && index > 0;
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
        done
          ? "border-emerald-600 bg-emerald-600 text-white"
          : started
            ? "border-amber-500"
            : "border-muted-foreground/45",
        className,
      )}
    >
      {done && <Check className="size-3" strokeWidth={3} />}
      {started && (
        <span className="absolute inset-[3px] rounded-full bg-[conic-gradient(var(--color-amber-500)_50%,transparent_0)]" />
      )}
    </span>
  );
}

type NoteProps = {
  card: OrgCard;
  columns: OrgColumn[];
  members: OrgMember[];
  me: string | null;
  onChange: (id: string, patch: CardPatch) => Promise<boolean>;
  onDelete: (id: string) => void;
  notice: string | null;
  /** Lets the parent flush the note before switching card or closing. */
  flushRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  autoFocus?: boolean;
};

/** The note itself: title, status, people, due date and free text. */
export function CardNote({
  card,
  columns,
  members,
  me,
  onChange,
  onDelete,
  notice,
  flushRef,
  autoFocus,
}: NoteProps) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Someone else edited this card: follow along unless I'm typing.
  useEffect(() => {
    if (!dirty.current) setContent(card.content);
  }, [card.content]);
  useEffect(() => {
    if (document.activeElement !== titleRef.current) setTitle(card.title);
  }, [card.title]);

  // Grow the fields with their text: the page scrolls, not the fields.
  useLayoutEffect(() => {
    for (const el of [textRef.current, titleRef.current]) {
      if (!el) continue;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [content, title]);

  useEffect(() => {
    if (autoFocus && !card.content) textRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function flush() {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    const value = textRef.current?.value ?? content;
    setSaveState("saving");
    const ok = await onChange(card.id, { content: value });
    if (ok && (textRef.current?.value ?? value) === value) dirty.current = false;
    setSaveState(ok ? "saved" : "error");
  }

  function commitTitle() {
    const v = title.trim();
    if (!v) return setTitle(card.title);
    if (v !== card.title) void onChange(card.id, { title: v });
  }

  if (flushRef) {
    flushRef.current = async () => {
      commitTitle();
      await flush();
    };
  }

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  function onContentChange(v: string) {
    setContent(v);
    dirty.current = true;
    setSaveState("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY);
  }

  const due = card.due_date ? dueState(card.due_date, new Date()) : null;
  const creator = card.created_by ? byId.get(card.created_by) : undefined;
  const editor = card.updated_by ? byId.get(card.updated_by) : undefined;
  const stamp = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <article className="flex min-h-full flex-col">
      <div className="px-6 pb-2 pt-7 sm:px-10">
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {columns.map((c, i) => {
            const on = c.id === card.column_id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => !on && void onChange(card.id, { column_id: c.id })}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors",
                  on
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <StatusMark
                  index={i}
                  total={columns.length}
                  className={cn("size-3.5", on && "border-background/70")}
                />
                {c.title}
              </button>
            );
          })}
        </div>

        <textarea
          ref={titleRef}
          value={title}
          rows={1}
          aria-label="Titre de la fiche"
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              textRef.current?.focus();
            }
          }}
          className={cn(
            "w-full resize-none overflow-hidden bg-transparent text-[1.75rem] font-semibold leading-tight tracking-[-0.01em] text-foreground outline-none sm:text-[2rem]",
            NOTE_FONT,
          )}
        />

        <dl className="mt-5 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2.5 text-sm">
          <dt className="text-muted-foreground">Responsable</dt>
          <dd>
            <AssigneePicker
              members={members}
              me={me}
              value={card.assignee_id}
              onChange={(assignee_id) => void onChange(card.id, { assignee_id })}
            />
          </dd>
          <dt className="text-muted-foreground">Avec</dt>
          <dd>
            <TagPicker
              members={members}
              value={card.tagged_ids}
              onChange={(tagged_ids) => void onChange(card.id, { tagged_ids })}
            />
          </dd>
          <dt className="text-muted-foreground">Échéance</dt>
          <dd className="flex items-center gap-2">
            <label
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 hover:bg-muted",
                due === "overdue"
                  ? "text-red-700 dark:text-red-400"
                  : due === "today" || due === "soon"
                    ? "text-amber-700 dark:text-amber-300"
                    : card.due_date
                      ? "text-foreground"
                      : "text-muted-foreground",
              )}
            >
              <CalendarDays className="size-4" />
              <span className="sr-only">Échéance</span>
              <input
                type="date"
                value={card.due_date ?? ""}
                onChange={(e) => void onChange(card.id, { due_date: e.target.value || null })}
                className="bg-transparent outline-none [color-scheme:light] dark:[color-scheme:dark]"
              />
            </label>
            {card.due_date && (
              <button
                type="button"
                onClick={() => void onChange(card.id, { due_date: null })}
                aria-label="Retirer l'échéance"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </dd>
        </dl>
        {notice && (
          <p
            role="status"
            className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"
          >
            <Mail className="size-3.5" /> {notice}
          </p>
        )}
      </div>

      <div className="mx-6 my-4 border-t border-dashed border-amber-900/15 sm:mx-10 dark:border-amber-100/15" />

      <div
        className="flex-1 cursor-text px-6 pb-8 sm:px-10"
        onClick={() => textRef.current?.focus()}
      >
        <textarea
          ref={textRef}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          onBlur={() => void flush()}
          onClick={(e) => e.stopPropagation()}
          placeholder="Écrivez ici : contexte, décisions, liens, compte rendu…"
          aria-label="Note"
          className={cn(
            "min-h-[30vh] w-full resize-none overflow-hidden bg-transparent text-[17px] leading-[1.75] text-foreground/90 outline-none placeholder:text-muted-foreground/60",
            NOTE_FONT,
          )}
        />
      </div>

      <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-6 pb-5 text-xs text-muted-foreground sm:px-10">
        <span>
          {`Créée ${creator ? `par ${memberName(creator)} ` : ""}le ${stamp(card.created_at)}`}
          {editor && card.updated_at !== card.created_at
            ? `, modifiée par ${memberName(editor)} le ${stamp(card.updated_at)}`
            : ""}
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
          <button
            type="button"
            onClick={() => onDelete(card.id)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Supprimer
          </button>
        </span>
      </footer>
    </article>
  );
}

/** Phone and tablet: the note opens full screen. */
export function OrganisationCardDialog({
  card,
  open,
  onClose,
  ...rest
}: Omit<NoteProps, "card" | "flushRef" | "autoFocus"> & {
  card: OrgCard | null;
  open: boolean;
  onClose: () => void;
}) {
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  if (!card) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={async (v) => {
        if (!v) {
          await flushRef.current?.();
          onClose();
        }
      }}
    >
      <DialogContent
        className="flex h-[100dvh] max-w-2xl flex-col gap-0 overflow-y-auto bg-background p-0 sm:h-[min(90vh,920px)]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{card.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Fiche Organisation : note, responsable et personnes associées.
        </DialogDescription>
        <CardNote key={card.id} card={card} flushRef={flushRef} autoFocus {...rest} />
      </DialogContent>
    </Dialog>
  );
}

const pickerButton =
  "inline-flex h-8 max-w-full items-center gap-2 rounded-md px-2 text-left hover:bg-muted data-[state=open]:bg-muted";

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
      <PopoverTrigger className={pickerButton}>
        {value ? (
          <>
            <MemberAvatar member={current} id={value} size="sm" className="ring-0" />
            <span className="truncate text-foreground">{memberName(current)}</span>
          </>
        ) : (
          <>
            <UserRound className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Personne</span>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Rechercher une personne…" />
          <CommandList>
            <CommandEmpty>Personne n'a accès à Organisation sous ce nom.</CommandEmpty>
            {value && (
              <CommandItem
                value="__none"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <X className="size-4" /> Retirer le responsable
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
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((id) => (
        <span
          key={id}
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-1 text-xs"
        >
          <MemberAvatar member={byId.get(id)} id={id} size="sm" className="ring-0" />
          <span className="text-foreground">{memberName(byId.get(id))}</span>
          <button
            type="button"
            onClick={() => onChange(value.filter((v) => v !== id))}
            aria-label={`Retirer ${memberName(byId.get(id))}`}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover>
        <PopoverTrigger className={cn(pickerButton, "text-muted-foreground")}>
          <UserPlus className="size-4" />
          <span>{value.length ? "Ajouter" : "Taguer quelqu'un"}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Taguer une personne…" />
            <CommandList>
              <CommandEmpty>Personne n'a accès à Organisation sous ce nom.</CommandEmpty>
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
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            Chaque personne ajoutée reçoit un mail avec le lien de la fiche.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
