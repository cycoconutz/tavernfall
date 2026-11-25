import { UNIT_TEMPLATES, toUnitState } from "../src/game/units";
import { combat } from "../src/sim/combat";

// Positional combat makes board ORDER part of comp strength, so the report
// fights curated showcase comps (front to back) rather than file-order slices.
// Each pair fights in BOTH directions so the player-side first-strike bias
// cancels out of the totals. Draws score half for each side.
const SHOWCASE: Record<string, string[]> = {
  goblins: ["goblin_flagbearer", "goblin_king", "goblin_juggernaut"],
  dragons: ["dragonspeaker", "dragonfire", "dragon_queen"],
  naga: ["naga_hydra", "naga_tideshield", "leviathan"],
  murlocs: ["murloc_tide_priest", "murloc_venomfin", "old_one"]
};

const TRIBES = Object.keys(SHOWCASE);

function comp(tribe: string) {
  return SHOWCASE[tribe]
    .map((id) => UNIT_TEMPLATES.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u, idx) => toUnitState(u, `p${idx}`));
}

function mark(r: { winner: string }, attacker: string): "W" | "D" | "L" {
  if (r.winner === "draw") return "D";
  return r.winner === attacker ? "W" : "L";
}

type Cell = { w: number; d: number; l: number };
const tally = new Map<string, Cell>();
for (const t of TRIBES) tally.set(t, { w: 0, d: 0, l: 0 });

const rows: string[] = ["attacker \\ defender," + TRIBES.join(",")];
for (const atk of TRIBES) {
  const line: string[] = [atk];
  for (const def of TRIBES) {
    if (atk === def) {
      line.push("-");
      continue;
    }
    const r = combat({ player: comp(atk), enemy: comp(def), seed: 1 });
    line.push(mark(r, "player"));
    const ca = tally.get(atk)!;
    const cd = tally.get(def)!;
    if (mark(r, "player") === "W") { ca.w++; cd.l++; }
    else if (mark(r, "player") === "D") { ca.d++; cd.d++; }
    else { ca.l++; cd.w++; }
  }
  rows.push(line.join(","));
}

console.log(rows.join("\n"));
console.log("");
for (const t of TRIBES) {
  const v = tally.get(t)!;
  const fights = v.w + v.d + v.l;
  const score = (v.w + 0.5 * v.d) / fights;
  console.log(
    `${t}: score ${score.toFixed(2)}  (${v.w}W ${v.d}D ${v.l}L over ${fights} fights)`
  );
}
console.log("");
console.log("gates: every tribe score >= 0.25, no tribe score > 0.85, murlocs >= 1 win");
