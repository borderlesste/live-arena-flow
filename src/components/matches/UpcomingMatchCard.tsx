import { Link } from "react-router-dom";
import { TeamBadge } from "./TeamBadge";
import { Button } from "@/components/ui/button";
import { Bell, Check, MapPin } from "lucide-react";
import { formatMatchDate } from "@/lib/format";
import { SPORT_LABEL } from "@/lib/sports";
import { toast } from "sonner";
import { useFavoriteMatch } from "@/hooks/useFavoriteMatch";
import { matchStatusLabel } from "@/lib/match-filters";
import type { Match, Team, Competition } from "@/types";

interface Props {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  competition: Competition;
}

export function UpcomingMatchCard({ match, homeTeam, awayTeam, competition }: Props) {
  const followed = useFavoriteMatch(match.id);
  const canFollow = match.status === "scheduled";
  async function toggleFollow() {
    try {
      const next = await followed.toggle();
      toast.success(next ? "Partido guardado en tu perfil" : "Partido retirado de tu perfil");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el partido");
    }
  }
  return (
    <article className="surface-card flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl p-4">
      <div className="flex min-w-0 items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="min-w-0 truncate">{competition.name} · {SPORT_LABEL[match.sport]}</span>
        <span className="shrink-0">{formatMatchDate(match.startsAt)}</span>
      </div>
      <span className="w-fit rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/90">
        {matchStatusLabel(match.status)}
      </span>
      <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamBadge team={homeTeam} size="md" />
          <span className="truncate font-display text-sm font-semibold">{homeTeam.name}</span>
        </div>
        <span className="shrink-0 text-xs font-semibold uppercase text-muted-foreground">vs</span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-right font-display text-sm font-semibold">{awayTeam.name}</span>
          <TeamBadge team={awayTeam} size="md" />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{match.venue}</span></span>
        <span className={`shrink-0 ${match.streams.length > 0 ? "text-success" : "text-muted-foreground"}`}>{match.streams.length > 0 ? "Fuente configurada" : "Sin fuente configurada"}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Button variant={followed.favorite ? "secondary" : "outline"} size="sm" onClick={() => void toggleFollow()} aria-pressed={followed.favorite} disabled={!canFollow}>
          {followed.favorite ? <Check className="mr-1.5 h-4 w-4" aria-hidden="true" /> : <Bell className="mr-1.5 h-4 w-4" aria-hidden="true" />}
          {followed.favorite ? "Siguiendo" : canFollow ? "Seguir" : matchStatusLabel(match.status)}
        </Button>
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <Link to={`/match/${match.id}`}>Ver detalles</Link>
        </Button>
      </div>
    </article>
  );
}
