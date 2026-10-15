import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAccess, signOutAndGoToAuth } from "@/lib/access";
import symbol from "@/assets/alterna-symbol.png.asset.json";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
};

export const Route = createFileRoute("/demandes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Demandes d'accès - Outil contenus Alterna Énergie" },
      { name: "description", content: "Validez ou refusez les demandes d'accès à Outil contenus Alterna Énergie." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Demandes d'accès - Outil contenus Alterna Énergie" },
      { property: "og:description", content: "Validez ou refusez les demandes d'accès à Outil contenus Alterna Énergie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Validé",
  rejected: "Refusé",
};

function RequestsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, status, requested_at, reviewed_at")
      .order("requested_at", { ascending: false });
    setRows((data ?? []) as Profile[]);
  }, []);

  useEffect(() => {
    (async () => {
      const a = await getAccess();
      if (!a.userId) return navigate({ to: "/auth" });
      if (!a.isAdmin) return navigate({ to: "/" });
      setMe(a.userId);
      await load();
    })();
  }, [navigate, load]);

  async function decide(id: string, status: "approved" | "rejected") {
    await supabase
      .from("profiles")
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: me })
      .eq("id", id);
    await load();
  }

  const pending = (rows ?? []).filter((r) => r.status === "pending");
  const others = (rows ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={symbol.url} alt="" className="h-9 w-9" />
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-emerald-900">Demandes d'accès</h1>
            <p className="text-sm text-emerald-700/80">Validez ou refusez les personnes qui demandent un accès.</p>
          </div>
          <Link to="/" className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-50">
            Retour à l'outil
          </Link>
          <button
            onClick={signOutAndGoToAuth}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-50"
          >
            Déconnexion
          </button>
        </div>

        {rows === null ? (
          <p className="text-sm text-emerald-700/70">Chargement…</p>
        ) : (
          <>
            <Section title={`En attente (${pending.length})`}>
              {pending.length === 0 ? (
                <p className="px-4 py-5 text-sm text-emerald-700/70">Aucune demande en attente.</p>
              ) : (
                pending.map((r) => (
                  <Row key={r.id} row={r}>
                    <button
                      onClick={() => decide(r.id, "approved")}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Valider
                    </button>
                    <button
                      onClick={() => decide(r.id, "rejected")}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Refuser
                    </button>
                  </Row>
                ))
              )}
            </Section>

            <Section title={`Comptes traités (${others.length})`}>
              {others.length === 0 ? (
                <p className="px-4 py-5 text-sm text-emerald-700/70">Rien pour le moment.</p>
              ) : (
                others.map((r) => (
                  <Row key={r.id} row={r}>
                    <span
                      className={
                        r.status === "approved"
                          ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
                          : "rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700"
                      }
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <button
                      onClick={() => decide(r.id, r.status === "approved" ? "rejected" : "approved")}
                      className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50"
                    >
                      {r.status === "approved" ? "Révoquer" : "Valider"}
                    </button>
                  </Row>
                ))
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
      <h2 className="border-b border-emerald-100 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">{title}</h2>
      <div className="divide-y divide-emerald-50">{children}</div>
    </section>
  );
}

function Row({ row, children }: { row: Profile; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-emerald-900">{row.full_name || row.email}</div>
        <div className="truncate text-xs text-emerald-700/70">
          {row.email} · demandé le {new Date(row.requested_at).toLocaleDateString("fr-FR")}
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
