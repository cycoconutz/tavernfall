import { UNIT_TEMPLATES } from "../src/game/units";
import { combat } from "../src/sim/combat";
import { Rng } from "../src/sim/rng";
import { toUnitState } from "../src/game/units";

const rng = new Rng(1);
let wins = 0;
const rows: string[] = ["tribe,fights,meanSurvivors"];
const byTribe = new Map<string, { fights: number; surv: number }>();
for (const t of ["goblins", "dragons", "naga", "murlocs"]) byTribe.set(t, { fights: 0, surv: 0 });

for (let i = 0; i < 200; i++) {
  const tribe = ["goblins", "dragons", "naga", "murlocs"][i % 4];
  const units = UNIT_TEMPLATES.filter((u) => u.tribe === tribe).slice(0, 3);
  const player = units.map((u, idx) => toUnitState(u, `p${idx}`));
  const enemy = units.map((u, idx) => toUnitState(u, `e${idx}`));
  const r = combat({ player, enemy, seed: Math.floor(rng.next() * 1e9) });
  if (r.winner === "player" || r.winner === "draw") wins++;
  const cell = byTribe.get(tribe)!;
  cell.fights++;
  cell.surv += r.playerSurvivors.length;
}

for (const [tribe, v] of byTribe) {
  rows.push(`${tribe},${v.fights},${(v.surv / v.fights).toFixed(2)}`);
}
console.log(rows.join("\n"));
console.log(`overall win/draw rate: ${(wins / 200).toFixed(3)}`);