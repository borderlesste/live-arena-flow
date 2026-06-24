export const BRAND_DEFAULTS = {
  platformName: "Luis Romero Fútbol",
  logoPrimary: "/brand/logos/logo-primary.png",
  logoDarkBackground: "/brand/logos/logo-white.png",
  logoLightBackground: "/brand/logos/logo-dark.png",
  symbol: "/brand/symbols/symbol-green-dark.png",
  symbolWhite: "/brand/symbols/symbol-white.png",
  favicon: "/brand/symbols/symbol-green-dark.png",
  primaryColor: "#77A608",
  hoverColor: "#628C04",
  darkColor: "#355700",
  deepBackground: "#012501",
} as const;

export type BrandSettings = {
  -readonly [Key in keyof typeof BRAND_DEFAULTS]: string;
};
