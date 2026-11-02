import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarPlus, Check, Copy, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditableText } from "@/components/editable-text";
import { cn } from "@/lib/utils";
import {
  ACTORS,
  NEWSLETTERS,
  REVIEWERS,
  STEPS,
  formatDay,
  formatLongDay,
  isWeekend,
  newsletterState,
  newsletterTitle,
  nextSend,
  parseDay,
  relativeDay,
  stepStates,
  toICalendar,
  toSpreadsheetText,
  upcomingDeadlines,
  type Actor,
  type Newsletter,
  type NewsletterState,
  type StepState,
} from "@/lib/newsletter-calendar";

/* Colours kept from the original calendar (Vattenfall blue / yellow + phase tints). */
type Phase = "presta" | "b2b" | "comm" | "client";
const STEP_PHASE: Phase[] = ["presta", "b2b", "presta", "comm", "comm", "client"];
const PHASE: Record<Phase, { cell: string; dot: string; label: string }> = {
  presta: {
    cell: "bg-[#e8f4fd] border-[#b6d4fe] text-[#0057B8]",
    dot: "bg-[#0057B8]",
    label: "Prestataire",
  },
  b2b: { cell: "bg-[#cfe2ff] border-[#9ec5fe] text-[#003d82]", dot: "bg-[#003d82]", label: "B2B" },
  comm: {
    cell: "bg-[#fff9e6] border-[#f5d76e] text-[#7a5c00]",
    dot: "bg-[#FDD20A]",
    label: "Communication",
  },
  client: {
    cell: "bg-[#ffe6e6] border-[#f5c2c2] text-[#a12a2a]",
    dot: "bg-[#e57373]",
    label: "Clients",
  },
};
const ACTOR_SHORT: Record<Actor, string> = {
  presta: "Presta",
  b2b: "B2B",
  comm: "Comm.",
  clients: "Clients",
};

const STATUS: Record<NewsletterState, { label: string; className: string }> = {
  sent: { label: "Envoyée", className: "bg-[#d4edda] text-[#155724]" },
  active: { label: "En cours", className: "bg-[#FDD20A] text-[#003d82]" },
  upcoming: { label: "À venir", className: "bg-[#cfe2ff] text-[#0057B8]" },
};

type Filter = "next" | "sent" | "all";

function useToday() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setToday(new Date()), 10 * 60 * 1000);
    return () => window.clearInterval(t);
  }, []);
  return today;
}

