import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Radar,
  Sparkles,
} from "lucide-react";
import { getHomeSummary } from "@/lib/home.functions";
import type { HomeSummary, HomeTask } from "@/lib/home-summary";
import { cn } from "@/lib/utils";

const frDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};
const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const daysUntil = (iso: string) =>
  Math.round((Date.parse(iso) - Date.parse(todayIso())) / 86400000);

function DeadlineBadge({ task }: { task: HomeTask }) {
  if (!task.deadline) return <span className="text-xs text-muted-foreground">sans deadline</span>;
  const n = daysUntil(task.deadline);
  const label = task.late
    ? `en retard · ${frDay(task.deadline)}`
    : n === 0
      ? "aujourd'hui"
      : n === 1
        ? "demain"
        : frDay(task.deadline);
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        task.late
          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
          : n <= 3
            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
            : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function TaskRow({
  task,
  showWho,
  go,
}: {
  task: HomeTask;
  showWho?: boolean;
  go: (p: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => go(task.path)}
        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
      >
        <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          {task.step}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{task.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {task.space}
            {showWho && task.assignee ? ` · ${task.assignee}` : ""}
          </span>
        </span>
        <DeadlineBadge task={task} />
        <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </li>
  );
}

function Card({
  icon: Icon,
  title,
  aside,
  children,
  className,
}: {
  icon: typeof Inbox;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 md:p-6", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="size-4" />
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Accueil : ce qui m'attend, les échéances de l'équipe, les derniers contenus publiés et Le Radar du mois. */
export function HomeDashboard() {
  const load = useServerFn(getHomeSummary);
  const navigate = useNavigate();
  const [data, setData] = useState<HomeSummary | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    load()
      .then((r) => alive && setData(r.ok ? r.summary : null))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [load]);

  const go = (path: string) => void navigate({ href: path });

  if (data === undefined)
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-2xl border border-border bg-muted/40"
          />
        ))}
      </div>
    );
  if (!data) return null;

  const hasEditorial = data.editorial;
  const lateCount = data.mine.filter((t) => t.late).length;

  return (
    <div className="space-y-4">
      {hasEditorial && (
        <Card
          icon={Inbox}
          title="Ce qui t'attend"
          aside={
            data.mine.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {data.mine.length} à traiter{lateCount ? ` · ${lateCount} en retard` : ""}
              </span>
            )
          }
        >
          {data.mine.length ? (
            <ul className="-mx-3">
              {data.mine.slice(0, 8).map((t) => (
                <TaskRow key={t.path} task={t} go={go} />
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-primary" /> Rien ne t'attend pour le moment.
            </p>
          )}
        </Card>
      )}

      {hasEditorial && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card icon={CalendarClock} title="Échéances de l'équipe">
            {data.upcoming.length ? (
              <ul className="-mx-3">
                {data.upcoming.map((t) => (
                  <TaskRow key={t.path} task={t} showWho go={go} />
                ))}
              </ul>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">
                Aucune deadline dans les deux prochaines semaines.
              </p>
            )}
          </Card>
          <Card icon={CheckCircle2} title="Derniers contenus publiés">
            {data.published.length ? (
              <ul className="-mx-3">
                {data.published.map((p) => (
                  <li
                    key={p.path}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-muted/60"
                  >
                    <button
                      type="button"
                      onClick={() => go(p.path)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium">{p.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.space}
                        {p.date ? ` · ${frDay(p.date)}` : ""}
                      </span>
                    </button>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                        title={p.url}
                      >
                        En ligne <ExternalLink className="size-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">
                Aucun contenu publié pour le moment.
              </p>
            )}
          </Card>
        </div>
      )}

      {data.radar && (
        <Card
          icon={Radar}
          title={`Le Radar · ${data.radar.month}`}
          aside={
            <button
              type="button"
              onClick={() => go("/radar")}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ouvrir Le Radar <ArrowRight className="size-4" />
            </button>
          }
        >
          {data.radar.campaigns.length || data.radar.milestones.length ? (
            <div className="space-y-3">
              {data.radar.campaigns.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.radar.campaigns.map((c) => (
                    <span
                      key={`${c.title}-${c.start}`}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm",
                        c.startsThisMonth
                          ? "border-primary/40 bg-primary/10"
                          : "border-border bg-background",
                      )}
                    >
                      <span className="font-medium">{c.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.startsThisMonth
                          ? "démarre le " + frDay(c.start)
                          : "jusqu'au " + frDay(c.end)}
                      </span>
                    </span>
                  ))}
                </div>
              )}
              {data.radar.milestones.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {data.radar.milestones
                    .map((m) => `${m.icon} ${m.title} (${frDay(m.date)})`)
                    .join(" · ")}
                </p>
              )}
            </div>
          ) : (
            <p className="py-1 text-sm text-muted-foreground">Rien de prévu ce mois-ci.</p>
          )}
        </Card>
      )}
    </div>
  );
}
