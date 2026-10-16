import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
const origin = process.env.QA_URL || "https://lizards-game.vercel.app";
let cookie;
try {
  const first = await fetch(origin + "/api/progress");
  assert.equal(first.status, 200);
  const data = await first.json();
  assert.equal(data.configured, true);
  assert.equal(data.progress, null);
  const setCookie = first.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Strict/i);
  cookie = setCookie.split(";")[0];
  const progress = {
    hero: 1,
    region: 0,
    tokens: { 0: [0, 2] },
    cleared: [],
    defeated: [],
    checkpoint: true,
    mode: "gentle",
    updatedAt: Date.now(),
  };
  const write = await fetch(origin + "/api/progress", {
    method: "PUT",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(progress),
  });
  assert.equal(write.status, 200);
  const read = await fetch(origin + "/api/progress", {
    headers: { Cookie: cookie },
  }).then((r) => r.json());
  assert.deepEqual(read.progress.tokens[0], [0, 2]);
  assert.equal(read.progress.hero, 1);
  assert.equal(read.progress.checkpoint, true);
  const isolated = await fetch(origin + "/api/progress").then((r) => r.json());
  assert.equal(isolated.progress, null);
  const rejected = await fetch(origin + "/api/progress", {
    method: "PUT",
    headers: {
      Cookie: cookie,
      Origin: "https://unrelated.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(rejected.status, 403);
  const malformed = await fetch(origin + "/api/progress", {
    method: "PUT",
    headers: {
      Cookie: cookie,
      Origin: "invalid-origin",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(malformed.status, 403);
  const stale = await fetch(origin + "/api/progress", {
    method: "PUT",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...progress, updatedAt: 1, tokens: {} }),
  });
  assert.equal(stale.status, 200);
  const retained = await fetch(origin + "/api/progress", {
    headers: { Cookie: cookie },
  }).then((r) => r.json());
  assert.deepEqual(retained.progress.tokens[0], [0, 2]);
  console.log(
    "Cloud QA passed: Neon write/read, private journey isolation, cookie flags, rejected cross-origin and malformed requests, stale-write protection.",
  );
} finally {
  const connection = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (cookie && connection) {
    const id = createHash("sha256")
      .update(cookie.slice(cookie.indexOf("=") + 1))
      .digest("hex");
    const sql = neon(connection);
    await sql`DELETE FROM journeys WHERE id=${id}`;
    console.log("Test journey removed.");
  }
}
