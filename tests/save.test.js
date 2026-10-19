import test from "node:test";
import assert from "node:assert/strict";
import { SaveStore, SAVE_KEY } from "../src/save.js";
import { sanitizeProgress, mergeProgress } from "../src/world.js";

const oldJourney = () =>
  sanitizeProgress({
    hero: 1,
    mode: "adventure",
    region: 3,
    checkpoint: true,
    tokens: { 0: [0, 1, 2] },
    secrets: { 0: [1] },
    broken: { 0: [2] },
    revealed: { 0: [4] },
    cleared: [0, 1],
    defeated: [0],
    visited: [0, 1, 2, 3],
    services: ["forge"],
    quests: ["child"],
    updatedAt: Date.now() - 1000,
  });
function setup(t) {
  const data = new Map([[SAVE_KEY, JSON.stringify(oldJourney())]]);
  globalThis.localStorage = {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
  t.after(() => {
    delete globalThis.localStorage;
  });
  t.mock.method(globalThis, "setTimeout", () => 0);
  const status = [];
  return { store: new SaveStore((s) => status.push(s)), data, status };
}
function fresh(p) {
  assert.equal(p.region, 0);
  assert.equal(p.checkpoint, false);
  for (const key of ["tokens", "secrets", "broken", "revealed", "discovered"])
    assert.ok(
      Object.values(p[key]).every((a) => a.length === 0),
      key,
    );
  for (const key of ["cleared", "defeated", "visited", "services", "quests"])
    assert.deepEqual(p[key], [], key);
}
test("reset clears all progress locally and retains player preferences", (t) => {
  const { store, data } = setup(t);
  const p = store.reset();
  fresh(p);
  assert.equal(p.hero, 1);
  assert.equal(p.mode, "adventure");
  assert.ok(p.resetAt > 0);
  assert.deepEqual(JSON.parse(data.get(SAVE_KEY)), p);
});
test("offline reset survives reload and an older cloud journey with a newer save timestamp", async (t) => {
  const { store } = setup(t);
  const p = store.reset();
  const stale = { ...oldJourney(), updatedAt: Date.now() + 10000 };
  t.mock.method(globalThis, "fetch", async (_, options) =>
    options?.method === "PUT"
      ? { ok: true }
      : { ok: true, json: async () => ({ configured: true, progress: stale }) },
  );
  const reloaded = new SaveStore(() => {});
  fresh(await reloaded.connect());
  assert.equal(reloaded.value.resetAt, p.resetAt);
  assert.equal(mergeProgress(stale, p).resetAt, p.resetAt);
});
test("a delayed connect response cannot resurrect the journey reset while loading", async (t) => {
  const { store } = setup(t);
  let finish;
  t.mock.method(globalThis, "fetch", (_, options) =>
    options?.method === "PUT"
      ? Promise.resolve({ ok: true })
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  const loading = store.connect();
  store.reset();
  finish({
    ok: true,
    json: async () => ({ configured: true, progress: oldJourney() }),
  });
  fresh(await loading);
});
test("reset queued during an in-flight cloud write is the next payload", async (t) => {
  const { store } = setup(t);
  store.cloud = true;
  const sent = [];
  let finish;
  t.mock.method(globalThis, "fetch", (_, options) => {
    sent.push(JSON.parse(options.body));
    return sent.length === 1
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve({ ok: true });
  });
  const saving = store.flush();
  const reset = store.reset();
  finish({ ok: true });
  await saving;
  assert.equal(store.pending, true);
  await store.flush();
  assert.equal(sent.length, 2);
  assert.equal(sent[0].resetAt, 0);
  assert.equal(sent[1].resetAt, reset.resetAt);
  fresh(sent[1]);
});
test("an old tab cannot overwrite a reset stored by another tab", (t) => {
  const { store } = setup(t);
  const old = store.value;
  const secondTab = new SaveStore(() => {});
  const reset = secondTab.reset();
  const result = store.update({ ...old, tokens: { 0: [4] } });
  fresh(result);
  assert.equal(result.resetAt, reset.resetAt);
});
test("normal cloud merging continues within the new journey", () => {
  const a = { resetAt: 10, tokens: { 0: [1] }, updatedAt: 20 };
  const b = { resetAt: 10, tokens: { 0: [2] }, updatedAt: 21 };
  assert.deepEqual(mergeProgress(a, b).tokens[0], [1, 2]);
});
