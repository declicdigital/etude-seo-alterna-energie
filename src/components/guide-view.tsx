import { BookOpen, Newspaper, Target, ArrowRight, Mail, CheckCircle2, PenLine, Image as ImageIcon, Globe, Users, Bell, AtSign, HelpCircle } from "lucide-react";
import logo from "@/assets/alterna-logo.png.asset.json";
import digicomWordmark from "@/assets/digicom-wordmark.png";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FolderDown } from "lucide-react";
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
      { title: "À rédiger", who: "Marina · Caroline · Elodie · Geoffrey", color: C.prep, items: ["Sujet", "Type : Réécriture / Création", "Titre H1", "Édition", "Catégorie Blog / Éditorial", "Catégorie du blog (si Blog)", "Deadline", "Lien du brief", "Lien du doc", "Tout rempli → Enregistrer"] },
      { title: "Rappel deadline", who: "Automatique · 9 h", color: C.remind, items: ["Le lundi avant la deadline", "Aurorae : Caroline + Elodie", "Marina seule", "Point rouge < 5 jours"], mail: "Mail rappel édition" },
      { title: "1 · Brief + 2 · Rédaction", who: "Validés à l'enregistrement", color: C.prep, items: ["Carte créée", "Brief + doc liés", "Passage auto en relecture"], mail: "Mail → Fannie Laurendin" },
      { title: "3 · Relecture + Image", who: "Service Communication", color: C.review, items: ["Relire", "Ajouter l'image (glisser / clic)", "Valider l'étape"], mail: "Mail → Marick" },
      { title: "4 · Intégration", who: "Marick", color: C.integ, items: ["Télécharger l'image", "Intégrer sur le site", "Date + lien obligatoires", "Valider"], mail: "Mail → Geoffrey" },
    ],
    end: ["En haut de « Contenus »", "Si Blog → aussi en haut de Blog › Particulier"],
  },
  {
    title: "Blog",
    intro: "Particulier (cartes roses) · Professionnel (cartes bleues)",
    steps: [
      { title: "À rédiger", who: "Marina · Caroline · Elodie · Geoffrey", color: C.prep, items: ["Sujet", "Titre H1", "Édition", "Cible Particulier / Pro", "Catégorie + Énergie", "Deadline", "Lien du doc", "Tout rempli → Enregistrer"] },
      { title: "Rappel deadline", who: "Automatique · 9 h", color: C.remind, items: ["Le lundi avant la deadline", "Aurorae : Caroline + Elodie", "Marina seule", "Point rouge < 5 jours"], mail: "Mail rappel édition" },
      { title: "1 · Rédaction", who: "Validée à l'enregistrement", color: C.prep, items: ["Carte créée", "Couleur selon la cible", "Passage auto en relecture"], mail: "Mail → Fannie Laurendin" },
      { title: "2 · Relecture + Image", who: "Service Communication", color: C.review, items: ["Relire", "Ajouter l'image (glisser / clic)", "Valider l'étape"], mail: "Mail → Marick" },
      { title: "3 · Intégration", who: "Marick", color: C.integ, items: ["Télécharger l'image", "Intégrer sur le site", "Date + lien obligatoires", "Valider"], mail: "Mail → Geoffrey" },
    ],
    end: ["En haut du Blog de la bonne cible", "Coché « Publié »"],
  },
  {
    title: "FAQ",
    intro: "Demandes de FAQ · Particulier (cartes roses) · Professionnel (cartes bleues)",
    steps: [
      { title: "Demande", who: "Toute personne connectée", color: C.prep, items: ["Demandeur (automatique)", "Création ou Réécriture", "Sujet", "Contenu : à créer ou déjà fourni", "Si déjà fourni → Question + Réponse", "Cible Particulier / Pro", "Catégorie (ou nouvelle)", "Commentaire avec @ et pièce jointe", "Tout rempli → Sauvegarder"], mail: "Mail → Geoffrey" },
      { title: "Échanges sur la carte", who: "Tous les comptes validés", color: C.review, items: ["Nouveaux messages", "@ pour taguer (un seul mail)", "Pièces jointes téléchargeables", "Demande visible en haut du suivi"], mail: "Mail aux personnes taguées" },
      { title: "Validation", who: "Geoffrey seul", color: C.integ, items: ["Lien de la FAQ", "Question finale", "Cible vérifiée", "Cliquer sur Valider"], mail: "Badge « Validée »" },
    ],
    end: ["En haut du tableau Particulier ou Pro", "Visible par tous les comptes validés"],
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
  { icon: HelpCircle, title: "FAQ", sheet: "SUIVI FAQ", text: "Demandes de questions fréquentes Particulier et Professionnel, validées puis ajoutées en ligne." },
  { icon: BookOpen, title: "Guide de l'outil", sheet: "__guide", text: "Les modes opératoires schématisés de chaque suivi." },
];

