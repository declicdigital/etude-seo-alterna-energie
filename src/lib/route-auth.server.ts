/** Verifies the Digicom bearer token sent to a public server route. */
export async function authenticateRequest(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || token.split(".").length !== 3) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("email, full_name, status").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return { user, profile };
}
