import { LiveMatchCard } from "@/components/matches/LiveMatchCard";
import { ResultCard } from "@/components/matches/ResultCard";
import { UpcomingMatchCard } from "@/components/matches/UpcomingMatchCard";
import { isLiveMatchStatus } from "@/lib/match-filters";
import type { Competition, Match, Team } from "@/types";

interface MatchCardProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  competition: Competition;
}

export function MatchCard({ match, homeTeam, awayTeam, competition }: MatchCardProps) {
  if (isLiveMatchStatus(match.status)) {
    return <LiveMatchCard match={match} homeTeam={homeTeam} awayTeam={awayTeam} competition={competition} />;
  }
  if (match.status === "finished") {
    return <ResultCard match={match} homeTeam={homeTeam} awayTeam={awayTeam} competition={competition} />;
  }
  return <UpcomingMatchCard match={match} homeTeam={homeTeam} awayTeam={awayTeam} competition={competition} />;
}
