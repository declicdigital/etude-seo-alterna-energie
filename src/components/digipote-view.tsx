import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Check, ChevronRight, Copy, Pencil, RotateCcw, Search, Undo2 } from "lucide-react";
import {
  correctAssistantAnswer,
  listAssistantExchanges,
  resolveAssistantQuestions,
  type AssistantExchange,
} from "@/lib/assistant.functions";
import { formatUnansweredForCopy } from "@/lib/assistant-knowledge";
import { MessageText } from "@/components/digicom-assistant";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Filter = "all" | "open" | "unanswered" | "corrected";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "open", label: "À traiter" },
  { key: "unanswered", label: "Sans réponse" },
  { key: "corrected", label: "Corrigées" },
];

/** Sans réponse et pas encore corrigée : une question corrigée passe dans « Corrigées » uniquement. */
const isUnanswered = (q: AssistantExchange) => q.unanswered && !q.correction;
/** Sans réponse, pas encore corrigée ni marquée traitée. */
const isOpen = (q: AssistantExchange) => q.unanswered && !q.resolved_at && !q.correction;

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("fr-FR")} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Texte à copier-coller : chaque échange avec la réponse du robot et la correction éventuelle. */
function formatAllForCopy(items: AssistantExchange[]): string {
  const lines = [`Questions posées à D.I.G.I.P.O.T.E (${items.length})`, ""];
  items.forEach((q, i) => {
    lines.push(`${i + 1}. ${q.question.trim()}`);
    lines.push(
      `   (${[when(q.created_at), q.user_name, q.page ? `page ${q.page}` : ""].filter(Boolean).join(" · ")})`,
    );
    lines.push(
      `   Réponse du robot${q.unanswered ? " (sans réponse)" : ""} : ${(q.reply ?? "").replace(/\s+/g, " ").trim()}`,
    );
    lines.push(`   Correction : ${q.correction ? q.correction.replace(/\s+/g, " ").trim() : ""}`);
    lines.push("");
  });
  return lines.join("\n").trimEnd() + "\n";
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

/** « Digipote » : toutes les questions posées au robot, ses réponses et les corrections (Geoffrey uniquement). */
export function DigipoteView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const list = useServerFn(listAssistantExchanges);
  const correct = useServerFn(correctAssistantAnswer);
  const resolve = useServerFn(resolveAssistantQuestions);
  const [items, setItems] = useState<AssistantExchange[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(40);
  const [copied, setCopied] = useState<"open" | "all" | null>(null);

  async function load() {
    try {
      const res = await list();
      if (!res.ok) throw new Error("forbidden");
      setItems(res.items);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const all = items ?? [];
    return {
      all: all.length,
      open: all.filter(isOpen).length,
      unanswered: all.filter(isUnanswered).length,
      corrected: all.filter((q) => q.correction).length,
    };
  }, [items]);

  const shown = useMemo(() => {
    const q = norm(query.trim());
    return (items ?? []).filter((x) => {
      if (filter === "open" && !isOpen(x)) return false;
      if (filter === "unanswered" && !isUnanswered(x)) return false;
      if (filter === "corrected" && !x.correction) return false;
      if (!q) return true;
      return norm(
        `${x.question} ${x.reply ?? ""} ${x.user_name ?? ""} ${x.correction ?? ""}`,
      ).includes(q);
    });
  }, [items, filter, query]);

  function patch(id: string, change: Partial<AssistantExchange>) {
    setItems((all) => (all ?? []).map((x) => (x.id === id ? { ...x, ...change } : x)));
  }

  async function saveCorrection(id: string, text: string | null) {
    const now = new Date().toISOString();
    const prev = items?.find((x) => x.id === id);
    patch(
      id,
      text
        ? { correction: text, corrected_at: now, resolved_at: now }
        : { correction: null, corrected_at: null },
    );
    const res = await correct({ data: { id, correction: text } }).catch(() => ({ ok: false }));
    if (!res.ok && prev) patch(id, prev);
    return res.ok;
  }

  async function setResolved(id: string, resolved: boolean) {
    patch(id, { resolved_at: resolved ? new Date().toISOString() : null });
    const res = await resolve({ data: { ids: [id], resolved } }).catch(() => ({ ok: false }));
    if (!res.ok) void load();
  }

  async function copy(kind: "open" | "all") {
    const source = kind === "open" ? (items ?? []).filter(isOpen) : shown;
    await copyText(kind === "open" ? formatUnansweredForCopy(source) : formatAllForCopy(source));
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-sky-500 text-white shadow-md">
              <Bot className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Digipote</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Toutes les questions posées à D.I.G.I.P.O.T.E, avec la réponse donnée. Corrige une
                réponse : le robot la reprendra pour les questions identiques ou proches. Page
                visible par toi seul.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!counts.open}
              onClick={() => void copy("open")}
            >
              {copied === "open" ? <Check /> : <Copy />}
              {copied === "open" ? "Copié !" : `Copier les questions à traiter (${counts.open})`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!shown.length}
              onClick={() => void copy("all")}
            >
              {copied === "all" ? <Check /> : <Copy />}
              {copied === "all" ? "Copié !" : "Copier la liste affichée"}
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
                setLimit(40);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground/80 hover:bg-muted",
              )}
            >
              {f.label} <span className="opacity-70">({counts[f.key]})</span>
            </button>
          ))}
          <label className="ml-auto flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm sm:flex-none">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une question, une personne…"
              className="w-full bg-transparent outline-none"
            />
          </label>
        </div>

        {failed && (
          <p role="alert" className="text-sm text-destructive">
            L'historique n'a pas pu être chargé.{" "}
            <button type="button" className="underline" onClick={() => void load()}>
              Réessayer
            </button>
          </p>
        )}
        {items === null && !failed && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {items !== null && shown.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune question pour ce filtre.</p>
        )}

        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {shown.slice(0, limit).map((q) => (
            <ExchangeCard
              key={q.id}
              q={q}
              onNavigate={onNavigate}
              onSave={(text) => saveCorrection(q.id, text)}
              onResolve={(r) => void setResolved(q.id, r)}
            />
          ))}
        </div>
        {shown.length > limit && (
          <div className="text-center">
            <Button variant="outline" onClick={() => setLimit((n) => n + 40)}>
              Afficher plus ({shown.length - limit} restantes)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ExchangeCard({
  q,
  onNavigate,
  onSave,
  onResolve,
}: {
  q: AssistantExchange;
  onNavigate: (path: string) => void;
  onSave: (text: string | null) => Promise<boolean>;
  onResolve: (resolved: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(q.correction ?? "");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const open = isOpen(q);

  async function save(text: string | null) {
    setSaving(true);
    const ok = await onSave(text);
    setSaving(false);
    if (ok) setEditing(false);
  }

  return (
    <article className={cn(open && "bg-rose-50/60 dark:bg-rose-500/5")}>
      {/* une ligne par question ; un clic déplie la réponse et les actions */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{q.question}</span>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {q.user_name || "Inconnu"}
        </span>
        <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground md:inline">
          {when(q.created_at)}
        </span>
        <span className="shrink-0 text-[11px]">
          {q.correction ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
              Corrigée
            </span>
          ) : q.unanswered ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold",
                q.resolved_at
                  ? "bg-muted text-muted-foreground"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
              )}
            >
              {q.resolved_at ? "Traitée" : "Sans réponse"}
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
              Répondue
            </span>
          )}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pl-11">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {q.page && <span>Page : {q.page}</span>}
            <span className="rounded-full border border-border px-2 py-0.5">
              {q.source === "local" ? "réponse intégrée" : "IA"}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[15px] font-semibold leading-snug">
            {q.question}
          </p>

          <div className="mt-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-[1.7]">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Réponse du robot
            </div>
            {q.reply ? (
              <MessageText text={q.reply} onGo={onNavigate} />
            ) : (
              <p className="italic text-muted-foreground">—</p>
            )}
          </div>

          {editing ? (
            <div className="mt-3 space-y-2">
              <label
                className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300"
                htmlFor={`fix-${q.id}`}
              >
                Bonne réponse
              </label>
              <textarea
                id={`fix-${q.id}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Écris la réponse que le robot doit donner à cette question."
                className="w-full rounded-xl border border-emerald-300 bg-background px-3 py-2 text-sm leading-[1.6] outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-emerald-500/40"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={saving || !draft.trim()}
                  onClick={() => void save(draft.trim())}
                >
                  <Check /> {saving ? "Enregistrement…" : "Enregistrer la correction"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(q.correction ?? "");
                    setEditing(false);
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : q.correction ? (
            <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm leading-[1.7] dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Ta correction{q.corrected_at ? ` · ${when(q.corrected_at)}` : ""}
              </div>
              <p className="whitespace-pre-wrap">{q.correction}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil /> Modifier
                </Button>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => void save(null)}>
                  <Undo2 /> Retirer la correction
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Corriger la réponse
              </Button>
              {q.unanswered &&
                (q.resolved_at ? (
                  <Button size="sm" variant="ghost" onClick={() => onResolve(false)}>
                    <RotateCcw /> Remettre à traiter
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => onResolve(true)}>
                    <Check /> Marquer traitée
                  </Button>
                ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
