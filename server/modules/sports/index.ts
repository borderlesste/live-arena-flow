import { CachedSportsProvider } from "./sports-provider.js";
import { SportSrcProvider } from "./sportsrc.provider.js";

export function sportsProviderDiagnostics() {
  const sportsSrcConfigured = Boolean(process.env.SPORTSRC_API_KEY?.trim());
  return {
    sportsSrcConfigured,
    primaryProvider: sportsSrcConfigured ? "sportsrc" : "not_configured",
  };
}

export function createSportsProvider() {
  const apiKey = process.env.SPORTSRC_API_KEY?.trim();
  if (!apiKey) throw new Error("SPORTSRC_API_KEY is required");
  return new CachedSportsProvider(new SportSrcProvider(apiKey));
}

export type { NormalizedSportsEvent, SportsProvider } from "./sports-provider.js";
