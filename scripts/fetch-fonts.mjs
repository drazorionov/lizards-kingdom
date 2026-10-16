// One-time vendor step. Game runtime uses only the checked-in WOFF2 files.
import { mkdir, writeFile } from "node:fs/promises";
const url =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap";
const response = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
});
if (!response.ok) throw new Error("Font CSS fetch failed");
const css = await response.text();
const blocks = css
  .split("/* latin */")
  .slice(1)
  .map((b) => b.split("}")[0] + "}");
await mkdir("public/fonts", { recursive: true });
let output = "";
const saved = new Map();
for (const block of blocks) {
  const family = block.match(/font-family: '([^']+)'/)[1];
  const source = block.match(/url\(([^)]+)\)/)[1];
  let file = saved.get(source);
  if (!file) {
    file =
      family.toLowerCase().replaceAll(" ", "-") + "-" + saved.size + ".woff2";
    const bytes = await fetch(source);
    if (!bytes.ok) throw new Error("Font download failed");
    await writeFile(
      "public/fonts/" + file,
      Buffer.from(await bytes.arrayBuffer()),
    );
    saved.set(source, file);
  }
  output += block.replace(source, "/fonts/" + file) + "\n";
}
if (!output) throw new Error("Latin font faces missing");
await writeFile("src/fonts.css", output);
console.log("Vendored", saved.size, "font files");
