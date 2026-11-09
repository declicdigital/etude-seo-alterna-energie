import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAccess } from "@/lib/access";
import { pendingEditorialDestination } from "@/lib/editorial-links";
import logo from "@/assets/alterna-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion - Digicom" },
      { name: "description", content: "Connectez-vous ou demandez un accès à Digicom." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Connexion - Digicom" },
      { property: "og:description", content: "Connectez-vous ou demandez un accès à Digicom." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAccess().then((a) => {
      if (!a.userId) return;
      navigate(a.status === "approved" ? pendingEditorialDestination() : { to: "/en-attente" });
    });
  }, [navigate]);

  async function afterAuth() {
    const a = await getAccess();
    navigate(a.status === "approved" ? pendingEditorialDestination() : { to: "/en-attente" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
        });
        if (err && !/not found|no user/i.test(err.message)) throw err;
        setSent(true);
        return;
      }
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });
        if (err) throw err;
        navigate({ to: "/en-attente" });
        return;
      }
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      await afterAuth();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        /invalid login/i.test(msg)
          ? "Email ou mot de passe incorrect."
          : /already registered|already exists/i.test(msg)
            ? "Un compte existe déjà avec cet email."
            : /password/i.test(msg)
              ? "Mot de passe trop faible ou compromis. Choisissez-en un autre."
              : "Une erreur est survenue. Réessayez dans un instant.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-emerald-100 bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={logo.url} alt="Logo" className="mb-4 h-10 w-auto" />
          <h1 className="text-xl font-semibold text-emerald-900">
            {mode === "login"
              ? "Connexion"
              : mode === "forgot"
                ? "Mot de passe oublié"
                : "Créer un compte"}
          </h1>
          <p className="mt-1 text-sm text-emerald-700/80">
            {mode === "login"
              ? "Accédez à Digicom."
              : mode === "forgot"
                ? "Recevez par mail un lien pour choisir un nouveau mot de passe."
                : "Votre demande sera validée par un administrateur."}
          </p>
        </div>

        {mode !== "forgot" && (
          <>
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
              <p className="text-xs font-semibold text-amber-900">Nouveau : l'accès a changé</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                Le mot de passe unique n'existe plus. À votre première venue, cliquez sur « Créer un
                compte » : votre demande est envoyée à l'administrateur, qui la valide. Ensuite,
                vous vous connectez avec votre email et votre mot de passe, et vous restez connecté.
                Mot de passe oublié ou jamais créé ? Cliquez sur « Mot de passe oublié ? ».
              </p>
            </div>
          </>
        )}

        {mode === "forgot" && sent ? (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
            <p className="font-semibold">Vérifiez votre boîte mail</p>
            <p>
              Si un compte existe pour <strong>{email.trim()}</strong>, un lien pour choisir un
              nouveau mot de passe vient d'y être envoyé. Pensez à regarder dans les indésirables.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-emerald-900" htmlFor="name">
                  Nom et prénom
                </label>
                <input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-emerald-900" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <label className="block text-xs font-medium text-emerald-900" htmlFor="password">
                    Mot de passe
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setSent(false);
                        setError("");
                      }}
                      className="text-xs text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Patientez…"
                : mode === "login"
                  ? "Se connecter"
                  : mode === "forgot"
                    ? "Recevoir le lien"
                    : "Demander un accès"}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setSent(false);
            setError("");
          }}
          className="mt-4 w-full text-center text-xs text-emerald-700 underline underline-offset-2"
        >
          {mode === "login"
            ? "Créer un compte"
            : mode === "forgot"
              ? "Retour à la connexion"
              : "J'ai déjà un compte"}
        </button>
      </div>
    </div>
  );
}
