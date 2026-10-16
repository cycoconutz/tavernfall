import type { GameState } from "./state";

const KEY = "tavernfall.run.v1";

export function saveRun(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage unavailable, ignore
  }
}

export function loadRun(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (!Array.isArray(parsed.lastFight)) parsed.lastFight = [];
    if (typeof parsed.bossBeaten !== "boolean") parsed.bossBeaten = false;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function encodeSeed(seed: number): string {
  return seed.toString(36).toUpperCase();
}

export function decodeSeed(code: string): number {
  const n = parseInt(code, 36);
  return Number.isFinite(n) ? n : Math.floor(Math.random() * 1e9);
}