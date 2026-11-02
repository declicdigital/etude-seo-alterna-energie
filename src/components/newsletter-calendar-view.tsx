import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarPlus, Check, Copy, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditableText } from "@/components/editable-text";
import { cn } from "@/lib/utils";
import {
  formatDay,
  formatLongDay,
  isWeekend,
  newsletterState,
  newsletterTitle,
  nextSend,
  parseDay,
  relativeDay,
  stepFlow,
  stepStates,
  toICalendar,
  toSpreadsheetText,
  upcomingDeadlines,
  type Newsletter,
  type NewsletterCalendar,
  type NewsletterState,
  type StepState,
} from "@/lib/newsletter-calendar";

/**
 * Colours kept from each original calendar. Class names are written out in
 * full so Tailwind picks them up.
 */
type Theme = {
  header: string;
  chip: string;
  title: string;
  hero: string;
  /** Highlight colour: today's step, active newsletter, progress. */
  accent: string;
  accentSoft: string;
  accentText: string;
  onAccent: string;
  ring: string;
  activeCard: string;
  todayBox: string;
  soonChip: string;
  tab: string;
  stepGrid: string;
  status: Record<NewsletterState, string>;
  /** One entry per step: tinted cell and matching dot. */
  cells: string[];
  dots: string[];
};

