import { neon } from "@neondatabase/serverless";
import { randomBytes, createHash } from "node:crypto";
import { sanitizeProgress } from "../src/world.js";
const COOKIE = "lk_journey";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "PUT"].includes(req.method)) {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const connection = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connection) return res.status(503).json({ configured: false });
  // Browser writes must originate on this deployment. Cookies cannot be used cross-site.
  if (req.method === "PUT") {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    let originHost;
    try {
      originHost = new URL(req.headers.origin).host;
    } catch {}
    if (originHost !== host)
      return res.status(403).json({ error: "Origin rejected" });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return res.status(415).json({ error: "JSON required" });
    if (
      Number(req.headers["content-length"]) > 8192 ||
      JSON.stringify(req.body || {}).length > 8192
    )
      return res.status(413).json({ error: "Save too large" });
  }
  let token = (req.headers.cookie || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (req.method !== "GET")
      return res.status(401).json({ error: "Start a journey first" });
    token = randomBytes(32).toString("hex");
    res.setHeader(
      "Set-Cookie",
      `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=31536000`,
    );
  }
  const id = createHash("sha256").update(token).digest("hex");
  try {
    const sql = neon(connection);
    if (req.method === "GET") {
      const rows = await sql`SELECT progress FROM journeys WHERE id=${id}`;
      return res
        .status(200)
        .json({ configured: true, progress: rows[0]?.progress || null });
    }
    const progress = sanitizeProgress(req.body);
    if (!progress) return res.status(400).json({ error: "Invalid progress" });
    await sql`INSERT INTO journeys(id,progress) VALUES(${id},${JSON.stringify(progress)}::jsonb) ON CONFLICT(id) DO UPDATE SET progress=EXCLUDED.progress, updated_at=NOW() WHERE (COALESCE((journeys.progress->>'resetAt')::bigint,0), COALESCE((journeys.progress->>'updatedAt')::bigint,0)) <= ((EXCLUDED.progress->>'resetAt')::bigint, (EXCLUDED.progress->>'updatedAt')::bigint)`;
    return res.status(200).json({ saved: true });
  } catch (error) {
    console.error("Journey database unavailable:", error.code || error.name);
    return res
      .status(503)
      .json({ error: "Cloud save temporarily unavailable" });
  }
}
