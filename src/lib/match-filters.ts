import type { MatchFilter } from "@/components/matches/MatchFilters";
import type { Match } from "@/types";

export function filterMatches(matches: Match[], filter: MatchFilter): Match[] {
  if (filter === "live") return matches.filter((match) => ["live", "halftime", "paused"].includes(match.status));
  if (filter === "upcoming") return matches.filter((match) => match.status === "scheduled");
  if (filter === "finished") return matches.filter((match) => match.status === "finished");
  // "all" and "football" both show football only — it's the only sport
  return matches.filter((match) => match.sport === "football");
}
