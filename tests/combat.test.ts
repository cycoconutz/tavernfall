import { describe, it, expect } from "vitest";
import { combat } from "../src/sim/combat";
import { combatFlagsForRelics } from "../src/game/modifiers";
import { UnitState } from "../src/sim/types";

function unit(
  instanceId: string,
  templateId: string,
  attack: number,
  health: number,
  keywords: string[] = [],
  deathrattle?: UnitState["deathrattle"]
): UnitState {
  return { instanceId, templateId, attack, health, keywords: keywords as UnitState["keywords"], golden: false, deathrattle };
}

describe("combat", () => {
  it("is deterministic for the same seed", () => {
    const p = [unit("a", "a", 3, 4)];
    const e = [unit("b", "b", 2, 5)];
    const r1 = combat({ player: p, enemy: e, seed: 42 });
    const r2 = combat({ player: [unit("a", "a", 3, 4)], enemy: [unit("b", "b", 2, 5)], seed: 42 });
    expect(r1.winner).toBe(r2.winner);
    expect(r1.rounds).toBe(r2.rounds);
  });

  it("taunt forces targeting", () => {
    const p = [unit("a", "a", 10, 1)];
    const e = [unit("t", "t", 1, 10, ["taunt"]), unit("x", "x", 1, 1)];
    const r = combat({ player: p, enemy: e, seed: 1 });
    // x should survive because taunt absorbs the hit
    expect(r.enemySurvivors.some((u) => u.templateId === "x")).toBe(true);
  });

  it("divine shield absorbs one hit", () => {
    const p = [unit("a", "a", 5, 10)];
    const e = [unit("b", "b", 1, 10, ["divineShield"])];
    const r = combat({ player: p, enemy: e, seed: 2 });
    expect(r.events.some((e) => e.includes("breaks divine shield"))).toBe(true);
  });

  it("poison kills on hit", () => {
    const p = [unit("a", "a", 1, 10, ["poison"])];
    const e = [unit("b", "b", 1, 10)];
    const r = combat({ player: p, enemy: e, seed: 3 });
    expect(r.playerSurvivors.length).toBe(1);
    expect(r.enemySurvivors.length).toBe(0);
  });

  it("structured log: fixed seed reproduces the pre-change fight with an exact log prefix", () => {
    const p = [
      unit("p0", "dragon_whelp", 3, 2),
      unit("p1", "shielded_squire", 2, 4, ["divineShield"]),
      unit("p2", "summon_brood", 1, 5, [], "summon")
    ];
    const e = [
      unit("e0", "brute", 4, 6, ["taunt"], "buff_ally"),
      unit("e1", "toad", 2, 3, [], "damage_adjacent"),
      unit("e2", "phoenix_hatch", 2, 2, ["reborn"])
    ];
    const r = combat({ player: p, enemy: e, seed: 6 });

    // Winner, rounds and narrative log recorded from this exact seed before
    // the structured log existed: behavior is byte-identical.
    expect(r.winner).toBe("enemy");
    expect(r.rounds).toBe(10);
    expect(r.events).toEqual([
      "shielded_squire hits brute for 2",
      "toad hits dragon_whelp for 2",
      "summon_brood hits brute for 1",
      "brute hits summon_brood for 4",
      "phoenix_hatch breaks divine shield on shielded_squire",
      "summon_brood hits brute for 1",
      "brute hits shielded_squire for 4",
      "toad hits summon_brood for 2",
      "summon_brood summons a token",
      "murloc_tadpole hits brute for 1",
      "phoenix_hatch hits murloc_tadpole for 2"
    ]);

    // Exact structured log prefix: kinds, slots, damage and seq.
    expect(r.log.slice(0, 6)).toEqual([
      { kind: "attack", seq: 0, attackerSide: "player", attackerSlot: 1, defenderSide: "enemy", defenderSlot: 0, damage: 2 },
      { kind: "attack", seq: 1, attackerSide: "enemy", attackerSlot: 1, defenderSide: "player", defenderSlot: 0, damage: 2 },
      { kind: "death", seq: 2, side: "player", slot: 0, templateId: "dragon_whelp" },
      // summon_brood moved to slot 1 after dragon_whelp was spliced.
      { kind: "attack", seq: 3, attackerSide: "player", attackerSlot: 1, defenderSide: "enemy", defenderSlot: 0, damage: 1 },
      { kind: "attack", seq: 4, attackerSide: "enemy", attackerSlot: 0, defenderSide: "player", defenderSlot: 1, damage: 4 },
      { kind: "attack", seq: 5, attackerSide: "enemy", attackerSlot: 2, defenderSide: "player", defenderSlot: 0, damage: 0 }
    ]);

    // Later events of the same fight: shield break, deaths, summon deathrattle.
    expect(r.log[6]).toEqual({ kind: "shieldBreak", seq: 6, defenderSide: "player", defenderSlot: 0 });
    expect(r.log.filter((ev) => ev.kind === "death")).toHaveLength(4);
    expect(r.log.filter((ev) => ev.kind === "deathrattle")).toEqual([
      { kind: "deathrattle", seq: 12, effect: "summon", side: "player", sourceSlot: 0, affectedSlots: [1] }
    ]);

    // Invariants: seq is dense and ordered, and every strike emits exactly
    // one attack event.
    r.log.forEach((ev, i) => expect(ev.seq).toBe(i));
    expect(r.log.filter((ev) => ev.kind === "attack")).toHaveLength(r.rounds);
  });

  it("resurrectFirstDeath flag: first death on each side returns with 1 health", () => {
    const r = combat({
      player: [unit("a", "bruiser", 5, 5)],
      enemy: [unit("b", "squishy", 1, 1)],
      seed: 11,
      resurrectFirstDeath: true
    });
    // Winner, rounds and narrative log recorded from this exact seed when
    // the effect was driven by the phoenix_ash relic before flags existed.
    expect(r.winner).toBe("player");
    expect(r.rounds).toBe(3);
    expect(r.events).toEqual([
      "bruiser hits squishy for 5",
      "squishy is resurrected with 1 health",
      "squishy hits bruiser for 1",
      "bruiser hits squishy for 5"
    ]);
    expect(r.log).toEqual([
      { kind: "attack", seq: 0, attackerSide: "player", attackerSlot: 0, defenderSide: "enemy", defenderSlot: 0, damage: 5 },
      { kind: "resurrect", seq: 1, side: "enemy", slot: 0, templateId: "squishy" },
      { kind: "attack", seq: 2, attackerSide: "enemy", attackerSlot: 0, defenderSide: "player", defenderSlot: 0, damage: 1 },
      { kind: "attack", seq: 3, attackerSide: "player", attackerSlot: 0, defenderSide: "enemy", defenderSlot: 0, damage: 5 },
      // Second death stays dead: the resurrection was already spent.
      { kind: "death", seq: 4, side: "enemy", slot: 0, templateId: "squishy" }
    ]);

    // Player-side deaths resurrect too; once per side.
    const r2 = combat({
      player: [unit("a", "minion", 1, 1)],
      enemy: [unit("b", "giant", 9, 9)],
      seed: 12,
      resurrectFirstDeath: true
    });
    expect(r2.winner).toBe("enemy");
    expect(r2.rounds).toBe(4);
    expect(r2.log).toEqual([
      { kind: "attack", seq: 0, attackerSide: "player", attackerSlot: 0, defenderSide: "enemy", defenderSlot: 0, damage: 1 },
      { kind: "attack", seq: 1, attackerSide: "enemy", attackerSlot: 0, defenderSide: "player", defenderSlot: 0, damage: 9 },
      { kind: "resurrect", seq: 2, side: "player", slot: 0, templateId: "minion" },
      { kind: "attack", seq: 3, attackerSide: "player", attackerSlot: 0, defenderSide: "enemy", defenderSlot: 0, damage: 1 },
      { kind: "attack", seq: 4, attackerSide: "enemy", attackerSlot: 0, defenderSide: "player", defenderSlot: 0, damage: 9 },
      { kind: "death", seq: 5, side: "player", slot: 0, templateId: "minion" }
    ]);

    // Without the flag the first death is final.
    const plain = combat({ player: [unit("a", "bruiser", 5, 5)], enemy: [unit("b", "squishy", 1, 1)], seed: 11 });
    expect(plain.winner).toBe("player");
    expect(plain.rounds).toBe(1);
    expect(plain.log).toEqual([
      { kind: "attack", seq: 0, attackerSide: "player", attackerSlot: 0, defenderSide: "enemy", defenderSlot: 0, damage: 5 },
      { kind: "death", seq: 1, side: "enemy", slot: 0, templateId: "squishy" }
    ]);
  });

  it("poisonOnShieldBreak flag: poison triggers on divine shield break", () => {
    const boards = {
      player: [unit("a", "assassin", 1, 5, ["poison"])],
      enemy: [unit("b", "paladin", 3, 3, ["divineShield"])]
    };
    const r = combat({ ...boards, seed: 13, poisonOnShieldBreak: true });
    // Winner, rounds and narrative log recorded from this exact seed when
    // the effect was driven by the void_relic relic before flags existed.
    expect(r.winner).toBe("player");
    expect(r.rounds).toBe(1);
    expect(r.events).toEqual([
      "assassin breaks divine shield on paladin",
      "assassin poisons paladin through the shield"
    ]);
    expect(r.log).toEqual([
      { kind: "attack", seq: 0, attackerSide: "player", attackerSlot: 0, defenderSide: "enemy", defenderSlot: 0, damage: 0 },
      { kind: "shieldBreak", seq: 1, defenderSide: "enemy", defenderSlot: 0 },
      { kind: "poison", seq: 2, attackerSide: "player", attackerSlot: 0, defenderSide: "enemy", defenderSlot: 0, throughShield: true },
      { kind: "death", seq: 3, side: "enemy", slot: 0, templateId: "paladin" }
    ]);

    // Without the flag the shield blocks the poison and the fight runs longer.
    const plain = combat({ ...boards, seed: 13 });
    expect(plain.winner).toBe("player");
    expect(plain.rounds).toBe(3);
    expect(plain.log.filter((ev) => ev.kind === "poison")).toEqual([
      { kind: "poison", seq: 4, attackerSide: "player", attackerSlot: 0, defenderSide: "enemy", defenderSlot: 0, throughShield: false }
    ]);
  });
});

