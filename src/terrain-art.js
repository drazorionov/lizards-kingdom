import forest from "./forest-cave-art.json" with { type: "json" };
import biomes from "./biome-cave-art.json" with { type: "json" };

const REGIONAL_SETS = { 1: "marsh", 4: "depths", 5: "lake" };
export function terrainArt(region = 0) {
  if (region === 0)
    return { prefix: "forest-cave-", version: "v2", frames: forest };
  const key = REGIONAL_SETS[region];
  return key
    ? { prefix: `${key}-cave-`, version: "v3", frames: biomes[key] }
    : null;
}

export function terrainArtKeys(region) {
  const set = terrainArt(region);
  return set
    ? ["edges", "walls", "joins-floor", "joins-ceiling"].map(
        (kind) => `${set.prefix}${kind}-${set.version}`,
      )
    : [];
}
