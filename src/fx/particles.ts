/**
 * Canvas particle engine for juice effects. Visual-only: uses Math.random on
 * purpose (no game logic flows through here, so determinism of runs is
 * untouched). Sprites load from /assets/fx/<name>.png when the harvest agent
 * placed them; every kind falls back to procedural drawing when a sprite is
 * missing, so the engine works with zero assets.
 */

export type FxKind = "coin" | "spark" | "puff" | "soul" | "shield";

export interface Particle {
  kind: FxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // seconds elapsed
  ttl: number;  // total lifetime in seconds
  size: number;
  angle: number;
  spin: number;
  sprite?: HTMLImageElement;
}

export interface BurstOptions {
  count?: number;
  ttl?: number;
  speed?: number;
  size?: number;
  gravity?: number;
  image?: HTMLImageElement; // for soul bursts
}

const GRAVITY: Partial<Record<FxKind, number>> = {
  coin: 340,
  spark: 60,
  puff: -30,
  soul: -60,
  shield: 0
};

export class FxEngine {
  particles: Particle[] = [];
  private textures = new Map<FxKind, HTMLImageElement>();
  private base: string;

  constructor(base = "") {
    this.base = base;
  }

  /** Preload a sprite for a kind; missing files are fine (procedural fallback). */
  loadSprite(kind: FxKind, name: string): void {
    if (typeof document === "undefined") return;
    const img = new Image();
    img.src = `${this.base}assets/fx/${name}.png`;
    img.onload = () => this.textures.set(kind, img);
  }

  burst(kind: FxKind, x: number, y: number, opts: BurstOptions = {}): void {
    const count = opts.count ?? (kind === "soul" ? 1 : 10);
    const ttl = opts.ttl ?? (kind === "soul" ? 0.9 : 0.7);
    const speed = opts.speed ?? (kind === "spark" ? 240 : 120);
    const gravity = opts.gravity ?? GRAVITY[kind] ?? 0;
    if (kind === "soul" && opts.image) {
      this.particles.push({
        kind, x, y, vx: 0, vy: gravity * 0.4, life: 0, ttl: ttl * 1.4,
        size: opts.size ?? 34, angle: 0, spin: 0.6, sprite: opts.image
      });
      return;
    }
    for (let i = 0; i < count; i++) {
      const dir = Math.random() * Math.PI * 2;
      const mag = speed * (0.35 + Math.random() * 0.75);
      this.particles.push({
        kind, x, y,
        vx: Math.cos(dir) * mag,
        vy: Math.sin(dir) * mag - (kind === "coin" ? 120 : 0),
        life: 0,
        ttl: ttl * (0.7 + Math.random() * 0.6),
        size: (opts.size ?? 8) * (0.6 + Math.random() * 0.8),
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 6
      });
    }
    // stamp gravity onto coin-like particles via ttl bookkeeping in tick
    (this as FxEngine & { _g?: Map<number, number> });
    for (const p of this.particles) {
      if (p.kind === kind && p.sprite === undefined) {
        (p as Particle & { g?: number }).g = gravity;
      }
    }
  }

  tick(dt: number): void {
    for (const p of this.particles) {
      p.life += dt;
      const g = (p as Particle & { g?: number }).g ?? GRAVITY[p.kind] ?? 0;
      p.vy += g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.ttl);
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const t = p.life / p.ttl;
      const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      const tex = this.textures.get(p.kind);
      if (p.sprite) {
        const s = p.size * (1 + t * 0.6);
        ctx.drawImage(p.sprite, -s / 2, -s / 2, s, s);
      } else if (tex) {
        const s = p.size * (p.kind === "puff" ? 1 + t * 1.6 : 1);
        ctx.drawImage(tex, -s / 2, -s / 2, s, s);
      } else {
        this.drawProcedural(ctx, p.kind, p.size * (p.kind === "puff" ? 1 + t * 1.6 : 1 - t * 0.3));
      }
      ctx.restore();
    }
  }

  private drawProcedural(ctx: CanvasRenderingContext2D, kind: FxKind, size: number): void {
    switch (kind) {
      case "coin":
        ctx.fillStyle = "#e9b44c";
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8a6d1f";
        ctx.beginPath();
        ctx.arc(0, 0, size / 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "spark":
        ctx.fillStyle = "#ffd98a";
        ctx.fillRect(-size / 2, -size / 6, size, size / 3);
        break;
      case "puff":
        ctx.fillStyle = "rgba(159,176,197,0.55)";
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "shield":
        ctx.strokeStyle = "#8fd0ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "soul":
        ctx.fillStyle = "rgba(200,220,255,0.6)";
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  }

  clear(): void {
    this.particles = [];
  }
}
