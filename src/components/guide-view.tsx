import { BookOpen, ExternalLink, ListChecks, FileText, Newspaper, Link2, FolderTree, Layers } from "lucide-react";

type Section = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sheet?: string;
  description: string;
  accent: string;
};

const SECTIONS: Section[] = [
  {
    icon: ListChecks,
    title: "TODO GENERALE",
    sheet: "TODO GENERALE",
    accent: "border-amber-500 bg-amber-50 dark:bg-amber-500/10",
    description:
      "Liste les grandes actions en cours (TODO / EN COURS / DONE), avec les tickets JIRA associés. C'est la vue d'ensemble de ce qui bouge côté SEO.",
  },
  {
    icon: FolderTree,
    title: "Structure Particulier",
    sheet: "Structure RES",
    accent: "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
    description:
      "Liste l'ensemble des pages et articles côté particulier, leur arborescence et la façon dont ils sont introduits dans la structure. Le maillage et l'arborescence étant un élément fondamental du SEO, cela permet de structurer et de savoir où en est le site.",
  },
  {
    icon: FolderTree,
    title: "Structure Professionnel",
    sheet: "Structure PRO",
    accent: "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
    description:
      "Le pendant \"Professionnel\" de Structure Particulier - à mettre au propre.",
  },
  {
    icon: FileText,
    title: "BLOG - IDEE",
    sheet: "BLOG - IDEE",
    accent: "border-sky-500 bg-sky-50 dark:bg-sky-500/10",
    description: "Liste d'idées potentielles d'articles à explorer.",
  },
  {
    icon: Newspaper,
    title: "BLOG - ARTICLES",
    sheet: "BLOG - ARTICLES",
    accent: "border-sky-500 bg-sky-50 dark:bg-sky-500/10",
    description:
      "Tous les articles du blog, publiés ou en stock. Cochez la case « Publié » pour marquer un article comme mis en ligne. Les articles non cochés sont le stock à faire valider puis publier.",
  },
  {
    icon: Link2,
    title: "Netlinking",
    sheet: "Netlinking",
    accent: "border-violet-500 bg-violet-50 dark:bg-violet-500/10",
    description: "Suivi du netlinking.",
  },
  {
    icon: Layers,
    title: "Cocon sémantique énergie verte",
    accent: "border-violet-500 bg-violet-50 dark:bg-violet-500/10",
    description:
      "Cocon sémantique énergie verte à terminer - il n'est pas encore finalisé.",
  },
];

const JIRA_LINKS = [
  {
    title: "Board contenus - JIRA SC",
    href: "https://soregies.atlassian.net/jira/core/projects/SC/board?filter=&groupBy=none",
    description: "Suivi et création des contenus (pages / articles de blog).",
  },
  {
    title: "Board site vitrine - JIRA PSV",
    href: "https://soregies.atlassian.net/jira/core/projects/PSV/board",
    description: "Suivi et demandes de modifications sur le site vitrine.",
  },
];

const PROCESS_STEPS = [
  "L'agence SEO réalise un brief SEO",
  "Rédaction du contenu",
  "Validation du contenu par le service comm'",
  "Validation du contenu par l'agence SEO",
  "Publication",
];

export function GuideView({ onOpenSheet }: { onOpenSheet: (sheet: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-10">
        <section>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Guide de l'outil</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Une vue d'ensemble de chaque onglet et des liens JIRA à utiliser au quotidien.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Les onglets
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const clickable = !!s.sheet;
              return (
                <button
                  key={s.title}
                  type="button"
                  disabled={!clickable}
                  onClick={() => s.sheet && onOpenSheet(s.sheet)}
                  className={`text-left rounded-lg border-l-4 border-y border-r border-border bg-card p-4 transition-all ${s.accent} ${
                    clickable ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : "opacity-90"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="size-4 text-foreground/70" />
                    <div className="font-semibold text-sm">{s.title}</div>
                  </div>
                  <p className="text-xs text-foreground/75 leading-relaxed">{s.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Liens JIRA importants
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {JIRA_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="group rounded-lg border border-border bg-card p-4 hover:border-primary/60 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{l.title}</span>
                  <ExternalLink className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{l.description}</p>
              </a>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Process contenus (page / article de blog)
          </h3>
          <ol className="space-y-2">
            {PROCESS_STEPS.map((step, i) => (
              <li key={step} className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3">
                <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground/90">{step}</span>
              </li>
            ))}
          </ol>
        </section>

      </div>
    </div>
  );
}
