import type { LocalMatchInput } from "@/schemas/local-match.schema";
import { normalizedSportsEventSchema, type NormalizedSportsEvent } from "@/schemas/sports-event.schema";
import { publicEnv } from "@/config/env";

export async function createLocalMatch(input: LocalMatchInput, token: string): Promise<NormalizedSportsEvent> {
  const response = await fetch(`${publicEnv.NEXT_PUBLIC_API_BASE_URL}/admin/local-matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({})) as { event?: unknown; error?: string };
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `El backend respondió ${response.status}`);
  return normalizedSportsEventSchema.parse(body.event);
}
