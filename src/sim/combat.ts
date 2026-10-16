import { Rng } from "./rng";
import { UnitState, CombatInput, CombatResult, Keyword, DeathrattleEffect } from "./types";

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

function findTarget(enemy: UnitState[], rng: Rng): UnitState {
  const poolAlive = alive(enemy);
  const taunts = poolAlive.filter((u) => hasKeyword(u, "taunt"));
  const pool = taunts.length ? taunts : poolAlive;
  if (pool.length === 0) throw new Error("no target");
  return rng.pick(pool);
}

function spawnToken(owner: UnitState[]): void {
  if (owner.length >= 7) return;
  owner.push({
    instanceId: `t${owner.length}`,
    templateId: "murloc_tadpole",
    attack: 1,
    health: 1,
    keywords: [],
    golden: false
  });
}

function processDeath(
  dead: UnitState,
  ownerBoard: UnitState[],
  enemyBoard: UnitState[],
  events: string[]
): void {
  const effect: DeathrattleEffect | undefined = dead.deathrattle;
  switch (effect) {
    case "buff_ally": {
      const idx = ownerBoard.indexOf(dead);
      for (const i of [idx - 1, idx + 1]) {
        if (i < 0 || i >= ownerBoard.length) continue;
        if (ownerBoard[i].health <= 0) continue;
        ownerBoard[i].attack += 1;
        ownerBoard[i].health += 1;
      }
      events.push(`${dead.templateId} buffs adjacent allies`);
      break;
    }
    case "damage_adjacent": {
      const base = Math.max(0, Math.min(enemyBoard.length - 1, ownerBoard.indexOf(dead)));
      for (const i of [base - 1, base, base + 1]) {
        if (i < 0 || i >= enemyBoard.length) continue;
        if (enemyBoard[i].health <= 0) continue;
        enemyBoard[i].health -= 1;
        if (enemyBoard[i].health <= 0) events.push(`${enemyBoard[i].templateId} dies from splash`);
      }
      events.push(`${dead.templateId} splashes adjacent enemies`);
      break;
    }
    case "summon": {
      spawnToken(ownerBoard);
      events.push(`${dead.templateId} summons a token`);
      break;
    }
    default:
      break;
  }
}

type Resurrections = { player: boolean; enemy: boolean };

function executeStrike(
  attacker: UnitState,
  defender: UnitState,
  attackerSide: UnitState[],
  defenderSide: UnitState[],
  defenderSideName: "player" | "enemy",
  relics: string[],
  resurrections: Resurrections,
  events: string[]
): void {
  const isPoison = hasKeyword(attacker, "poison");
  const voidRelic = relics.includes("void_relic");
  const phoenix = relics.includes("phoenix_ash");
  const hadDivine = hasKeyword(defender, "divineShield");

  if (hadDivine) {
    removeKeyword(defender, "divineShield");
    events.push(`${attacker.templateId} breaks divine shield on ${defender.templateId}`);
    if (isPoison && voidRelic) {
      defender.health = 0;
      events.push(`${attacker.templateId} poisons ${defender.templateId} through the shield`);
    }
  } else {
    if (attacker.attack > 0) {
      if (isPoison) {
        defender.health = 0;
        events.push(`${attacker.templateId} poisons ${defender.templateId}`);
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
    return;
  }

  if (defender.health > 0) return;

  if (phoenix && !resurrections[defenderSideName]) {
    resurrections[defenderSideName] = true;
    defender.health = 1;
    removeKeyword(defender, "reborn");
    events.push(`${defender.templateId} is resurrected with 1 health`);
    return;
  }

  processDeath(defender, defenderSide, attackerSide, events);
  const index = defenderSide.indexOf(defender);
  if (index >= 0) defenderSide.splice(index, 1);
}

export function combat(input: CombatInput): CombatResult {
  const player = cloneBoard(input.player);
  const enemy = cloneBoard(input.enemy);
  const relics = input.relics ?? [];
  const rng = new Rng(input.seed);
  const events: string[] = [];
  const attacked = new Set<string>();
  const resurrections: Resurrections = { player: false, enemy: false };
  let activeSide: "player" | "enemy" = (player.length >= enemy.length) ? "player" : "enemy";
  const initialSide: "player" | "enemy" = activeSide;
  let rounds = 0;

  for (let step = 0; step < 100000; step++) {
    if (alive(player).length === 0 || alive(enemy).length === 0) break;

    const playerSide = activeSide === "player";
    const attackerBoard = playerSide ? player : enemy;
    const defenderBoard = playerSide ? enemy : player;
    const defenderName: "player" | "enemy" = playerSide ? "enemy" : "player";

    let unattacked = alive(attackerBoard).filter((u) => !attacked.has(u.instanceId));
    if (unattacked.length === 0) {
      const otherAlive = alive(defenderBoard).filter((u) => !attacked.has(u.instanceId));
      if (otherAlive.length > 0) {
        activeSide = playerSide ? "enemy" : "player";
        continue;
      }
      // Start a new cycle.
      attacked.clear();
      activeSide = initialSide;
      continue;
    }

    const attacker = rng.pick(unattacked);
    const target = findTarget(defenderBoard, rng);
    executeStrike(attacker, target, attackerBoard, defenderBoard, defenderName, relics, resurrections, events);
    attacked.add(attacker.instanceId);
    rounds++;
    activeSide = playerSide ? "enemy" : "player";
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
    events
  };
}