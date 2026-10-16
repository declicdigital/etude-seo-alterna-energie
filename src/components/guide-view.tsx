import { BookOpen, Newspaper, Target, ArrowRight } from "lucide-react";
import modopPac from "@/assets/modop-pac.png";
import modopBlog from "@/assets/modop-blog.png";

const MODOPS = [
  { title: "Stratégie PAC", img: modopPac },
  { title: "Blog", img: modopBlog },
];

export function GuideView(_: { onOpenSheet: (sheet: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-8 space-y-10">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Guide de l'outil</h2>
            <p className="text-sm text-muted-foreground mt-1">Le mode opératoire de chaque suivi, en schéma.</p>
          </div>
        </div>
        {MODOPS.map((m) => (
          <section key={m.title} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Modop — {m.title}</h3>
            <a href={m.img} target="_blank" rel="noreferrer">
              <img src={m.img} alt={`Schéma du fonctionnement ${m.title}`} className="w-full rounded-xl border border-border bg-card shadow-sm" />
            </a>
          </section>
        ))}
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
