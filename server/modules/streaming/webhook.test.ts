// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cloudflareLiveWebhookSchema } from "../../../src/schemas/live-source.schema.js";
import { buildWebhookEventKey, mapCloudflareEventToStatus, validateWebhookSecret } from "./webhook.js";

const SECRET = "test-webhook-secret-value-long-enough";

describe("Cloudflare Stream webhook", () => {
  it("validates a configured secret in constant-length form", () => {
    expect(validateWebhookSecret(SECRET, SECRET)).toBe(true);
    expect(validateWebhookSecret(SECRET, "wrong-secret")).toBe(false);
    expect(validateWebhookSecret("", "")).toBe(false);
    expect(validateWebhookSecret(undefined, SECRET)).toBe(false);
  });

  it("accepts the official Live notification fields", () => {
    const result = cloudflareLiveWebhookSchema.safeParse({
      data: {
        input_id: "live-input-123",
        event_type: "live_input.connected",
        updated_at: "2026-06-28T12:00:00.000Z",
      },
      ts: 1_782_646_400,
    });
    expect(result.success).toBe(true);
  });

  it("rejects the obsolete payload shape", () => {
    expect(cloudflareLiveWebhookSchema.safeParse({
      data: { liveInput: { uid: "old" } },
      event: "live_input.connected",
      updated: "2026-06-28T12:00:00.000Z",
    }).success).toBe(false);
  });

  it("builds stable, collision-resistant event keys", () => {
    const first = buildWebhookEventKey("uid", "live_input.connected", "2026-06-28T12:00:00Z");
    const replay = buildWebhookEventKey("uid", "live_input.connected", "2026-06-28T12:00:00Z");
    const next = buildWebhookEventKey("uid", "live_input.disconnected", "2026-06-28T12:00:00Z");
    expect(first).toBe(replay);
    expect(first).not.toBe(next);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normalizes supported events and ignores unknown ones", () => {
    expect(mapCloudflareEventToStatus("live_input.connected")).toBe("live");
    expect(mapCloudflareEventToStatus("live_input.disconnected")).toBe("disconnected");
    expect(mapCloudflareEventToStatus("live_input.errored")).toBe("provider_error");
    expect(mapCloudflareEventToStatus("unknown")).toBeNull();
  });
});
