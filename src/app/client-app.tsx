"use client";

import dynamic from "next/dynamic";

const LuisRomeroApp = dynamic(() => import("@/App"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-background" aria-busy="true" />,
});

export function ClientApp() {
  return <LuisRomeroApp />;
}
