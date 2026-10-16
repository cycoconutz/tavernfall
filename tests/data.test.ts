import { describe, it, expect } from "vitest";
import units from "../data/units.json";
import heroes from "../data/heroes.json";
import relics from "../data/relics.json";

const TRIBES = ["goblins", "dragons", "naga", "murlocs"];

describe("game data", () => {
  it("has 30 balanced units", () => {
    expect(units).toHaveLength(30);
    expect(new Set(units.map((u: any) => u.id)).size).toBe(30);
    for (const u of units as any[]) {
      expect(TRIBES).toContain(u.tribe);
      expect(u.tier).toBeGreaterThanOrEqual(1);
      expect(u.tier).toBeLessThanOrEqual(6);
      expect(u.attack).toBeGreaterThan(0);
      expect(u.health).toBeGreaterThan(0);
      expect(Array.isArray(u.keywords)).toBe(true);
    }
  });

  it("covers every tribe", () => {
    for (const tribe of TRIBES) {
      const n = (units as any[]).filter((u) => u.tribe === tribe).length;
      expect(n).toBeGreaterThanOrEqual(5);
    }
  });

  it("has the three hero classes", () => {
    expect((heroes as any[]).map((h: any) => h.id).sort()).toEqual(["mage", "ranger", "warrior"]);
  });

  it("has ten relic templates", () => {
    expect(relics).toHaveLength(10);
    expect(new Set((relics as any[]).map((r: any) => r.id)).size).toBe(10);
  });
});