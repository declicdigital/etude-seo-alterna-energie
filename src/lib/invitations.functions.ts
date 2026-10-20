import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { invitationSchema, approvedInvitationProfile, canInvite } from "./invitations";

export const invitePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => invitationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !canInvite(isAdmin === true)) return { ok: false, error: "Vous n’avez pas le droit d’inviter des personnes." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cloud Auth sends its secure Invite email; never return or copy its link.
    const { data: invitation, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName },
      redirectTo: "https://etude-seo-alterna-energie.lovable.app/accept-invitation",
    });
    if (error || !invitation.user) {
      return { ok: false, error: /already|registered|exists/i.test(error?.message ?? "")
        ? "Un compte existe déjà avec cette adresse. Vous pouvez gérer son accès dans la liste ci-dessous."
        : "L’invitation n’a pas pu être envoyée. Réessayez dans un instant." };
    }
    const { data: profile, error: approvalError } = await supabaseAdmin.from("profiles")
      .update(approvedInvitationProfile(data.fullName, context.userId))
      .eq("id", invitation.user.id).select("id").maybeSingle();
    if (approvalError || !profile) {
      return { ok: false, error: "Le mail est envoyé, mais l’accès n’a pas pu être validé. Validez ce compte dans la liste ci-dessous." };
    }
    return { ok: true, error: "" };
  });