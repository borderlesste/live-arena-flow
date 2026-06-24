import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  clearSession,
  getProfile,
  getSessionToken,
  login as loginRequest,
  loginWithGoogle,
  logout as logoutRequest,
  register as registerRequest,
  requestPasswordReset,
  subscribeToAuth,
  updatePassword,
  updateProfile as updateProfileRequest,
  type UserPreferences,
} from "@/services/auth.service";

export function useAuth() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => getSessionToken());

  useEffect(() => subscribeToAuth((_event, session) => {
    const nextToken = session?.access_token ?? null;
    setToken(nextToken);
    if (nextToken) void queryClient.invalidateQueries({ queryKey: ["profile"] });
    else queryClient.removeQueries({ queryKey: ["profile"] });
  }), [queryClient]);
  const query = useQuery({
    queryKey: ["profile", token],
    queryFn: async () => {
      try { return await getProfile(token!); }
      catch (error) { clearSession(); setToken(null); throw error; }
    },
    enabled: Boolean(token),
    retry: false,
  });

  async function login(email: string, password: string) {
    const auth = await loginRequest(email, password);
    setToken(auth.token);
    queryClient.setQueryData(["profile", auth.token], auth.user);
  }

  async function register(displayName: string, email: string, password: string) {
    const auth = await registerRequest(displayName, email, password);
    setToken(auth.token);
    queryClient.setQueryData(["profile", auth.token], auth.user);
  }

  async function save(displayName: string, preferences: UserPreferences) {
    const profile = await updateProfileRequest(token!, { displayName, preferences });
    queryClient.setQueryData(["profile", token], profile);
  }

  async function logout() {
    if (token) await logoutRequest(token);
    queryClient.removeQueries({ queryKey: ["profile"] });
    setToken(null);
  }

  return {
    ...query,
    profile: query.data ?? null,
    authenticated: Boolean(token && query.data),
    login,
    register,
    loginWithGoogle,
    requestPasswordReset,
    updatePassword,
    save,
    logout,
  };
}
