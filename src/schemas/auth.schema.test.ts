import { describe, expect, it } from "vitest";
import { authCredentialsSchema, authRegistrationSchema, displayNameKey, displayNameSchema } from "./auth.schema";

describe("auth input validation", () => {
  it("normalizes valid credentials without altering an opaque password", () => {
    const password = "' OR 1=1; -- <script>";
    expect(authCredentialsSchema.parse({ email: "  USER@Example.com ", password })).toEqual({
      email: "user@example.com",
      password,
    });
  });

  it("rejects malformed emails and unexpected fields", () => {
    expect(authCredentialsSchema.safeParse({ email: "x' OR 1=1 --", password: "password-123" }).success).toBe(false);
    expect(authCredentialsSchema.safeParse({ email: "user@example.com", password: "password-123", role: "admin" }).success).toBe(false);
  });

  it("rejects markup and control characters in public display names", () => {
    expect(displayNameSchema.safeParse("<img src=x onerror=alert(1)>").success).toBe(false);
    expect(displayNameSchema.safeParse("Usuario\u0000admin").success).toBe(false);
  });

  it("accepts legitimate Unicode names", () => {
    expect(authRegistrationSchema.parse({
      displayName: "José 中文",
      email: "jose@example.com",
      password: "contraseña-segura",
    }).displayName).toBe("José 中文");
  });

  it("compares display names case-insensitively after Unicode normalization", () => {
    expect(displayNameKey("  USUARIO  ")).toBe(displayNameKey("usuario"));
    expect(displayNameKey("José")).toBe(displayNameKey("Jose\u0301"));
  });
});
