import type { UnitState } from "../sim/types";

export interface Encounter {
  id: string;
  label: string;
  kind: "common" | "elite" | "rest" | "boss";
  enemy: UnitState[];
}

export interface GameState {
  heroId: string;
  health: number;
  maxHealth: number;
  gold: number;
  tier: number;
  shop: UnitState[];
  board: UnitState[];
  frozen: boolean;
  purchaseCount: number; // for ranger free every 3
  freeBuysLeft: number;
  instanceCounter: number;
  seed: number;
  encounterIndex: number;
  encounters: Encounter[];
  relicIds: string[];
  pendingRelics: string[] | null;
  log: string[];
  bossBeaten: boolean;
  lastFight: string[];
  stats: { wins: number; losses: number };
  status: "playing" | "won" | "lost";
}

export function pushLog(state: GameState, line: string): void {
  state.log.push(line);
  if (state.log.length > 200) state.log.shift();
}