import { useState } from "react";
import { Bot, ExternalLink, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** External authentication remains entirely owned by Aliénor. Never send Digicom tokens. */
export function AlienorView() {
  const [reload, setReload] = useState(0);
  return (
    <section className="flex flex-1 min-h-0 flex-col">
      <div className="hidden h-12 shrink-0 md:block" />
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Bot className="size-5 text-primary" aria-hidden="true" />
        <h1 className="mr-auto text-xl font-semibold">Aliénor</h1>
        <Button variant="ghost" size="icon" onClick={() => setReload((n) => n + 1)} title="Recharger Aliénor" aria-label="Recharger Aliénor">
          <RotateCw className="size-4" />
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href="https://soregies.ai/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" /> Ouvrir dans un onglet
          </a>
        </Button>
      </header>
      <iframe
        key={reload}
        src="https://soregies.ai/"
        title="Aliénor — connexion et assistant IA"
        referrerPolicy="no-referrer"
        className="min-h-0 w-full flex-1 border-0 bg-background"
      />
    </section>
  );
}