const THEMES: Record<NewsletterCalendar["id"], Theme> = {
  // Vattenfall blue / yellow with the original phase tints.
  "grands-comptes": {
    header: "border-[#0057B8]/20 bg-gradient-to-r from-[#0057B8]/12 via-[#0057B8]/5 to-transparent",
    chip: "text-[#0057B8]",
    title: "text-[#003d82]",
    hero: "bg-[#003d82]",
    accent: "bg-[#FDD20A]",
    accentSoft: "bg-[#FDD20A]/50",
    accentText: "text-[#FDD20A]",
    onAccent: "text-[#003d82]",
    ring: "ring-[#FDD20A]",
    activeCard: "border-[#FDD20A] ring-1 ring-[#FDD20A]/60",
    todayBox: "border-[#FDD20A] bg-[#FDD20A]/20",
    soonChip: "bg-[#cfe2ff] text-[#003d82]",
    tab: "text-[#003d82]",
    stepGrid: "lg:grid-cols-6",
    status: {
      sent: "bg-[#d4edda] text-[#155724]",
      active: "bg-[#FDD20A] text-[#003d82]",
      upcoming: "bg-[#cfe2ff] text-[#0057B8]",
    },
    cells: [
      "bg-[#e8f4fd] border-[#b6d4fe] text-[#0057B8]",
      "bg-[#cfe2ff] border-[#9ec5fe] text-[#003d82]",
      "bg-[#e8f4fd] border-[#b6d4fe] text-[#0057B8]",
      "bg-[#fff9e6] border-[#f5d76e] text-[#7a5c00]",
      "bg-[#fff9e6] border-[#f5d76e] text-[#7a5c00]",
      "bg-[#ffe6e6] border-[#f5c2c2] text-[#a12a2a]",
    ],
    dots: [
      "bg-[#0057B8]",
      "bg-[#003d82]",
      "bg-[#0057B8]",
      "bg-[#FDD20A]",
      "bg-[#FDD20A]",
      "bg-[#e57373]",
    ],
  },
  // Burgundy / amber with the original peach tints.
  // Indigo / teal with amber highlights and the original pastel phases.
  sme: {
    header: "border-[#6366f1]/20 bg-gradient-to-r from-[#6366f1]/12 via-[#14b8a6]/8 to-transparent",
    chip: "text-[#4f46e5]",
    title: "text-[#0f172a]",
    hero: "bg-gradient-to-br from-[#4f46e5] to-[#0f766e]",
    accent: "bg-[#f59e0b]",
    accentSoft: "bg-[#f59e0b]/50",
    accentText: "text-[#fbbf24]",
    onAccent: "text-[#0f172a]",
    ring: "ring-[#f59e0b]",
    activeCard: "border-[#f59e0b] ring-1 ring-[#f59e0b]/50",
    todayBox: "border-[#f59e0b] bg-[#f59e0b]/15",
    soonChip: "bg-[#e0e7ff] text-[#3730a3]",
    tab: "text-[#4f46e5]",
    stepGrid: "lg:grid-cols-6",
    status: {
      sent: "bg-[#dcfce7] text-[#166534]",
      active: "bg-[#ffedd5] text-[#9a3412]",
      upcoming: "bg-[#e0e7ff] text-[#3730a3]",
    },
    cells: [
      "bg-[#e0f2fe] border-[#bae6fd] text-[#0369a1]",
      "bg-[#ede9fe] border-[#c4b5fd] text-[#5b21b6]",
      "bg-[#e0f2fe] border-[#bae6fd] text-[#0369a1]",
      "bg-[#fff7ed] border-[#fed7aa] text-[#9a3412]",
      "bg-[#fff7ed] border-[#fed7aa] text-[#9a3412]",
      "bg-[#dcfce7] border-[#86efac] text-[#166534]",
    ],
    dots: [
      "bg-[#0ea5e9]",
      "bg-[#7c3aed]",
      "bg-[#0ea5e9]",
      "bg-[#f59e0b]",
      "bg-[#f59e0b]",
      "bg-[#16a34a]",
    ],
  },
  // Deep green / lime with the original green tints.
  b2c: {
    header:
      "border-[#0f5a3f]/20 bg-gradient-to-r from-[#b7f2c7]/60 via-[#d7f9df]/40 to-transparent",
    chip: "text-[#0f5a3f]",
    title: "text-[#0b3d2e]",
    hero: "bg-gradient-to-br from-[#0f5a3f] to-[#0b3d2e]",
    accent: "bg-[#bef264]",
    accentSoft: "bg-[#bef264]/50",
    accentText: "text-[#bef264]",
    onAccent: "text-[#0b3d2e]",
    ring: "ring-[#84cc16]",
    activeCard: "border-[#84cc16] ring-1 ring-[#84cc16]/50",
    todayBox: "border-[#84cc16] bg-[#bef264]/30",
    soonChip: "bg-[#dff7e7] text-[#0f5a3f]",
    tab: "text-[#0f5a3f]",
    stepGrid: "lg:grid-cols-3",
    status: {
      sent: "bg-[#dcfce7] text-[#166534]",
      active: "bg-[#ffedd5] text-[#9a3412]",
      upcoming: "bg-[#e0e7ff] text-[#3730a3]",
    },
    cells: [
      "bg-[#dff7e7] border-[#b5e6c4] text-[#0f5a3f]",
      "bg-[#c9f2d6] border-[#9edcb2] text-[#0f5a3f]",
      "bg-[#b8ebc9] border-[#86d4a0] text-[#0b3d2e]",
    ],
    dots: ["bg-[#4ade80]", "bg-[#16a34a]", "bg-[#0f5a3f]"],
  },
  interne: {
    header: "border-[#7a1430]/20 bg-gradient-to-r from-[#7a1430]/12 via-[#7a1430]/5 to-transparent",
    chip: "text-[#7a1430]",
    title: "text-[#4a0d1c]",
    hero: "bg-gradient-to-br from-[#7a1430] to-[#4a0d1c]",
    accent: "bg-[#fbbf24]",
    accentSoft: "bg-[#fbbf24]/50",
    accentText: "text-[#fbbf24]",
    onAccent: "text-[#4a0d1c]",
    ring: "ring-[#fbbf24]",
    activeCard: "border-[#fbbf24] ring-1 ring-[#fbbf24]/60",
    todayBox: "border-[#fbbf24] bg-[#fbbf24]/20",
    soonChip: "bg-[#fde7dc] text-[#7a1430]",
    tab: "text-[#7a1430]",
    stepGrid: "lg:grid-cols-5",
    status: {
      sent: "bg-[#dcfce7] text-[#166534]",
      active: "bg-[#ffedd5] text-[#9a3412]",
      upcoming: "bg-[#e0e7ff] text-[#3730a3]",
    },
    cells: [
      "bg-[#fde7dc] border-[#f6c9b3] text-[#7a1430]",
      "bg-[#fcd6c4] border-[#f3b89c] text-[#7a1430]",
      "bg-[#fde7dc] border-[#f6c9b3] text-[#7a1430]",
      "bg-[#fcd6c4] border-[#f3b89c] text-[#7a1430]",
      "bg-[#fbc3a8] border-[#ee9f7d] text-[#4a0d1c]",
    ],
    dots: ["bg-[#e8a07f]", "bg-[#c2410c]", "bg-[#e8a07f]", "bg-[#c2410c]", "bg-[#7a1430]"],
  },
};

