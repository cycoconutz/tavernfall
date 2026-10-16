import { cloneBoard } from "../sim/combat";
import type { GameState } from "./state";
import type { UnitState, Keyword } from "../sim/types";
import { findTemplate } from "./units";

// Applies hero and relic static modifiers to a copy of the board for combat.
export function boardForCombat(state: GameState): UnitState[] {
  const board = cloneBoard(state.board);
  const relics = new Set(state.relicIds);

  for (const u of board) {
    const template = findTemplate(u.templateId);
    const tribe = template?.tribe;

    if (relics.has("war_drum")) u.attack += 1;
    if (relics.has("dragon_heart") && tribe === "dragons") u.attack += 2;
    if (relics.has("poisoned_barbs") && tribe === "goblins") addKeyword(u, "poison");
    if (relics.has("tide_surge") && tribe === "naga") addKeyword(u, "divineShield");
    if (relics.has("murloc_call") && tribe === "murlocs") addKeyword(u, "reborn");
  }

  return board;
}

function addKeyword(u: UnitState, k: Keyword): void {
  if (!u.keywords.includes(k)) u.keywords = [...u.keywords, k];
}

// Mage hero: after a win, buff the most common tribe on the board.
export function applyMagePostWin(state: GameState): void {
  if (state.heroId !== "mage" || state.board.length === 0) return;
  const counts = new Map<string, number>();
  for (const u of state.board) {
    const tribe = findTemplate(u.templateId)?.tribe;
    if (!tribe) continue;
    counts.set(tribe, (counts.get(tribe) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [tribe, n] of counts) {
    if (best === null || n > (counts.get(best) ?? 0)) best = tribe;
  }
  if (!best) return;
  for (const u of state.board) {
    if (findTemplate(u.templateId)?.tribe === best) {
      u.attack += 1;
      u.health += 1;
    }
  }
}
