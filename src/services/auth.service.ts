import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { publicEnv } from "@/config/env";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { authCredentialsSchema, authRegistrationSchema, displayNameSchema } from "@/schemas/auth.schema";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;
const TOKEN_KEY = "arena-live:session-token";
const legacyAuthAvailable = process.env.NODE_ENV !== "production";

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

export interface RegistrationResult {
  confirmationRequired: boolean;
  email: string;
}

const defaultPreferences: UserPreferences = {
  matchReminders: false,
};

export const getSessionToken = () => localStorage.getItem(TOKEN_KEY);

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function resolveAuthRedirect(path: string, configuredAppUrl: string | undefined, runtimeOrigin: string): string {
  const runtimeUrl = new URL(runtimeOrigin);
  const configuredUrl = configuredAppUrl ? new URL(configuredAppUrl) : undefined;
  const configuredIsLoopback = configuredUrl ? LOOPBACK_HOSTS.has(configuredUrl.hostname) : false;
  const runtimeIsPublic = !LOOPBACK_HOSTS.has(runtimeUrl.hostname);

  // A local .env value must never leak into an email created from the public site.
  const baseUrl = configuredUrl && !(configuredIsLoopback && runtimeIsPublic)
    ? configuredUrl
    : runtimeUrl;

  return new URL(path, `${baseUrl.origin}/`).toString();
}

function authRedirect(path: string): string {
  return resolveAuthRedirect(path, publicEnv.NEXT_PUBLIC_APP_URL, window.location.origin);
}

function parseAuthInput<T>(result: { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } }): T {
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Datos de acceso inválidos");
  return result.data;
}

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
  const input = parseAuthInput(authCredentialsSchema.safeParse({ email, password }));
  if (!isSupabaseConfigured && legacyAuthAvailable) return legacyAuthenticate("login", input);
  const { data, error } = await (await getSupabaseClient()).auth.signInWithPassword(input);
  if (error?.code === "email_not_confirmed") throw new Error("Debes verificar tu correo antes de iniciar sesión");
  if (error || !data.session) throw new Error(error?.message ?? "No se pudo iniciar sesión");
  localStorage.setItem(TOKEN_KEY, data.session.access_token);
  return { token: data.session.access_token, user: await supabaseProfile() };
}

export async function register(displayName: string, email: string, password: string): Promise<RegistrationResult> {
  const input = parseAuthInput(authRegistrationSchema.safeParse({ displayName, email, password }));
  if (!isSupabaseConfigured && legacyAuthAvailable) {
    const auth = await legacyAuthenticate("register", input);
    return { confirmationRequired: false, email: auth.user.email };
  }
  const { data, error } = await (await getSupabaseClient()).auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { display_name: input.displayName }, emailRedirectTo: authRedirect("/auth/confirm") },
  });
  if (error) {
    if (error.code === "23505" || /profiles_display_name_unique_ci|duplicate.*display/i.test(error.message)) {
      throw new Error("Ese nombre visible ya está en uso");
    }
    if (error.code === "user_already_exists") throw new Error("Ya existe una cuenta con ese correo");
    throw new Error(error.message ?? "No se pudo crear la cuenta");
  }
  if (!data.user) throw new Error("No se pudo crear la cuenta");
  if (data.user.identities?.length === 0) {
    throw new Error("No se creó una cuenta nueva. Si ese correo ya está registrado, inicia sesión o recupera tu contraseña.");
  }
  if (!data.session) return { confirmationRequired: true, email: input.email };
  localStorage.setItem(TOKEN_KEY, data.session.access_token);
  return { confirmationRequired: false, email: data.user.email ?? input.email };
}

export async function resendSignupConfirmation(email: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("La verificación requiere configurar Supabase");
  const { error } = await (await getSupabaseClient()).auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: authRedirect("/auth/confirm") },
  });
  if (error) throw new Error(error.message);
}

export async function loginWithGoogle(): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Google requiere configurar Supabase");
  const { error } = await (await getSupabaseClient()).auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authRedirect("/profile") },
  });
  if (error) throw new Error(error.message);
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("La recuperación requiere configurar Supabase");
  const { error } = await (await getSupabaseClient()).auth.resetPasswordForEmail(email, {
    redirectTo: authRedirect("/auth/update-password"),
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("El cambio de contraseña requiere configurar Supabase");
  const { error } = await (await getSupabaseClient()).auth.updateUser({ password });
  if (error) throw new Error(error.message);
  const { error: signOutError } = await (await getSupabaseClient()).auth.signOut({ scope: "global" });
  if (signOutError) throw new Error(signOutError.message);
  localStorage.removeItem(TOKEN_KEY);
}

export async function hasVerifiedRecoverySession(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data, error } = await (await getSupabaseClient()).auth.getUser();
  return !error && Boolean(data.user);
}

export async function getProfile(token: string): Promise<UserProfile> {
  if (!isSupabaseConfigured && legacyAuthAvailable) {
    return fetch(`${API_BASE}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(responseJson<UserProfile>)
      .then(normalizeLegacyProfile);
  }
  return supabaseProfile();
}

export async function updateProfile(token: string, profile: Pick<UserProfile, "displayName" | "preferences">): Promise<UserProfile> {
  const displayName = parseAuthInput(displayNameSchema.safeParse(profile.displayName));
  if (!isSupabaseConfigured && legacyAuthAvailable) {
    return fetch(`${API_BASE}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...profile, displayName }) })
      .then(responseJson<UserProfile>)
      .then(normalizeLegacyProfile);
  }
  const supabase = await getSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  if (!userResult.user) throw new Error("La sesión ha expirado");
  const { error } = await supabase.from("profiles").update({ display_name: displayName, preferences: profile.preferences }).eq("id", userResult.user.id);
  if (error?.code === "23505") throw new Error("Ese nombre visible ya está en uso");
  if (error) throw new Error(error.message);
  return supabaseProfile();
}

export async function logout(token: string): Promise<void> {
  if (!isSupabaseConfigured && legacyAuthAvailable) {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  } else {
    const { error } = await (await getSupabaseClient()).auth.signOut();
    if (error) throw new Error(error.message);
  }
  localStorage.removeItem(TOKEN_KEY);
}

export function subscribeToAuth(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void {
  if (!isSupabaseConfigured && legacyAuthAvailable) return () => undefined;
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
  }).catch(() => undefined);
  return () => { cancelled = true; unsubscribe?.(); };
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
}

export { isSupabaseConfigured };