describe("combatFlagsForRelics", () => {
  it("maps relic ids onto generic engine flags", () => {
    expect(combatFlagsForRelics([])).toEqual({ resurrectFirstDeath: false, poisonOnShieldBreak: false });
    expect(combatFlagsForRelics(["war_drum"])).toEqual({ resurrectFirstDeath: false, poisonOnShieldBreak: false });
    expect(combatFlagsForRelics(["phoenix_ash"])).toEqual({ resurrectFirstDeath: true, poisonOnShieldBreak: false });
    expect(combatFlagsForRelics(["void_relic"])).toEqual({ resurrectFirstDeath: false, poisonOnShieldBreak: true });
    expect(combatFlagsForRelics(["war_drum", "phoenix_ash", "void_relic"])).toEqual({
      resurrectFirstDeath: true,
      poisonOnShieldBreak: true
    });
  });

  it("flags reproduce the fight the legacy relic ids produced", () => {
    // Phoenix Ash through the real mapping: identical to the outcome
    // recorded from the pre-flag engine (relics: ["phoenix_ash"], seed 11).
    const phoenix = combat({
      player: [unit("a", "bruiser", 5, 5)],
      enemy: [unit("b", "squishy", 1, 1)],
      seed: 11,
      ...combatFlagsForRelics(["phoenix_ash"])
    });
    expect(phoenix.winner).toBe("player");
    expect(phoenix.rounds).toBe(3);
    expect(phoenix.events).toContain("squishy is resurrected with 1 health");

    // Void Relic through the real mapping (relics: ["void_relic"], seed 13).
    const voided = combat({
      player: [unit("a", "assassin", 1, 5, ["poison"])],
      enemy: [unit("b", "paladin", 3, 3, ["divineShield"])],
      seed: 13,
      ...combatFlagsForRelics(["void_relic"])
    });
    expect(voided.winner).toBe("player");
    expect(voided.rounds).toBe(1);
    expect(voided.events).toEqual([
      "assassin breaks divine shield on paladin",
      "assassin poisons paladin through the shield"
    ]);
  });
});
