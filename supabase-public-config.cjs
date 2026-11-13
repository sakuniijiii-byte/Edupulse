function getSupabasePublicConfig(env = process.env) {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").trim();
  const anonKey = String(
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      env.SUPABASE_PUBLISHABLE_KEY ||
      env.SUPABASE_ANON_KEY ||
      "",
  ).trim();

  if (!url || !anonKey) return null;

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "https:") return null;

  return {
    url: parsedUrl.origin,
    anonKey,
    redirectUrl: String(env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || "").trim() || null,
  };
}

module.exports = getSupabasePublicConfig;
