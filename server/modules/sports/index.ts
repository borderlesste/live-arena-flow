import { CachedSportsProvider, FallbackSportsProvider, type SportsProvider } from "./sports-provider.js";
import { SportSrcProvider } from "./sportsrc.provider.js";
import { TheSportsDbProvider } from "./thesportsdb.provider.js";

function createSportsDataIoProvider(): SportsProvider | undefined {
  const baseUrl = process.env.SPORTSRC_BASE_URL?.trim();
  const apiKey = process.env.SPORTSRC_API_KEY?.trim();
  if (!baseUrl || !apiKey) return undefined;
  return new SportSrcProvider(
    baseUrl,
    apiKey,
    process.env.SPORTSRC_EVENTS_PATH,
    process.env.SPORTSRC_AUTH_HEADER,
    undefined,
    process.env.SPORTSRC_EVENT_PATH,
    process.env.SPORTSRC_LIVE_EVENTS_PATH,
  );
}

export function sportsProviderDiagnostics() {
  const preferred = process.env.SPORTS_PROVIDER?.trim().toLowerCase() || "thesportsdb";
  const sportsDataIoConfigured = Boolean(process.env.SPORTSRC_BASE_URL?.trim() && process.env.SPORTSRC_API_KEY?.trim());
  const theSportsDbConfigured = Boolean(process.env.THESPORTSDB_API_KEY?.trim());
  const primaryProvider = (preferred === "sportsrc" || preferred === "sportsdataio") && sportsDataIoConfigured
    ? "sportsdataio"
    : "thesportsdb";
  const secondaryProvider = primaryProvider === "sportsdataio" && theSportsDbConfigured
    ? "thesportsdb"
    : primaryProvider === "thesportsdb" && sportsDataIoConfigured
      ? "sportsdataio"
      : undefined;
  return { preferred, sportsDataIoConfigured, theSportsDbConfigured, primaryProvider, secondaryProvider };
}

export function createSportsProvider(): SportsProvider {
  const diagnostics = sportsProviderDiagnostics();
  if (process.env.NODE_ENV === "production" && !diagnostics.sportsDataIoConfigured && !diagnostics.theSportsDbConfigured) {
    throw new Error("At least one sports provider API key/configuration is required in production");
  }
  const preferred = process.env.SPORTS_PROVIDER?.trim().toLowerCase() ?? "thesportsdb";
  const theSportsDb = new TheSportsDbProvider(process.env.THESPORTSDB_API_KEY?.trim() || "123");
  const sportsDataIo = createSportsDataIoProvider();

  if (!sportsDataIo) {
    if (preferred === "sportsrc" || preferred === "sportsdataio") {
      console.warn("[sports] SportsDataIO is preferred but incomplete in .env; using TheSportsDB");
    }
    return new CachedSportsProvider(theSportsDb);
  }

  const primary = preferred === "sportsrc" || preferred === "sportsdataio" ? sportsDataIo : theSportsDb;
  const secondary = primary === sportsDataIo ? theSportsDb : sportsDataIo;
  return new CachedSportsProvider(new FallbackSportsProvider(primary, secondary));
}

export type { NormalizedSportsEvent, SportsProvider } from "./sports-provider.js";
