import {
  UnitState,
  CombatInput,
  CombatResult,
  CombatEvent,
  CombatFlags,
  Keyword,
  DeathrattleEffect,
  Side
} from "./types";

export function cloneUnit(u: UnitState): UnitState {
  return { ...u, keywords: [...u.keywords] };
}

export function cloneBoard(units: UnitState[]): UnitState[] {
  return units.map(cloneUnit);
}

export function hasKeyword(u: UnitState, k: Keyword): boolean {
  return u.keywords.includes(k);
}

function removeKeyword(u: UnitState, k: Keyword): void {
  u.keywords = u.keywords.filter((x) => x !== k);
}

function alive(units: UnitState[]): UnitState[] {
  return units.filter((u) => u.health > 0);
}

function findTarget(enemy: UnitState[]): UnitState {
  // Flumble-style positional targeting: the frontmost alive unit defends,
  // unless a taunt unit stands somewhere on the board.
  const poolAlive = alive(enemy);
  const taunts = poolAlive.filter((u) => hasKeyword(u, "taunt"));
  const pool = taunts.length ? taunts : poolAlive;
  if (pool.length === 0) throw new Error("no target");
  return pool[0];
}

/** Spawns a token for the owning side; returns its slot, or -1 if the board is full. */
function spawnToken(owner: UnitState[]): number {
  if (owner.length >= 7) return -1;
  owner.push({
    instanceId: `t${owner.length}`,
    templateId: "murloc_tadpole",
    attack: 1,
    health: 1,
    keywords: [],
    golden: false
  });
  return owner.length - 1;
}

// Structured log helper: every event gets a sequence number equal to its
// index in the log (first event is seq 0).
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type EventDraft = DistributiveOmit<CombatEvent, "seq">;

function emitLog(log: CombatEvent[], event: EventDraft): void {
  log.push({ ...event, seq: log.length } as CombatEvent);
}

function otherSide(side: Side): Side {
  return side === "player" ? "enemy" : "player";
}

function processDeath(
  dead: UnitState,
  ownerBoard: UnitState[],
  enemyBoard: UnitState[],
  ownerSideName: Side,
  events: string[],
  log: CombatEvent[],
  rotation: Rotation
): void {
  const effect: DeathrattleEffect | undefined = dead.deathrattle;
  const sourceSlot = ownerBoard.indexOf(dead);
  switch (effect) {
    case "buff_ally": {
      const affectedSlots: number[] = [];
      for (const i of [sourceSlot - 1, sourceSlot + 1]) {
        if (i < 0 || i >= ownerBoard.length) continue;
        if (ownerBoard[i].health <= 0) continue;
        ownerBoard[i].attack += 1;
        ownerBoard[i].health += 1;
        affectedSlots.push(i);
      }
      events.push(`${dead.templateId} buffs adjacent allies`);
      emitLog(log, { kind: "deathrattle", effect: "buff_ally", side: ownerSideName, sourceSlot, affectedSlots });
      break;
    }
    case "damage_adjacent": {
      const base = Math.max(0, Math.min(enemyBoard.length - 1, sourceSlot));
      const affectedSlots: number[] = [];
      for (const i of [base - 1, base, base + 1]) {
        if (i < 0 || i >= enemyBoard.length) continue;
        if (enemyBoard[i].health <= 0) continue;
        enemyBoard[i].health -= 1;
        affectedSlots.push(i);
        if (enemyBoard[i].health <= 0) {
          events.push(`${enemyBoard[i].templateId} dies from splash`);
          emitLog(log, {
            kind: "death",
            side: otherSide(ownerSideName),
            slot: i,
            templateId: enemyBoard[i].templateId
          });
        }
      }
      events.push(`${dead.templateId} splashes adjacent enemies`);
      emitLog(log, { kind: "deathrattle", effect: "damage_adjacent", side: ownerSideName, sourceSlot, affectedSlots });
      break;
    }
    case "summon": {
      const summonSlot = spawnToken(ownerBoard);
      events.push(`${dead.templateId} summons a token`);
      emitLog(log, {
        kind: "deathrattle",
        effect: "summon",
        side: ownerSideName,
        sourceSlot,
        affectedSlots: summonSlot >= 0 ? [summonSlot] : []
      });
      if (summonSlot >= 0) {
        // Summoned tokens join the rotation and attack in later cycles.
        rotation.push({ side: ownerSideName, unit: ownerBoard[summonSlot] });
      }
      break;
    }
    default:
      break;
  }
}

type Resurrections = { player: boolean; enemy: boolean };

// Fixed attack rotation: one entry per starting unit, alternating sides by
// slot (player 0, enemy 0, player 1, enemy 1, ...). Dead entries are skipped
// and the pointer wraps; summoned tokens are appended during the fight.
type Rotation = Array<{ side: Side; unit: UnitState }>;

