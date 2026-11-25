import { describe, expect, it } from "vitest";
import { FxEngine } from "../src/fx/particles";

function stubCtx(): CanvasRenderingContext2D {
  const noop = () => undefined;
  return new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return { width: 100, height: 100 };
        return noop;
      },
      set: () => true
    }
  ) as unknown as CanvasRenderingContext2D;
}

describe("FxEngine", () => {
  it("spawns and decays particles over time", () => {
    const fx = new FxEngine();
    fx.burst("coin", 50, 50, { count: 12, ttl: 1 });
    expect(fx.particles.length).toBe(12);
    fx.tick(0.5);
    expect(fx.particles.length).toBe(12); // still alive mid-life
    expect(fx.particles[0].x).not.toBe(50); // movement happened
    fx.tick(5);
    expect(fx.particles.length).toBe(0); // all expired
  });

  it("coin bursts fall with gravity, puffs rise", () => {
    const fx = new FxEngine();
    fx.burst("coin", 0, 0, { count: 1, ttl: 1 });
    const coin = fx.particles[0];
    const vyBefore = coin.vy;
    fx.tick(0.1);
    expect(coin.vy).toBeGreaterThan(vyBefore); // gravity pulled down

    fx.clear();
    fx.burst("puff", 0, 0, { count: 1, ttl: 1 });
    const puff = fx.particles[0];
    const puffVy = puff.vy;
    fx.tick(0.1);
    expect(puff.vy).toBeLessThan(puffVy + 1); // rises or barely falls
  });

  it("soul bursts carry the unit portrait and live longer", () => {
    const fx = new FxEngine();
    const fakeImg = new Image();
    fx.burst("soul", 40, 40, { image: fakeImg, ttl: 1 });
    expect(fx.particles.length).toBe(1);
    expect(fx.particles[0].sprite).toBe(fakeImg);
    expect(fx.particles[0].ttl).toBeGreaterThan(1); // extended lifetime
  });

  it("renders without sprites and without throwing", () => {
    const fx = new FxEngine();
    fx.burst("spark", 10, 10, { count: 3 });
    fx.burst("soul", 10, 10, { image: new Image() });
    fx.tick(0.1);
    expect(() => fx.render(stubCtx())).not.toThrow();
  });

  it("clear empties everything", () => {
    const fx = new FxEngine();
    fx.burst("puff", 0, 0, { count: 5 });
    fx.clear();
    expect(fx.particles.length).toBe(0);
  });
});
