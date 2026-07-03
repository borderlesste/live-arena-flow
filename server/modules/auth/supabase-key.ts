interface SupabaseKeyEnvironment {
  [key: string]: string | undefined;
  SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

function decodeJwtPayload(token: string): { exp?: number; role?: string } | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { exp?: number; role?: string };
  } catch {
    return null;
  }
}

export function isUsableSupabasePublicKey(key: string | undefined, nowSeconds = Date.now() / 1000): boolean {
  const value = key?.trim();
  if (!value) return false;
  if (value.startsWith("sb_publishable_")) return true;
  const payload = decodeJwtPayload(value);
  return payload?.role === "anon" && typeof payload.exp === "number" && payload.exp > nowSeconds;
}

export function selectSupabasePublicKey(env: SupabaseKeyEnvironment = process.env): string | undefined {
  return [
    env.SUPABASE_PUBLISHABLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ].map((key) => key?.trim()).find((key) => isUsableSupabasePublicKey(key));
}
