import { ClientApp } from "@/app/client-app";
import type { PublicSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function publicSupabaseExplicitlyDisabled(): boolean {
  return process.env.NEXT_PUBLIC_SUPABASE_URL === "" && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === "";
}

function directSupabaseConfig(): PublicSupabaseConfig | undefined {
  if (publicSupabaseExplicitlyDisabled()) return undefined;
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)?.trim();
  const supabasePublishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  )?.trim();
  return supabaseUrl && supabasePublishableKey ? { supabaseUrl, supabasePublishableKey } : undefined;
}

async function runtimeSupabaseConfig(): Promise<PublicSupabaseConfig> {
  if (publicSupabaseExplicitlyDisabled()) return {};
  const direct = directSupabaseConfig();
  if (direct) return direct;

  const apiOrigin = process.env.API_INTERNAL_URL?.trim().replace(/\/$/, "");
  if (!apiOrigin) return {};

  try {
    const response = await fetch(`${apiOrigin}/api/config/public`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return {};
    const payload = await response.json() as PublicSupabaseConfig;
    return payload.supabaseUrl && payload.supabasePublishableKey ? payload : {};
  } catch {
    return {};
  }
}

export default async function Page() {
  return <ClientApp runtimeConfig={await runtimeSupabaseConfig()} />;
}
