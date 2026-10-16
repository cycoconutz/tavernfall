export type Tribe = "goblins" | "dragons" | "naga" | "murlocs";
export type Keyword = "taunt" | "divineShield" | "poison" | "reborn";
export type DeathrattleEffect = "summon" | "damage_adjacent" | "buff_ally";

export interface UnitTemplate {
  id: string;
  name: string;
  tribe: Tribe;
  tier: number;
  attack: number;
  health: number;
  keywords: Keyword[];
  // optional shorthand effects resolved by sim
  deathrattle?: "summon" | "damage_adjacent" | "buff_ally";
}

export interface UnitState {
  instanceId: string;
  templateId: string;
  attack: number;
  health: number;
  keywords: Keyword[];
  golden: boolean;
  deathrattle?: DeathrattleEffect;
}

export interface Board {
  units: UnitState[];
}

export interface CombatInput {
  player: UnitState[];
  enemy: UnitState[];
  seed: number;
  relics?: string[];
}

export interface CombatResult {
  winner: "player" | "enemy" | "draw";
  playerSurvivors: UnitState[];
  enemySurvivors: UnitState[];
  rounds: number;
  events: string[];
}