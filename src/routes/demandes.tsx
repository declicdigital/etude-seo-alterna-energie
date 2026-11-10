import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAccess, signOutAndGoToAuth } from "@/lib/access";
import { SECTION_TREE, ALL_SECTION_KEYS, grantedSections, serializeSections, groupDisplayName } from "@/lib/sections";
import digicomWordmark from "@/assets/digicom-wordmark.png";
import { useServerFn } from "@tanstack/react-start";
import { Check, UserPlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { invitePerson } from "@/lib/invitations.functions";
import { getAccessActivity } from "@/lib/access-activity.functions";
import { formatLastConnection, invitationState, type AccessActivity } from "@/lib/access-activity";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  allowed_sections: string[] | null;
  activity?: AccessActivity;
};

export const Route = createFileRoute("/demandes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Demandes d'accès - Digicom" },
      { name: "description", content: "Validez ou refusez les demandes d'accès à Digicom." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Demandes d'accès - Digicom" },
      { property: "og:description", content: "Validez ou refusez les demandes d'accès à Digicom." },
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
  const sendInvitation = useServerFn(invitePerson);
  const fetchActivity = useServerFn(getAccessActivity);
  const [loadError, setLoadError] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setInviting(true); setInviteError(""); setInviteSuccess("");
    try {
      const result = await sendInvitation({ data: { fullName: inviteName, email: inviteEmail } });
      if (!result.ok) setInviteError(result.error);
      else { setInviteSuccess(`Invitation envoyée à ${inviteEmail.trim()}. Son accès est validé.`); setInviteName(""); setInviteEmail(""); }
      await load();
    } catch { setInviteError("L’invitation n’a pas pu être envoyée. Réessayez."); }
    finally { setInviting(false); }
  }

  const load = useCallback(async () => {
    try {
      const [profiles, activity] = await Promise.all([
        supabase.from("profiles")
          .select("id, email, full_name, status, requested_at, reviewed_at, allowed_sections")
          .order("requested_at", { ascending: false }),
        fetchActivity(),
      ]);
      if (profiles.error) throw profiles.error;
      const byId = new Map(activity.map((item) => [item.user_id, item]));
      setRows((profiles.data ?? []).map((profile) => ({ ...profile, activity: byId.get(profile.id) })));
      setLoadError("");
    } catch {
      setLoadError("Les informations d’accès n’ont pas pu être chargées. Réessayez.");
    }
  }, [fetchActivity]);

  useEffect(() => {
    (async () => {
      const a = await getAccess();
      if (!a.userId) return navigate({ to: "/auth" });
      if (!a.isAdmin) return navigate({ to: "/" });
      setMe(a.userId);
      await load();
    })();
  }, [navigate, load]);

  useEffect(() => {
    if (!me) return;
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [me, load]);

  async function decide(id: string, status: "approved" | "rejected") {
    await supabase
      .from("profiles")
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: me })
      .eq("id", id);
    await load();
  }

  async function saveSections(r: Profile, granted: Set<string>) {
    const next = serializeSections(granted);
    setRows((rs) => (rs ?? []).map((x) => (x.id === r.id ? { ...x, allowed_sections: next } : x)));
    await supabase.from("profiles").update({ allowed_sections: next }).eq("id", r.id);
  }

  async function toggleSection(r: Profile, key: string) {
    const cur = grantedSections(r.allowed_sections);
    if (cur.has(key)) cur.delete(key); else cur.add(key);
    await saveSections(r, cur);
  }

  const pending = (rows ?? []).filter((r) => r.status === "pending");
  const others = (rows ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={digicomWordmark} alt="Digicom" loading="lazy" width={1281} height={359} className="h-7 w-auto shrink-0" />
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

        {me && <section className="mb-6 border-y border-border py-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground"><UserPlus className="size-5" />Inviter une personne</h2>
          <form onSubmit={invite} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div><label htmlFor="invite-name" className="mb-1 block text-sm text-foreground">Prénom et Nom</label>
              <Input id="invite-name" required maxLength={150} value={inviteName} onChange={(event) => setInviteName(event.target.value)} /></div>
            <div><label htmlFor="invite-email" className="mb-1 block text-sm text-foreground">Adresse e-mail</label>
              <Input id="invite-email" type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></div>
            <Button type="submit" disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}><Send />{inviting ? "Envoi…" : "Envoyer l’invitation"}</Button>
          </form>
          {inviteError && <p role="alert" className="mt-3 text-sm text-destructive">{inviteError}</p>}
          {inviteSuccess && <p role="status" className="mt-3 text-sm text-primary">{inviteSuccess}</p>}
        </section>}

        {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm text-destructive">
          {loadError}<Button variant="outline" size="sm" onClick={() => void load()}>Réessayer</Button>
        </div>}
        {rows === null && !loadError ? (
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
                  <Row key={r.id} row={r} extra={r.status === "approved" && r.id !== me ? <SectionToggles row={r} onToggle={(k) => toggleSection(r, k)} onSetAll={(on) => {
                    if (!on && !window.confirm(`Retirer tous les accès de ${r.full_name || r.email} ?`)) return;
                    void saveSections(r, new Set(on ? ALL_SECTION_KEYS : []));
                  }} /> : null}>
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

function SectionToggles({ row, onToggle, onSetAll }: {
  row: Profile;
  onToggle: (key: string) => void;
  onSetAll: (on: boolean) => void;
}) {
  const granted = grantedSections(row.allowed_sections);
  const openGroups = SECTION_TREE.filter((t) => granted.has(t.group)).length;
  return (
    <div className="w-full rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Accès</span>
        <span className="text-xs text-muted-foreground">
          {openGroups} rubrique{openGroups > 1 ? "s" : ""} sur {SECTION_TREE.length}
        </span>
        <div className="ml-auto flex items-center gap-1 text-xs">
          <button type="button" onClick={() => onSetAll(true)} className="rounded-md px-2 py-1 text-emerald-800 hover:bg-emerald-100">
            Tout autoriser
          </button>
          <span className="text-emerald-200">|</span>
          <button type="button" onClick={() => onSetAll(false)} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-emerald-100 hover:text-foreground">
            Tout retirer
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SECTION_TREE.map((t) => {
          const on = granted.has(t.group);
          const switchId = `access-${row.id}-${t.group}`;
          return (
            <div
              key={t.group}
              className={
                "rounded-lg border p-2.5 transition-colors " +
                (on ? "border-emerald-200 bg-white shadow-sm" : "border-dashed border-gray-200 bg-white/50")
              }
            >
              <div className="flex items-center gap-2">
                <span className={"size-2 shrink-0 rounded-full " + t.accent + (on ? "" : " opacity-30")} aria-hidden />
                <label htmlFor={switchId} className={"min-w-0 flex-1 cursor-pointer truncate text-sm font-medium " + (on ? "text-foreground" : "text-muted-foreground")}>
                  {groupDisplayName(t.group)}
                </label>
                <Switch
                  id={switchId}
                  checked={on}
                  onCheckedChange={() => onToggle(t.group)}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
              {t.subs.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-4">
                  {t.subs.map((sub) => {
                    const key = `${t.group}/${sub}`;
                    const subOn = granted.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!on}
                        aria-pressed={subOn}
                        onClick={() => onToggle(key)}
                        title={subOn ? "Accès autorisé — cliquer pour retirer" : "Pas d'accès — cliquer pour autoriser"}
                        className={
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
                          (subOn
                            ? "border-emerald-200 bg-emerald-50 font-medium text-emerald-800 enabled:hover:bg-emerald-100"
                            : "border-gray-200 text-muted-foreground enabled:hover:bg-gray-50")
                        }
                      >
                        {subOn && <Check className="size-3" aria-hidden />}
                        {sub}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-1.5 pl-4 text-xs text-muted-foreground">Toute la rubrique</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ row, children, extra }: { row: Profile; children: React.ReactNode; extra?: React.ReactNode }) {
  const invitation = invitationState(row.activity);
  const lastConnection = formatLastConnection(row.activity?.last_sign_in_at);
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-words text-sm font-medium text-foreground">{row.full_name || row.email}</span>
          {invitation && <span className={"inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium " +
            (invitation === "accepted" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground")}>
            {invitation === "accepted" ? "✓ Invitation acceptée" : "Invitation non acceptée"}
          </span>}
        </div>
        <div className="break-words text-xs text-muted-foreground">
          {row.email} · demandé le {new Date(row.requested_at).toLocaleDateString("fr-FR")}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Dernière connexion : <span className="font-medium text-foreground">{lastConnection ?? "Aucune connexion enregistrée"}</span>
          {lastConnection && " (heure de Paris)"}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {extra}
    </div>
  );
}
