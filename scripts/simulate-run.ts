import { startRun, currentEncounter, resolveCurrentFight, advance } from "../src/game/run";
import { buy, upgradeTier } from "../src/game/shop";

const state = startRun("warrior", 12345);

function snapshot() {
  console.log(`\n== Encounter ${state.encounterIndex + 1}: ${currentEncounter(state)?.label} (${currentEncounter(state)?.kind}) ==`);
  console.log(`HP ${state.health}/${state.maxHealth} Gold ${state.gold} Tier ${state.tier} Board ${state.board.map((u) => u.templateId).join(", ") || "-"}`);
}

// buy a few
if (state.shop.length) buy(state, 0);
if (state.shop.length) buy(state, 0);
upgradeTier(state);
console.log("Initial shop bought 2, tier upgraded (if gold).");

for (let i = 0; i < state.encounters.length; i++) {
  snapshot();
  const enc = currentEncounter(state)!;
  if (enc.kind !== "rest") {
    const r = resolveCurrentFight(state);
    console.log(`Fight result: ${r.won ? "WIN" : "LOSS"} damage ${r.damageTaken} survivors ${r.survivors}`);
  } else {
    console.log("Resting...");
  }
  advance(state);
  if (state.status !== "playing") break;
}
console.log(`\nRun status: ${state.status}. Final HP ${state.health}, gold ${state.gold}.`);