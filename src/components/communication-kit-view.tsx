import { useState } from "react";
import { Download, Copy, Check, FolderDown, FileText, Type, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { kitResources } from "@/lib/communication-kit";

export const kitColors = [
  { name: "Green renouvelable", hex: "#003838", className: "bg-kit-renewable" },
  { name: "Green énergie", hex: "#54D89C", className: "bg-kit-energy" },
  { name: "Solaire", hex: "#E1EC64", className: "bg-kit-solar" },
  { name: "Hydraulique", hex: "#639AFF", className: "bg-kit-hydro" },
  { name: "Beige / Blanc cassé", hex: "#FFFBF4", className: "bg-kit-ivory" },
];

function Resource({ resource }: { resource: typeof kitResources[number] }) {
  return <div className="flex items-center justify-between gap-3 border-b border-border py-4 last:border-0">
    <div className="min-w-0"><p className="font-medium break-words">{resource.title}</p><p className="mt-1 text-xs text-muted-foreground">{resource.filename.split('.').pop()?.toUpperCase()} · {(resource.size / 1024 / 1024).toFixed(2)} Mo</p></div>
    <Button asChild variant="outline" size="icon"><a href={resource.url} download={resource.filename} aria-label={`Télécharger ${resource.title}`} title={`Télécharger ${resource.title}`}><Download /></a></Button>
  </div>;
}

export function CommunicationKitView() {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const complete = kitResources.find(r => r.group === "complete");
  const logo = kitResources.find(r => r.key === "resource-1");
  return <div className="max-w-6xl mx-auto px-6 md:px-10 py-12 space-y-10">
    <header className="flex flex-wrap items-start justify-between gap-5">
      <div><p className="text-primary text-sm font-medium mb-2">Ressources de marque</p><h1 className="text-3xl font-semibold">Kit de communication</h1><p className="mt-3 text-muted-foreground">Tous les éléments pour vos communications.</p></div>
      {complete && <Button asChild size="lg"><a href={complete.url} download={complete.filename}><FolderDown /> Télécharger le kit complet</a></Button>}
    </header>
    <section className="border-t border-border pt-8">
      <h2 className="text-xl font-semibold">Logos</h2>
      <div className="mt-5 flex items-start gap-3 bg-secondary text-secondary-foreground p-4 rounded-md"><ShieldCheck className="size-5 shrink-0 mt-0.5" /><div className="text-sm space-y-2"><p className="font-semibold">Toute utilisation du logo nécessite validation par le service Communication.</p><p>Si vous ne trouvez pas le format attendu du logo, n’hésitez pas à solliciter le service Communication.</p></div></div>
      {logo && <img src={logo.url} alt="Logo Alterna Énergie" className="h-20 w-auto max-w-full object-contain mt-7 mb-5" />}
      <div className="grid md:grid-cols-2 gap-x-8">{kitResources.filter(r => r.group === "logos" || r.group === "variants").map(r => <Resource key={r.key} resource={r} />)}</div>
    </section>
    <section className="border-t border-border pt-8">
      <h2 className="text-xl font-semibold flex items-center gap-2"><Type className="size-5 text-primary" /> Polices de caractères</h2>
      <p className="mt-3 text-sm text-muted-foreground">Partagez les fichiers Inter et Poppins à vos collaborateurs afin qu’ils installent ces polices et leurs déclinaisons sur leur PC.</p>
      <div className="grid md:grid-cols-2 gap-8 mt-6"><div><p className="text-xl font-semibold">Poppins SemiBold</p><p className="text-sm text-muted-foreground mt-1">Titres et sous-titres</p></div><div><p className="text-xl font-medium">Inter Medium</p><p className="text-sm text-muted-foreground mt-1">Tous les contenus texte</p></div></div>
      <div className="mt-4">{kitResources.filter(r => r.group === "fonts").map(r => <Resource key={r.key} resource={r} />)}</div>
    </section>
    <section className="border-t border-border pt-8">
      <h2 className="text-xl font-semibold">Couleurs</h2><p className="mt-3 text-sm text-muted-foreground">Les couleurs principales à utiliser, en remplacement du « yellow & blue ».</p>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6">{kitColors.map(c => <div key={c.hex} className="border border-border rounded-md overflow-hidden"><div className={`h-24 ${c.className}`} /><div className="p-3"><p className="text-sm font-medium min-h-10">{c.name}</p><Button variant="ghost" size="sm" className="px-0 w-full justify-between font-mono" aria-label={`Copier ${c.hex}`} onClick={async () => { try { await navigator.clipboard.writeText(c.hex); setCopied(c.hex); setError(false); } catch { setError(true); } }}>{c.hex}{copied === c.hex ? <Check /> : <Copy />}</Button></div></div>)}</div>
      {error && <p role="alert" className="text-destructive text-sm mt-3">Copie indisponible : sélectionnez le code affiché.</p>}
      <p className="mt-4 text-sm text-muted-foreground">Astuce : pensez à enregistrer ces HEX dans vos applications lorsque vous les utilisez la première fois !</p>
    </section>
    <section className="border-t border-border pt-8"><h2 className="text-xl font-semibold flex items-center gap-2"><FileText className="size-5 text-primary" /> Charte, guide de marque et modèle email</h2><div className="mt-3">{kitResources.filter(r => r.group === "documents").map(r => <Resource key={r.key} resource={r} />)}</div></section>
  </div>;
}