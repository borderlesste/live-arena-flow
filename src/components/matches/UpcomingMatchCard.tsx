import { Link } from "react-router-dom";
import { TeamBadge } from "./TeamBadge";
import { Button } from "@/components/ui/button";
import { Bell, MapPin } from "lucide-react";
import { formatMatchDate } from "@/lib/format";
import { SPORT_LABEL } from "@/lib/sports";
import { toast } from "sonner";
import { useState } from "react";
import type { Match, Team, Competition } from "@/types";

interface Props {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  competition: Competition;
}

export function UpcomingMatchCard({ match, homeTeam, awayTeam, competition }: Props) {
  const [reminded, setReminded] = useState(false);
  async function remind() {
    setReminded(true);
    if ("Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          toast.success("Te avisaremos cuando empiece", { description: `${homeTeam.shortName} vs ${awayTeam.shortName}` });
          return;
        }
      } catch { /* ignore */ }
    }
    toast.info("Recordatorio guardado", { description: "Activa las notificaciones del navegador para alertas en tiempo real." });
  }
  return (
    <article className="surface-card flex flex-col gap-3 rounded-xl p-4">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{competition.name} · {SPORT_LABEL[match.sport]}</span>
        <span>{formatMatchDate(match.startsAt)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <TeamBadge team={homeTeam} size="md" />
          <span className="truncate font-display text-sm font-semibold">{homeTeam.name}</span>
        </div>
        <span className="text-xs font-semibold uppercase text-muted-foreground">vs</span>
        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="truncate text-right font-display text-sm font-semibold">{awayTeam.name}</span>
          <TeamBadge team={awayTeam} size="md" />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{match.venue}</span>
        <span className="text-success">Disponible para retransmisión</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Button variant={reminded ? "secondary" : "outline"} size="sm" onClick={remind} aria-pressed={reminded}>
          <Bell className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {reminded ? "Recordatorio activo" : "Recordarme"}
        </Button>
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <Link to={`/match/${match.id}`}>Ver detalles</Link>
        </Button>
      </div>
    </article>
  );
}
