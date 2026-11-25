import { describe, it, expect, afterAll } from "vitest";
import { boardForCombat } from "../src/game/modifiers";
import { cloneBoard } from "../src/sim/combat";
import { UNIT_TEMPLATES } from "../src/game/units";
import type { GameState } from "../src/game/state";
import type { UnitState, UnitTemplate } from "../src/sim/types";

// No shipped unit carries a startEffect yet (the data designer authors
// those in data/units.json), so the tests register an in-memory template
// and remove it afterwards. Vitest isolates each test file's module
// registry, so this never reaches other suites.
const BEARER: UnitTemplate = {
  id: "test_banner_bearer",
  name: "Banner Bearer",
  tribe: "goblins",
  tier: 1,
  attack: 1,
  health: 1,
  keywords: [],
  startEffect: { type: "buff_behind", attack: 2, health: 3 }
};
UNIT_TEMPLATES.push(BEARER);
afterAll(() => {
  const i = UNIT_TEMPLATES.indexOf(BEARER);
  if (i >= 0) UNIT_TEMPLATES.splice(i, 1);
});

function unit(instanceId: string, templateId: string, attack: number, health: number): UnitState {
  return { instanceId, templateId, attack, health, keywords: [], golden: false };
}

function makeState(board: UnitState[], relicIds: string[] = []): GameState {
  return {
    heroId: "ranger",
    health: 30,
    maxHealth: 30,
    gold: 10,
    tier: 1,
    shop: [],
    board,
    frozen: false,
    purchaseCount: 0,
    freeBuysLeft: 0,
    instanceCounter: board.length,
    seed: 1,
    encounterIndex: 0,
    encounters: [],
    relicIds,
    pendingRelics: null,
    log: [],
    bossBeaten: false,
    lastFight: [],
    lastFightLog: [],
    stats: { wins: 0, losses: 0 },
    status: "playing"
  };
}

describe("boardForCombat startEffect: buff_behind", () => {
  it("buffs allies in later slots only (bearer at slot 0 of 3)", () => {
    const state = makeState([
      unit("b0", BEARER.id, 1, 1),
      unit("a1", "goblin_scamp", 1, 2),
      unit("a2", "whelp", 1, 3)
    ]);
    const board = boardForCombat(state);

    // Bearer never buffs itself.
    expect(board[0]).toMatchObject({ attack: 1, health: 1 });
    // Slots 1 and 2 both gain the full +2/+3.
    expect(board[1]).toMatchObject({ attack: 3, health: 5 });
    expect(board[2]).toMatchObject({ attack: 3, health: 6 });
  });

  it("a bearer mid-row buffs only the units behind it, not the ones ahead", () => {
    const state = makeState([
      unit("a0", "goblin_scamp", 1, 2),
      unit("b1", BEARER.id, 1, 1),
      unit("a2", "whelp", 1, 3)
    ]);
    const board = boardForCombat(state);

    // The unit ahead is untouched, as is the bearer itself.
    expect(board[0]).toMatchObject({ attack: 1, health: 2 });
    expect(board[1]).toMatchObject({ attack: 1, health: 1 });
    // Only the unit behind gains.
    expect(board[2]).toMatchObject({ attack: 3, health: 6 });
  });

  it("two bearers stack", () => {
    const state = makeState([
      unit("b0", BEARER.id, 1, 1),
      unit("b1", BEARER.id, 1, 1),
      unit("a2", "goblin_scamp", 1, 2)
    ]);
    const board = boardForCombat(state);

    // The first bearer has nobody ahead of it to benefit from.
    expect(board[0]).toMatchObject({ attack: 1, health: 1 });
    // The second bearer gains from the first, and the rear ally gains
    // from both: +4/+6 total.
    expect(board[1]).toMatchObject({ attack: 3, health: 4 });
    expect(board[2]).toMatchObject({ attack: 5, health: 8 });
  });

  it("leaves boards without startEffect units unchanged", () => {
    const state = makeState([
      unit("a0", "goblin_scamp", 1, 2),
      unit("a1", "whelp", 2, 3),
      unit("a2", "goblin_skirmisher", 2, 1)
    ]);
    // Deep-equal to a fresh clone of the pre-effect board: the relic pass
    // and the startEffect pass are both no-ops here.
    expect(boardForCombat(state)).toEqual(cloneBoard(state.board));
  });

  it("buffs only the combat copies; the GameState board is untouched", () => {
    const state = makeState([
      unit("b0", BEARER.id, 1, 1),
      unit("a1", "goblin_scamp", 1, 2),
      unit("a2", "whelp", 1, 3)
    ]);
    const before = JSON.parse(JSON.stringify(state.board));

    const board = boardForCombat(state);

    // Run state is byte-identical to what went in.
    expect(state.board).toEqual(before);
    // The returned board is a separate copy, not the run-state array or
    // its unit objects.
    expect(board).not.toBe(state.board);
    expect(board[0]).not.toBe(state.board[0]);
    expect(board[1]).toMatchObject({ attack: 3, health: 5 });
  });

  it("composes with the relic pass on the same combat copies", () => {
    const state = makeState(
      [
        unit("b0", BEARER.id, 1, 1),
        unit("a1", "goblin_scamp", 1, 2)
      ],
      ["war_drum"]
    );
    const board = boardForCombat(state);

    // War Drum gives everyone +1 attack; the bearer also grants the rear
    // ally its +2/+3 on top.
    expect(board[0]).toMatchObject({ attack: 2, health: 1 });
    expect(board[1]).toMatchObject({ attack: 4, health: 5 });
  });
});
