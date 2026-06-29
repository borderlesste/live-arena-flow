// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isUsableSupabasePublicKey, selectSupabasePublicKey } from "./supabase-key.js";

function jwt(exp: number): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({ role: "anon", exp })}.signature`;
}

describe("Supabase public key selection", () => {
  it("rejects expired legacy anon JWTs", () => {
    expect(isUsableSupabasePublicKey(jwt(100), 200)).toBe(false);
  });

  it("rejects legacy JWTs and accepts modern publishable keys", () => {
    expect(isUsableSupabasePublicKey(jwt(300), 200)).toBe(false);
    expect(isUsableSupabasePublicKey("sb_publishable_valid-test-key", 200)).toBe(true);
  });

  it("prefers the server publishable key over the browser alias", () => {
    expect(selectSupabasePublicKey({
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_valid-test-key",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser-key",
    })).toBe("sb_publishable_valid-test-key");
  });
});
