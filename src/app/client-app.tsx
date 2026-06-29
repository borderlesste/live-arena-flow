"use client";

import dynamic from "next/dynamic";
import { configureSupabase, type PublicSupabaseConfig } from "@/lib/supabase";

const LuisRomeroApp = dynamic(() => import("@/App"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-background" aria-busy="true" />,
});

export function ClientApp({ runtimeConfig }: { runtimeConfig: PublicSupabaseConfig }) {
  configureSupabase(runtimeConfig);
  return <LuisRomeroApp />;
}