export function NewsletterCalendarView({
  groupLabel,
  sheetLabel,
  onRenameGroup,
  onRenameSheet,
}: {
  groupLabel: string;
  sheetLabel: string;
  onRenameGroup: (v: string) => void;
  onRenameSheet: (v: string) => void;
}) {
  const today = useToday();
  const [filter, setFilter] = useState<Filter>("next");
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);

  const states = useMemo(
    () => new Map(NEWSLETTERS.map((n) => [n.id, newsletterState(n, today)])),
    [today],
  );
  const counts = {
    next: NEWSLETTERS.filter((n) => states.get(n.id) !== "sent").length,
    sent: NEWSLETTERS.filter((n) => states.get(n.id) === "sent").length,
    all: NEWSLETTERS.length,
  };
  const shown = NEWSLETTERS.filter((n) =>
    filter === "all"
      ? true
      : filter === "sent"
        ? states.get(n.id) === "sent"
        : states.get(n.id) !== "sent",
  );
  if (filter === "sent") shown.reverse();

  async function copyForExcel() {
    try {
      await navigator.clipboard.writeText(toSpreadsheetText());
      setCopied("ok");
    } catch {
      setCopied("error");
    }
    window.setTimeout(() => setCopied(null), 2500);
  }

  function downloadCalendar() {
    const url = URL.createObjectURL(
      new Blob([toICalendar()], { type: "text/calendar;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "newsletters-grands-comptes-2026.ics";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="border-b border-[#0057B8]/20 bg-gradient-to-r from-[#0057B8]/12 via-[#0057B8]/5 to-transparent px-5 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <EditableText
              as="div"
              className="text-[11px] font-semibold uppercase tracking-widest text-[#0057B8]"
              value={groupLabel}
              onCommit={onRenameGroup}
            />
            <EditableText
              as="h2"
              className="mt-1 text-2xl font-semibold tracking-tight text-[#003d82]"
              value={sheetLabel}
              onCommit={onRenameSheet}
            />
            <p className="mt-1 text-sm text-muted-foreground">
              Planning 2026 de production et d'envoi des newsletters Grands Comptes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCalendar}
              title="Fichier .ics à ouvrir dans Outlook ou Google Agenda"
            >
              <CalendarPlus /> Ajouter à mon agenda
            </Button>
            <Button variant="outline" size="sm" onClick={copyForExcel}>
              {copied === "ok" ? <Check /> : <Copy />}
              {copied === "ok" ? "Copié !" : "Copier pour Excel"}
            </Button>
          </div>
        </div>
        {copied === "error" && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            La copie n'a pas fonctionné dans ce navigateur.
          </p>
        )}
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 md:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          <NextSendCard today={today} />
          <UpcomingCard today={today} />
        </div>

        <TeamStrip />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Planning 2026
            </h3>
            <div
              role="tablist"
              aria-label="Filtrer les newsletters"
              className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
            >
              {(
                [
                  ["next", "À venir"],
                  ["sent", "Envoyées"],
                  ["all", "Toutes"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    filter === key
                      ? "bg-card text-[#003d82] shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label} <span className="ml-0.5 tabular-nums opacity-60">{counts[key]}</span>
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {filter === "sent"
                ? "Aucune newsletter envoyée pour le moment."
                : "Toutes les newsletters de l'année sont envoyées."}
            </p>
          ) : (
            <div className="space-y-3">
              {shown.map((n) => (
                <NewsletterRow key={n.id} newsletter={n} state={states.get(n.id)!} today={today} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function NextSendCard({ today }: { today: Date }) {
  const n = nextSend(today);
  if (!n) {
    return (
      <div className="min-w-0 rounded-xl bg-[#003d82] p-5 text-white shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-white/70">Prochain envoi</p>
        <p className="mt-2 text-lg font-semibold">Toutes les newsletters 2026 sont envoyées.</p>
      </div>
    );
  }
  const send = n.dates[n.dates.length - 1];
  const steps = stepStates(n, today);
  const doneCount = steps.filter((s) => s === "done").length;
  const focus = steps.findIndex((s) => s === "today" || s === "current");
  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl bg-[#003d82] p-5 text-white shadow-sm">
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-white/[0.06]"
        aria-hidden
      />
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-white/70">
        <Send className="size-3.5" /> Prochain envoi
      </p>
      <p className="mt-2 text-2xl font-semibold">{newsletterTitle(n)}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/85">
        <span className="first-letter:uppercase">{formatLongDay(send)}</span>
        <span className="rounded-full bg-[#FDD20A] px-2 py-0.5 text-xs font-semibold text-[#003d82]">
          {relativeDay(send, today)}
        </span>
      </div>
      <div className="mt-5">
        <div className="flex gap-1" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                s === "done"
                  ? "bg-[#FDD20A]"
                  : s === "today" || s === "current"
                    ? "bg-[#FDD20A]/50"
                    : "bg-white/20",
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-sm text-white/85">
          {focus >= 0 ? (
            <>
              Étape {focus + 1} sur {STEPS.length} :{" "}
              <span className="font-semibold text-white">{STEPS[focus].label}</span>
            </>
          ) : (
            <>
              {doneCount} étape{doneCount > 1 ? "s" : ""} sur {STEPS.length} terminée
              {doneCount > 1 ? "s" : ""} · démarre le {formatDay(n.dates[0])}
            </>
          )}
        </p>
      </div>
      <ol className="mt-4 space-y-1.5 border-t border-white/15 pt-4">
        {STEPS.map((step, i) => {
          const st = steps[i];
          const focused = st === "today" || st === "current";
          return (
            <li key={step.key} className="flex items-center gap-2.5 text-sm">
              {st === "done" ? (
                <Check className="size-4 shrink-0 text-[#FDD20A]" aria-label="Terminé" />
              ) : (
                <span
                  className={cn(
                    "mx-1 size-2 shrink-0 rounded-full",
                    focused ? "bg-[#FDD20A] ring-4 ring-[#FDD20A]/25" : "bg-white/30",
                  )}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  st === "done"
                    ? "text-white/55"
                    : focused
                      ? "font-semibold text-white"
                      : "text-white/85",
                )}
              >
                {step.label}
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs tabular-nums",
                  focused ? "text-[#FDD20A]" : "text-white/55",
                )}
              >
                {st === "today" ? "Aujourd'hui" : formatDay(n.dates[i])}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function UpcomingCard({ today }: { today: Date }) {
  const items = upcomingDeadlines(today).slice(0, 5);
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
      <h3 className="text-sm font-semibold text-[#003d82]">Prochaines échéances</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Plus aucune échéance prévue en 2026.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {items.map((d) => {
            const phase = PHASE[STEP_PHASE[d.index]];
            const date = parseDay(d.date);
            const isToday = d.days === 0;
            return (
              <li
                key={`${d.newsletter.id}-${d.step.key}`}
                className="flex items-center gap-3 py-2.5"
              >
                <div
                  className={cn(
                    "flex w-11 shrink-0 flex-col items-center rounded-lg border py-1 leading-none",
                    isToday ? "border-[#FDD20A] bg-[#FDD20A]/20" : "border-border bg-muted/40",
                  )}
                >
                  <span className="text-base font-semibold text-[#003d82]">{date.getDate()}</span>
                  <span className="mt-0.5 text-[10px] uppercase text-muted-foreground">
                    {date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <span className={cn("size-2 shrink-0 rounded-full", phase.dot)} aria-hidden />
                    {d.step.label}
                    {isWeekend(d.date) && <WeekendFlag />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {newsletterTitle(d.newsletter)} · {ACTORS[d.step.from].label}{" "}
                    <ArrowRight className="inline size-3" /> {ACTORS[d.step.to].label}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    isToday
                      ? "bg-[#FDD20A] text-[#003d82]"
                      : d.days <= 7
                        ? "bg-[#cfe2ff] text-[#003d82]"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {relativeDay(d.date, today)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TeamStrip() {
  const team: { phase: Phase; role: string; people: string }[] = [
    { phase: "presta", role: "Prestataire", people: ACTORS.presta.people },
    { phase: "b2b", role: "B2B", people: ACTORS.b2b.people },
    { phase: "comm", role: "Relecture", people: REVIEWERS },
    { phase: "comm", role: "Communication", people: ACTORS.comm.people },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <span className="mr-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Users className="size-3.5" /> Équipe
      </span>
      {team.map((t) => (
        <span
          key={t.role}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
            PHASE[t.phase].cell,
          )}
        >
          <span className="font-semibold">{t.role}</span>
          <span className="text-foreground/80">{t.people}</span>
        </span>
      ))}
    </div>
  );
}

function NewsletterRow({
  newsletter: n,
  state,
  today,
}: {
  newsletter: Newsletter;
  state: NewsletterState;
  today: Date;
}) {
  const steps = stepStates(n, today);
  const send = n.dates[n.dates.length - 1];
  const status = STATUS[state];
  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        state === "active" ? "border-[#FDD20A] ring-1 ring-[#FDD20A]/60" : "border-border",
        state === "sent" && "bg-muted/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h4
          className={cn(
            "text-base font-semibold",
            state === "sent" ? "text-muted-foreground" : "text-[#003d82]",
          )}
        >
          {newsletterTitle(n)}
        </h4>
        <span
          className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", status.className)}
        >
          {status.label}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          Envoi <span className="font-medium text-foreground">{formatDay(send)}</span>
          {state !== "sent" && <> · {relativeDay(send, today)}</>}
        </span>
      </div>
      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STEPS.map((step, i) => (
          <StepCell key={step.key} index={i} date={n.dates[i]} state={steps[i]} />
        ))}
      </ol>
    </article>
  );
}

function StepCell({ index, date, state }: { index: number; date: string; state: StepState }) {
  const step = STEPS[index];
  const phase = PHASE[STEP_PHASE[index]];
  const focus = state === "today" || state === "current";
  return (
    <li
      title={`${step.label} · ${ACTORS[step.from].label} → ${ACTORS[step.to].label}`}
      className={cn(
        "relative rounded-lg border px-2.5 py-2",
        phase.cell,
        state === "done" && "opacity-55",
        focus && "ring-2 ring-[#FDD20A] ring-offset-1",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold tabular-nums opacity-60">{index + 1}</span>
        <span className="truncate text-xs font-semibold">{step.short}</span>
        {state === "done" && <Check className="ml-auto size-3.5 shrink-0" aria-label="Terminé" />}
        {state === "today" && (
          <span className="ml-auto shrink-0 rounded bg-[#FDD20A] px-1 text-[10px] font-bold text-[#003d82]">
            Auj.
          </span>
        )}
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-foreground">
        {formatDay(date)}
        {isWeekend(date) && <WeekendFlag />}
      </p>
      <p className="mt-0.5 truncate text-[10px] opacity-75">
        {ACTOR_SHORT[step.from]} → {ACTOR_SHORT[step.to]}
      </p>
    </li>
  );
}

function WeekendFlag() {
  return (
    <span title="Échéance un week-end" className="inline-flex shrink-0 text-amber-600">
      <AlertTriangle className="size-3.5" aria-label="Échéance un week-end" />
    </span>
  );
}
