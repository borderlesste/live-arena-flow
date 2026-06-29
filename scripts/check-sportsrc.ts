import "dotenv/config";
import { SportSrcProvider } from "../server/modules/sports/sportsrc.provider.js";

const apiKey = process.env.SPORTSRC_API_KEY?.trim();
const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);

if (!apiKey) {
  console.error("SportSRC validation failed: SPORTSRC_API_KEY is required");
  process.exitCode = 1;
} else {
  try {
    const provider = new SportSrcProvider(apiKey);
    const events = await provider.eventsByDate(date);
    console.log(JSON.stringify({ ok: true, provider: provider.name, date, eventCount: events.length }));
  } catch (error) {
    console.error(`SportSRC validation failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}
