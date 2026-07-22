import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { unlockSite } from "@/lib/gate.functions";
import symbol from "@/assets/alterna-symbol.png.asset.json";

export const Route = createFileRoute("/unlock")({
  head: () => ({
    meta: [
      { title: "Accès protégé - Étude SEO Alterna" },
      { name: "description", content: "Saisissez le mot de passe pour accéder à l'étude SEO." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UnlockPage,
});

function UnlockPage() {
  const unlock = useServerFn(unlockSite);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { ok } = await unlock({ data: { password } });
      if (ok) {
        window.location.assign("/");
      } else {
        setError("Mot de passe incorrect.");
      }
    } catch {
      setError("Impossible de vérifier le mot de passe. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-emerald-100 bg-white p-8 shadow-xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={symbol.url} alt="Alterna Énergie" className="mb-4 h-12 w-12" />
          <h1 className="text-xl font-semibold text-emerald-900">Accès protégé</h1>
          <p className="mt-1 text-sm text-emerald-700/80">
            Saisissez le mot de passe pour consulter l'étude SEO.
          </p>
        </div>
        <label className="mb-2 block text-xs font-medium text-emerald-900" htmlFor="password">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Vérification…" : "Entrer"}
        </button>
      </form>
    </div>
  );
}