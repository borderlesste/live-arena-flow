import { ArrowRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatMatchDate, formatRelativeShort } from "@/lib/format";
import { TeamBadge } from "./TeamBadge";
import type { Competition, Match, Team } from "@/types";

interface AgendaMatchCardProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  competition: Competition;
}

export function AgendaMatchCard({ match, homeTeam, awayTeam, competition }: AgendaMatchCardProps) {
  const matchLabel = `${homeTeam.name} vs ${awayTeam.name}`;
  const startsInFuture = new Date(match.startsAt).getTime() > Date.now();

  return (
    <article className="surface-card group rounded-xl p-3.5" aria-label={matchLabel}>
      <div className="flex min-w-0 items-center justify-between gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="truncate">{competition.name}</span>
        <time className="shrink-0" dateTime={match.startsAt}>{formatMatchDate(match.startsAt)}</time>
      </div>

      <div className="mt-3 flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamBadge team={homeTeam} size="sm" />
          <span className="truncate font-display text-sm font-semibold">{homeTeam.name}</span>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase text-muted-foreground">vs</span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-right font-display text-sm font-semibold">{awayTeam.name}</span>
          <TeamBadge team={awayTeam} size="sm" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary">
          <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{startsInFuture ? formatRelativeShort(match.startsAt) : "Horario por confirmar"}</span>
        </span>
        <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs">
          <Link to={`/match/${match.id}`} aria-label={`Ver partido ${matchLabel}`}>
            Ver partido <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
