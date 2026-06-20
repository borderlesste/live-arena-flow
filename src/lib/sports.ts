import type { Sport } from "@/types";

export const SPORT_LABEL: Record<Sport, string> = {
  football: "Fútbol",
  basketball: "Baloncesto",
  baseball: "Béisbol",
  volleyball: "Voleibol",
  other: "Otros",
};

export const SPORT_OPTIONS: { value: Sport | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "football", label: "Fútbol" },
  { value: "basketball", label: "Baloncesto" },
  { value: "baseball", label: "Béisbol" },
  { value: "volleyball", label: "Voleibol" },
  { value: "other", label: "Otros" },
];
