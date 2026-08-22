import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/storage/adapter";

/**
 * Server-only client, authenticated as the service role. Used exclusively
 * for the trust boundaries that already exist in the schema — reading a
 * sheet through a share token, calling the security-definer RPCs — never
 * for anything a signed-in user's own browser session should do instead.
 * Never import this from a "use client" file; the `server-only` import
 * throws at build time if that ever happens by accident.
 */
export function getSupabaseServiceClient(): SupabaseClient | null {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}
