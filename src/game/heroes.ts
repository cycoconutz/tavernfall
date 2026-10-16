import heroesJson from "../../data/heroes.json";

export interface HeroDescription {
  id: string;
  name: string;
  power: string;
  description: string;
}

export function heroDescription(id: string): HeroDescription {
  return (heroesJson as HeroDescription[]).find((h) => h.id === id)!;
}

export function heroPower(id: string): string {
  return heroDescription(id).power;
}

export function heroList(): HeroDescription[] {
  return heroesJson as HeroDescription[];
}