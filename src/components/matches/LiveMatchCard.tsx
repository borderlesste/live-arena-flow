import { Link } from "react-router-dom";
import { TeamBadge } from "./TeamBadge";
import { LiveBadge } from "@/components/live/LiveBadge";
import { Button } from "@/components/ui/button";
import { compactNumber, formatMatchDate } from "@/lib/format";
import { SPORT_LABEL } from "@/lib/sports";
import { Users, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Match, Team, Competition } from "@/types";

interface LiveMatchCardProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  competition: Competition;
  isActive?: boolean;
  onSelect?: (matchId: string) => void;
}

export function LiveMatchCard({ match, homeTeam, awayTeam, competition, isActive, onSelect }: LiveMatchCardProps) {
  const live = match.status === "live" || match.status === "halftime";
  return (
    <article
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "surface-card group relative flex w-full flex-col gap-3 rounded-xl p-4 transition-all",
        isActive ? "border-primary/60 shadow-glow" : "hover:border-border-strong",
      )}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-2">
          {live ? <LiveBadge /> : <span className="rounded bg-surface-2 px-1.5 py-0.5">{statusLabel(match.status)}</span>}
          <span>{SPORT_LABEL[match.sport]}</span>
        </span>
        <span className="truncate">{competition.name}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2">
          <TeamBadge team={homeTeam} size="md" />
          <span className="truncate font-display text-sm font-semibold">{homeTeam.shortName}</span>
        </div>
        <span className="font-display text-xl font-bold tabular-nums text-foreground">
          {match.homeScore}<span className="text-muted-foreground"> : </span>{match.awayScore}
        </span>
        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="truncate text-right font-display text-sm font-semibold">{awayTeam.shortName}</span>
          <TeamBadge team={awayTeam} size="md" />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{match.clock ?? formatMatchDate(match.startsAt)}</span>
        {match.viewers ? (
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {compactNumber(match.viewers)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {onSelect ? (
          <Button
            size="sm"
            variant={isActive ? "default" : "secondary"}
            className={cn(isActive && "bg-primary text-primary-foreground hover:bg-primary-hover")}
            onClick={() => onSelect(match.id)}
          >
            <Play className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {isActive ? "Reproduciendo" : "Ver"}
          </Button>
        ) : null}
        <Button asChild size="sm" variant="ghost" className="ml-auto">
          <Link to={`/match/${match.id}`}>Detalles</Link>
        </Button>
      </div>
    </article>
  );
}

function statusLabel(s: Match["status"]): string {
  switch (s) {
    case "scheduled": return "Próximo";
    case "finished": return "Final";
    case "halftime": return "Descanso";
    case "paused": return "Pausado";
    case "postponed": return "Aplazado";
    case "cancelled": return "Cancelado";
    case "live": return "En vivo";
  }
}
