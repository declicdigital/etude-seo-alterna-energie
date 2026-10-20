import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAccessActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // The RPC validates the authenticated admin role before projecting Auth data.
    const { data, error } = await context.supabase.rpc("admin_access_activity");
    if (error) throw new Error("Les informations de connexion ne sont pas disponibles.");
    return data ?? [];
  });