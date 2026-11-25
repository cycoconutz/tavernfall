import { describe, it, expect } from "vitest";
import { reduce } from "../src/game/reducer";
import { findTemplate, toUnitState } from "../src/game/units";
import type { GameState } from "../src/game/state";

function fresh(): GameState {
  const s = reduce(null, { type: "START", heroId: "warrior", seed: 777 });
  return s as GameState;
}

function mk(templateId: string, instanceId: string) {
  return toUnitState(findTemplate(templateId)!, instanceId);
}

function withTripleSetup(relicIds: string[], templateId: string): GameState {
  const s = fresh();
  s.relicIds = relicIds;
  s.board = [mk(templateId, "a1"), mk(templateId, "a2")];
  s.shop = [mk(templateId, "a3")];
  return s;
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

describe("relic hooks", () => {
  it("golden anvil makes upgrades cost 1 less", () => {
    const plain = reduce(fresh(), { type: "UPGRADE" }) as GameState;
    expect(plain.tier).toBe(2);
    expect(plain.gold).toBe(5); // 10 - 5, no relic

    const s = fresh();
    s.relicIds = ["golden_anvil"];
    const next = reduce(s, { type: "UPGRADE" }) as GameState;
    expect(next.tier).toBe(2);
    expect(next.gold).toBe(6); // 10 - 4
  });

  it("deep forge makes upgrades cost 2 less and stacks with golden anvil", () => {
    const s = fresh();
    s.relicIds = ["deep_forge"];
    const next = reduce(s, { type: "UPGRADE" }) as GameState;
    expect(next.tier).toBe(2);
    expect(next.gold).toBe(7); // 10 - 3

    const stacked = fresh();
    stacked.relicIds = ["golden_anvil", "deep_forge"];
    const stackedNext = reduce(stacked, { type: "UPGRADE" }) as GameState;
    expect(stackedNext.gold).toBe(8); // 10 - 2
  });

  it("discounted upgrades still respect the gold check", () => {
    const s = fresh();
    s.relicIds = ["deep_forge"];
    s.gold = 2;
    const tooPoor = reduce(s, { type: "UPGRADE" }) as GameState;
    expect(tooPoor.tier).toBe(1);
    expect(tooPoor.gold).toBe(2);
    expect(tooPoor.log[tooPoor.log.length - 1]).toBe("Upgrade failed");

    s.gold = 3;
    const just = reduce(s, { type: "UPGRADE" }) as GameState;
    expect(just.tier).toBe(2);
    expect(just.gold).toBe(0);
  });

  it("crystal lens widens the shop to 5 and grand bazaar to 6", () => {
    expect(fresh().shop).toHaveLength(4); // base width, also at run start

    const lens = fresh();
    lens.relicIds = ["crystal_lens"];
    expect((reduce(lens, { type: "REROLL" }) as GameState).shop).toHaveLength(5);

    const bazaar = fresh();
    bazaar.relicIds = ["grand_bazaar"];
    expect((reduce(bazaar, { type: "REROLL" }) as GameState).shop).toHaveLength(6);

    const both = fresh();
    both.relicIds = ["crystal_lens", "grand_bazaar"];
    expect((reduce(both, { type: "REROLL" }) as GameState).shop).toHaveLength(6); // widest wins
  });

  it("triple crown grants one free higher-tier offer per completed triple", () => {
    const s = withTripleSetup(["triple_crown"], "goblin_scamp"); // tier 1
    const next = reduce(s, { type: "BUY", index: 0 }) as GameState;

    // the three copies merged into one golden
    expect(next.board).toHaveLength(1);
    expect(next.board[0].templateId).toBe("goblin_scamp");
    expect(next.board[0].golden).toBe(true);

    // the reward fired exactly once: one discovered offer, one free buy
    expect(next.shop).toHaveLength(1);
    expect(findTemplate(next.shop[0].templateId)!.tier).toBe(2); // one above the merged tier
    expect(next.freeBuysLeft).toBe(1);
    expect(next.log.filter((l) => l.startsWith("Triple Crown:"))).toHaveLength(1);

    // a second triple fires the reward again (once per triple, not once per run)
    next.shop = [mk("whelp", "a4")];
    next.board.push(mk("whelp", "a5"), mk("whelp", "a6"));
    const again = reduce(next, { type: "BUY", index: 0 }) as GameState;
    expect(again.shop).toHaveLength(1);
    expect(findTemplate(again.shop[0].templateId)!.tier).toBe(2); // whelp is tier 1
    expect(again.log.filter((l) => l.startsWith("Triple Crown:"))).toHaveLength(2);
  });

  it("no triple reward without the relic or without a completed triple", () => {
    // merge happens, but no reward without the relic
    const bare = reduce(withTripleSetup([], "goblin_scamp"), { type: "BUY", index: 0 }) as GameState;
    expect(bare.board[0].golden).toBe(true);
    expect(bare.shop).toHaveLength(0);
    expect(bare.freeBuysLeft).toBe(0);
    expect(bare.log.some((l) => l.startsWith("Triple Crown:"))).toBe(false);

    // relic held, but a buy that completes no triple fires nothing
    const s = fresh();
    s.relicIds = ["triple_crown"];
    s.board = [mk("goblin_scamp", "a1")];
    s.shop = [mk("whelp", "a2")];
    const noTriple = reduce(s, { type: "BUY", index: 0 }) as GameState;
    expect(noTriple.shop).toHaveLength(0);
    expect(noTriple.freeBuysLeft).toBe(0);
    expect(noTriple.log.some((l) => l.startsWith("Triple Crown:"))).toBe(false);
  });

  it("triple crown caps the discovered offer at tier 6", () => {
    // leviathan is tier 6, so the offer stays at the max tier
    const s = withTripleSetup(["triple_crown"], "leviathan");
    const next = reduce(s, { type: "BUY", index: 0 }) as GameState;
    expect(next.shop).toHaveLength(1);
    expect(findTemplate(next.shop[0].templateId)!.tier).toBe(6);
  });

  it("barkeep's tip pays 5 gold once per completed triple", () => {
    const s = withTripleSetup(["barkeeps_tip"], "goblin_scamp");
    const next = reduce(s, { type: "BUY", index: 0 }) as GameState;
    expect(next.gold).toBe(10 - 3 + 5); // buy costs 3, the tip pays 5
    expect(next.log.filter((l) => l.startsWith("Barkeep's Tip:"))).toHaveLength(1);

    next.shop = [mk("whelp", "a4")];
    next.board.push(mk("whelp", "a5"), mk("whelp", "a6"));
    const again = reduce(next, { type: "BUY", index: 0 }) as GameState;
    expect(again.gold).toBe(next.gold - 3 + 5);
    expect(again.log.filter((l) => l.startsWith("Barkeep's Tip:"))).toHaveLength(2);
  });

  it("triple rewards are deterministic for the same seed", () => {
    const run = () => {
      const s = withTripleSetup(["triple_crown", "barkeeps_tip"], "goblin_scamp");
      return reduce(s, { type: "BUY", index: 0 }) as GameState;
    };
    const a = run();
    const b = run();
    expect(a.shop[0].templateId).toBe(b.shop[0].templateId);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});