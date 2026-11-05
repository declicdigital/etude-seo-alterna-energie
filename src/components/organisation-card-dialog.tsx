import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Mail,
  Paperclip,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  attachmentsOf,
  avatarColour,
  dueState,
  formatSize,
  initials,
  linkify,
  linkLabel,
  memberName,
  normalizeLink,
  ORG_FILE_MAX_BYTES,
  ORG_FILES_BUCKET,
  storageName,
  type OrgAttachment,
  type OrgCard,
  type OrgColumn,
  type OrgMember,
} from "@/lib/organisation";

export type CardPatch = Partial<
  Pick<
    OrgCard,
    "title" | "content" | "column_id" | "assignee_id" | "tagged_ids" | "due_date" | "attachments"
  >
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
  // The note reads with clickable links; a click on the text switches to editing.
  const [editing, setEditing] = useState(() => !!autoFocus && !card.content);
  const files = useCardAttachments(card, me, onChange);
  const [dropping, setDropping] = useState(false);

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
  }, [content, title, editing]);

  useEffect(() => {
    const el = textRef.current;
    if (!editing || !el || document.activeElement === el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  function startEditing() {
    // Selecting text to copy it should not switch to editing.
    if (window.getSelection()?.toString()) return;
    setEditing(true);
  }

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
    <article
      className={cn(
        "relative flex min-h-full flex-col",
        dropping && "outline-dashed outline-2 -outline-offset-8 outline-amber-500/70",
      )}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDropping(false);
        void files.addFiles(Array.from(e.dataTransfer.files));
      }}
    >
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
          <dt className="self-start pt-1.5 text-muted-foreground">Fichiers et liens</dt>
          <dd className="min-w-0">
            <AttachmentList state={files} />
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

      <div className="flex-1 cursor-text px-6 pb-8 sm:px-10" onClick={startEditing}>
        {editing ? (
          <textarea
            ref={textRef}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onBlur={() => {
              void flush();
              setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Écrivez ici : contexte, décisions, liens, compte rendu…"
            aria-label="Note"
            className={cn(
              "min-h-[30vh] w-full resize-none overflow-hidden bg-transparent text-[17px] leading-[1.75] text-foreground/90 outline-none placeholder:text-muted-foreground/60",
              NOTE_FONT,
            )}
          />
        ) : (
          <div
            tabIndex={0}
            aria-label="Note, cliquer pour modifier"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target === e.currentTarget) {
                e.preventDefault();
                setEditing(true);
              }
            }}
            className={cn(
              "min-h-[30vh] whitespace-pre-wrap break-words text-[17px] leading-[1.75] text-foreground/90 outline-none",
              NOTE_FONT,
            )}
          >
            {content ? (
              linkify(content).map((part, i) =>
                part.href ? (
                  <a
                    key={i}
                    href={part.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="break-all text-amber-800 underline decoration-amber-800/30 underline-offset-2 hover:decoration-amber-800 dark:text-amber-300 dark:decoration-amber-300/40"
                  >
                    {part.text}
                  </a>
                ) : (
                  <Fragment key={i}>{part.text}</Fragment>
                ),
              )
            ) : (
              <span className="text-muted-foreground/60">
                Écrivez ici : contexte, décisions, liens, compte rendu…
              </span>
            )}
          </div>
        )}
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

type AttachmentState = ReturnType<typeof useCardAttachments>;

/** Links and files of a card: files go to the private « org-files » bucket. */
function useCardAttachments(card: OrgCard, me: string | null, onChange: NoteProps["onChange"]) {
  const items = attachmentsOf(card);
  const latest = useRef(items);
  latest.current = items;
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const save = (next: OrgAttachment[]) => onChange(card.id, { attachments: next });
  const stamp = () => ({ added_by: me, added_at: new Date().toISOString() });

  async function addLink(rawUrl: string, rawName: string): Promise<boolean> {
    const url = normalizeLink(rawUrl);
    if (!url) {
      setError("Ce lien n'est pas valide (exemple : https://exemple.fr/page).");
      return false;
    }
    setError(null);
    return save([
      ...latest.current,
      {
        id: crypto.randomUUID(),
        kind: "link",
        name: rawName.trim() || linkLabel(url),
        url,
        ...stamp(),
      },
    ]);
  }

  async function addFiles(list: File[]) {
    setError(null);
    const tooBig = list.filter((f) => f.size > ORG_FILE_MAX_BYTES);
    const ok = list.filter((f) => f.size > 0 && f.size <= ORG_FILE_MAX_BYTES);
    if (tooBig.length) {
      setError(
        `${tooBig.map((f) => `« ${f.name} »`).join(", ")} dépasse 50 Mo : partagez-le plutôt par un lien.`,
      );
    }
    if (!ok.length) return;
    setUploading((u) => [...u, ...ok.map((f) => f.name)]);
    const added: OrgAttachment[] = [];
    for (const f of ok) {
      const path = `${card.id}/${crypto.randomUUID()}-${storageName(f.name)}`;
      const { error: err } = await supabase.storage
        .from(ORG_FILES_BUCKET)
        .upload(path, f, { contentType: f.type || undefined, upsert: false });
      setUploading((u) => {
        const i = u.indexOf(f.name);
        return i < 0 ? u : [...u.slice(0, i), ...u.slice(i + 1)];
      });
      if (err) {
        setError(`« ${f.name} » n'a pas pu être envoyé. Réessayez.`);
        continue;
      }
      added.push({
        id: crypto.randomUUID(),
        kind: "file",
        name: f.name,
        path,
        size: f.size,
        mime: f.type || undefined,
        ...stamp(),
      });
    }
    if (!added.length) return;
    if (!(await save([...latest.current, ...added]))) {
      await supabase.storage.from(ORG_FILES_BUCKET).remove(added.map((a) => a.path as string));
    }
  }

  async function openFile(a: OrgAttachment, download = false) {
    if (!a.path) return;
    // Open the tab now: browsers block windows opened after an await.
    const tab = download ? null : window.open("", "_blank");
    const { data, error: err } = await supabase.storage
      .from(ORG_FILES_BUCKET)
      .createSignedUrl(a.path, 300, download ? { download: a.name } : undefined);
    if (err || !data) {
      tab?.close();
      setError(`Impossible d'ouvrir « ${a.name} ».`);
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = data.signedUrl;
    } else {
      window.location.href = data.signedUrl;
    }
  }

  async function remove(a: OrgAttachment) {
    const what = a.kind === "file" ? "le fichier" : "le lien";
    if (!window.confirm(`Retirer ${what} « ${a.name} » de la fiche ?`)) return;
    const ok = await save(latest.current.filter((x) => x.id !== a.id));
    if (ok && a.path) await supabase.storage.from(ORG_FILES_BUCKET).remove([a.path]);
  }

  return { items, uploading, error, setError, addLink, addFiles, openFile, remove };
}

function AttachmentList({ state }: { state: AttachmentState }) {
  const { items, uploading, error, setError, addLink, addFiles, openFile, remove } = state;
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const action =
    "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className="space-y-1">
      {items.length > 0 && (
        <ul className="space-y-0.5">
          {items.map((a) => {
            const Icon =
              a.kind === "link" ? Link2 : a.mime?.startsWith("image/") ? ImageIcon : FileText;
            const meta = a.kind === "link" && a.url ? linkLabel(a.url) : formatSize(a.size);
            const label = (
              <>
                <Icon className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
                <span className="min-w-0 truncate text-foreground underline decoration-foreground/20 underline-offset-2 group-hover/item:decoration-foreground/60">
                  {a.name}
                </span>
                {meta && meta !== a.name && (
                  <span className="hidden shrink-0 truncate text-xs text-muted-foreground sm:inline sm:max-w-[45%]">
                    {meta}
                  </span>
                )}
              </>
            );
            return (
              <li
                key={a.id}
                className="group/item -mx-2 flex items-center gap-1 rounded-md px-2 hover:bg-muted/70"
              >
                {a.kind === "link" ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={a.url}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1.5"
                  >
                    {label}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => void openFile(a)}
                    title={`Ouvrir ${a.name}`}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
                  >
                    {label}
                  </button>
                )}
                {a.kind === "file" && (
                  <button
                    type="button"
                    onClick={() => void openFile(a, true)}
                    aria-label={`Télécharger ${a.name}`}
                    title="Télécharger"
                    className="rounded p-1 text-muted-foreground opacity-100 hover:bg-background hover:text-foreground sm:opacity-0 sm:group-hover/item:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <Download className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(a)}
                  aria-label={`Retirer ${a.name}`}
                  title="Retirer"
                  className="rounded p-1 text-muted-foreground opacity-100 hover:bg-background hover:text-destructive sm:opacity-0 sm:group-hover/item:opacity-100 sm:focus-visible:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {uploading.map((n, i) => (
        <p key={`${n}-${i}`} className="flex items-center gap-2 py-1 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="truncate">Envoi de « {n} »…</span>
        </p>
      ))}

      {linkOpen ? (
        <form
          className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2 sm:flex-row sm:items-center"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await addLink(url, name)) {
              setUrl("");
              setName("");
              setLinkOpen(false);
            }
          }}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setLinkOpen(false)}
            placeholder="https://…"
            aria-label="Adresse du lien"
            inputMode="url"
            className="h-8 min-w-0 flex-[3] rounded-md bg-muted/60 px-2 outline-none focus:ring-2 focus:ring-amber-500/40"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setLinkOpen(false)}
            placeholder="Nom (facultatif)"
            aria-label="Nom du lien"
            className="h-8 min-w-0 flex-[2] rounded-md bg-muted/60 px-2 outline-none focus:ring-2 focus:ring-amber-500/40"
          />
          <div className="flex gap-1">
            <button
              type="submit"
              disabled={!url.trim()}
              className="h-8 rounded-md bg-foreground px-3 text-background disabled:opacity-40"
            >
              Ajouter
            </button>
            <button
              type="button"
              onClick={() => {
                setLinkOpen(false);
                setError(null);
              }}
              className="h-8 rounded-md px-2 text-muted-foreground hover:bg-muted"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="-ml-2 flex flex-wrap items-center gap-1">
          <button type="button" className={action} onClick={() => setLinkOpen(true)}>
            <Link2 className="size-4" /> Ajouter un lien
          </button>
          <button type="button" className={action} onClick={() => fileRef.current?.click()}>
            <Paperclip className="size-4" /> Joindre un fichier
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
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