const TEAM = [
  { name: "Aurorae", role: "Rédaction · Caroline & Elodie", color: "bg-emerald-500" },
  { name: "Marina", role: "Rédaction", color: "bg-violet-500" },
  { name: "Fannie Laurendin", role: "Relecture + image", color: "bg-amber-500" },
  { name: "Marick", role: "Intégration site", color: "bg-sky-500" },
  { name: "Geoffrey", role: "Pilotage · en copie", color: "bg-rose-500" },
];

const PIPE = [
  { label: "À rédiger", icon: PenLine, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { label: "Relecture + image", icon: ImageIcon, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { label: "Intégration", icon: Globe, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { label: "Publié", icon: CheckCircle2, tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
];

export function HomeView({ onOpenSheet }: { onOpenSheet: (sheet: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-10 space-y-10">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 md:p-12">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-24 bottom-0 size-40 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-start gap-5 md:gap-7">
              <img src={logo.url} alt="Logo" className="h-10 md:h-14 w-auto" />
              <div aria-hidden="true" className="h-10 md:h-14 w-px shrink-0 bg-foreground/30" />
              <img src={digicomWordmark} alt="Digicom" width={1281} height={359} className="h-8 md:h-11 w-auto" />
            </div>

            <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight max-w-2xl">Bienvenue sur Digicom</h2>
            <p className="mt-2 text-base md:text-lg font-medium text-primary">
              l'outil de suivi de la communication digitale
            </p>
            <p className="mt-3 text-base md:text-lg text-muted-foreground max-w-2xl">
              Du sujet à la mise en ligne : on rédige, on relit, on intègre, on publie, et chacun reçoit le bon mail au bon moment.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => onOpenSheet("SUIVI STRATEGIE")} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90">
                Stratégie PAC <ArrowRight className="size-4" />
              </button>
              <button onClick={() => onOpenSheet("SUIVI EDITORIAL")} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted">
                Blog <ArrowRight className="size-4" />
              </button>
              <button onClick={() => onOpenSheet("SUIVI FAQ")} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted">
                FAQ <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-6">
          <div><h3 className="text-xl font-semibold">Kit de communication</h3><p className="mt-1 text-sm text-muted-foreground">Logos, polices, couleurs et charte.</p></div>
          <Button asChild variant="outline"><Link to="/kit-communication"><FolderDown /> Ouvrir le kit</Link></Button>
        </section>
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ENTRIES.map((e) => {
            const Icon = e.icon;
            return (
              <button key={e.title} type="button" onClick={() => onOpenSheet(e.sheet)}
                className="group text-left rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/50">
                <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform"><Icon className="size-6" /></div>
                <div className="mt-5 text-lg font-semibold flex items-center gap-1">{e.title}<ArrowRight className="size-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></div>
                <p className="mt-1 text-sm text-muted-foreground">{e.text}</p>
              </button>
            );
          })}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Le parcours d'un contenu</h3>
          <div className="mt-6 flex flex-col md:flex-row md:items-center gap-3">
            {PIPE.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={p.label} className="flex md:flex-1 items-center gap-3">
                  <div className="flex-1 flex flex-col items-center text-center gap-2">
                    <div className={`size-16 rounded-2xl flex items-center justify-center ${p.tone}`}><Icon className="size-7" /></div>
                    <div className="text-sm font-semibold">{p.label}</div>
                  </div>
                  {i < PIPE.length - 1 && <ArrowRight className="hidden md:block size-5 text-muted-foreground shrink-0" />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Users className="size-4" />L'équipe</h3>
            <ul className="mt-4 space-y-3">
              {TEAM.map((t) => (
                <li key={t.name} className="flex items-center gap-3">
                  <div className={`size-9 rounded-full ${t.color} text-primary-foreground flex items-center justify-center text-sm font-bold`}>{t.name[0]}</div>
                  <div><div className="text-sm font-semibold">{t.name}</div><div className="text-xs text-muted-foreground">{t.role}</div></div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Bell className="size-4" />Automatique</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                [Mail, "Un mail à chaque étape validée, avec lien direct vers la carte"],
                [Bell, "Rappel à l'édition le lundi avant la deadline"],
                [AtSign, "@ dans un message : les personnes taguées sont prévenues"],
                [ImageIcon, "Images ajoutées par glisser-déposer, téléchargeables à l'intégration"],
              ].map(([I, t]) => {
                const Ic = I as typeof Mail;
                return <li key={t as string} className="flex gap-3"><span className="size-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Ic className="size-4" /></span><span className="pt-1.5">{t as string}</span></li>;
              })}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