const STATUS_LABEL: Record<NewsletterState, string> = {
  sent: "Envoyée",
  active: "En cours",
  upcoming: "À venir",
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
  calendar: cal,
  groupLabel,
  sheetLabel,
  onRenameGroup,
  onRenameSheet,
}: {
  calendar: NewsletterCalendar;
  groupLabel: string;
  sheetLabel: string;
  onRenameGroup: (v: string) => void;
  onRenameSheet: (v: string) => void;
}) {
  const theme = THEMES[cal.id];
  const today = useToday();
  const [filter, setFilter] = useState<Filter>("next");
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);

  const states = useMemo(
    () => new Map(cal.newsletters.map((n) => [n.id, newsletterState(n, today)])),
    [cal, today],
  );
  const counts = {
    next: cal.newsletters.filter((n) => states.get(n.id) !== "sent").length,
    sent: cal.newsletters.filter((n) => states.get(n.id) === "sent").length,
    all: cal.newsletters.length,
  };
  const shown = cal.newsletters.filter((n) =>
    filter === "all"
      ? true
      : filter === "sent"
        ? states.get(n.id) === "sent"
        : states.get(n.id) !== "sent",
  );
  if (filter === "sent") shown.reverse();
  const years = [...new Set(shown.map((n) => n.year))];
  const span = [...new Set(cal.newsletters.map((n) => n.year))];
  const period = span.length > 1 ? `${span[0]}–${span[span.length - 1]}` : String(span[0]);

  async function copyForExcel() {
    try {
      await navigator.clipboard.writeText(toSpreadsheetText(cal));
      setCopied("ok");
    } catch {
      setCopied("error");
    }
    window.setTimeout(() => setCopied(null), 2500);
  }

  function downloadCalendar() {
    const url = URL.createObjectURL(
      new Blob([toICalendar(cal)], { type: "text/calendar;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsletters-${cal.id}-${period}.ics`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className={cn("border-b px-5 py-6 md:px-8", theme.header)}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <EditableText
              as="div"
              className={cn("text-[11px] font-semibold uppercase tracking-widest", theme.chip)}
              value={groupLabel}
              onCommit={onRenameGroup}
            />
            <EditableText
              as="h2"
              className={cn("mt-1 text-2xl font-semibold tracking-tight", theme.title)}
              value={sheetLabel}
              onCommit={onRenameSheet}
            />
            <p className="mt-1 text-sm text-muted-foreground">{cal.description}</p>
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
          <NextSendCard cal={cal} theme={theme} today={today} />
          <UpcomingCard cal={cal} theme={theme} today={today} />
        </div>

        <TeamStrip cal={cal} theme={theme} />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Planning {period}
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
                      ? cn("bg-card shadow-sm", theme.tab)
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
                : "Toutes les newsletters prévues sont envoyées."}
            </p>
          ) : (
            <div className="space-y-6">
              {years.map((year) => (
                <div key={year} className="space-y-3">
                  {years.length > 1 && (
                    <h4
                      className={cn("flex items-center gap-3 text-lg font-semibold", theme.title)}
                    >
                      {year}
                      <span className="h-px flex-1 bg-border" aria-hidden />
                    </h4>
                  )}
                  {shown
                    .filter((n) => n.year === year)
                    .map((n) => (
                      <NewsletterRow
                        key={n.id}
                        cal={cal}
                        theme={theme}
                        newsletter={n}
                        state={states.get(n.id)!}
                        today={today}
                      />
                    ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type CardProps = { cal: NewsletterCalendar; theme: Theme; today: Date };

function NextSendCard({ cal, theme, today }: CardProps) {
  const n = nextSend(cal, today);
  if (!n) {
    return (
      <div className={cn("min-w-0 rounded-xl p-5 text-white shadow-sm", theme.hero)}>
        <p className="text-xs font-medium uppercase tracking-wider text-white/70">Prochain envoi</p>
        <p className="mt-2 text-lg font-semibold">Toutes les newsletters prévues sont envoyées.</p>
      </div>
    );
  }
  const send = n.dates[n.dates.length - 1];
  const steps = stepStates(n, today);
  const focus = steps.findIndex((s) => s === "today" || s === "current");
  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-xl p-5 text-white shadow-sm",
        theme.hero,
      )}
    >
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
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            theme.accent,
            theme.onAccent,
          )}
        >
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
                  ? theme.accent
                  : s === "today" || s === "current"
                    ? theme.accentSoft
                    : "bg-white/20",
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-sm text-white/85">
          {focus >= 0 ? (
            <>
              Étape {focus + 1} sur {cal.steps.length} :{" "}
              <span className="font-semibold text-white">{cal.steps[focus].label}</span>
            </>
          ) : (
            <>
              Démarre le {formatDay(n.dates[0])} :{" "}
              <span className="font-semibold text-white">{cal.steps[0].label}</span>
            </>
          )}
        </p>
      </div>
      <ol className="mt-4 space-y-1.5 border-t border-white/15 pt-4">
        {cal.steps.map((step, i) => {
          const st = steps[i];
          const focused = st === "today" || st === "current";
          return (
            <li key={step.key} className="flex items-center gap-2.5 text-sm">
              {st === "done" ? (
                <Check className={cn("size-4 shrink-0", theme.accentText)} aria-label="Terminé" />
              ) : (
                <span
                  className={cn(
                    "mx-1 size-2 shrink-0 rounded-full",
                    focused ? cn(theme.accent, "ring-4 ring-white/15") : "bg-white/30",
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
                  focused ? theme.accentText : "text-white/55",
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

function UpcomingCard({ cal, theme, today }: CardProps) {
  const items = upcomingDeadlines(cal, today).slice(0, 5);
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
      <h3 className={cn("text-sm font-semibold", theme.title)}>Prochaines échéances</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Plus aucune échéance prévue.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {items.map((d) => {
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
                    isToday ? theme.todayBox : "border-border bg-muted/40",
                  )}
                >
                  <span className={cn("text-base font-semibold", theme.title)}>
                    {date.getDate()}
                  </span>
                  <span className="mt-0.5 text-[10px] uppercase text-muted-foreground">
                    {date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <span
                      className={cn("size-2 shrink-0 rounded-full", theme.dots[d.index])}
                      aria-hidden
                    />
                    {d.step.label}
                    {isWeekend(d.date) && <WeekendFlag />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {newsletterTitle(d.newsletter)} · {cal.actors[d.step.from].label}
                    {d.step.to && (
                      <>
                        {" "}
                        <ArrowRight className="inline size-3" /> {cal.actors[d.step.to].label}
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    isToday
                      ? cn(theme.accent, theme.onAccent)
                      : d.days <= 7
                        ? theme.soonChip
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

function TeamStrip({ cal, theme }: { cal: NewsletterCalendar; theme: Theme }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <span className="mr-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Users className="size-3.5" /> Équipe
      </span>
      {cal.team.map((t) => (
        <span
          key={t.role}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
            theme.cells[t.step],
          )}
        >
          <span className="font-semibold">{t.role}</span>
          {t.people && <span className="text-foreground/80">{t.people}</span>}
        </span>
      ))}
    </div>
  );
}

function NewsletterRow({
  cal,
  theme,
  newsletter: n,
  state,
  today,
}: {
  cal: NewsletterCalendar;
  theme: Theme;
  newsletter: Newsletter;
  state: NewsletterState;
  today: Date;
}) {
  const steps = stepStates(n, today);
  const send = n.dates[n.dates.length - 1];
  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        state === "active" ? theme.activeCard : "border-border",
        state === "sent" && "bg-muted/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h4
          className={cn(
            "text-base font-semibold",
            state === "sent" ? "text-muted-foreground" : theme.title,
          )}
        >
          {newsletterTitle(n)}
        </h4>
        <span
          className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", theme.status[state])}
        >
          {STATUS_LABEL[state]}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          Envoi <span className="font-medium text-foreground">{formatDay(send)}</span>
          {state !== "sent" && <> · {relativeDay(send, today)}</>}
        </span>
      </div>
      <ol className={cn("mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3", theme.stepGrid)}>
        {cal.steps.map((step, i) => (
          <StepCell
            key={step.key}
            cal={cal}
            theme={theme}
            index={i}
            date={n.dates[i]}
            state={steps[i]}
          />
        ))}
      </ol>
    </article>
  );
}

function StepCell({
  cal,
  theme,
  index,
  date,
  state,
}: {
  cal: NewsletterCalendar;
  theme: Theme;
  index: number;
  date: string;
  state: StepState;
}) {
  const step = cal.steps[index];
  const focus = state === "today" || state === "current";
  return (
    <li
      title={`${step.label} · ${stepFlow(cal, step)}`}
      className={cn(
        "relative rounded-lg border px-2.5 py-2",
        theme.cells[index],
        state === "done" && "opacity-55",
        focus && cn("ring-2 ring-offset-1", theme.ring),
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold tabular-nums opacity-60">{index + 1}</span>
        <span className="truncate text-xs font-semibold">{step.short}</span>
        {state === "done" && <Check className="ml-auto size-3.5 shrink-0" aria-label="Terminé" />}
        {state === "today" && (
          <span
            className={cn(
              "ml-auto shrink-0 rounded px-1 text-[10px] font-bold",
              theme.accent,
              theme.onAccent,
            )}
          >
            Auj.
          </span>
        )}
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-foreground">
        {formatDay(date)}
        {isWeekend(date) && <WeekendFlag />}
      </p>
      <p className="mt-0.5 truncate text-[10px] opacity-75">{stepFlow(cal, step, true)}</p>
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
