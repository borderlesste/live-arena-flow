import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MatchFilter =
  | "all" | "football" | "basketball" | "baseball" | "volleyball"
  | "live" | "upcoming" | "finished";

const ITEMS: { value: MatchFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "football", label: "Fútbol" },
  { value: "basketball", label: "Baloncesto" },
  { value: "baseball", label: "Béisbol" },
  { value: "volleyball", label: "Voleibol" },
  { value: "live", label: "En vivo" },
  { value: "upcoming", label: "Próximos" },
  { value: "finished", label: "Finalizados" },
];

interface Props {
  value: MatchFilter;
  onChange: (v: MatchFilter) => void;
  showStatusFilters?: boolean;
}

export function MatchFilters({ value, onChange, showStatusFilters = true }: Props) {
  const items = showStatusFilters ? ITEMS : ITEMS.filter((item) => !["upcoming", "finished"].includes(item.value));
  return (
    <div className="flex w-full gap-2 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Filtrar partidos">
      {items.map((it) => {
        const active = value === it.value;
        return (
          <Button
            key={it.value}
            size="sm"
            variant={active ? "default" : "secondary"}
            role="tab"
            aria-selected={active}
            className={cn("shrink-0", active && "bg-primary text-primary-foreground hover:bg-primary-hover")}
            onClick={() => onChange(it.value)}
          >
            {it.label}
          </Button>
        );
      })}
    </div>
  );
}
