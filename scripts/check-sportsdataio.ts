import "dotenv/config";
import { SportSrcProvider } from "../server/modules/sports/sportsrc.provider.js";

const baseUrl = process.env.SPORTSRC_BASE_URL?.trim();
const apiKey = process.env.SPORTSRC_API_KEY?.trim();
const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);

if (!baseUrl || !apiKey) {
  console.error("SportsDataIO validation failed: SPORTSRC_BASE_URL and SPORTSRC_API_KEY are required");
  process.exitCode = 1;
} else {
  try {
    const provider = new SportSrcProvider(
      baseUrl,
      apiKey,
      process.env.SPORTSRC_EVENTS_PATH,
      process.env.SPORTSRC_AUTH_HEADER,
      undefined,
      process.env.SPORTSRC_EVENT_PATH,
    );
    const events = await provider.eventsByDate(date);
    console.log(JSON.stringify({ ok: true, provider: provider.name, date, eventCount: events.length }));
  } catch (error) {
    console.error(`SportsDataIO validation failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}
