import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { publicEnv } from "@/config/env";
import "../index.css";

export const metadata: Metadata = {
  // metadataBase must be an absolute URL. Uses NEXT_PUBLIC_APP_URL from env.
  // In production: set NEXT_PUBLIC_APP_URL=https://tudominio.com in Render/Vercel.
  // Falls back to a relative base "/" which Next.js handles correctly.
  metadataBase: publicEnv.NEXT_PUBLIC_APP_URL
    ? new URL(publicEnv.NEXT_PUBLIC_APP_URL)
    : new URL("https://luisromerofutbol.com"),
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
  const analyticsToken = publicEnv.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN;
  const shouldLoadAnalytics = analyticsToken && process.env.NODE_ENV === "production";

  return (
    <html lang="es">
      <body>
        {children}
        {shouldLoadAnalytics ? (
          <Script
            id="cloudflare-web-analytics"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            strategy="afterInteractive"
            data-cf-beacon={JSON.stringify({ token: analyticsToken, spa: true })}
          />
        ) : null}
      </body>
    </html>
  );
}
