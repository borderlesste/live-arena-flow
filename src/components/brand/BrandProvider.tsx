"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BRAND_DEFAULTS, type BrandSettings } from "./brand-config";
import { BrandContext } from "./brand-context";
import { getBrandSettings } from "@/services/brand.service";

function hexToHsl(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (!delta) return `0 0% ${Math.round(lightness * 100)}%`;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return `${Math.round((hue * 60 + 360) % 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BrandSettings>({ ...BRAND_DEFAULTS });

  useEffect(() => {
    void getBrandSettings().then(setSettings).catch(() => setSettings({ ...BRAND_DEFAULTS }));
    const update = (event: Event) => setSettings((event as CustomEvent<BrandSettings>).detail);
    window.addEventListener("brand-settings-updated", update);
    return () => window.removeEventListener("brand-settings-updated", update);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", hexToHsl(settings.primaryColor));
    root.style.setProperty("--primary-hover", hexToHsl(settings.hoverColor));
    root.style.setProperty("--primary-active", hexToHsl(settings.darkColor));
    root.style.setProperty("--background-deep", hexToHsl(settings.deepBackground));
    const icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (icon) icon.href = settings.favicon;
  }, [settings]);

  return <BrandContext.Provider value={settings}>{children}</BrandContext.Provider>;
}