function executeStrike(
  attacker: UnitState,
  defender: UnitState,
  attackerBoard: UnitState[],
  defenderBoard: UnitState[],
  defenderSideName: Side,
  flags: CombatFlags,
  resurrections: Resurrections,
  events: string[],
  log: CombatEvent[],
  rotation: Rotation
): void {
  const attackerSideName = otherSide(defenderSideName);
  const isPoison = hasKeyword(attacker, "poison");
  const hadDivine = hasKeyword(defender, "divineShield");
  const attackerSlot = attackerBoard.indexOf(attacker);
  const defenderSlot = defenderBoard.indexOf(defender);

  emitLog(log, {
    kind: "attack",
    attackerSide: attackerSideName,
    attackerSlot,
    defenderSide: defenderSideName,
    defenderSlot,
    damage: hadDivine || isPoison ? 0 : attacker.attack
  });

  if (hadDivine) {
    removeKeyword(defender, "divineShield");
    events.push(`${attacker.templateId} breaks divine shield on ${defender.templateId}`);
    emitLog(log, { kind: "shieldBreak", defenderSide: defenderSideName, defenderSlot });
    if (isPoison && flags.poisonOnShieldBreak) {
      defender.health = 0;
      events.push(`${attacker.templateId} poisons ${defender.templateId} through the shield`);
      emitLog(log, {
        kind: "poison",
        attackerSide: attackerSideName,
        attackerSlot,
        defenderSide: defenderSideName,
        defenderSlot,
        throughShield: true
      });
    }
  } else {
    if (attacker.attack > 0) {
      if (isPoison) {
        defender.health = 0;
        events.push(`${attacker.templateId} poisons ${defender.templateId}`);
        emitLog(log, {
          kind: "poison",
          attackerSide: attackerSideName,
          attackerSlot,
          defenderSide: defenderSideName,
          defenderSlot,
          throughShield: false
        });
      } else {
        defender.health -= attacker.attack;
        events.push(`${attacker.templateId} hits ${defender.templateId} for ${attacker.attack}`);
      }
    }
  }

  if (defender.health <= 0 && hasKeyword(defender, "reborn")) {
    removeKeyword(defender, "reborn");
    defender.health = 1;
    events.push(`${defender.templateId} reborns`);
    emitLog(log, { kind: "reborn", side: defenderSideName, slot: defenderSlot, templateId: defender.templateId });
    return;
  }

  if (defender.health > 0) return;

  if (flags.resurrectFirstDeath && !resurrections[defenderSideName]) {
    resurrections[defenderSideName] = true;
    defender.health = 1;
    removeKeyword(defender, "reborn");
    events.push(`${defender.templateId} is resurrected with 1 health`);
    emitLog(log, { kind: "resurrect", side: defenderSideName, slot: defenderSlot, templateId: defender.templateId });
    return;
  }

  emitLog(log, { kind: "death", side: defenderSideName, slot: defenderSlot, templateId: defender.templateId });
  processDeath(defender, defenderBoard, attackerBoard, defenderSideName, events, log, rotation);
  const index = defenderBoard.indexOf(defender);
  if (index >= 0) defenderBoard.splice(index, 1);
}

export function combat(input: CombatInput): CombatResult {
  const player = cloneBoard(input.player);
  const enemy = cloneBoard(input.enemy);
  const flags: CombatFlags = {
    resurrectFirstDeath: input.resurrectFirstDeath ?? false,
    poisonOnShieldBreak: input.poisonOnShieldBreak ?? false
  };
  const events: string[] = [];
  const log: CombatEvent[] = [];
  const resurrections: Resurrections = { player: false, enemy: false };

  // Fluffle-style rotation: fixed at battle start, alternating sides by slot.
  // Targeting is positional (leftmost alive, taunts override) so the engine
  // needs no randomness at all: same boards, same outcome, seed unused.
  const rotation: Rotation = [];
  const maxn = Math.max(player.length, enemy.length);
  for (let i = 0; i < maxn; i++) {
    if (i < player.length) rotation.push({ side: "player", unit: player[i] });
    if (i < enemy.length) rotation.push({ side: "enemy", unit: enemy[i] });
  }

  let ptr = 0;
  let rounds = 0;

  for (let step = 0; step < 100000; step++) {
    if (alive(player).length === 0 || alive(enemy).length === 0) break;
    if (rotation.length === 0) break;

    // Next living attacker in the fixed rotation, wrapping between cycles.
    let entry: { side: Side; unit: UnitState } | null = null;
    for (let k = 0; k < rotation.length; k++) {
      const cand = rotation[ptr % rotation.length];
      ptr++;
      if (cand.unit.health > 0) {
        entry = cand;
        break;
      }
    }
    if (!entry) break;

    const playerSide = entry.side === "player";
    const attackerBoard = playerSide ? player : enemy;
    const defenderBoard = playerSide ? enemy : player;
    const defenderName: Side = playerSide ? "enemy" : "player";

    const target = findTarget(defenderBoard);
    executeStrike(entry.unit, target, attackerBoard, defenderBoard, defenderName, flags, resurrections, events, log, rotation);
    rounds++;
  }

  const pAlive = alive(player);
  const eAlive = alive(enemy);
  const winner: CombatResult["winner"] =
    pAlive.length > 0 && eAlive.length === 0
      ? "player"
      : eAlive.length > 0 && pAlive.length === 0
        ? "enemy"
        : "draw";

  return {
    winner,
    playerSurvivors: pAlive,
    enemySurvivors: eAlive,
    rounds,
    events,
    log
  };
}
