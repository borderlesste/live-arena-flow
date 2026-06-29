import type { SupabaseClient } from "@supabase/supabase-js";
import { isPublicSupabaseConfigured, publicEnv } from "@/config/env";

let supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
let supabasePublishableKey = publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export let isSupabaseConfigured = isPublicSupabaseConfigured;

let clientPromise: Promise<SupabaseClient> | undefined;

export interface PublicSupabaseConfig {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
}

export function configureSupabase(config: PublicSupabaseConfig): void {
  const nextUrl = config.supabaseUrl?.trim();
  const nextKey = config.supabasePublishableKey?.trim();
  if (!nextUrl || !nextKey) return;
  if (supabaseUrl === nextUrl && supabasePublishableKey === nextKey) return;
  supabaseUrl = nextUrl;
  supabasePublishableKey = nextKey;
  isSupabaseConfigured = true;
  clientPromise = undefined;
}

export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!isSupabaseConfigured) {
    return Promise.reject(new Error("Supabase no está configurado en este entorno"));
  }
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    }));
  return clientPromise;
}
