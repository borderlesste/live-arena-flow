"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { BRAND_DEFAULTS } from "./brand-config";
import { useBrand } from "./brand-context";

type BrandLogoVariant = "primary" | "white" | "dark" | "symbol";
type BrandLogoSize = "sm" | "md" | "lg" | "xl";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  priority?: boolean;
  className?: string;
  withWordmark?: boolean;
  decorative?: boolean;
}

const fullWidths: Record<BrandLogoSize, number> = { sm: 128, md: 176, lg: 216, xl: 280 };
const symbolWidths: Record<BrandLogoSize, number> = { sm: 36, md: 44, lg: 64, xl: 96 };

const fullSources: Record<Exclude<BrandLogoVariant, "symbol">, string> = {
  primary: BRAND_DEFAULTS.logoPrimary,
  white: BRAND_DEFAULTS.logoDarkBackground,
  dark: BRAND_DEFAULTS.logoLightBackground,
};

const symbolSources: Record<BrandLogoVariant, string> = {
  primary: BRAND_DEFAULTS.symbol,
  white: BRAND_DEFAULTS.symbolWhite,
  dark: "/brand/symbols/symbol-black.png",
  symbol: BRAND_DEFAULTS.symbol,
};

export function BrandLogo({
  variant = "primary",
  size = "md",
  priority = false,
  className,
  withWordmark = variant !== "symbol",
  decorative = false,
}: BrandLogoProps) {
  const settings = useBrand();
  const showWordmark = withWordmark && variant !== "symbol";
  const width = showWordmark ? fullWidths[size] : symbolWidths[size];
  const height = showWordmark ? Math.round(width / 2.754) : Math.round(width / 1.011);
  const configuredFullSources = {
    ...fullSources,
    primary: settings.logoPrimary,
    white: settings.logoDarkBackground,
    dark: settings.logoLightBackground,
  };
  const configuredSymbolSources = { ...symbolSources, primary: settings.symbol, white: settings.symbolWhite, symbol: settings.symbol };
  const src = showWordmark ? configuredFullSources[variant as Exclude<BrandLogoVariant, "symbol">] : configuredSymbolSources[variant];

  return (
    <Image
      src={src}
      alt={decorative ? "" : showWordmark ? settings.platformName : `Símbolo de ${settings.platformName}`}
      aria-hidden={decorative || undefined}
      width={width}
      height={height}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      unoptimized
      className={cn("h-auto max-w-full object-contain", className)}
      style={{ width, height: "auto", aspectRatio: `${width} / ${height}` }}
    />
  );
}
