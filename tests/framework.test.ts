import { describe, it, expect } from "vitest";
import { reduce } from "../src/game/reducer";
import type { GameState } from "../src/game/state";

function fresh(): GameState {
  const s = reduce(null, { type: "START", heroId: "warrior", seed: 777 });
  return s as GameState;
}

describe("framework", () => {
  it("starts a run with encounters and a shop", () => {
    const s = fresh();
    expect(s.status).toBe("playing");
    expect(s.encounters.length).toBe(9);
    expect(s.shop.length).toBeGreaterThan(0);
    expect(s.health).toBe(30);
  });

  it("buying spends gold and adds to the board", () => {
    const s = fresh();
    const gold = s.gold;
    const next = reduce(s, { type: "BUY", index: 0 }) as GameState;
    expect(next.board.length).toBe(1);
    expect(next.gold).toBe(gold - 3);
  });

  it("is immutable: original state is unchanged", () => {
    const s = fresh();
    const before = JSON.stringify(s);
    reduce(s, { type: "BUY", index: 0 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it("serialises cleanly (no Set)", () => {
    const s = fresh();
    const next = reduce(s, { type: "BUY", index: 0 }) as GameState;
    expect(next.board.length).toBe(1);
    const round = JSON.parse(JSON.stringify(next)) as GameState;
    expect(round.board[0].keywords).toBeInstanceOf(Array);
  });

  it("fights and logs the result", () => {
    const s = fresh();
    const next = reduce(s, { type: "FIGHT" }) as GameState;
    expect(next.log.length).toBeGreaterThan(s.log.length);
    expect(next.stats.wins + next.stats.losses).toBe(1);
  });

  it("offers and accepts relics after an elite win", () => {
    let s = fresh();
    // jump to the elite encounter with an overwhelming board so the win is guaranteed
    s.encounterIndex = 3;
    s.board = s.board.length
      ? s.board
      : [{ instanceId: "x1", templateId: "leviathan", attack: 99, health: 99, keywords: [], golden: false }];
    s = reduce(s, { type: "FIGHT" }) as GameState;
    expect(s.pendingRelics?.length ?? 0).toBeGreaterThan(0);
    if (s.pendingRelics && s.pendingRelics.length) {
      const picked = s.pendingRelics[0];
      const after = reduce(s, { type: "CHOOSE_RELIC", relicId: picked }) as GameState;
      expect(after.relicIds).toContain(picked);
      expect(after.pendingRelics).toBeNull();
    }
  });
});