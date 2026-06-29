function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function isUsablePublicKey(key) {
  const value = key?.trim();
  if (!value) return false;
  if (value.startsWith("sb_publishable_")) return true;
  const payload = decodeJwtPayload(value);
  return payload?.role === "anon" && typeof payload?.exp === "number" && payload.exp > Date.now() / 1000;
}

const publicSupabaseExplicitlyDisabled =
  process.env.NEXT_PUBLIC_SUPABASE_URL === "" &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === "";

const publicSupabaseUrl = publicSupabaseExplicitlyDisabled
  ? undefined
  : [
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_URL,
      process.env.VITE_SUPABASE_URL,
    ].map((value) => value?.trim()).find(Boolean);

const publicSupabasePublishableKey = publicSupabaseExplicitlyDisabled
  ? undefined
  : [
      process.env.SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ].map((key) => key?.trim()).find(isUsablePublicKey);

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Keep dev and production artifacts isolated: `prebuild` may safely clean
  // `.next` without corrupting a concurrently running development server.
  distDir: process.env.NEXT_DIST_DIR || (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  env: {
    NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicSupabasePublishableKey,
  },
  allowedDevOrigins: ["127.0.0.1"],
  experimental: { webpackBuildWorker: false },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default nextConfig;
