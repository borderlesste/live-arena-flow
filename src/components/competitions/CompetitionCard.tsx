import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Check, Heart } from "lucide-react";
import { SPORT_LABEL } from "@/lib/sports";
import { formatMatchDate } from "@/lib/format";
import { toast } from "sonner";
import type { Competition } from "@/types";

interface Props { competition: Competition }

export function CompetitionCard({ competition }: Props) {
  const [following, setFollowing] = useState(false);
  return (
    <article className="surface-card flex flex-col gap-3 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-12 w-12 place-items-center rounded-lg font-display text-sm font-bold ring-1 ring-white/10"
          style={{ background: `linear-gradient(135deg, hsl(${competition.color} / 0.45), hsl(${competition.color} / 0.1))` }}
        >
          {competition.monogram}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold">{competition.name}</p>
          <p className="text-xs text-muted-foreground">{competition.region} · {SPORT_LABEL[competition.sport]}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-surface-2 p-2">
          <dt className="text-muted-foreground">Partidos activos</dt>
          <dd className="font-display text-base font-bold">{competition.activeMatches}</dd>
        </div>
        <div className="rounded-md bg-surface-2 p-2">
          <dt className="text-muted-foreground">Próximo evento</dt>
          <dd className="font-display text-sm font-semibold">{competition.nextEventAt ? formatMatchDate(competition.nextEventAt) : "—"}</dd>
        </div>
      </dl>
      <Button
        size="sm"
        variant={following ? "default" : "outline"}
        className={following ? "bg-gradient-primary text-primary-foreground" : ""}
        aria-pressed={following}
        onClick={() => { setFollowing((v) => !v); toast.success(following ? "Dejaste de seguir" : "Ahora sigues esta competición"); }}
      >
        {following ? <><Check className="mr-1.5 h-4 w-4" /> Siguiendo</> : <><Heart className="mr-1.5 h-4 w-4" /> Seguir</>}
      </Button>
    </article>
  );
}
