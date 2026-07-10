import { format } from "date-fns";
import type { Competition, Match } from "@/types";
import { getMatchLocalDateKey, sortMatchesByDateAsc, sortMatchesByDateDesc } from "@/lib/format";

export const WORLD_CHAMPIONSHIP_NAME = "World Championship";
export const WORLD_CHAMPIONSHIP_START_DATE = "2026-06-11";
export const WORLD_CHAMPIONSHIP_END_DATE = "2026-07-19";

/** Known provider IDs / slugs for the World Championship competition. */
export const WORLD_CHAMPIONSHIP_ID_HINTS = [
  "sportsrc-competition-world-cup",
  "world-cup",
  "world-championship",
] as const;

const LIVE_STATUSES = new Set<Match["status"]>(["live", "halftime", "paused"]);

function normalizeCompetitionName(name: string): string {
  return name.normalize("NFKC").trim().toLowerCase();
}

export function isWorldChampionshipCompetition(
  competition: Pick<Competition, "id" | "name">,
): boolean {
  if (normalizeCompetitionName(competition.name) === normalizeCompetitionName(WORLD_CHAMPIONSHIP_NAME)) {
    return true;
  }
  const id = competition.id.toLowerCase();
  return WORLD_CHAMPIONSHIP_ID_HINTS.some((hint) => id.includes(hint));
}

export function filterWorldChampionshipMatches(
  matches: Match[],
  competitions: Competition[],
): Match[] {
  const competitionIds = new Set(
    competitions.filter(isWorldChampionshipCompetition).map((competition) => competition.id),
  );
  if (competitionIds.size === 0) return [];
  return matches.filter((match) => competitionIds.has(match.competitionId));
}

export type WorldChampionshipPhase =
  | "group-stage"
  | "round-of-32"
  | "round-of-16"
  | "quarter-finals"
  | "semi-finals"
  | "third-place"
  | "final"
  | "other";

const WORLD_PHASES: Array<{ key: WorldChampionshipPhase; label: string }> = [
  { key: "group-stage", label: "Fase de grupos" },
  { key: "round-of-32", label: "Ronda de 32" },
  { key: "round-of-16", label: "Octavos de final" },
  { key: "quarter-finals", label: "Cuartos de final" },
  { key: "semi-finals", label: "Semifinales" },
  { key: "third-place", label: "Tercer lugar" },
  { key: "final", label: "Final" },
  { key: "other", label: "Otros partidos" },
];

function normalizedPhase(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function classifyWorldChampionshipPhase(match: Match): WorldChampionshipPhase {
  const value = normalizedPhase([match.phase, match.group].filter(Boolean).join(" "));
  if (!value) return "other";
  if (/third|3rd|tercer|bronze/.test(value)) return "third-place";
  if (/semi/.test(value)) return "semi-finals";
  if (/quarter|cuarto|1\/4/.test(value)) return "quarter-finals";
  if (/round\s*(of)?\s*32|last\s*32|ronda\s*de\s*32|1\/16|dieciseis/.test(value)) return "round-of-32";
  if (/round\s*(of)?\s*16|last\s*16|ronda\s*de\s*16|1\/8|octav/.test(value)) return "round-of-16";
  if (/group|grupo/.test(value)) return "group-stage";
  if (/final/.test(value)) return "final";
  return "other";
}

export interface WorldChampionshipPhaseGroup {
  key: WorldChampionshipPhase;
  label: string;
  matches: Match[];
}

export function groupWorldChampionshipMatchesByPhase(matches: Match[]): WorldChampionshipPhaseGroup[] {
  const grouped = new Map<WorldChampionshipPhase, Match[]>();
  for (const match of sortMatchesByDateAsc(matches)) {
    const phase = classifyWorldChampionshipPhase(match);
    const current = grouped.get(phase) ?? [];
    current.push(match);
    grouped.set(phase, current);
  }
  return WORLD_PHASES.flatMap((phase) => {
    const phaseMatches = grouped.get(phase.key);
    return phaseMatches?.length ? [{ ...phase, matches: phaseMatches }] : [];
  });
}

export interface WorldChampionshipTimeline {
  past: Match[];
  present: Match[];
  future: Match[];
}

export function splitWorldChampionshipTimeline(
  matches: Match[],
  now: Date = new Date(),
): WorldChampionshipTimeline {
  const todayKey = format(now, "yyyy-MM-dd");

  const past = sortMatchesByDateDesc(matches.filter((match) => match.status === "finished"));

  const live = sortMatchesByDateAsc(matches.filter((match) => LIVE_STATUSES.has(match.status)));
  const todayScheduled = sortMatchesByDateAsc(
    matches.filter(
      (match) => match.status === "scheduled" && getMatchLocalDateKey(match.startsAt) === todayKey,
    ),
  );

  const present: Match[] = [];
  const seen = new Set<string>();

  for (const match of [...live, ...todayScheduled]) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    present.push(match);
  }

  if (present.length === 0) {
    const nextUpcoming = sortMatchesByDateAsc(matches.filter((match) => match.status === "scheduled"))[0];
    if (nextUpcoming) present.push(nextUpcoming);
  }

  const presentIds = new Set(present.map((match) => match.id));
  const future = sortMatchesByDateAsc(
    matches.filter((match) => match.status === "scheduled" && !presentIds.has(match.id)),
  );

  return { past, present, future };
}
