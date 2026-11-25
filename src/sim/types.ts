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
  // start-of-fight positional effect, resolved on the combat copy by
  // boardForCombat: buff_behind gives every ally in a later slot
  // +attack/+health (multiple bearers stack, applied in slot order).
  startEffect?: { type: "buff_behind"; attack: number; health: number };
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

export type Side = "player" | "enemy";

/**
 * Structured combat log. Every event carries `seq`, which numbers events in
 * the order they occur and always equals the event's index in
 * `CombatResult.log` (first event is seq 0).
 *
 * Slots are indexes into that side's board array at the moment of the event
 * (dead defenders are spliced after their death event, so slots can shift
 * between events).
 */
export type CombatEvent =
  | {
      kind: "attack";
      seq: number;
      attackerSide: Side;
      attackerSlot: number;
      defenderSide: Side;
      defenderSlot: number;
      /** Health the strike subtracted from the defender (0 for shield breaks and poison strikes). */
      damage: number;
    }
  | {
      kind: "shieldBreak";
      seq: number;
      defenderSide: Side;
      defenderSlot: number;
    }
  | {
      kind: "poison";
      seq: number;
      attackerSide: Side;
      attackerSlot: number;
      defenderSide: Side;
      defenderSlot: number;
      throughShield: boolean;
    }
  | {
      kind: "death";
      seq: number;
      side: Side;
      slot: number;
      templateId: string;
    }
  | {
      kind: "deathrattle";
      seq: number;
      effect: DeathrattleEffect;
      /** Side of the unit that died. */
      side: Side;
      sourceSlot: number;
      /** Slots actually affected by the effect at the moment it resolved. */
      affectedSlots: number[];
    }
  | {
      kind: "reborn";
      seq: number;
      side: Side;
      slot: number;
      templateId: string;
    }
  | {
      kind: "resurrect";
      seq: number;
      side: Side;
      slot: number;
      templateId: string;
    };

/**
 * Generic combat-layer capability flags. The game layer decides which of its
 * relics map onto these (see combatFlagsForRelics in src/game/modifiers.ts);
 * the raw engine knows nothing about relic ids.
 */
export interface CombatFlags {
  /** The first unit death on each side returns with 1 health instead of dying. */
  resurrectFirstDeath: boolean;
  /** A poison attacker's strike is lethal even through divine shield. */
  poisonOnShieldBreak: boolean;
}

export interface CombatInput {
  player: UnitState[];
  enemy: UnitState[];
  seed: number;
  resurrectFirstDeath?: boolean;
  poisonOnShieldBreak?: boolean;
}

export interface CombatResult {
  winner: "player" | "enemy" | "draw";
  playerSurvivors: UnitState[];
  enemySurvivors: UnitState[];
  rounds: number;
  /** Narrative log, kept for compatibility. */
  events: string[];
  /** Structured log of the same fight; one entry per thing that happened. */
  log: CombatEvent[];
}
