const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;

function isUsablePublicKey(key) {
  const value = key?.trim();
  return Boolean(value?.startsWith("sb_publishable_"));
}

const publicSupabasePublishableKey = [
  process.env.SUPABASE_PUBLISHABLE_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
].map((key) => key?.trim()).find(isUsablePublicKey);

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
