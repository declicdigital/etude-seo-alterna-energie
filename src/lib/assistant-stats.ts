/**
 * Chiffres en temps réel pour D.I.G.I.P.O.T.E : tout est calculé ici, exactement, à partir des
 * données de Digicom, puis donné au modèle sous forme de tableaux à lire (il ne compte jamais
 * lui-même). Seules les rubriques ouvertes à la personne sont calculées.
 */
import existingFaq from "@/data/faq-existing.json";
import type { FaqRequest } from "./faq";
import {
  NEWSLETTER_CALENDARS,
  nextSend,
  upcomingDeadlines,
  formatLongDay,
} from "./newsletter-calendar";
import { dataRows, getRow, type EditsMap } from "./workbook";

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

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
const frDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Date d'une cellule (AAAA-MM-JJ, JJ/MM/AAAA, numéro de série Excel ou texte contenant une date). */
export function cellDate(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const pl = (n: number, word: string, plural = `${word}s`) => `${n} ${n > 1 ? plural : word}`;

const truthy = (v: unknown) => {
  const s = v == null ? "" : String(v).trim().toLowerCase();
  return !!s && !["non", "no", "false", "0", "-"].includes(s);
};

/** Compte par clé, trié du plus grand au plus petit (ou par clé si `byKey`). */
function tally(values: (string | null | undefined)[], byKey = false): [string, number][] {
  const m = new Map<string, number>();
  for (const v of values) {
    const k = (v ?? "").trim() || "(non renseigné)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) =>
    byKey ? a[0].localeCompare(b[0]) : b[1] - a[1] || a[0].localeCompare(b[0]),
  );
}
const line = (pairs: [string, number][], label: (k: string) => string = (k) => k) =>
  pairs.length ? pairs.map(([k, n]) => `${label(k)} : ${n}`).join(" · ") : "aucun";

/* ───────────── Listes des contenus en ligne ───────────── */

export type ListSpec = {
  id: string;
  label: string;
  sheet: string;
  dateLabel: string;
  energy?: boolean;
  subcat?: boolean;
};

export const LISTS: ListSpec[] = [
  {
    id: "blog-part",
    label: "Blog Particulier",
    sheet: "BLOG - ARTICLES::Particulier",
    dateLabel: "« Dernière maj »",
    energy: true,
  },
  {
    id: "blog-pro",
    label: "Blog Professionnel",
    sheet: "BLOG - ARTICLES::Professionnel",
    dateLabel: "« Dernière maj »",
    energy: true,
  },
  {
    id: "pac-contenus",
    label: "Stratégie PAC · Contenus",
    sheet: "STRATEGIE - ARTICLES",
    dateLabel: "« Dernière maj »",
  },
  {
    id: "planete-blog",
    label: "Parlons Planète · Blog",
    sheet: "PLANETE - ARTICLES",
    dateLabel: "« Date de publication »",
    subcat: true,
  },
];

type ListRow = {
  title: string;
  url: boolean;
  published: boolean;
  date: string | null;
  category: string;
  subcat: string;
  energy: string;
  noindex: boolean;
};

export function listRows(spec: ListSpec, edits: EditsMap): ListRow[] {
  // La liste et ses sous-listes (feuilles « Liste/Sous-liste » créées dans le menu).
  const sheets = [
    spec.sheet,
    ...Object.keys(edits).filter(
      (s) =>
        s.startsWith(`${spec.sheet}/`) ||
        (!spec.sheet.includes("::") && s.startsWith(`${spec.sheet}::`)),
    ),
  ];
  const out: ListRow[] = [];
  for (const sheet of sheets) {
    for (const id of dataRows(sheet, edits)) {
      const r = getRow(sheet, id, edits);
      const title = r[1] == null ? "" : String(r[1]).trim();
      if (!title) continue;
      out.push({
        title,
        url: !!(r[9] && String(r[9]).trim()),
        published: truthy(r[0]),
        date: cellDate(r[4]),
        category: r[6] == null ? "" : String(r[6]).trim(),
        subcat: r[7] == null ? "" : String(r[7]).trim(),
        energy: r[10] == null ? "" : String(r[10]).trim(),
        noindex: truthy(r[8]),
      });
    }
  }
  return out;
}

function listBlock(spec: ListSpec, rows: ListRow[], today: string): string[] {
  const thisMonth = today.slice(0, 7);
  const thisYear = today.slice(0, 4);
  const dated = rows.filter((r) => r.date);
  const months = tally(
    dated.map((r) => r.date!.slice(0, 7)),
    true,
  ).reverse();
  const lines = [
    `- ${spec.label} : ${pl(rows.length, "article")} dans la liste des contenus en ligne (${rows.filter((r) => r.url).length} avec leur lien en ligne ; case « Publié » cochée pour ${rows.filter((r) => r.published).length}${rows.some((r) => r.noindex) ? ` ; ${rows.filter((r) => r.noindex).length} en noindex` : ""})`,
    `  - date utilisée : colonne ${spec.dateLabel}${spec.energy ? " (date de dernière mise à jour, ou de publication pour les articles ajoutés depuis le suivi)" : ""}`,
    `  - ce mois-ci (${monthLabel(thisMonth)}) : ${dated.filter((r) => r.date!.startsWith(thisMonth)).length} · cette année (${thisYear}) : ${dated.filter((r) => r.date!.startsWith(thisYear)).length} · sans date : ${rows.length - dated.length}`,
    `  - par année : ${line(
      tally(
        dated.map((r) => r.date!.slice(0, 4)),
        true,
      ),
    )}`,
    `  - par mois : ${line(months, monthLabel)}`,
    `  - par catégorie : ${line(tally(rows.map((r) => r.category)))}`,
  ];
  if (spec.subcat)
    lines.push(
      `  - par sous-catégorie : ${line(tally(rows.filter((r) => r.subcat).map((r) => `${r.category} › ${r.subcat}`)))}`,
    );
  if (spec.energy && rows.some((r) => r.energy))
    lines.push(
      `  - par énergie (quand elle est renseignée) : ${line(tally(rows.filter((r) => r.energy).map((r) => r.energy)))}`,
    );
  const recent = [...dated].sort((a, b) => b.date!.localeCompare(a.date!)).slice(0, 8);
  if (recent.length)
    lines.push(
      `  - les plus récents : ${recent.map((r) => `« ${r.title} » (${frDate(r.date!)})`).join(" ; ")}`,
    );
  return lines;
}

/* ───────────── Suivi éditorial ───────────── */

type Step = { key: string; status?: string; date?: string; deadline?: string; assignee?: string };
export type TrackedArticle = {
  title?: string;
  audience?: string;
  category?: string;
  type?: string;
  dest?: string;
  blogRowId?: number | null;
  createdAt?: string;
  steps?: Step[];
};
type Todo = {
  sujet?: string;
  h1?: string;
  editrice?: string;
  deadline?: string;
  articleId?: string | null;
};

const STEP_LABELS: Record<string, string> = {
  brief: "Brief",
  redaction: "Rédaction",
  expert: "Relecture de l'expert métier",
  image: "Image",
  relecture: "Relecture",
  integration: "Intégration",
};

export type SpaceSpec = { id: string; label: string };
export const SPACES: Record<string, SpaceSpec> = {
  blog: { id: "blog-suivi", label: "Blog · Suivi éditorial" },
  strat: { id: "pac-suivi", label: "Stratégie PAC · Suivi éditorial" },
  planete: { id: "planete-suivi", label: "Parlons Planète · Suivi éditorial" },
};

function suiviBlock(
  spec: SpaceSpec,
  articles: TrackedArticle[],
  todos: Todo[],
  today: string,
): string[] {
  const thisMonth = today.slice(0, 7);
  const stepOf = (a: TrackedArticle, k: string) => (a.steps ?? []).find((s) => s.key === k);
  const pubDate = (a: TrackedArticle) => {
    const s = stepOf(a, "integration");
    return s?.status === "done" && /^\d{4}-\d{2}-\d{2}$/.test(s.date ?? "") ? s.date! : null;
  };
  const redDate = (a: TrackedArticle) => {
    const s = stepOf(a, "redaction");
    return s && s.status !== "pending" && /^\d{4}-\d{2}-\d{2}$/.test(s.date ?? "") ? s.date! : null;
  };
  const isPublished = (a: TrackedArticle) =>
    !!a.blogRowId || stepOf(a, "integration")?.status === "done";
  const published = articles.filter(isPublished);
  const ongoing = articles.filter((a) => !isPublished(a));
  const current = (a: TrackedArticle) => (a.steps ?? []).find((s) => s.status === "pending");
  const late = ongoing.flatMap((a) =>
    (a.steps ?? [])
      .filter((s) => s.status === "pending" && s.deadline && s.deadline < today)
      .map(
        (s) =>
          `« ${a.title || "Sans titre"} » (${STEP_LABELS[s.key] ?? s.key}, deadline ${frDate(s.deadline!)})`,
      ),
  );
  const pending = todos.filter((t) => !t.articleId);
  const daysLeft = (d?: string) =>
    d && /^\d{4}-\d{2}-\d{2}$/.test(d)
      ? Math.round((Date.parse(d) - Date.parse(today)) / 86400000)
      : null;
  if (!articles.length && !pending.length)
    return [`- ${spec.label} : aucun article suivi pour le moment, rien dans « À rédiger »`];
  const lines = [
    `- ${spec.label} : ${pl(articles.length, "article suivi", "articles suivis")}, ${pl(published.length, "publié", "publiés")} (intégration validée), ${ongoing.length} en cours`,
    `  - en cours, par étape actuelle : ${line(tally(ongoing.map((a) => STEP_LABELS[current(a)?.key ?? ""] ?? "—")))}`,
    `  - publiés ce mois-ci (${monthLabel(thisMonth)}) : ${published.filter((a) => pubDate(a)?.startsWith(thisMonth)).length} · rédigés ce mois-ci : ${articles.filter((a) => redDate(a)?.startsWith(thisMonth)).length}`,
    `  - publiés par mois (date de validation de l'intégration) : ${line(
      tally(
        published
          .map(pubDate)
          .filter(Boolean)
          .map((d) => d!.slice(0, 7)),
        true,
      ).reverse(),
      monthLabel,
    )}`,
    `  - rédigés par mois (date de validation de la rédaction) : ${line(
      tally(
        articles
          .map(redDate)
          .filter(Boolean)
          .map((d) => d!.slice(0, 7)),
        true,
      ).reverse(),
      monthLabel,
    )}`,
  ];
  if (spec.id === "blog-suivi")
    lines.push(`  - par cible : ${line(tally(articles.map((a) => a.audience)))}`);
  if (spec.id === "pac-suivi")
    lines.push(
      `  - par type : ${line(tally(articles.map((a) => a.type)))} · par destination : ${line(tally(articles.map((a) => a.dest)))}`,
    );
  lines.push(`  - par catégorie : ${line(tally(articles.map((a) => a.category)))}`);
  lines.push(
    `  - deadlines d'étape dépassées : ${late.length ? `${late.length} → ${late.join(" ; ")}` : "aucune"}`,
  );
  if (ongoing.length)
    lines.push(
      `  - articles en cours : ${ongoing
        .map((a) => {
          const s = current(a);
          return `« ${a.title || "Sans titre"} » → ${STEP_LABELS[s?.key ?? ""] ?? "—"}${s?.assignee ? ` (${s.assignee})` : ""}${s?.deadline ? `, deadline ${frDate(s.deadline)}` : ""}`;
        })
        .join(" ; ")}`,
    );
  if (published.length)
    lines.push(
      `  - derniers publiés : ${[...published]
        .sort((a, b) => (pubDate(b) ?? "").localeCompare(pubDate(a) ?? ""))
        .slice(0, 6)
        .map(
          (a) => `« ${a.title || "Sans titre"} »${pubDate(a) ? ` (${frDate(pubDate(a)!)})` : ""}`,
        )
        .join(" ; ")}`,
    );
  lines.push(
    `  - « À rédiger » : ${pl(pending.length, "sujet")} pas encore enregistré${pending.length > 1 ? "s" : ""} en article${
      pending.length
        ? ` (deadline dépassée : ${pending.filter((t) => (daysLeft(t.deadline) ?? 1) < 0).length}, deadline dans moins de 5 jours : ${
            pending.filter((t) => {
              const n = daysLeft(t.deadline);
              return n !== null && n >= 0 && n < 5;
            }).length
          } ; par éditrice : ${line(tally(pending.map((t) => t.editrice)))})`
        : ""
    }`,
  );
  return lines;
}

/* ───────────── FAQ ───────────── */

function faqBlock(requests: FaqRequest[], zoneIds: Set<string>, today: string): string[] {
  const lines: string[] = [];
  const thisMonth = today.slice(0, 7);
  if (zoneIds.has("faq-demandes")) {
    const validated = requests.filter((r) => r.validatedAt);
    lines.push(
      `- FAQ · Demandes : ${pl(requests.length, "demande")}, ${pl(validated.length, "validée")}, ${requests.length - validated.length} en attente · par cible : ${line(tally(requests.map((r) => r.target)))} · Zendesk ou Site Web : ${line(tally(requests.map((r) => r.channel || "non précisé")))} · par type : ${line(tally(requests.map((r) => r.type)))} · par catégorie : ${line(tally(requests.map((r) => r.category || "sans catégorie (Site Web)")))} · demandes créées ce mois-ci : ${requests.filter((r) => (r.createdAt ?? "").startsWith(thisMonth)).length} · validées ce mois-ci : ${validated.filter((r) => (r.validatedAt ?? "").startsWith(thisMonth)).length}`,
    );
  }
  for (const [zone, target] of [
    ["faq-part", "Particulier"],
    ["faq-pro", "Professionnel"],
  ] as const) {
    if (!zoneIds.has(zone)) continue;
    const base = (existingFaq as { target: string; category: string }[]).filter(
      (f) => f.target === target,
    );
    const added = requests.filter((r) => r.validatedAt && r.target === target);
    lines.push(
      `- FAQ ${target} en ligne : ${base.length + added.length} questions (${added.length} validées depuis les demandes) · par catégorie : ${line(tally([...base.map((f) => f.category), ...added.map((r) => r.category)]))}`,
    );
  }
  return lines;
}

/* ───────────── Newsletters ───────────── */

const NL_ZONE: Record<string, string> = {
  "grands-comptes": "nl-gc",
  interne: "nl-interne",
  b2c: "nl-b2c",
  sme: "nl-sme",
};

function newsletterBlock(zoneIds: Set<string>, now: Date): string[] {
  const lines: string[] = [];
  for (const cal of NEWSLETTER_CALENDARS) {
    if (!zoneIds.has(NL_ZONE[cal.id])) continue;
    const next = nextSend(cal, now);
    const steps = upcomingDeadlines(cal, now).slice(0, 4);
    const sent = cal.newsletters.filter(
      (n) => n.dates[n.dates.length - 1] < now.toISOString().slice(0, 10),
    ).length;
    lines.push(
      `- Newsletter ${cal.title} : ${next ? `prochain envoi ${formatLongDay(next.dates[next.dates.length - 1])} ${next.year} (newsletter de ${monthLabel(next.id)})` : "plus aucun envoi prévu"} · prochaines échéances : ${steps.length ? steps.map((d) => `${d.step.label} le ${frDate(d.date)}`).join(" ; ") : "aucune"} · ${sent} envoyées / ${cal.newsletters.length} prévues au calendrier`,
    );
  }
  return lines;
}

/* ───────────── Assemblage ───────────── */

export type StatsInput = {
  today: string;
  zoneIds: Set<string>;
  edits: EditsMap;
  articles: Partial<Record<keyof typeof SPACES, TrackedArticle[]>>;
  todos: Partial<Record<keyof typeof SPACES, Todo[]>>;
  faq: FaqRequest[];
};

/** Bloc « Données chiffrées » du contexte du modèle. */
export function buildStatsBlock(input: StatsInput): string {
  const { today, zoneIds, edits } = input;
  const out: string[] = [
    `Aujourd'hui : ${frDate(today)} (mois en cours : ${monthLabel(today.slice(0, 7))}).`,
  ];
  const lists = LISTS.filter((l) => zoneIds.has(l.id));
  if (lists.length) {
    out.push("", "### Listes des contenus en ligne");
    const totals: [string, number][] = [];
    for (const spec of lists) {
      const rows = listRows(spec, edits);
      totals.push([spec.label, rows.length]);
      out.push(...listBlock(spec, rows, today));
    }
    const blog = totals.filter(([l]) => l.startsWith("Blog "));
    if (blog.length === 2)
      out.push(
        `- Total Blog (Particulier + Professionnel) : ${blog[0][1]} + ${blog[1][1]} = ${blog[0][1] + blog[1][1]} articles`,
      );
    out.push(
      `- Total de toutes les listes ci-dessus : ${totals.reduce((n, [, v]) => n + v, 0)} contenus`,
    );
  }
  const suivis = (Object.keys(SPACES) as (keyof typeof SPACES)[]).filter((k) =>
    zoneIds.has(SPACES[k].id),
  );
  if (suivis.length) {
    out.push("", "### Suivis éditoriaux");
    for (const k of suivis)
      out.push(...suiviBlock(SPACES[k], input.articles[k] ?? [], input.todos[k] ?? [], today));
  }
  const faq = faqBlock(input.faq, zoneIds, today);
  if (faq.length) out.push("", "### FAQ", ...faq);
  const nl = newsletterBlock(zoneIds, new Date(`${today}T12:00:00`));
  if (nl.length) out.push("", "### Newsletters", ...nl);
  return out.join("\n");
}
