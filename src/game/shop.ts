import { Rng } from "../sim/rng";
import { randomTemplate, toUnitState, findTemplate } from "./units";
import type { GameState } from "./state";
import type { UnitState } from "../sim/types";
import { onTriple, relicShopWidth, relicUpgradeCost } from "./relics";

const TIER_COST: Record<number, number> = { 2: 5, 3: 7, 4: 8, 5: 9, 6: 10 };
const BUY_COST = 3;
const REROLL_COST = 1;
const SHOP_SIZE = 4;

export const SHOP = { BUY_COST, REROLL_COST, SHOP_SIZE };

function nextId(state: GameState): string {
  state.instanceCounter++;
  return `u${state.instanceCounter}`;
}

export function generateShop(state: GameState, rng: Rng): void {
  if (state.frozen) return;
  const size = relicShopWidth(state, SHOP_SIZE);
  const out: UnitState[] = [];
  const maxTier = state.tier;
  for (let i = 0; i < size; i++) {
    const template = randomTemplate(rng, maxTier);
    out.push(toUnitState(template, nextId(state)));
  }
  state.shop = out;
  state.frozen = false;
}

export function buy(state: GameState, shopIndex: number): boolean {
  const unit = state.shop[shopIndex];
  if (!unit) return false;
  if (state.board.length >= 7) return false;
  const cost = state.freeBuysLeft > 0 ? 0 : BUY_COST;
  if (state.gold < cost) return false;
  state.gold -= cost;
  if (state.freeBuysLeft > 0) state.freeBuysLeft--;
  state.purchaseCount++;
  if (state.heroId === "ranger" && state.purchaseCount % 3 === 0) {
    state.freeBuysLeft++;
  }
  // move
  const template = findTemplate(unit.templateId)!;
  state.board.push({ ...unit, keywords: [...unit.keywords] });
  state.shop.splice(shopIndex, 1);
  // triple check
  tripleUpgrade(state, unit.templateId);
  applyHeroBuy(state, template);
  return true;
}

function applyHeroBuy(state: GameState, template: ReturnType<typeof findTemplate>): void {
  if (!template) return;
  if (state.heroId === "warrior" && (template.tribe === "goblins" || template.tribe === "dragons")) {
    for (const u of state.board) {
      if (findTemplate(u.templateId)?.tribe === template.tribe) {
        u.attack += 1;
      }
    }
  }
}

function tripleUpgrade(state: GameState, templateId: string): void {
  const copies = state.board.filter((u) => u.templateId === templateId);
  if (copies.length >= 3) {
    // remove 3, add golden
    let removed = 0;
    state.board = state.board.filter((u) => {
      if (u.templateId === templateId && removed < 3) {
        removed++;
        return false;
      }
      return true;
    });
    const t = findTemplate(templateId)!;
    state.board.push(toUnitState(t, `g${state.instanceCounter++}`, true));
    onTriple(state, t);
  }
}

export function sell(state: GameState, boardIndex: number): boolean {
  if (boardIndex < 0 || boardIndex >= state.board.length) return false;
  state.board.splice(boardIndex, 1);
  state.gold += 1;
  return true;
}

export function reroll(state: GameState, rng: Rng): boolean {
  if (state.frozen) return false;
  if (state.gold < REROLL_COST) return false;
  state.gold -= REROLL_COST;
  generateShop(state, rng);
  return true;
}

export function upgradeTier(state: GameState): boolean {
  if (state.tier >= 6) return false;
  const cost = relicUpgradeCost(state, TIER_COST[state.tier + 1]);
  if (state.gold < cost) return false;
  state.gold -= cost;
  state.tier++;
  return true;
}

export function toggleFreeze(state: GameState): void {
  state.frozen = !state.frozen;
}

export function Tiers() {
  return TIER_COST;
}