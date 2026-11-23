import { Bot, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const ALIENOR_URL = "https://soregies.ai/";

/**
 * Aliénor's login cannot work inside an embedded frame (browsers block its
 * session cookies there), so we open it in its own window. Its authentication
 * stays entirely owned by Aliénor. Never send Digicom tokens.
 */
export function AlienorView() {
  const openWindow = () => {
    const w = Math.min(1200, window.screen.availWidth - 80);
    const h = Math.min(900, window.screen.availHeight - 80);
    const win = window.open(ALIENOR_URL, "alienor", `width=${w},height=${h},left=40,top=40`);
    if (!win) window.open(ALIENOR_URL, "_blank", "noopener");
  };
  return (
    <section className="flex flex-1 min-h-0 flex-col">
      <div className="hidden h-12 shrink-0 md:block" />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <Bot className="mx-auto mb-4 size-10 text-primary" aria-hidden="true" />
          <h1 className="mb-2 text-2xl font-semibold">Aliénor</h1>
          <p className="mb-6 text-muted-foreground">
            L'IA s'ouvre dans sa propre fenêtre : connecte-toi avec ton compte et ton mot de passe Aliénor.
          </p>
          <div className="flex flex-col gap-2">
            <Button size="lg" onClick={openWindow}>
              <Bot className="size-4" /> Ouvrir Aliénor
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href={ALIENOR_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" /> Ou dans un nouvel onglet
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
