import type { SupabaseClient } from "@supabase/supabase-js";
import { isPublicSupabaseConfigured, publicEnv } from "@/config/env";

const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = isPublicSupabaseConfigured;

let clientPromise: Promise<SupabaseClient> | undefined;

export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!isSupabaseConfigured) {
    return Promise.reject(new Error("Supabase no está configurado en este entorno"));
  }
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    }));
  return clientPromise;
}
