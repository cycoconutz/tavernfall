import { Rng } from "../sim/rng";
import { UNIT_TEMPLATES, toUnitState } from "./units";
import type { GameState, Encounter } from "./state";
import { pushLog } from "./state";
import { generateShop } from "./shop";
import { combat, cloneBoard } from "../sim/combat";
import { boardForCombat, applyMagePostWin, combatFlagsForRelics } from "./modifiers";
import relicsJson from "../../data/relics.json";

function enemyCountMaxTier(kind: Encounter["kind"], tier: number): { count: number; maxTier: number } {
  if (kind === "common") return { count: 3, maxTier: Math.min(tier, 2) };
  if (kind === "elite") return { count: 4, maxTier: Math.min(Math.max(tier, 2), 4) };
  if (kind === "boss") return { count: 5, maxTier: 6 };
  return { count: 0, maxTier: 0 };
}

function makeEnemyBoard(rng: Rng, kind: Encounter["kind"], tier: number): ReturnType<typeof toUnitState>[] {
  const { count, maxTier } = enemyCountMaxTier(kind, tier);
  const pool = UNIT_TEMPLATES.filter((t) => t.tier <= Math.max(1, maxTier));
  const out: ReturnType<typeof toUnitState>[] = [];
  for (let i = 0; i < count; i++) {
    const t = rng.pick(pool);
    out.push(toUnitState(t, `e${i}`));
  }
  if (kind === "boss") {
    const boss = UNIT_TEMPLATES.find((t) => t.id === "leviathan")!;
    // ensure at least one boss-like anchor
    if (out.length) out[0] = toUnitState(boss, "boss0");
  }
  return out as never;
}

const ENCOUNTER_PLAN: { label: string; kind: Encounter["kind"] }[] = [
  { label: "Goblin Outpost", kind: "common" },
  { label: "Murloc Tide", kind: "common" },
  { label: "Dragon Roost", kind: "common" },
  { label: "Naga Ambush", kind: "elite" },
  { label: "Cavern Skirmish", kind: "common" },
  { label: "Elite Vanguard", kind: "elite" },
  { label: "Sanctum Rest", kind: "rest" },
  { label: "Final Descent", kind: "common" },
  { label: "The Leviathan", kind: "boss" }
];

export function startRun(heroId: string, seed: number): GameState {
  const rng = new Rng(seed + 997);
  const state: GameState = {
    heroId,
    health: 30,
    maxHealth: 30,
    gold: 10,
    tier: 1,
    shop: [],
    board: [],
    frozen: false,
    purchaseCount: 0,
    freeBuysLeft: 0,
    instanceCounter: 0,
    seed,
    encounterIndex: 0,
    encounters: [],
    relicIds: [],
    bossBeaten: false,
    pendingRelics: null,
    log: [],
    lastFight: [],
    lastFightLog: [],
    stats: { wins: 0, losses: 0 },
    status: "playing"
  };
  state.log.push(`Run started as ${heroId} (seed ${seed})`);

  for (let i = 0; i < ENCOUNTER_PLAN.length; i++) {
    const plan = ENCOUNTER_PLAN[i];
    const enemy = plan.kind === "rest" ? [] : makeEnemyBoard(rng, plan.kind, state.tier);
    state.encounters.push({
      id: `enc_${i}`,
      label: plan.label,
      kind: plan.kind,
      enemy: enemy as never
    });
  }

  generateShop(state, new Rng(seed + 13));
  return state;
}

export function currentEncounter(state: GameState): Encounter | undefined {
  return state.encounters[state.encounterIndex];
}

export function resolveCurrentFight(state: GameState): { won: boolean; damageTaken: number; survivors: number } {
  const enc = currentEncounter(state);
  if (!enc || enc.kind === "rest") return { won: true, damageTaken: 0, survivors: 0 };
  const rng = new Rng(state.seed + state.encounterIndex * 101);
  const playerBoard = boardForCombat(state);
  const result = combat({ player: playerBoard, enemy: cloneBoard(enc.enemy), seed: Math.floor(rng.next() * 1e9), ...combatFlagsForRelics(state.relicIds) });
  const won = result.winner === "player" || result.winner === "draw";
  pushLog(state, `${enc.label}: ${won ? "win" : "loss"} in ${result.rounds} attacks`);
  state.lastFight = result.events.slice(-70);
  state.lastFightLog = result.log;

  if (won) {
    state.stats.wins++;
    state.gold += enc.kind === "elite" ? 5 : enc.kind === "boss" ? 8 : 4;
    applyMagePostWin(state);
    if (enc.kind === "elite" || enc.kind === "boss") {
      state.pendingRelics = offerRelics(state);
    }
    if (enc.kind === "boss") {
      state.bossBeaten = true;
      state.status = "won";
    }
  } else {
    state.stats.losses++;
    const damage = Math.min(10, result.enemySurvivors.reduce((s, u) => s + u.attack, 0) || 3);
    state.health = Math.max(0, state.health - damage);
    pushLog(state, `Took ${damage} damage (${result.enemySurvivors.length} enemies survived)`);
    if (state.health <= 0) state.status = "lost";
  }
  return { won, damageTaken: won ? 0 : Math.min(10, result.enemySurvivors.reduce((s, u) => s + u.attack, 0) || 3), survivors: result.enemySurvivors.length };
}

const ALL_RELICS: string[] = (relicsJson as { id: string }[]).map((r) => r.id);

export function offerRelics(state: GameState, count = 3): string[] {
  const rng = new Rng(state.seed + state.encounterIndex * 331 + state.relicIds.length * 17);
  const pool = ALL_RELICS.filter((r) => !state.relicIds.includes(r));
  return rng.shuffle(pool).slice(0, count);
}

export function chooseRelic(state: GameState, relicId: string): boolean {
  if (!state.pendingRelics || !state.pendingRelics.includes(relicId)) return false;
  state.relicIds.push(relicId);
  state.pendingRelics = null;
  pushLog(state, `Relic acquired: ${relicId}`);
  return true;
}

export function advance(state: GameState): void {
  if (state.status !== "playing") return;
  const enc = currentEncounter(state);
  if (enc?.kind === "rest") {
    state.health = Math.min(state.maxHealth, state.health + 8);
  }
  state.encounterIndex++;
  // if boss just finished, status
  if (state.encounterIndex >= state.encounters.length) {
    state.status = state.bossBeaten && state.health > 0 ? "won" : "lost";
  } else {
    generateShop(state, new Rng(state.seed + state.encounterIndex * 17));
  }
  if (state.health <= 0) state.status = "lost";
}