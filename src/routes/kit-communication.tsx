import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getAccess } from "@/lib/access";
import { useMeta } from "@/lib/use-meta";
import { SheetSidebar } from "@/components/sheet-sidebar";
import { CommunicationKitView } from "@/components/communication-kit-view";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/kit-communication")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Kit De Communication — Digicom" },
    { name: "description", content: "Logos, polices, couleurs, charte et modèle email à télécharger." },
    { property: "og:title", content: "Kit De Communication — Digicom" },
    { property: "og:description", content: "Toutes les ressources de communication, ensemble ou à l’unité." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: async () => {
    const access = await getAccess();
    if (!access.userId) throw redirect({ to: "/auth" });
    if (access.status !== "approved") throw redirect({ to: "/en-attente" });
    return { access };
  },
  component: KitPage,
});

function KitPage() {
  const { access } = Route.useRouteContext();
  const { meta, setMetaValue } = useMeta();
  return <div className="flex h-screen overflow-hidden bg-background text-foreground"><div className="hidden md:block"><SheetSidebar allowed={access.allowedSections} meta={meta} setMetaValue={setMetaValue} /></div><main className="flex-1 min-w-0 overflow-y-auto"><div className="md:hidden px-6 pt-4"><Button asChild variant="ghost"><Link to="/" search={{ sheet: "__home" }}><ArrowLeft /> Accueil</Link></Button></div><CommunicationKitView /></main></div>;
}