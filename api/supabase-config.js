const getSupabasePublicConfig = require("../supabase-public-config.cjs");

module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Vary", "Host");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const config = getSupabasePublicConfig();
  if (!config) {
    return res.status(503).json({ error: "Supabase public configuration is unavailable." });
  }

  return res.status(200).json(config);
};
