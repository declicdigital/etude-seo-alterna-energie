import { fichePath } from "./slugs";

/**
 * Page d'accueil : « ce qui m'attend », les prochaines échéances, les derniers contenus publiés
 * et Le Radar du mois. Calculé côté serveur avec les droits de la personne, et uniquement pour
 * les rubriques qui lui sont ouvertes.
 */

export type HomeSpaceId = "blog" | "strat" | "planete";

export const HOME_SPACES: Record<
  HomeSpaceId,
  { label: string; zone: string; prefix: string; sheet: string }
> = {
  blog: { label: "Blog", zone: "blog-suivi", prefix: "", sheet: "SUIVI EDITORIAL" },
  strat: { label: "Stratégie PAC", zone: "pac-suivi", prefix: "strat:", sheet: "SUIVI STRATEGIE" },
  planete: {
    label: "Parlons Planète",
    zone: "planete-suivi",
    prefix: "planete:",
    sheet: "SUIVI PLANETE",
  },
};

type Step = { key: string; status?: string; date?: string; deadline?: string; assignee?: string };
export type HomeArticle = {
  id?: string;
  title?: string;
  finalLink?: string;
  blogRowId?: number | null;
  steps?: Step[];
};
export type HomeTodo = {
  id?: string;
  sujet?: string;
  h1?: string;
  editrice?: string;
  deadline?: string;
  articleId?: string | null;
};
export type StepConfig = {
  key: string;
  label?: string;
  assignee?: string;
  emails?: Record<string, string>;
};
export type SpaceData = {
  space: HomeSpaceId;
  articles: HomeArticle[];
  todos: HomeTodo[];
  config: StepConfig[];
};

export type HomeTask = {
  space: string;
  title: string;
  step: string;
  assignee: string;
  deadline: string | null;
  late: boolean;
  path: string;
};
export type HomePublished = {
  space: string;
  title: string;
  date: string | null;
  url: string | null;
  path: string;
};
export type HomeRadar = {
  month: string;
  campaigns: {
    title: string;
    type: string;
    start: string;
    end: string;
    startsThisMonth: boolean;
  }[];
  milestones: { title: string; date: string; icon: string }[];
};
export type HomeSummary = {
  /** La personne a au moins un suivi éditorial ouvert. */
  editorial: boolean;
  me: string[];
  mine: HomeTask[];
  upcoming: HomeTask[];
  published: HomePublished[];
  radar: HomeRadar | null;
};

