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

  it("accepts valid legacy anon JWTs and modern publishable keys", () => {
    expect(isUsableSupabasePublicKey(jwt(300), 200)).toBe(true);
    expect(isUsableSupabasePublicKey("sb_publishable_valid-test-key", 200)).toBe(true);
  });

  it("rejects non-anon JWTs", () => {
    const serviceRoleJwt = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ role: "service_role", exp: 300 })).toString("base64url")}.signature`;
    expect(isUsableSupabasePublicKey(serviceRoleJwt, 200)).toBe(false);
  });

  it("prefers the server publishable key over the browser alias", () => {
    expect(selectSupabasePublicKey({
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_valid-test-key",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser-key",
    })).toBe("sb_publishable_valid-test-key");
  });
});
