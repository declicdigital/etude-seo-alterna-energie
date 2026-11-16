import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  ImagePlus,
  MessageSquare,
  Paperclip,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Access } from "@/lib/access";
import {
  canDeleteFaqItem,
  canModerateFaq,
  canValidateFaq,
  canValidateFaqRequests,
  faqNeedsCategory,
  faqStatus,
  validatedFaqForTarget,
  faqCategories,
  matchFaqCategory,
  FAQ_CHANNELS,
  type FaqAttachment,
  type FaqComment,
  type FaqRequest,
} from "@/lib/faq";
import { FaqAttachmentList } from "@/components/faq-files";
import { removeFaqFiles, uploadFaqFile } from "@/lib/faq-files";
import existingFaq from "@/data/faq-existing.json";

type User = { id: string; full_name: string | null; email: string };

const NEW_CAT = "__new__";
const KEY_PREFIX = "faq:";

async function loadRequests(): Promise<FaqRequest[]> {
  const { data } = await supabase
    .from("editorial_kv")
    .select("key, value")
    .like("key", `${KEY_PREFIX}%`);
  const out: FaqRequest[] = [];
  for (const r of data ?? []) {
    try {
      out.push(JSON.parse(r.value) as FaqRequest);
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function saveRequest(r: FaqRequest) {
  const { error } = await supabase.from("editorial_kv").upsert({
    key: KEY_PREFIX + r.id,
    value: JSON.stringify(r),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

function mentionedIn(text: string, users: User[]): string[] {
  return users
    .filter((u) => {
      const n = (u.full_name || u.email.split("@")[0]).toLowerCase();
      const t = text.toLowerCase();
      return t.includes("@" + n) || t.includes("@" + u.email.toLowerCase());
    })
    .map((u) => u.email);
}

async function notify(body: Record<string, unknown>) {
  try {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const r = await fetch("/api/public/notify-faq", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) alert("La demande est enregistrée, mais le mail n'a pas pu partir.");
  } catch {
    alert("La demande est enregistrée, mais le mail n'a pas pu partir.");
  }
}

export function FaqView({
  access,
  scope,
  hash,
}: {
  access: Access;
  scope: string | null;
  hash: string;
}) {
  const [requests, setRequests] = useState<FaqRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => setRequests(await loadRequests());
  useEffect(() => {
    Promise.all([
      reload(),
      supabase.rpc("approved_users").then(({ data }) => setUsers((data ?? []) as User[])),
    ]).finally(() => setLoading(false));
  }, []);

  const me = users.find((u) => u.email.toLowerCase() === (access.email ?? "").toLowerCase());
  const myName = me?.full_name || access.email || "";

  const target = scope?.toLowerCase().startsWith("pro")
    ? "Professionnel"
    : scope
      ? "Particulier"
      : null;
  const list = requests;
  const focusId = hash.startsWith("#faq-") ? decodeURIComponent(hash.slice(5)) : null;

  useEffect(() => {
    if (!focusId || loading) return;
    document
      .getElementById(`faq-${focusId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, loading, requests.length]);

  const update = async (r: FaqRequest) => {
    await saveRequest(r);
    setRequests((prev) => prev.map((x) => (x.id === r.id ? r : x)));
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-5 md:px-8 py-6 border-b bg-gradient-to-r from-teal-500/15 via-teal-500/5 to-transparent border-teal-500/30">
        <div className="text-[11px] uppercase tracking-widest font-semibold text-teal-700">FAQ</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-teal-900">
          {target ? `FAQ — ${target}` : "Demande"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {target
            ? `Questions FAQ — ${target.toLowerCase()}.`
            : "Remplissez une demande, puis sauvegardez : Geoffrey est prévenu par mail. Geoffrey, Matthieu et Marick la valident."}
        </p>
      </header>

      <div className="p-5 md:p-8 space-y-6 max-w-5xl">
        {!target && (
          <NewRequestForm
            categories={faqCategories(requests)}
            myName={myName}
            myEmail={access.email ?? ""}
            users={users}
            onSaved={async (r) => {
              await saveRequest(r);
              setRequests((prev) => [r, ...prev]);
              const comment = r.comments[0];
              await notify({
                kind: "new",
                id: r.id,
                request: summary(r),
                message: comment?.body ?? "",
              });
              if (comment?.mentions.length) {
                await notify({
                  kind: "mention",
                  id: r.id,
                  request: summary(r),
                  message: comment.body,
                  mentions: comment.mentions,
                  authorName: myName,
                });
              }
            }}
          />
        )}

        {!target && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {loading ? "Chargement…" : `${list.length} demande${list.length > 1 ? "s" : ""}`}
            </h3>
            {list.map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                focused={r.id === focusId}
                users={users}
                myName={myName}
                myEmail={access.email ?? ""}
                canValidate={canValidateFaqRequests(access.isAdmin, access.email)}
                canModerate={canModerateFaq(access.isAdmin, access.email)}
                userId={access.userId}
                onUpdate={update}
                onDelete={async () => {
                  if (!confirm("Supprimer définitivement cette demande ?")) return;
                  setRequests((prev) => prev.filter((x) => x.id !== r.id));
                  await supabase
                    .from("editorial_kv")
                    .delete()
                    .eq("key", KEY_PREFIX + r.id);
                  void removeFaqFiles([
                    ...(r.files ?? []),
                    ...r.comments.flatMap((c) => c.attachments ?? []),
                  ]).catch(() => {});
                }}
              />
            ))}
            {!loading && list.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Aucune demande pour le moment.</p>
            )}
          </section>
        )}
        {target && <ExistingFaq target={target} requests={requests} />}
      </div>
    </div>
  );
}

type ExistingQ = { target: string; category: string; sub: string; question: string; link: string };

function ExistingFaq({ target, requests }: { target: string; requests: FaqRequest[] }) {
  const validated = validatedFaqForTarget(requests, target);
  const rows = (existingFaq as ExistingQ[]).filter((q) => q.target === target);
  const groups = new Map<string, ExistingQ[]>();
  for (const q of rows) {
    const k = q.sub ? `${q.category} · ${q.sub}` : q.category;
    groups.set(k, [...(groups.get(k) ?? []), q]);
  }
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        FAQ en ligne · {rows.length + validated.length} questions
      </h3>
      {validated.length > 0 && (
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3">Question</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Lien</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {validated.map((r) => (
                <tr key={r.id} id={`faq-${r.id}`}>
                  <td className="px-4 py-3 font-medium">{r.question}</td>
                  <td className="px-4 py-3">{r.category}</td>
                  <td className="px-4 py-3">
                    <Button asChild variant="link" size="sm">
                      <a href={r.link} target="_blank" rel="noreferrer">
                        Voir ↗
                      </a>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {[...groups].map(([cat, qs]) => (
        <div key={cat} className="rounded-xl border bg-card">
          <div className="px-4 py-2 border-b text-xs font-semibold uppercase tracking-wider text-teal-700">
            {cat}
          </div>
          <ul className="divide-y">
            {qs.map((q) => (
              <li
                key={q.question}
                className="px-4 py-2 text-sm flex items-center justify-between gap-3"
              >
                <span>{q.question}</span>
                {q.link && (
                  <a
                    href={q.link}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-teal-700 hover:underline text-xs"
                  >
                    Voir ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function summary(r: FaqRequest) {
  return {
    subject: r.subject,
    requester: r.requester,
    type: r.type,
    content: r.content,
    category: r.category,
    target: r.target,
    channel: r.channel ?? "",
  };
}

const field =
  "w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const label =
  "text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 block";

function Choice({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
            value === o
              ? "bg-primary text-primary-foreground border-primary"
              : "border-input hover:bg-muted",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function NewRequestForm({
  categories,
  myName,
  myEmail,
  users,
  onSaved,
}: {
  /** Catégories de base + nouvelles catégories gardées par Geoffrey ou Matthieu. */
  categories: string[];
  myName: string;
  myEmail: string;
  users: User[];
  onSaved: (r: FaqRequest) => Promise<void>;
}) {
  const [type, setType] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [target, setTarget] = useState("");
  const [channel, setChannel] = useState("");
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<FaqAttachment[]>([]);
  const [saving, setSaving] = useState(false);

  const needsCategory = faqNeedsCategory(channel);
  // Une « nouvelle » catégorie déjà connue (casse ou accents près) reprend son orthographe.
  const typedKnown = category === NEW_CAT ? matchFaqCategory(newCategory, categories) : null;
  const finalCategory = needsCategory
    ? category === NEW_CAT
      ? (typedKnown ?? newCategory.trim().replace(/\s+/g, " "))
      : category
    : "";
  const contentReady = content !== "Contenu déjà fourni" || (question.trim() && answer.trim());
  const ready = !!(
    type &&
    subject.trim() &&
    content &&
    contentReady &&
    target &&
    channel &&
    (!needsCategory || finalCategory)
  );

  const submit = async () => {
    if (!ready || saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const comments: FaqComment[] =
      comment.trim() || files.length
        ? [
            {
              id: crypto.randomUUID(),
              authorName: myName,
              authorEmail: myEmail,
              body: comment.trim(),
              mentions: mentionedIn(comment, users),
              attachments: files,
              createdAt: now,
            },
          ]
        : [];
    const r: FaqRequest = {
      id: crypto.randomUUID().slice(0, 8),
      requester: myName,
      requesterEmail: myEmail,
      type,
      subject: subject.trim(),
      content,
      question: content === "Contenu déjà fourni" && question.trim() ? question.trim() : undefined,
      answer: content === "Contenu déjà fourni" && answer.trim() ? answer.trim() : undefined,
      target,
      channel,
      category: finalCategory,
      newCategory: needsCategory && category === NEW_CAT && !typedKnown,
      comments,
      createdAt: now,
    };
    try {
      await onSaved(r);
      setType("");
      setSubject("");
      setContent("");
      setQuestion("");
      setAnswer("");
      setTarget("");
      setChannel("");
      setCategory("");
      setNewCategory("");
      setComment("");
      setFiles([]);
    } catch (e) {
      alert("Échec de l'enregistrement : " + (e as Error).message);
    }
    setSaving(false);
  };

  return (
    <section className="rounded-xl border border-teal-500/30 bg-card shadow-sm p-5 space-y-5">
      <h3 className="text-base font-semibold">Nouvelle demande FAQ</h3>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <span className={label}>Demandeur</span>
          <div className="h-10 flex items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
            {myName || "…"}
          </div>
        </div>
        <div>
          <span className={label}>Création ou réécriture</span>
          <Choice value={type} options={["Création", "Réécriture"]} onChange={setType} />
        </div>
        <div className="md:col-span-2">
          <span className={label}>Sujet</span>
          <input
            className={field}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex. : Comment résilier mon contrat ?"
          />
        </div>
        <div>
          <span className={label}>Contenu</span>
          <Choice
            value={content}
            options={["À créer", "Contenu déjà fourni"]}
            onChange={setContent}
          />
        </div>
        {content === "Contenu déjà fourni" && (
          <div className="md:col-span-2 rounded-lg border border-teal-500/30 bg-teal-500/5 p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-teal-800">
              Contenu fourni
            </div>
            <div>
              <span className={label}>Question</span>
              <textarea
                autoFocus
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="La question exacte telle qu'elle apparaîtra dans la FAQ"
              />
            </div>
            <div>
              <span className={label}>Réponse</span>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={5}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="La réponse rédigée à afficher dans la FAQ"
              />
            </div>
          </div>
        )}
        <div>
          <span className={label}>Cible</span>
          <Choice value={target} options={["Particulier", "Professionnel"]} onChange={setTarget} />
        </div>
        <div>
          <span className={label}>Zendesk ou Site Web</span>
          <Choice value={channel} options={FAQ_CHANNELS} onChange={setChannel} />
        </div>
        {needsCategory && (
          <div className="md:col-span-2">
            <span className={label}>Catégorie</span>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    category === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input hover:bg-muted",
                  )}
                >
                  {c}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCategory(NEW_CAT)}
                className={cn(
                  "rounded-full border border-dashed px-3.5 py-1.5 text-sm transition-colors",
                  category === NEW_CAT
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input hover:bg-muted",
                )}
              >
                + Nouvelle catégorie
              </button>
            </div>
            {category === NEW_CAT && (
              <input
                autoFocus
                className={cn(field, "mt-2")}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nom de la nouvelle catégorie"
              />
            )}
            {category === NEW_CAT && typedKnown && (
              <p className="mt-1 text-xs text-muted-foreground">
                Cette catégorie existe déjà : la demande sera classée dans « {typedKnown} ».
              </p>
            )}
          </div>
        )}
        <div className="md:col-span-2">
          <span className={label}>Commentaire</span>
          <CommentInput
            value={comment}
            onChange={setComment}
            files={files}
            onFiles={setFiles}
            users={users}
            author={{ name: myName, email: myEmail }}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={!ready || saving}
          title={ready ? "" : "Remplissez toutes les cases avant de sauvegarder"}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="size-4" /> {saving ? "Sauvegarde…" : "Sauvegarder"}
        </button>
      </div>
    </section>
  );
}

function CommentInput({
  value,
  onChange,
  files,
  onFiles,
  users,
  onSubmit,
  author,
}: {
  value: string;
  onChange: (v: string) => void;
  files: FaqAttachment[];
  onFiles: (f: FaqAttachment[]) => void;
  users: User[];
  onSubmit?: () => void;
  /** Qui ajoute les pièces jointes (elles partent tout de suite dans le stockage privé). */
  author: { name: string; email: string };
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const matches = useMemo(() => {
    if (query == null) return [];
    const q = query.toLowerCase();
    return users
      .filter(
        (u) => (u.full_name || "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, users]);

  const onText = (v: string) => {
    onChange(v);
    const pos = ref.current?.selectionStart ?? v.length;
    const m = /@([^\s@]*)$/.exec(v.slice(0, pos));
    setQuery(m ? m[1] : null);
  };

  const pick = (u: User) => {
    const el = ref.current;
    const pos = el?.selectionStart ?? value.length;
    const before = value
      .slice(0, pos)
      .replace(/@([^\s@]*)$/, "@" + (u.full_name || u.email.split("@")[0]) + " ");
    onChange(before + value.slice(pos));
    setQuery(null);
    setTimeout(() => el?.focus(), 0);
  };

  const [uploading, setUploading] = useState(0);
  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    const picked = [...list];
    setUploading((n) => n + picked.length);
    const done: FaqAttachment[] = [];
    for (const f of picked) {
      try {
        done.push(await uploadFaqFile(f, author));
      } catch (e) {
        alert(e instanceof Error ? e.message : "La pièce jointe n'a pas pu être envoyée.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (done.length) onFiles([...files, ...done]);
  };

  return (
    <div
      className={cn(
        "relative rounded-md border border-input bg-background",
        drag && "ring-2 ring-primary",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        add(e.dataTransfer.files);
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (query != null && matches.length && e.key === "Enter") {
            e.preventDefault();
            pick(matches[0]);
          } else if (onSubmit && e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={3}
        placeholder="Écrivez un commentaire… tapez @ pour taguer quelqu'un"
        className="w-full resize-y rounded-md bg-transparent px-3 py-2 text-sm focus:outline-none"
      />
      {query != null && matches.length > 0 && (
        <div className="absolute z-20 left-2 top-full mt-1 w-72 rounded-md border bg-popover shadow-lg overflow-hidden">
          {matches.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(u);
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-muted"
            >
              {u.full_name || u.email}
              <span className="block text-xs text-muted-foreground">{u.email}</span>
            </button>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {files.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
            >
              <Paperclip className="size-3" /> {f.name}
              <button
                type="button"
                onClick={() => {
                  onFiles(files.filter((_, j) => j !== i));
                  void removeFaqFiles([f]).catch(() => {});
                }}
                aria-label="Retirer"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between border-t px-2 py-1.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ImagePlus className="size-3.5" />{" "}
          {uploading
            ? `Envoi de ${uploading} fichier${uploading > 1 ? "s" : ""}…`
            : "Ajouter une pièce jointe (ou glisser-déposer)"}
        </button>
        {onSubmit && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={uploading > 0}
            className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Envoyer
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function RequestCard({
  r,
  focused,
  users,
  myName,
  myEmail,
  onUpdate,
  onDelete,
  canValidate,
  canModerate,
  userId,
}: {
  r: FaqRequest;
  focused: boolean;
  users: User[];
  myName: string;
  myEmail: string;
  canValidate: boolean;
  /** Geoffrey et Matthieu : suppriment les commentaires et pièces jointes de n'importe qui. */
  canModerate: boolean;
  userId: string | null;
  onUpdate: (r: FaqRequest) => Promise<void>;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(focused);
  const status = faqStatus(r);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(0);
  const canDelete = (email?: string) => canDeleteFaqItem(email, myEmail, canModerate);
  // Confirmations et erreurs affichées dans Digicom (les fenêtres du navigateur peuvent être
  // bloquées : on cliquait alors sur « Supprimer » sans que rien ne se passe).
  const [ask, setAsk] = useState<{ title: string; run: () => Promise<void>; error: string } | null>(
    null,
  );
  const [cardError, setCardError] = useState<string | null>(null);
  const safely = async (fn: () => Promise<void>, error: string) => {
    if (busy) return;
    setBusy(true);
    setCardError(null);
    try {
      await fn();
    } catch {
      setCardError(error);
    } finally {
      setBusy(false);
    }
  };
  const approve = () =>
    safely(
      () =>
        onUpdate({
          ...r,
          approvedAt: new Date().toISOString(),
          approvedBy: userId ?? undefined,
          approvedByName: myName,
          // Validée par Geoffrey ou Matthieu : la nouvelle catégorie est gardée pour la suite.
          ...(r.newCategory && canModerate && !r.categoryAcceptedAt
            ? { categoryAcceptedAt: new Date().toISOString() }
            : {}),
        }),
      "La validation a échoué. Réessayez.",
    );
  const unapprove = () =>
    safely(
      () =>
        onUpdate({ ...r, approvedAt: undefined, approvedBy: undefined, approvedByName: undefined }),
      "L'annulation a échoué. Réessayez.",
    );
  const keepCategory = () =>
    safely(
      () => onUpdate({ ...r, categoryAcceptedAt: new Date().toISOString() }),
      "La catégorie n'a pas pu être ajoutée. Réessayez.",
    );
  const deleteComment = (c: FaqComment) =>
    setAsk({
      title: "Supprimer ce commentaire ?",
      error: "Le commentaire n'a pas pu être supprimé. Réessayez.",
      run: async () => {
        await onUpdate({ ...r, comments: r.comments.filter((x) => x.id !== c.id) });
        void removeFaqFiles(c.attachments ?? []).catch(() => {});
      },
    });
  const deleteFile = (f: FaqAttachment) =>
    setAsk({
      title: `Supprimer la pièce jointe « ${f.name} » ?`,
      error: "La pièce jointe n'a pas pu être supprimée. Réessayez.",
      run: async () => {
        await onUpdate({
          ...r,
          files: (r.files ?? []).filter((x) => x !== f && (!f.id || x.id !== f.id)),
        });
        void removeFaqFiles([f]).catch(() => {});
      },
    });
  const deleteCommentFile = (c: FaqComment, f: FaqAttachment) =>
    setAsk({
      title: `Supprimer la pièce jointe « ${f.name} » ?`,
      error: "La pièce jointe n'a pas pu être supprimée. Réessayez.",
      run: async () => {
        await onUpdate({
          ...r,
          comments: r.comments.map((x) =>
            x.id === c.id ? { ...x, attachments: x.attachments.filter((a) => a !== f) } : x,
          ),
        });
        void removeFaqFiles([f]).catch(() => {});
      },
    });
  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const picked = [...list];
    setAdding(picked.length);
    const done: FaqAttachment[] = [];
    for (const f of picked) {
      try {
        done.push(await uploadFaqFile(f, { name: myName, email: myEmail }));
      } catch (e) {
        setCardError(e instanceof Error ? e.message : "La pièce jointe n'a pas pu être envoyée.");
      }
    }
    setAdding(0);
    if (done.length) {
      try {
        await onUpdate({ ...r, files: [...(r.files ?? []), ...done] });
      } catch {
        setCardError("Les pièces jointes n'ont pas pu être ajoutées à la demande.");
        void removeFaqFiles(done).catch(() => {});
      }
    }
  };
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FaqAttachment[]>([]);
  const pro = r.target === "Professionnel";
  const published = status === "realisee";
  const [finalQuestion, setFinalQuestion] = useState(r.question ?? "");
  const [link, setLink] = useState(r.link ?? "");
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [linkSaved, setLinkSaved] = useState(false);
  const saveLink = async () => {
    if (!canValidate || validating) return;
    const clean = link.trim();
    if (clean && !/^https?:\/\/\S+$/i.test(clean)) {
      setValidationError("Le lien doit commencer par https://");
      return;
    }
    setValidating(true);
    setValidationError("");
    try {
      await onUpdate({
        ...r,
        question: r.validatedAt ? r.question : finalQuestion.trim() || r.question,
        link: clean || undefined,
      });
      setLinkSaved(true);
      window.setTimeout(() => setLinkSaved(false), 2500);
    } catch {
      setValidationError("Le lien n'a pas pu être enregistré. Réessayez.");
    } finally {
      setValidating(false);
    }
  };
  const validate = async () => {
    if (!canValidate || !userId || validating || !canValidateFaq(finalQuestion, link)) return;
    setValidating(true);
    setValidationError("");
    try {
      const now = new Date().toISOString();
      await onUpdate({
        ...r,
        question: finalQuestion.trim(),
        link: link.trim(),
        validatedAt: now,
        validatedBy: userId,
        // Réalisée implique validée.
        approvedAt: r.approvedAt ?? now,
        approvedBy: r.approvedBy ?? userId,
        approvedByName: r.approvedByName ?? myName,
        ...(r.newCategory && canModerate && !r.categoryAcceptedAt
          ? { categoryAcceptedAt: now }
          : {}),
      });
    } catch {
      setValidationError("L'enregistrement a échoué. Réessayez.");
    } finally {
      setValidating(false);
    }
  };

  const send = async () => {
    if (!text.trim() && !files.length) return;
    const c: FaqComment = {
      id: crypto.randomUUID(),
      authorName: myName,
      authorEmail: myEmail,
      body: text.trim(),
      mentions: mentionedIn(text, users),
      attachments: files,
      createdAt: new Date().toISOString(),
    };
    setText("");
    setFiles([]);
    await onUpdate({ ...r, comments: [...r.comments, c] });
    if (c.mentions.length)
      await notify({
        kind: "mention",
        id: r.id,
        request: summary(r),
        message: c.body,
        mentions: c.mentions,
        authorName: myName,
      });
  };

  return (
    <article
      id={`faq-${r.id}`}
      className={cn(
        "rounded-xl border border-l-4 shadow-sm",
        published
          ? "border-emerald-500/50 bg-emerald-500/10 border-l-emerald-600"
          : pro
            ? "bg-card border-l-blue-500"
            : "bg-card border-l-pink-500",
        focused && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5 text-[11px] font-semibold">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 uppercase tracking-wider ring-1",
                pro
                  ? "bg-blue-500/15 text-blue-700 ring-blue-500/40"
                  : "bg-pink-500/15 text-pink-700 ring-pink-500/40",
              )}
            >
              {pro ? "Pro" : "Part."}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5",
                status === "realisee"
                  ? "bg-emerald-600 text-white"
                  : status === "validee"
                    ? "bg-sky-500/20 text-sky-900 ring-1 ring-sky-500/50"
                    : "bg-amber-400/25 text-amber-900 ring-1 ring-amber-500/50",
              )}
            >
              {status === "realisee"
                ? "✓ Réalisée"
                : status === "validee"
                  ? "Validée · à réaliser"
                  : "En cours"}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5">{r.type}</span>
            <span className="rounded-full bg-muted px-2 py-0.5">{r.content}</span>
            {r.channel && (
              <span className="rounded-full bg-indigo-500/15 text-indigo-800 px-2 py-0.5">
                {r.channel}
              </span>
            )}
            {r.category && (
              <span className="rounded-full bg-teal-500/15 text-teal-800 px-2 py-0.5">
                {r.category}
                {r.newCategory && !r.categoryAcceptedAt ? " (nouvelle)" : ""}
              </span>
            )}
          </div>
          <h4 className="font-semibold leading-snug">{r.subject}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Demandé par {r.requester} · {new Date(r.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="size-3.5" /> {r.comments.length}
        </span>
        {(r.files?.length ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Paperclip className="size-3.5" /> {r.files!.length}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="size-8 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex items-center justify-center"
          aria-label="Supprimer la demande"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <AlertDialog open={!!ask} onOpenChange={(o) => !o && setAsk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ask?.title}</AlertDialogTitle>
            <AlertDialogDescription>Cette suppression est définitive.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const a = ask;
                setAsk(null);
                if (a) void safely(a.run, a.error);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {open && (
        <div className="border-t px-4 py-4 space-y-3">
          {cardError && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {cardError}
            </p>
          )}
          {(status === "validee" || (canValidate && status === "en-cours")) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2">
              {status === "validee" ? (
                <p className="text-sm">
                  <strong>Demande validée</strong>
                  {r.approvedByName ? ` par ${r.approvedByName}` : ""}
                  {r.approvedAt
                    ? ` le ${new Date(r.approvedAt).toLocaleDateString("fr-FR")}`
                    : ""}{" "}
                  · la FAQ reste à réaliser.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  La demande n'est pas encore validée.
                </p>
              )}
              {canValidate &&
                (status === "validee" ? (
                  <Button variant="ghost" size="sm" onClick={unapprove} disabled={busy}>
                    Annuler la validation
                  </Button>
                ) : (
                  <Button size="sm" onClick={approve} disabled={busy}>
                    <Check /> Valider la demande
                  </Button>
                ))}
            </div>
          )}
          {canModerate &&
            r.newCategory &&
            !r.categoryAcceptedAt &&
            r.category &&
            status !== "en-cours" && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-500/30 bg-teal-500/5 px-3 py-2">
                <p className="text-sm">
                  Nouvelle catégorie « <strong>{r.category}</strong> » : pas encore dans la liste.
                </p>
                <Button size="sm" variant="outline" onClick={keepCategory} disabled={busy}>
                  Garder cette catégorie
                </Button>
              </div>
            )}
          {canValidate && !r.validatedAt && (
            <div className="border-b border-border pb-4 space-y-3">
              <p className="text-sm font-semibold">Marquer la FAQ comme réalisée</p>
              <label className={label} htmlFor={`question-${r.id}`}>
                Question finale
              </label>
              <textarea
                id={`question-${r.id}`}
                rows={2}
                className={cn(field, "h-auto py-2")}
                value={finalQuestion}
                onChange={(e) => setFinalQuestion(e.target.value)}
              />
              <label className={label} htmlFor={`link-${r.id}`}>
                Lien de la FAQ
              </label>
              <input
                id={`link-${r.id}`}
                type="url"
                className={field}
                placeholder="https://…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
              {validationError && (
                <p role="alert" className="text-sm text-destructive">
                  {validationError}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {linkSaved && <span className="text-xs text-emerald-700">Lien enregistré ✓</span>}
                <Button
                  variant="outline"
                  onClick={saveLink}
                  disabled={validating || link.trim() === (r.link ?? "")}
                >
                  Enregistrer le lien
                </Button>
                <Button
                  onClick={validate}
                  disabled={validating || !canValidateFaq(finalQuestion, link)}
                >
                  <Check />
                  {validating ? "Enregistrement…" : "Marquer comme réalisée"}
                </Button>
              </div>
            </div>
          )}
          {canValidate && r.validatedAt && (
            <div className="border-b border-border pb-4 space-y-2">
              <label className={label} htmlFor={`link-${r.id}`}>
                Lien de la FAQ
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id={`link-${r.id}`}
                  type="url"
                  className={cn(field, "flex-1 min-w-[220px]")}
                  placeholder="https://…"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={saveLink}
                  disabled={
                    validating ||
                    !canValidateFaq(r.question ?? "x", link) ||
                    link.trim() === (r.link ?? "")
                  }
                >
                  Mettre à jour le lien
                </Button>
              </div>
              {linkSaved && <p className="text-xs text-emerald-700">Lien enregistré ✓</p>}
              {validationError && (
                <p role="alert" className="text-sm text-destructive">
                  {validationError}
                </p>
              )}
            </div>
          )}
          {r.validatedAt && r.link && (
            <Button asChild variant="link" size="sm">
              <a href={r.link} target="_blank" rel="noreferrer">
                Voir la FAQ ↗
              </a>
            </Button>
          )}
          {r.question && (
            <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 px-3 py-2 space-y-1.5">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-teal-800">
                  Question
                </span>
                <p className="text-sm whitespace-pre-wrap mt-0.5">{r.question}</p>
              </div>
              {r.answer && (
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-teal-800">
                    Réponse
                  </span>
                  <p className="text-sm whitespace-pre-wrap mt-0.5">{r.answer}</p>
                </div>
              )}
            </div>
          )}
          <div className="rounded-lg border border-dashed px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={cn(label, "mb-0")}>Pièces jointes de la demande</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={adding > 0}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                <Paperclip className="size-3.5" />
                {adding
                  ? `Envoi de ${adding} fichier${adding > 1 ? "s" : ""}…`
                  : "Ajouter une pièce jointe"}
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {(r.files?.length ?? 0) > 0 ? (
              <FaqAttachmentList
                files={r.files!}
                canDelete={(f) => canDelete(f.addedByEmail)}
                onDelete={deleteFile}
              />
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Aucune pièce jointe. Clique sur un fichier pour l'ouvrir en lecture seule.
              </p>
            )}
          </div>
          {r.comments.map((c) => (
            <div key={c.id} className="group/comment rounded-lg bg-muted/40 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{c.authorName}</strong> ·{" "}
                  {new Date(c.createdAt).toLocaleString("fr-FR")}
                </div>
                {canDelete(c.authorEmail) && (
                  <button
                    type="button"
                    onClick={() => deleteComment(c)}
                    disabled={busy}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Supprimer le commentaire"
                  >
                    <Trash2 className="size-3.5" /> Supprimer
                  </button>
                )}
              </div>
              {c.body && <p className="text-sm whitespace-pre-wrap mt-1">{c.body}</p>}
              <FaqAttachmentList
                files={c.attachments ?? []}
                canDelete={() => canDelete(c.authorEmail)}
                onDelete={(f) => deleteCommentFile(c, f)}
              />
            </div>
          ))}
          <CommentInput
            value={text}
            onChange={setText}
            files={files}
            onFiles={setFiles}
            users={users}
            onSubmit={send}
            author={{ name: myName, email: myEmail }}
          />
        </div>
      )}
    </article>
  );
}
