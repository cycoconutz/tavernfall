import unitsJson from "../../data/units.json";
import type { UnitTemplate, UnitState } from "../sim/types";

export const UNIT_TEMPLATES: UnitTemplate[] = unitsJson as UnitTemplate[];

export function templatesForTier(maxTier: number): UnitTemplate[] {
  return UNIT_TEMPLATES.filter((t) => t.tier <= maxTier);
}

export function randomTemplate(rng: { int: (a: number, b: number) => number; pick: <T>(x: readonly T[]) => T }, maxTier: number): UnitTemplate {
  const pool = templatesForTier(maxTier);
  return rng.pick(pool);
}

export function toUnitState(t: UnitTemplate, instanceId: string, golden = false): UnitState {
  return {
    instanceId,
    templateId: t.id,
    attack: golden ? t.attack * 2 : t.attack,
    health: golden ? t.health * 2 : t.health,
    keywords: [...t.keywords],
    deathrattle: t.deathrattle,
    golden
  };
}

export function findTemplate(id: string): UnitTemplate | undefined {
  return UNIT_TEMPLATES.find((t) => t.id === id);
}