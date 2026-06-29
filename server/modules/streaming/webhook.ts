import { createHash, timingSafeEqual } from "node:crypto";
import type { LiveSourceStatus } from "../../../src/schemas/live-source.schema.js";

export function validateWebhookSecret(expectedSecret: string | undefined, receivedHeader: string | string[] | undefined): boolean {
  if (!expectedSecret || expectedSecret.length < 16 || typeof receivedHeader !== "string") return false;
  const expected = Buffer.from(expectedSecret, "utf8");
  const received = Buffer.from(receivedHeader, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function buildWebhookEventKey(inputId: string, eventType: string, updatedAt: string): string {
  return createHash("sha256").update(`${inputId}:${eventType}:${updatedAt}`).digest("hex");
}

export function mapCloudflareEventToStatus(eventType: string): LiveSourceStatus | null {
  switch (eventType) {
    case "live_input.connected": return "live";
    case "live_input.disconnected": return "disconnected";
    case "live_input.errored": return "provider_error";
    default: return null;
  }
}
