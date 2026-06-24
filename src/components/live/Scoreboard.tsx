import { TeamBadge } from "@/components/matches/TeamBadge";
import { LiveBadge } from "./LiveBadge";
import { compactNumber } from "@/lib/format";
import { Users, Signal } from "lucide-react";
import type { Match, Team } from "@/types";

interface ScoreboardProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  competitionName: string;
  variant?: "overlay" | "panel";
}

export function Scoreboard({ match, homeTeam, awayTeam, competitionName, variant = "overlay" }: ScoreboardProps) {
  const isLive = match.status === "live" || match.status === "halftime";

  if (variant === "panel") {
    return (
      <div className="surface-card flex items-center justify-between gap-4 rounded-xl p-4 md:p-5">
        <TeamSide team={homeTeam} side="home" />
        <div className="flex flex-col items-center px-2 text-center" aria-live="polite">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{competitionName}</span>
          <span className="font-display text-3xl font-bold tabular-nums md:text-4xl">
            {match.homeScore} <span className="text-muted-foreground">·</span> {match.awayScore}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">{match.clock ?? statusText(match.status)}</span>
        </div>
        <TeamSide team={awayTeam} side="away" />
      </div>
    );
  }

  return (
    <div data-testid="player-scoreboard" className="pointer-events-none flex w-full items-start justify-between gap-2 p-2 sm:gap-3 sm:p-3 md:p-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isLive ? <LiveBadge /> : null}
        <span className="truncate rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/90 ring-1 ring-white/10 sm:text-[11px]">
          {competitionName}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-md bg-black/45 px-2 py-1 text-sm ring-1 ring-white/10 sm:gap-3 sm:px-3 sm:py-1.5" aria-live="polite">
        <span className="flex items-center gap-1.5">
          <span className="hidden min-[360px]:inline-flex"><TeamBadge team={homeTeam} size="sm" /></span>
          <span className="hidden font-semibold sm:inline">{homeTeam.shortName}</span>
        </span>
        <span className="whitespace-nowrap font-display text-sm font-bold tabular-nums sm:text-base">{match.homeScore} : {match.awayScore}</span>
        <span className="flex items-center gap-1.5">
          <span className="hidden font-semibold sm:inline">{awayTeam.shortName}</span>
          <span className="hidden min-[360px]:inline-flex"><TeamBadge team={awayTeam} size="sm" /></span>
        </span>
        <span className="hidden text-xs text-muted-foreground md:inline">{match.clock ?? statusText(match.status)}</span>
      </div>
      <div className="hidden items-center gap-3 rounded-md bg-black/45 px-3 py-1.5 text-xs ring-1 ring-white/10 sm:flex">
        {match.viewers ? (
          <span className="flex items-center gap-1.5" aria-label={`${match.viewers} espectadores`}>
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {compactNumber(match.viewers)}
          </span>
        ) : null}
        <span className="flex items-center gap-1.5 text-success" aria-label="Conexión estable">
          <Signal className="h-3.5 w-3.5" aria-hidden="true" />
          Estable
        </span>
      </div>
    </div>
  );
}

function TeamSide({ team, side }: { team: Team; side: "home" | "away" }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${side === "away" ? "flex-row-reverse text-right" : ""}`}>
      <TeamBadge team={team} size="lg" />
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold md:text-base">{team.name}</p>
        <p className="text-xs text-muted-foreground">{team.city}</p>
      </div>
    </div>
  );
}

function statusText(s: Match["status"]): string {
  switch (s) {
    case "scheduled": return "Por comenzar";
    case "halftime": return "Descanso";
    case "paused": return "Pausado";
    case "finished": return "Final";
    case "postponed": return "Aplazado";
    case "cancelled": return "Cancelado";
    default: return "";
  }
}
