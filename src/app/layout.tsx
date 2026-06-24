import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { publicEnv } from "@/config/env";
import "../index.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:8080"),
  title: { default: "Luis Romero Fútbol", template: "%s | Luis Romero Fútbol" },
  description: "Transmisiones, partidos, resultados y contenido deportivo en Luis Romero Fútbol.",
  applicationName: "Luis Romero Fútbol",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/brand/symbols/symbol-green-dark.png", type: "image/png" }],
    apple: [{ url: "/brand/symbols/symbol-green-dark.png", type: "image/png" }],
  },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "Luis Romero Fútbol",
    title: "Luis Romero Fútbol",
    description: "Transmisiones, partidos, resultados y contenido deportivo en Luis Romero Fútbol.",
    images: [{ url: "/brand/logos/logo-primary.png", width: 16090, height: 5843, alt: "Luis Romero Fútbol" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Luis Romero Fútbol",
    description: "Transmisiones, partidos, resultados y contenido deportivo en Luis Romero Fútbol.",
    images: ["/brand/logos/logo-primary.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#012501",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
