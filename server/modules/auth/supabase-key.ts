interface SupabaseKeyEnvironment {
  SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export function isUsableSupabasePublicKey(key: string | undefined, nowSeconds = Date.now() / 1000): boolean {
  const value = key?.trim();
  if (!value) return false;
  void nowSeconds;
  return value.startsWith("sb_publishable_");
}

export function selectSupabasePublicKey(env: SupabaseKeyEnvironment = process.env): string | undefined {
  return [
    env.SUPABASE_PUBLISHABLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ].map((key) => key?.trim()).find((key) => isUsableSupabasePublicKey(key));
}
