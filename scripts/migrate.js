import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("Set DATABASE_URL before migrating.");
const sql = neon(url);
await sql`CREATE TABLE IF NOT EXISTS journeys (id TEXT PRIMARY KEY CHECK (length(id)=64), progress JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
console.log("Neon journeys table is ready.");
