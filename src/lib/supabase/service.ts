import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a service_role key — ignora RLS.
 * Use SOMENTE no servidor (cron/rotas internas), nunca no client.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY (ou URL) não configurado.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
