import { useMemo, useState } from "react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useSportsLocalDate, useSportsWindow } from "@/hooks/useSportsData";
import { MatchFilters, type MatchFilter } from "@/components/matches/MatchFilters";
import { MatchCard } from "@/components/matches/MatchCard";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { groupMatchesByDate } from "@/lib/format";
import { filterMatchesByCriteria } from "@/lib/match-filters";
import { cn } from "@/lib/utils";

const CalendarPage = () => {
  useDocumentMeta({ title: "Calendario", description: "Próximos partidos por fecha, competición y estado." });
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [comp, setComp] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<MatchFilter>("all");
  const dateKey = date ? format(date, "yyyy-MM-dd") : undefined;
  const windowQuery = useSportsWindow();
  const dateQuery = useSportsLocalDate(dateKey);
  const activeQuery = date ? dateQuery : windowQuery;
  const bundle = activeQuery.bundle;
  const { matches, competitions, teams } = bundle;
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const competitionById = useMemo(() => new Map(competitions.map((competition) => [competition.id, competition])), [competitions]);

  const filtered = useMemo(() => {
    return filterMatchesByCriteria(matches, { status: statusFilter, competitionId: comp, localDate: dateKey });
  }, [matches, statusFilter, comp, dateKey]);

  const groups = useMemo(
    () => groupMatchesByDate(filtered, { order: statusFilter === "finished" ? "desc" : "asc" }),
    [filtered, statusFilter],
  );

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
      <div className="mt-3">
        <MatchFilters value={statusFilter} onChange={setStatusFilter} />
      </div>

      {activeQuery.isLoading ? <SkeletonLoader className="h-72 w-full" /> : activeQuery.isError ? <ErrorState title="No se pudo cargar el calendario" description="El proveedor deportivo no respondió correctamente." action={<Button onClick={() => void activeQuery.refetch()}>Reintentar</Button>} /> : groups.length === 0 ? (
        <EmptyState title="Sin partidos programados" description="Cambia los filtros para ver más eventos." />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key}>
              <h2 className="mb-3 font-display text-lg font-semibold capitalize">{group.label}</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {group.matches.map((m) => (
                  (() => {
                    const homeTeam = teamById.get(m.homeTeamId);
                    const awayTeam = teamById.get(m.awayTeamId);
                    const competition = competitionById.get(m.competitionId);
                    return homeTeam && awayTeam && competition
                      ? <MatchCard key={m.id} match={m} homeTeam={homeTeam} awayTeam={awayTeam} competition={competition} />
                      : null;
                  })()
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
