import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAccess, signOutAndGoToAuth, type AccessStatus } from "@/lib/access";
import { pendingEditorialDestination } from "@/lib/editorial-links";
import symbol from "@/assets/alterna-symbol.png.asset.json";

export const Route = createFileRoute("/en-attente")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Demande en attente - Outil contenus Alterna Énergie" },
      { name: "description", content: "Votre demande d'accès à Outil contenus Alterna Énergie est en cours de validation." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Demande en attente - Outil contenus Alterna Énergie" },
      { property: "og:description", content: "Votre demande d'accès à Outil contenus Alterna Énergie est en cours de validation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PendingPage,
});

function PendingPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let notified = false;
    const check = async () => {
      const a = await getAccess();
      if (!active) return;
      if (!a.userId) {
        navigate({ to: "/auth" });
        return;
      }
      if (a.status === "approved") {
        navigate(pendingEditorialDestination());
        return;
      }
      setStatus(a.status);
      setEmail(a.email);
      if (a.status === "pending" && !notified) {
        notified = true;
        fetch("/api/public/notify-access-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: a.userId }),
        }).catch(() => {});
      }
    };
    check();
    const t = setInterval(check, 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [navigate]);

  const rejected = status === "rejected";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-xl">
        <img src={symbol.url} alt="Alterna Énergie" className="mx-auto mb-4 h-12 w-12" />
        <h1 className="text-xl font-semibold text-emerald-900">
          {rejected ? "Demande refusée" : "Demande en attente de validation"}
        </h1>
        <p className="mt-2 text-sm text-emerald-700/80">
          {rejected
            ? "Votre demande d'accès n'a pas été acceptée. Contactez l'administrateur si vous pensez qu'il s'agit d'une erreur."
            : "Votre demande a bien été enregistrée. Un administrateur doit la valider avant que vous puissiez accéder à l'outil."}
        </p>
        {email && <p className="mt-3 text-xs text-emerald-700/60">Compte : {email}</p>}
        <button
          onClick={signOutAndGoToAuth}
          className="mt-6 rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-50"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
