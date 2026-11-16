import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAuthConfig } from "./supabase-config";

let client: SupabaseClient | undefined;

export function publicStoreClient() {
  if (!client) {
    const { url, key } = supabaseAuthConfig();
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    });
  }
  return client;
}
