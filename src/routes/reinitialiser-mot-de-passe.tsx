import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAccess } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import wordmark from "@/assets/digicom-wordmark.png";

export const Route = createFileRoute("/reinitialiser-mot-de-passe")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nouveau Mot De Passe — Digicom" },
      { name: "description", content: "Choisissez un nouveau mot de passe pour Digicom." },
      { property: "og:title", content: "Nouveau Mot De Passe — Digicom" },
      { property: "og:description", content: "Choisissez un nouveau mot de passe pour Digicom." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPassword,
});

/** Page ouverte depuis le mail « Mot de passe oublié » : la personne choisit un nouveau mot de passe. */
function ResetPassword() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ready" | "invalid">("loading");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const done = (s: "ready" | "invalid") => active && setState(s);
    // Le lien du mail arrive soit avec des jetons dans l'ancre (#access_token…&type=recovery),
    // soit avec un code (?code=…) ; les deux ouvrent une session de récupération.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") done("ready");
    });
    async function recover() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      if (hash.has("error") || hash.has("error_code") || query.has("error")) return done("invalid");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (hash.get("type") === "recovery" && accessToken && refreshToken) {
        const { error: e } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.history.replaceState(null, "", window.location.pathname);
        return done(e ? "invalid" : "ready");
      }
      const code = query.get("code");
      if (code) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(code);
        window.history.replaceState(null, "", window.location.pathname);
        return done(e ? "invalid" : "ready");
      }
      // Jetons déjà lus automatiquement par le client : on attend l'évènement de récupération.
      setTimeout(() => active && setState((s) => (s === "loading" ? "invalid" : s)), 2500);
    }
    recover().catch(() => done("invalid"));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) {
        setError(
          /same|different/i.test(passwordError.message)
            ? "Choisissez un mot de passe différent de l'ancien."
            : "Ce mot de passe n’a pas pu être enregistré. Choisissez un mot de passe plus robuste (8 caractères minimum).",
        );
        return;
      }
      const access = await getAccess();
      await navigate({ to: access.status === "approved" ? "/" : "/en-attente" });
    } catch {
      setError("Une erreur est survenue. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <img src={wordmark} alt="digicom" className="mx-auto mb-6 h-12 w-auto" />
        <h1 className="mb-5 text-xl font-semibold text-foreground">Nouveau mot de passe</h1>
        {state === "loading" ? (
          <p className="text-muted-foreground">Vérification du lien…</p>
        ) : state === "invalid" ? (
          <>
            <p role="alert" className="mb-4 text-destructive">
              Ce lien est invalide ou a expiré. Refaites une demande avec « Mot de passe oublié ? »
              sur la page de connexion.
            </p>
            <Button asChild variant="outline">
              <Link to="/auth">Retour à la connexion</Link>
            </Button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm">
                Nouveau mot de passe
              </label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1 block text-sm">
                Confirmez le mot de passe
              </label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={busy || password.length < 8 || !confirmation}
            >
              {busy ? "Enregistrement…" : "Enregistrer et accéder à Digicom"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
