import relicsJson from "../../data/relics.json";
import { Rng } from "../sim/rng";
import { UNIT_TEMPLATES, templatesForTier, toUnitState } from "./units";
import { pushLog } from "./state";
import type { GameState } from "./state";
import type { UnitTemplate } from "../sim/types";

export interface RelicDescription {
  id: string;
  name: string;
  effect: string;
}

const BY_ID = new Map<string, RelicDescription>();
for (const r of relicsJson as RelicDescription[]) BY_ID.set(r.id, r);

export function findRelic(id: string): RelicDescription | undefined {
  return BY_ID.get(id);
}

export function allRelics(): RelicDescription[] {
  return relicsJson as RelicDescription[];
}

export function relicLabel(id: string): string {
  const r = BY_ID.get(id);
  return r ? `${r.name}: ${r.effect}` : id;
}

// ---------------------------------------------------------------------------
// Relic hooks. The game layer (shop flow) calls these; relic ids stay here so
// the raw engine never names a relic. All randomness follows the seeded Rng
// pattern: run seed plus a per-action offset, so a seed replays identically.
// ---------------------------------------------------------------------------

const MAX_TIER = 6;

/** Gold cost of a tavern tier upgrade after relic discounts (minimum 1). */
export function relicUpgradeCost(state: GameState, base: number): number {
  let cost = base;
  if (state.relicIds.includes("golden_anvil")) cost -= 1;
  if (state.relicIds.includes("deep_forge")) cost -= 2;
  return Math.max(1, cost);
}

/** Number of units the shop offers after relic effects; the widest relic wins. */
export function relicShopWidth(state: GameState, base: number): number {
  let width = base;
  if (state.relicIds.includes("crystal_lens")) width = Math.max(width, 5);
  if (state.relicIds.includes("grand_bazaar")) width = Math.max(width, 6);
  return width;
}

/**
 * Fires once whenever a triple completes and merges into a golden unit.
 * Triple Crown: pushes a free offer one tier above the merged unit (capped at
 * tier 6) into the shop. The "free" rides the existing freeBuysLeft counter,
 * so taking the discovered offer costs no gold.
 * Barkeep's Tip: pays 5 gold per completed triple.
 */
export function onTriple(state: GameState, mergedTemplate: UnitTemplate): void {
  const relics = new Set(state.relicIds);
  if (relics.has("triple_crown")) {
    const tier = Math.min(mergedTemplate.tier + 1, MAX_TIER);
    const rng = new Rng(state.seed + 4099 + state.purchaseCount * 131);
    const pool = UNIT_TEMPLATES.filter((t) => t.tier === tier);
    const template = pool.length > 0 ? rng.pick(pool) : rng.pick(templatesForTier(tier));
    state.shop.push(toUnitState(template, `u${state.instanceCounter++}`));
    state.freeBuysLeft++;
    pushLog(state, `Triple Crown: discovered ${template.name} (tier ${tier}) for free`);
  }
  if (relics.has("barkeeps_tip")) {
    state.gold += 5;
    pushLog(state, "Barkeep's Tip: +5 gold for a completed triple");
  }
}