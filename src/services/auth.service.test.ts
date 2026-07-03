import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabaseClient: async () => ({ auth }),
}));

import {
  hasVerifiedRecoverySession,
  register,
  requestPasswordReset,
  resendSignupConfirmation,
  updatePassword,
} from "./auth.service";

describe("account verification and recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("treats signup without a session as pending email verification", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { email: "user@example.com" }, session: null }, error: null });

    await expect(register("Usuario", "user@example.com", "password-123")).resolves.toEqual({
      confirmationRequired: true,
      email: "user@example.com",
    });
    const options = auth.signUp.mock.calls[0][0].options;
    expect(new URL(options.emailRedirectTo).pathname).toBe("/auth/confirm");
  });

  it("resends signup verification to the confirmation route", async () => {
    auth.resend.mockResolvedValue({ error: null });
    await resendSignupConfirmation("user@example.com");
    const request = auth.resend.mock.calls[0][0];
    expect(request).toMatchObject({ type: "signup", email: "user@example.com" });
    expect(new URL(request.options.emailRedirectTo).pathname).toBe("/auth/confirm");
  });

  it("sends recovery links to the password update route", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    await requestPasswordReset("user@example.com");
    expect(new URL(auth.resetPasswordForEmail.mock.calls[0][1].redirectTo).pathname).toBe("/auth/update-password");
  });

  it("updates the password and revokes existing sessions", async () => {
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    localStorage.setItem("arena-live:session-token", "token");

    await updatePassword("new-password-123");

    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password-123" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(localStorage.getItem("arena-live:session-token")).toBeNull();
  });

  it("only accepts recovery when Supabase has an authenticated session", async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "expired" } });
    await expect(hasVerifiedRecoverySession()).resolves.toBe(true);
    await expect(hasVerifiedRecoverySession()).resolves.toBe(false);
  });
});
