import { cloneBoard } from "../sim/combat";
import type { GameState } from "./state";
import type { UnitState, Keyword, CombatFlags } from "../sim/types";
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

  // Start-of-fight positional effects, applied after the relic pass so the
  // buffs land on the same combat copies. For each unit whose template has a
  // startEffect, every ally in a later slot gains its attack/health. Slot
  // order, so a bearer benefits from bearers earlier in the row, never from
  // itself, and multiple bearers stack. No-op for boards without them.
  for (let i = 0; i < board.length; i++) {
    const effect = findTemplate(board[i].templateId)?.startEffect;
    if (!effect || effect.type !== "buff_behind") continue;
    for (let j = i + 1; j < board.length; j++) {
      board[j].attack += effect.attack;
      board[j].health += effect.health;
    }
  }

  return board;
}

function addKeyword(u: UnitState, k: Keyword): void {
  if (!u.keywords.includes(k)) u.keywords = [...u.keywords, k];
}

/**
 * Maps combat-layer relic ids onto the generic engine capability flags of
 * CombatInput, so the raw sim (src/sim) never learns about specific relic
 * ids. Callers building a CombatInput spread these flags into it:
 *
 *   combat({ player, enemy, seed, ...combatFlagsForRelics(state.relicIds) })
 */
export function combatFlagsForRelics(relicIds: string[]): CombatFlags {
  return {
    // Phoenix Ash: first unit death each fight resurrects with 1 health.
    resurrectFirstDeath: relicIds.includes("phoenix_ash"),
    // Void Relic: poison triggers on divine shield break.
    poisonOnShieldBreak: relicIds.includes("void_relic")
  };
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
