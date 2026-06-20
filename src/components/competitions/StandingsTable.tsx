import { TeamBadge } from "@/components/matches/TeamBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTeam } from "@/data/mocks";
import type { StandingRow } from "@/types";

interface Props { rows: StandingRow[] }

export function StandingsTable({ rows }: Props) {
  return (
    <div className="surface-card overflow-x-auto rounded-xl">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead scope="col" className="sticky left-0 z-10 w-10 bg-card">#</TableHead>
            <TableHead scope="col" className="sticky left-10 z-10 min-w-[160px] bg-card">Equipo</TableHead>
            <TableHead scope="col" className="text-center">PJ</TableHead>
            <TableHead scope="col" className="text-center">G</TableHead>
            <TableHead scope="col" className="text-center">E</TableHead>
            <TableHead scope="col" className="text-center">P</TableHead>
            <TableHead scope="col" className="text-center">DG</TableHead>
            <TableHead scope="col" className="text-center font-bold text-primary">PTS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const team = getTeam(r.teamId);
            return (
              <TableRow key={r.teamId} className="border-border">
                <TableCell className="sticky left-0 bg-card font-semibold">{r.position}</TableCell>
                <TableCell className="sticky left-10 bg-card">
                  <span className="flex items-center gap-2">
                    <TeamBadge team={team} size="sm" />
                    <span className="truncate font-medium">{team.name}</span>
                  </span>
                </TableCell>
                <TableCell className="text-center tabular-nums">{r.played}</TableCell>
                <TableCell className="text-center tabular-nums">{r.won}</TableCell>
                <TableCell className="text-center tabular-nums">{r.drawn}</TableCell>
                <TableCell className="text-center tabular-nums">{r.lost}</TableCell>
                <TableCell className="text-center tabular-nums">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</TableCell>
                <TableCell className="text-center font-bold tabular-nums text-primary">{r.points}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