const DEFAULT_LABELS: Record<string, string> = {
  brief: "Brief",
  redaction: "Rédaction",
  expert: "Relecture métier",
  image: "Image",
  relecture: "Relecture",
  integration: "Intégration",
};
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Noms d'équipe de la personne : ceux dont la liste de mails (réglages des suivis) la contient, plus son prénom. */
export function teamNamesOf(
  email: string,
  firstName: string | null,
  configs: StepConfig[][],
): string[] {
  const me = email.trim().toLowerCase();
  const names = new Set<string>();
  if (firstName?.trim()) names.add(firstName.trim());
  for (const cfg of configs)
    for (const step of cfg)
      for (const [name, list] of Object.entries(step.emails ?? {}))
        if (
          me &&
          String(list)
            .split(/[,;\s]+/)
            .map((e) => e.trim().toLowerCase())
            .includes(me)
        )
          names.add(name);
  return [...names];
}

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function buildHomeSummary(input: {
  today: string;
  me: string[];
  spaces: SpaceData[];
  radarYear?: { campaigns?: unknown[]; milestones?: unknown[] } | null;
}): HomeSummary {
  const { today } = input;
  const mine: HomeTask[] = [];
  const team: HomeTask[] = [];
  const published: HomePublished[] = [];
  const meSet = new Set(input.me.map(norm));
  const soon = new Date(Date.parse(today) + 14 * 86400000).toISOString().slice(0, 10);

  for (const sd of input.spaces) {
    const spec = HOME_SPACES[sd.space];
    const cfgOf = (k: string) => sd.config.find((c) => c.key === k);
    for (const a of sd.articles) {
      if (!a.id) continue;
      const title = (a.title || "Sans titre").trim();
      const path = "/" + fichePath(spec.sheet, "articles", a.id, title);
      const steps = a.steps ?? [];
      const integ = steps.find((s) => s.key === "integration");
      const isPublished = !!a.blogRowId || integ?.status === "done";
      if (isPublished) {
        published.push({
          space: spec.label,
          title,
          date: integ?.status === "done" && ISO.test(integ.date ?? "") ? integ.date! : null,
          url: a.finalLink?.trim() ? a.finalLink.trim() : null,
          path,
        });
        continue;
      }
      const cur = steps.find((s) => s.status === "pending");
      if (!cur) continue;
      const assignee = (cur.assignee || cfgOf(cur.key)?.assignee || "").trim();
      const deadline = ISO.test(cur.deadline ?? "") ? cur.deadline! : null;
      const task: HomeTask = {
        space: spec.label,
        title,
        step: cfgOf(cur.key)?.label || DEFAULT_LABELS[cur.key] || cur.key,
        assignee,
        deadline,
        late: !!deadline && deadline < today,
        path: `${path}?step=${encodeURIComponent(cur.key)}`,
      };
      if (assignee && meSet.has(norm(assignee))) mine.push(task);
      else team.push(task);
    }
    for (const t of sd.todos) {
      if (!t.id || t.articleId) continue;
      const title = (t.h1 || t.sujet || "Sujet sans titre").trim();
      const deadline = ISO.test(t.deadline ?? "") ? t.deadline! : null;
      const task: HomeTask = {
        space: spec.label,
        title,
        step: "À rédiger",
        assignee: (t.editrice || "").trim(),
        deadline,
        late: !!deadline && deadline < today,
        path: "/" + fichePath(spec.sheet, "a-rediger", t.id, title),
      };
      if (task.assignee && meSet.has(norm(task.assignee))) mine.push(task);
      else team.push(task);
    }
  }

  const byDeadline = (a: HomeTask, b: HomeTask) =>
    (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || a.title.localeCompare(b.title);
  mine.sort(byDeadline);
  const upcoming = team
    .filter((t) => t.deadline && t.deadline <= soon)
    .sort(byDeadline)
    .slice(0, 8);
  published.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  let radar: HomeRadar | null = null;
  if (input.radarYear) {
    const month = today.slice(0, 7);
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-31`;
    const campaigns = (input.radarYear.campaigns ?? [])
      .map((c) => c as Record<string, unknown>)
      .filter((c) => typeof c.startDate === "string" && typeof c.endDate === "string")
      .filter((c) => (c.startDate as string) <= monthEnd && (c.endDate as string) >= monthStart)
      .map((c) => ({
        title: String(c.title ?? "Campagne"),
        type: String(c.campaignType ?? c.type ?? ""),
        start: c.startDate as string,
        end: c.endDate as string,
        startsThisMonth: (c.startDate as string).startsWith(month),
      }))
      .sort(
        (a, b) =>
          Number(b.startsThisMonth) - Number(a.startsThisMonth) || a.start.localeCompare(b.start),
      );
    const milestones = (input.radarYear.milestones ?? [])
      .map((m) => m as Record<string, unknown>)
      .filter((m) => typeof m.date === "string" && (m.date as string).startsWith(month))
      .map((m) => ({
        title: String(m.title ?? "Jalon"),
        date: m.date as string,
        icon: String(m.icon ?? "📌"),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    radar = {
      month: `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`,
      campaigns,
      milestones,
    };
  }

  return {
    editorial: input.spaces.length > 0,
    me: input.me,
    mine,
    upcoming,
    published: published.slice(0, 6),
    radar,
  };
}
