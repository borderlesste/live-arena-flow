import { useMemo, useState } from "react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { matches, competitions, getTeam } from "@/data/mocks";
import { UpcomingMatchCard } from "@/components/matches/UpcomingMatchCard";
import { EmptyState } from "@/components/feedback/States";
import { formatDayGroup } from "@/lib/format";
import { cn } from "@/lib/utils";

const CalendarPage = () => {
  useDocumentMeta({ title: "Calendario", description: "Próximos partidos por fecha y competición." });
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [comp, setComp] = useState<string>("all");

  const upcoming = useMemo(() => matches.filter((m) => m.status === "scheduled"), []);
  const filtered = useMemo(() => {
    return upcoming.filter((m) => {
      if (comp !== "all" && m.competitionId !== comp) return false;
      if (date) {
        const sel = format(date, "yyyy-MM-dd");
        const d = new Date(m.startsAt).toISOString().slice(0, 10);
        if (d !== sel) return false;
      }
      return true;
    }).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  }, [upcoming, comp, date]);

  // group by day
  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((m) => {
      const key = new Date(m.startsAt).toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <section className="container mx-auto space-y-6 px-4 py-6 md:px-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Calendario</h1>
        <p className="text-sm text-muted-foreground">Filtra por día y competición.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: es }) : "Cualquier fecha"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={setDate} className={cn("pointer-events-auto p-3")} />
          </PopoverContent>
        </Popover>
        {date ? <Button size="sm" variant="ghost" onClick={() => setDate(undefined)}>Limpiar fecha</Button> : null}
        <Select value={comp} onValueChange={setComp}>
          <SelectTrigger className="w-[240px]" aria-label="Filtrar por competición">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las competiciones</SelectItem>
            {competitions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="Sin partidos programados" description="Cambia los filtros para ver más eventos." />
      ) : (
        <div className="space-y-6">
          {groups.map(([day, list]) => (
            <div key={day}>
              <h2 className="mb-3 font-display text-lg font-semibold capitalize">{formatDayGroup(list[0].startsAt)}</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {list.map((m) => (
                  <UpcomingMatchCard
                    key={m.id}
                    match={m}
                    homeTeam={getTeam(m.homeTeamId)}
                    awayTeam={getTeam(m.awayTeamId)}
                    competition={competitions.find((c) => c.id === m.competitionId)!}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default CalendarPage;
