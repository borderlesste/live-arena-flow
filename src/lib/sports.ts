import type { Sport } from "@/types";

export const SPORT_LABEL: Record<Sport, string> = {
  football: "Fútbol",
};

export const SPORT_OPTIONS: { value: Sport | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "football", label: "Fútbol" },
];
