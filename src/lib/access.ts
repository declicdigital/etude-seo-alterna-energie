import { supabase } from "@/integrations/supabase/client";

export type AccessStatus = "pending" | "approved" | "rejected";

export type Access = {
  userId: string | null;
  email: string | null;
  status: AccessStatus | null;
  isAdmin: boolean;
};

export async function getAccess(): Promise<Access> {
  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;
  if (!user) return { userId: null, email: null, status: null, isAdmin: false };

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("status").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const isAdmin = (roles ?? []).some((r) => r.role === "admin");

  return {
    userId: user.id,
    email: user.email ?? null,
    status: ((profile?.status as AccessStatus | undefined) ?? "pending"),
    isAdmin,
  };
}

export async function signOutAndGoToAuth() {
  await supabase.auth.signOut();
  window.location.assign("/auth");
}
