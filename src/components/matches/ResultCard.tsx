import { TeamBadge } from "./TeamBadge";
import { Button } from "@/components/ui/button";
import { formatMatchDate } from "@/lib/format";
import { Link } from "react-router-dom";
import type { Match, Team, Competition } from "@/types";

interface Props {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  competition: Competition;
}

export function ResultCard({ match, homeTeam, awayTeam, competition }: Props) {
  return (
    <article className="surface-card flex items-center gap-3 rounded-xl p-3 sm:p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-foreground/90">Final</span>
          <span className="truncate">{competition.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2">
            <TeamBadge team={homeTeam} size="sm" />
            <span className="truncate text-sm font-medium">{homeTeam.shortName}</span>
          </div>
          <span className="font-display text-base font-bold tabular-nums">
            {match.homeScore}<span className="text-muted-foreground"> : </span>{match.awayScore}
          </span>
          <div className="flex flex-1 items-center justify-end gap-2">
            <span className="truncate text-right text-sm font-medium">{awayTeam.shortName}</span>
            <TeamBadge team={awayTeam} size="sm" />
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{formatMatchDate(match.startsAt)} · {match.venue}</span>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
        <Button asChild={match.hasSummary} disabled={!match.hasSummary} size="sm" variant="outline">
          {match.hasSummary ? <Link to={`/match/${match.id}#summary`}>Resumen</Link> : <span>Resumen</span>}
        </Button>
        <Button asChild={match.hasReplay} disabled={!match.hasReplay} size="sm" variant="ghost">
          {match.hasReplay ? <Link to={`/match/${match.id}#replay`}>Repetición</Link> : <span>Repetición</span>}
        </Button>
      </div>
    </article>
  );
}
