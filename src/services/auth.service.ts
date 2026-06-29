import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { publicEnv } from "@/config/env";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;
const TOKEN_KEY = "arena-live:session-token";

export type AppRole = "super_admin" | "admin" | "stream_operator" | "moderator" | "user";

export interface UserPreferences {
  matchReminders: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  role: AppRole;
  accountStatus: "active" | "suspended" | "blocked" | "deleted";
  preferences: UserPreferences;
}

interface AuthResponse { token: string; user: UserProfile }

const defaultPreferences: UserPreferences = {
  matchReminders: false,
};

export const getSessionToken = () => localStorage.getItem(TOKEN_KEY);

async function ensureProfileExists(token: string): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/ensure-profile`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "No se pudo reparar el perfil");
  }
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `El backend respondió ${response.status}`);
  }
  return response.json();
}

function normalizeLegacyProfile(profile: Omit<UserProfile, "role" | "accountStatus"> & Partial<Pick<UserProfile, "role" | "accountStatus">>): UserProfile {
  return { ...profile, role: profile.role ?? "user", accountStatus: profile.accountStatus ?? "active" };
}

async function legacyAuthenticate(path: "login" | "register", input: Record<string, string>): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const auth = await responseJson<{ token: string; user: UserProfile }>(response);
  localStorage.setItem(TOKEN_KEY, auth.token);
  return { ...auth, user: normalizeLegacyProfile(auth.user) };
}

async function supabaseProfile(): Promise<UserProfile> {
  const supabase = await getSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) throw new Error("La sesión ha expirado");
  const user = userResult.user;
  let [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("display_name, account_status, preferences, created_at").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  if (!profile) {
    const { data: session } = await supabase.auth.getSession();
    if (session.session?.access_token) {
      await ensureProfileExists(session.session.access_token);
      const [{ data: nextProfile }, { data: nextRoles }] = await Promise.all([
        supabase.from("profiles").select("display_name, account_status, preferences, created_at").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      profile = nextProfile;
      roles = nextRoles;
    }
  }
  const roleOrder: AppRole[] = ["super_admin", "admin", "stream_operator", "moderator", "user"];
  const assigned = new Set((roles ?? []).map((item) => item.role as AppRole));
  const role = roleOrder.find((candidate) => assigned.has(candidate)) ?? "user";
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name ?? user.user_metadata.display_name ?? user.email?.split("@")[0] ?? "Usuario",
    createdAt: profile?.created_at ?? user.created_at,
    role,
    accountStatus: profile?.account_status ?? "active",
    preferences: { ...defaultPreferences, ...(profile?.preferences as Partial<UserPreferences> | null) },
  };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  if (!isSupabaseConfigured) return legacyAuthenticate("login", { email, password });
  const { data, error } = await (await getSupabaseClient()).auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "No se pudo iniciar sesión");
  localStorage.setItem(TOKEN_KEY, data.session.access_token);
  return { token: data.session.access_token, user: await supabaseProfile() };
}

export async function register(displayName: string, email: string, password: string): Promise<AuthResponse> {
  if (!isSupabaseConfigured) return legacyAuthenticate("register", { displayName, email, password });
  const { data, error } = await (await getSupabaseClient()).auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/profile` },
  });
  if (error || !data.user) throw new Error(error?.message ?? "No se pudo crear la cuenta");
  if (!data.session) throw new Error("Revisa tu correo para confirmar la cuenta antes de iniciar sesión");
  localStorage.setItem(TOKEN_KEY, data.session.access_token);
  return { token: data.session.access_token, user: await supabaseProfile() };
}

export async function loginWithGoogle(): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Google requiere configurar Supabase");
  const { error } = await (await getSupabaseClient()).auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/profile` },
  });
  if (error) throw new Error(error.message);
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("La recuperación requiere configurar Supabase");
  const { error } = await (await getSupabaseClient()).auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/profile?recovery=1`,
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("El cambio de contraseña requiere configurar Supabase");
  const { error } = await (await getSupabaseClient()).auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function getProfile(token: string): Promise<UserProfile> {
  if (isSupabaseConfigured) return supabaseProfile();
  return fetch(`${API_BASE}/profile`, { headers: { Authorization: `Bearer ${token}` } })
    .then(responseJson<UserProfile>)
    .then(normalizeLegacyProfile);
}

export async function updateProfile(token: string, profile: Pick<UserProfile, "displayName" | "preferences">): Promise<UserProfile> {
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user) throw new Error("La sesión ha expirado");
    const { error } = await supabase.from("profiles").update({ display_name: profile.displayName, preferences: profile.preferences }).eq("id", userResult.user.id);
    if (error) throw new Error(error.message);
    return supabaseProfile();
  }
  return fetch(`${API_BASE}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(profile) })
    .then(responseJson<UserProfile>)
    .then(normalizeLegacyProfile);
}

export async function logout(token: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await (await getSupabaseClient()).auth.signOut();
    if (error) throw new Error(error.message);
  } else {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  }
  localStorage.removeItem(TOKEN_KEY);
}

export function subscribeToAuth(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  let cancelled = false;
  let unsubscribe: (() => void) | undefined;
  void getSupabaseClient().then((client) => {
    if (cancelled) return;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (session) localStorage.setItem(TOKEN_KEY, session.access_token);
      else localStorage.removeItem(TOKEN_KEY);
      callback(event, session);
    });
    unsubscribe = () => data.subscription.unsubscribe();
  });
  return () => { cancelled = true; unsubscribe?.(); };
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
}

export { isSupabaseConfigured };
