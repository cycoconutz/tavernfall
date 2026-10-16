import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = process.env.GEN_BASE ?? "http://localhost:3001";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

const units = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "units.json"), "utf8"));
const heroes = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "heroes.json"), "utf8"));

const items = [
  ...units.map((u) => ({ id: u.id, prompt: u.artPrompt })),
  ...heroes.map((h) => ({ id: `hero_${h.id}`, prompt: h.artPrompt }))
];

const outDir = path.join(ROOT, "public", "assets");
fs.mkdirSync(outDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const outPath = path.join(outDir, `${item.id}.png`);
    if (!force && fs.existsSync(outPath)) {
      console.log(`skip (exists): ${item.id}`);
      continue;
    }
    if (dryRun) {
      console.log(`[${i + 1}/${items.length}] ${item.id}: ${item.prompt}`);
      continue;
    }

    let saved = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[${i + 1}/${items.length}] generating ${item.id} (attempt ${attempt})...`);
        const res = await fetch(`${BASE}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: item.prompt, aspectRatio: "1:1" }),
          signal: AbortSignal.timeout(300000)
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status} ${text}`);
        }
        const data = await res.json();
        const match = data.imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
        if (!match) throw new Error("bad data url");
        fs.writeFileSync(outPath, Buffer.from(match[1], "base64"));
        console.log(`saved ${outPath}`);
        saved = true;
        break;
      } catch (err) {
        console.error(`failed ${item.id} attempt ${attempt}: ${err}`);
        if (attempt < 3) await sleep(45000);
      }
    }
    if (!saved) console.error(`giving up on ${item.id}`);

    if (i < items.length - 1) await sleep(45000);
  }
  console.log("done");
}

main().catch((err) => {
  console.error(err);
});