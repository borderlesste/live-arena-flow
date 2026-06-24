import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage } from "node:http";

export type AppRole = "super_admin" | "admin" | "moderator" | "user";

export function bearerToken(request: IncomingMessage): string | undefined {
  return request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
}

export async function hasSupabaseRole(request: IncomingMessage, allowedRoles: AppRole[]): Promise<boolean> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const token = bearerToken(request);
  if (!url || !anonKey || !token) return false;

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userResult, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userResult.user) return false;

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: roles, error: rolesError } = await userClient.from("user_roles").select("role").eq("user_id", userResult.user.id);
  return !rolesError && (roles ?? []).some((item) => allowedRoles.includes(item.role as AppRole));
}
