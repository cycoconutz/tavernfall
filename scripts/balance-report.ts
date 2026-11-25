import { UNIT_TEMPLATES, toUnitState } from "../src/game/units";
import { combat } from "../src/sim/combat";

// Positional combat is deterministic and the player side always strikes first,
// so mirror matches are decided purely by turn order. A meaningful balance
// signal needs asymmetric matchups: every tribe against every other tribe.
const TRIBES = ["goblins", "dragons", "naga", "murlocs"] as const;

const rows: string[] = ["defender \\ attacker,goblins,dragons,naga,murlocs"];
const totals = new Map<string, { wins: number; fights: number }>();
for (const t of TRIBES) totals.set(t, { wins: 0, fights: 0 });

for (const attacker of TRIBES) {
  const line: string[] = [attacker];
  for (const defender of TRIBES) {
    if (attacker === defender) {
      line.push("-");
      continue;
    }
    const atkUnits = UNIT_TEMPLATES.filter((u) => u.tribe === attacker).slice(0, 3);
    const defUnits = UNIT_TEMPLATES.filter((u) => u.tribe === defender).slice(0, 3);
    const player = atkUnits.map((u, idx) => toUnitState(u, `p${idx}`));
    const enemy = defUnits.map((u, idx) => toUnitState(u, `e${idx}`));
    const r = combat({ player, enemy, seed: 1 });
    const won = r.winner === "player" || r.winner === "draw";
    line.push(won ? "W" : "L");
    const cellA = totals.get(attacker)!;
    cellA.fights++;
    if (won) cellA.wins++;
    const cellD = totals.get(defender)!;
    cellD.fights++;
    if (!won) cellD.wins++;
  }
  rows.push(line.join(","));
}

console.log(rows.join("\n"));
console.log("");
for (const t of TRIBES) {
  const v = totals.get(t)!;
  console.log(`${t}: ${(v.wins / v.fights).toFixed(2)} win rate across ${v.fights} matchups`);
}
console.log("");
console.log("note: attacker is the player side and always strikes first; mirror matches are excluded.");
