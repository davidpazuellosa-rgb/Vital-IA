import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolverEmpresaUserId(supabase: SupabaseClient, fallbackUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc("empresa_user_id");
  if (error || typeof data !== "string") return fallbackUserId;
  return data;
}
