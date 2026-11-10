import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAccess } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import wordmark from "@/assets/digicom-wordmark.png";

export const Route = createFileRoute("/accept-invitation")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Votre Invitation — Digicom" },
    { name: "description", content: "Choisissez votre mot de passe pour rejoindre Digicom." },
    { property: "og:title", content: "Votre Invitation — Digicom" },
    { property: "og:description", content: "Choisissez votre mot de passe pour rejoindre Digicom." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: AcceptInvitation,
});

function AcceptInvitation() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ready" | "invalid">("loading");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function accept() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");
      if (params.has("error") || params.has("error_code")) {
        if (active) setState("invalid");
        return;
      }
      if (type === "invite" && accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.history.replaceState(null, "", window.location.pathname);
        if (sessionError) { if (active) setState("invalid"); return; }
      }
      const { data, error: userError } = await supabase.auth.getUser();
      if (active) setState(!userError && data.user?.invited_at ? "ready" : "invalid");
    }
    accept().catch(() => { if (active) setState("invalid"); });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setBusy(true); setError("");
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) { setError("Ce mot de passe n’a pas pu être enregistré. Choisissez un mot de passe plus robuste ou demandez une nouvelle invitation."); return; }
      const access = await getAccess();
      await navigate({ to: access.status === "approved" ? "/" : "/en-attente" });
    } catch { setError("Une erreur est survenue. Réessayez."); }
    finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
    <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
      <img src={wordmark} alt="digicom" className="mx-auto mb-6 h-12 w-auto" />
      <h1 className="mb-5 text-xl font-semibold text-foreground">Bienvenue sur Digicom</h1>
      {state === "loading" ? <p className="text-muted-foreground">Vérification de votre invitation…</p> : state === "invalid" ? <>
        <p role="alert" className="mb-4 text-destructive">Ce lien d’invitation est invalide ou a expiré. Demandez une nouvelle invitation à Geoffrey.</p>
        <Button asChild variant="outline"><Link to="/auth">Retour à la connexion</Link></Button>
      </> : <form onSubmit={submit} className="space-y-4">
        <div><label htmlFor="new-password" className="mb-1 block text-sm">Choisissez votre mot de passe</label>
          <Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <div><label htmlFor="confirm-password" className="mb-1 block text-sm">Confirmez votre mot de passe</label>
          <Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || password.length < 8 || !confirmation}>{busy ? "Enregistrement…" : "Accéder à Digicom"}</Button>
      </form>}
    </div>
  </main>;
}