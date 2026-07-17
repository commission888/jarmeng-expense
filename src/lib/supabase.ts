import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

let client: SupabaseClient | null = null;

/**
 * Server-only client. Every table has RLS on with no permissive policy, so the
 * service-role key is what makes these queries work — which is also why this
 * must never be imported into a client component.
 */
export function supabase(): SupabaseClient {
  client ??= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}
