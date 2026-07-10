import { useDeferredValue, useId, useState, type FocusEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSportsWindow } from "@/hooks/useSportsData";
import { findMatchSearchResults } from "@/lib/match-search";
import { SPORTS_DISPLAY_TIME_ZONE } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HeaderSearchProps {
  sport?: string;
  className?: string;
  inputClassName?: string;
  onNavigate?: () => void;
}

const dateFormatter = new Intl.DateTimeFormat("es", {
  timeZone: SPORTS_DISPLAY_TIME_ZONE,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function HeaderSearch({ sport = "all", className, inputClassName, onNavigate }: HeaderSearchProps) {
  const navigate = useNavigate();
  const resultsId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());
  const { bundle, isLoading } = useSportsWindow();
  const results = deferredQuery.length >= 2
    ? findMatchSearchResults(bundle.matches, bundle.teams, bundle.competitions, deferredQuery)
    : [];
  const showResults = focused && deferredQuery.length >= 2;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (sport !== "all") params.set("sport", sport);
    navigate(`/matches${params.size ? `?${params.toString()}` : ""}`);
    setFocused(false);
    onNavigate?.();
  }

  function handleBlur(event: FocusEvent<HTMLFormElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  }

  return (
    <form
      className={cn("relative", className)}
      role="search"
      onSubmit={submitSearch}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        placeholder="Buscar equipo o competición..."
        className={cn("h-9 bg-surface/60 pl-8 pr-10", inputClassName)}
        aria-label="Buscar partidos"
        aria-expanded={showResults}
        aria-controls={resultsId}
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-9 w-9"
        aria-label="Ejecutar búsqueda"
      >
        <Search className="h-4 w-4" />
      </Button>

      {showResults ? (
        <div
          id={resultsId}
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          {isLoading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Buscando partidos...</p>
          ) : results.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map(({ match, homeTeam, awayTeam, competition }) => (
                <li key={match.id}>
                  <Link
                    to={`/match/${encodeURIComponent(match.id)}`}
                    className="block px-4 py-3 transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
                    onClick={() => {
                      setFocused(false);
                      onNavigate?.();
                    }}
                  >
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {homeTeam.name} vs {awayTeam.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {competition.name} · {dateFormatter.format(new Date(match.startsAt))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2 px-4 py-3">
              <p className="text-sm text-muted-foreground">No hay coincidencias en los partidos recientes y próximos.</p>
              <button type="submit" className="text-sm font-semibold text-primary hover:underline">
                Ver resultados completos
              </button>
            </div>
          )}
        </div>
      ) : null}
    </form>
  );
}
