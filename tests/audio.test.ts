import { describe, expect, it } from "vitest";
import { isMuted, sfx, toggleMute, warmUp } from "../src/game/audio";

describe("audio module", () => {
  it("exposes a mute toggle that persists and round-trips", () => {
    const before = isMuted();
    const after = toggleMute();
    expect(after).toBe(!before);
    // jsdom has localStorage, so the flag survives a fresh import cycle
    expect(localStorage.getItem("tavernfall_muted")).toBe(after ? "1" : "0");
    toggleMute(); // restore
    expect(isMuted()).toBe(before);
  });

  it("degrades to no-op without an AudioContext", () => {
    expect(() => {
      warmUp();
      sfx.coin();
      sfx.hit();
      sfx.death();
      sfx.victory();
    }).not.toThrow();
  });
});
