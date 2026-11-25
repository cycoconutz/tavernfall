import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { FxEngine } from "./particles";
import type { BurstOptions, FxKind } from "./particles";

export interface FxCanvasHandle {
  burst(kind: FxKind, x: number, y: number, opts?: BurstOptions): void;
}

interface Props {
  /** Sprite kinds to preload, e.g. [["puff", "puff_01"]]. Defaults cover the cozy set. */
  sprites?: Array<[FxKind, string]>;
}

const DEFAULT_SPRITES: Array<[FxKind, string]> = [
  ["puff", "puff_01"],
  ["spark", "spark_01"],
  ["coin", "sparkle_01"],
  ["shield", "circle_01"]
];

/**
 * Transparent overlay canvas. Place inside any `position: relative` container
 * and it sizes itself to that container. Call burst() through the ref from
 * game events; pointer events pass through to the UI below.
 */
export const FxCanvas = forwardRef<FxCanvasHandle, Props>(function FxCanvas(
  { sprites = DEFAULT_SPRITES },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FxEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new FxEngine(import.meta.env.BASE_URL);
    engineRef.current = engine;
    for (const [kind, name] of sprites) engine.loadSprite(kind, name);

    let raf = 0;
    let last = performance.now();
    const loop = (t: number): void => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const parent = canvas.parentElement;
      if (parent) {
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
      }
      engine.tick(dt);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        engine.render(ctx);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sprites]);

  useImperativeHandle(
    ref,
    () => ({
      burst(kind: FxKind, x: number, y: number, opts?: BurstOptions): void {
        engineRef.current?.burst(kind, x, y, opts);
      }
    }),
    []
  );

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
});
