/**
 * Tiny WebAudio SFX module: pure synthesis, no assets, no autoplay violations.
 * The AudioContext is created lazily on the first user gesture (call warmUp()
 * from any click handler once). Everything degrades to a no-op when WebAudio
 * or localStorage is unavailable (tests, SSR, old browsers).
 */

type Ctx = AudioContext & { _tavernfallMute?: boolean };

let ctx: Ctx | null = null;
let muted = false;

try {
  muted = localStorage.getItem("tavernfall_muted") === "1";
} catch {
  muted = false;
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem("tavernfall_muted", muted ? "1" : "0");
  } catch {
    /* persistence optional */
  }
  return muted;
}

/** Call from any user-gesture handler; safe to call repeatedly. */
export function warmUp(): void {
  if (ctx || typeof window === "undefined") return;
  const AC = (window as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!AC) return;
  try {
    ctx = new AC() as Ctx;
  } catch {
    ctx = null;
  }
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.08,
  slideTo?: number
): void {
  if (!ctx || muted) return;
  if (ctx.state === "suspended") void ctx.resume();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + duration);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function noise(duration: number, gain = 0.05, filterFreq = 1200): void {
  if (!ctx || muted) return;
  if (ctx.state === "suspended") void ctx.resume();
  const t = ctx.currentTime;
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const amp = ctx.createGain();
  amp.gain.value = gain;
  src.connect(filter).connect(amp).connect(ctx.destination);
  src.start(t);
}

export const sfx = {
  coin() {
    tone(880, 0.09, "triangle", 0.07);
    tone(1320, 0.12, "triangle", 0.06);
  },
  buy() {
    tone(520, 0.1, "triangle", 0.08, 780);
  },
  sell() {
    tone(780, 0.12, "triangle", 0.07, 390);
    noise(0.08, 0.03, 2400);
  },
  hit() {
    noise(0.06, 0.06, 900);
    tone(160, 0.06, "square", 0.05);
  },
  shield() {
    tone(1200, 0.15, "sine", 0.06, 400);
  },
  death() {
    tone(300, 0.28, "sawtooth", 0.05, 60);
    noise(0.2, 0.04, 500);
  },
  victory() {
    tone(523, 0.12, "triangle", 0.08);
    setTimeout(() => tone(659, 0.12, "triangle", 0.08), 110);
    setTimeout(() => tone(784, 0.2, "triangle", 0.08), 220);
  },
  defeat() {
    tone(392, 0.18, "sawtooth", 0.06, 330);
    setTimeout(() => tone(262, 0.3, "sawtooth", 0.06, 130), 160);
  },
  relic() {
    tone(660, 0.14, "sine", 0.07);
    setTimeout(() => tone(990, 0.18, "sine", 0.06), 120);
  },
  tick() {
    tone(440, 0.04, "sine", 0.03);
  }
};
