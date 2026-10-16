import { BookOpen, Newspaper, Target, ArrowRight, Mail, CheckCircle2 } from "lucide-react";
type Step = { title: string; who: string; color: string; items: string[]; mail?: string };
type Flow = { title: string; intro: string; steps: Step[]; end: string[] };

const C = {
  prep: "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
  remind: "border-amber-500 bg-amber-50 dark:bg-amber-500/10",
  review: "border-violet-500 bg-violet-50 dark:bg-violet-500/10",
  integ: "border-sky-500 bg-sky-50 dark:bg-sky-500/10",
  done: "border-rose-500 bg-rose-50 dark:bg-rose-500/10",
};

const FLOWS: Flow[] = [
  {
    title: "Stratégie PAC",
    intro: "Contenus Particulier uniquement · catégorie Blog ou Éditorial",
    steps: [
      { title: "À rédiger", who: "Marina · Caroline · Elodie · Geoffrey", color: C.prep, items: ["Sujet", "Type : Réécriture / Création", "Titre H1", "Éditrice", "Catégorie Blog / Éditorial", "Deadline", "Lien du brief", "Lien du doc", "Tout rempli → Enregistrer"] },
      { title: "Rappel deadline", who: "Automatique · 9 h", color: C.remind, items: ["J-5 avant deadline", "Aurorae : Caroline + Elodie", "Marina seule", "Point rouge < 5 jours"], mail: "Mail rappel éditrice" },
      { title: "1 · Brief + 2 · Rédaction", who: "Validés à l'enregistrement", color: C.prep, items: ["Carte créée", "Brief + doc liés", "Passage auto en relecture"], mail: "Mail → Fannie" },
      { title: "3 · Relecture + Image", who: "Service Communication", color: C.review, items: ["Relire", "Ajouter l'image (glisser / clic)", "Valider l'étape"], mail: "Mail → Marick" },
      { title: "4 · Intégration", who: "Marick", color: C.integ, items: ["Télécharger l'image", "Intégrer sur le site", "Date + lien obligatoires", "Valider"], mail: "Mail → Geoffrey" },
    ],
    end: ["En haut de « Contenus »", "Si Blog → aussi en haut de Blog › Particulier"],
  },
  {
    title: "Blog",
    intro: "Particulier (cartes roses) · Professionnel (cartes bleues)",
    steps: [
      { title: "À rédiger", who: "Marina · Caroline · Elodie · Geoffrey", color: C.prep, items: ["Sujet", "Titre H1", "Éditrice", "Cible Particulier / Pro", "Catégorie + Énergie", "Deadline", "Lien du doc", "Tout rempli → Enregistrer"] },
      { title: "Rappel deadline", who: "Automatique · 9 h", color: C.remind, items: ["J-5 avant deadline", "Aurorae : Caroline + Elodie", "Marina seule", "Point rouge < 5 jours"], mail: "Mail rappel éditrice" },
      { title: "1 · Rédaction", who: "Validée à l'enregistrement", color: C.prep, items: ["Carte créée", "Couleur selon la cible", "Passage auto en relecture"], mail: "Mail → Fannie" },
      { title: "2 · Relecture + Image", who: "Service Communication", color: C.review, items: ["Relire", "Ajouter l'image (glisser / clic)", "Valider l'étape"], mail: "Mail → Marick" },
      { title: "3 · Intégration", who: "Marick", color: C.integ, items: ["Télécharger l'image", "Intégrer sur le site", "Date + lien obligatoires", "Valider"], mail: "Mail → Geoffrey" },
    ],
    end: ["En haut du Blog de la bonne cible", "Coché « Publié »"],
  },
];

function FlowChart({ flow }: { flow: Flow }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold tracking-tight">Modop — {flow.title}</h3>
        <p className="text-sm text-muted-foreground">{flow.intro}</p>
      </div>
      <div className="overflow-x-auto pb-4 snap-x">
        <div className="flex items-stretch gap-3 w-max">
          {flow.steps.map((s) => (
            <div key={s.title} className="flex items-center gap-3 snap-start">
              <div className={`w-72 h-full rounded-2xl border-2 p-5 flex flex-col ${s.color}`}>
                <div className="text-lg font-semibold">{s.title}</div>
                <div className="text-xs uppercase tracking-wide text-foreground/60 mt-1">{s.who}</div>
                <ul className="mt-4 space-y-1.5 text-sm flex-1">
                  {s.items.map((i) => <li key={i} className="flex gap-2"><span className="text-foreground/40">•</span>{i}</li>)}
                </ul>
                {s.mail && <div className="mt-4 rounded-lg bg-card border border-border px-3 py-2 text-sm font-medium flex items-center gap-2"><Mail className="size-4 text-primary" />{s.mail}</div>}
              </div>
              <ArrowRight className="size-6 text-muted-foreground shrink-0" />
            </div>
          ))}
          <div className={`w-72 rounded-2xl border-2 p-5 snap-start ${C.done}`}>
            <div className="text-lg font-semibold flex items-center gap-2"><CheckCircle2 className="size-5" />Publié</div>
            <ul className="mt-4 space-y-1.5 text-sm">
              {flow.end.map((i) => <li key={i} className="flex gap-2"><span className="text-foreground/40">•</span>{i}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function GuideView(_: { onOpenSheet: (sheet: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 md:px-10 py-8 space-y-12">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><BookOpen className="size-5" /></div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Guide de l'outil</h2>
            <p className="text-sm text-muted-foreground mt-1">Faites glisser horizontalement pour voir toutes les étapes.</p>
          </div>
        </div>
        {FLOWS.map((f) => <FlowChart key={f.title} flow={f} />)}
        <section className="rounded-2xl border border-border bg-card p-5 text-sm space-y-1.5">
          <div className="font-semibold text-base mb-2">Partout</div>
          <div>• @ dans un message → un seul mail à toutes les personnes taguées</div>
          <div>• Messages modifiables sans renvoi de mail</div>
          <div>• Lien des mails → ouvre la carte à la bonne étape</div>
          <div>• Geoffrey en copie de tous les mails</div>
        </section>
      </div>
    </div>
  );
}

const ENTRIES = [
  { icon: Target, title: "Stratégie PAC", sheet: "SUIVI STRATEGIE", text: "Suivi éditorial des contenus PAC : brief, rédaction, relecture + image, intégration." },
  { icon: Newspaper, title: "Blog", sheet: "SUIVI EDITORIAL", text: "Suivi éditorial des articles de blog Particulier et Professionnel." },
  { icon: BookOpen, title: "Guide de l'outil", sheet: "__guide", text: "Les modes opératoires schématisés de chaque suivi." },
];

export function HomeView({ onOpenSheet }: { onOpenSheet: (sheet: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 md:px-8 py-12 space-y-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary font-semibold">Alterna Énergie</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Bienvenue sur l'Outil contenus</h2>
          <p className="mt-2 text-muted-foreground">Choisissez un espace pour commencer.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {ENTRIES.map((e) => {
            const Icon = e.icon;
            return (
              <button key={e.title} type="button" onClick={() => onOpenSheet(e.sheet)}
                className="group text-left rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/50">
                <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon className="size-5" /></div>
                <div className="mt-4 font-semibold flex items-center gap-1">{e.title}<ArrowRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                <p className="mt-1 text-sm text-muted-foreground">{e.text}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
