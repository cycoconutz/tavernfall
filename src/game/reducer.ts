import type { GameState } from "./state";
import { pushLog } from "./state";
import type { Action } from "./actions";
import { startRun, resolveCurrentFight, advance, chooseRelic } from "./run";
import { buy, sell, reroll, upgradeTier, toggleFreeze } from "./shop";
import { Rng } from "../sim/rng";

export function reduce(state: GameState | null, action: Action): GameState | null {
  switch (action.type) {
    case "START":
      return startRun(action.heroId, action.seed);
    case "LOAD":
      return JSON.parse(action.state) as GameState;
    case "CHOOSE_RELIC": {
      if (!state) return state;
      const next = structuredClone(state);
      chooseRelic(next, action.relicId);
      return next;
    }
  }

  if (!state) return state;
  const next = structuredClone(state) as GameState;

  switch (action.type) {
    case "BUY": {
      const unit = next.shop[action.index];
      const ok = buy(next, action.index);
      if (ok) pushLog(next, `Bought ${unit?.templateId ?? "?"}`);
      else pushLog(next, "Buy failed");
      return next;
    }
    case "SELL": {
      const unit = next.board[action.index];
      const ok = sell(next, action.index);
      if (ok) pushLog(next, `Sold ${unit?.templateId ?? "?"}`);
      return next;
    }
    case "MOVE_BOARD": {
      if (action.from < 0 || action.to < 0 || action.from >= next.board.length || action.to >= next.board.length) return next;
      const [item] = next.board.splice(action.from, 1);
      next.board.splice(action.to, 0, item);
      pushLog(next, `Reordered ${item.templateId}`);
      return next;
    }
    case "REROLL": {
      const ok = reroll(next, new Rng(next.seed + next.encounterIndex * 7 + next.board.length));
      pushLog(next, ok ? "Rerolled shop" : "Reroll failed");
      return next;
    }
    case "UPGRADE": {
      const ok = upgradeTier(next);
      pushLog(next, ok ? `Tavern tier ${next.tier}` : "Upgrade failed");
      return next;
    }
    case "FREEZE":
      toggleFreeze(next);
      return next;
    case "FIGHT":
      resolveCurrentFight(next);
      return next;
    case "ADVANCE":
      advance(next);
      return next;
    default:
      return next;
  }
}