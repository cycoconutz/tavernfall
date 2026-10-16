import { describe, it, expect } from "vitest";
import { combat } from "../src/sim/combat";
import { UnitState } from "../src/sim/types";

function unit(instanceId: string, templateId: string, attack: number, health: number, keywords: string[] = []): UnitState {
  return { instanceId, templateId, attack, health, keywords: keywords as UnitState["keywords"], golden: false };
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
});