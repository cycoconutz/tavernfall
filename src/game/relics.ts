import relicsJson from "../../data/relics.json";

export interface RelicDescription {
  id: string;
  name: string;
  effect: string;
}

const BY_ID = new Map<string, RelicDescription>();
for (const r of relicsJson as RelicDescription[]) BY_ID.set(r.id, r);

export function findRelic(id: string): RelicDescription | undefined {
  return BY_ID.get(id);
}

export function allRelics(): RelicDescription[] {
  return relicsJson as RelicDescription[];
}

export function relicLabel(id: string): string {
  const r = BY_ID.get(id);
  return r ? `${r.name}: ${r.effect}` : id;
}