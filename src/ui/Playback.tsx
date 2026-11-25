import { useEffect, useMemo, useRef, useState } from "react";
import { cloneBoard } from "../sim/combat";
import type { CombatEvent, Side, UnitState } from "../sim/types";
import { FxCanvas } from "../fx/FxCanvas";
import type { FxCanvasHandle } from "../fx/FxCanvas";
import { sfx } from "../game/audio";

interface Float {
  side: Side;
  slot: number;
  text: string;
  key: number;
}

interface Frame {
  event: CombatEvent;
  player: UnitState[];
  enemy: UnitState[];
  attacker?: { side: Side; slot: number };
  hurt?: { side: Side; slot: number };
  dying?: { side: Side; slot: number };
  float?: Float;
  buffed?: { side: Side; slots: number[] };
}

interface Props {
  log: CombatEvent[];
  player: UnitState[];
  enemy: UnitState[];
  won: boolean;
  onDone: () => void;
}

function buildFrames(log: CombatEvent[], player0: UnitState[], enemy0: UnitState[]): Frame[] {
  const frames: Frame[] = [];
  for (const ev of log) {
    const f: Frame = { event: ev, player: cloneBoard(player0), enemy: cloneBoard(enemy0) };
    const work = { player: cloneBoard(player0), enemy: cloneBoard(enemy0) };
    type Boards = { player: UnitState[]; enemy: UnitState[] };
    const arrOf = (b: Boards) => (s: Side) => (s === "player" ? b.player : b.enemy);
    const display = arrOf(f);
    const logic = arrOf(work);

    switch (ev.kind) {
      case "attack": {
        f.attacker = { side: ev.attackerSide, slot: ev.attackerSlot };
        f.hurt = { side: ev.defenderSide, slot: ev.defenderSlot };
        if (ev.damage > 0) {
          f.float = { side: ev.defenderSide, slot: ev.defenderSlot, text: `-${ev.damage}`, key: ev.seq };
          const d = logic(ev.defenderSide);
          if (d[ev.defenderSlot]) d[ev.defenderSlot].health = Math.max(0, d[ev.defenderSlot].health - ev.damage);
          const dd = display(ev.defenderSide);
          if (dd[ev.defenderSlot]) dd[ev.defenderSlot].health = Math.max(0, dd[ev.defenderSlot].health - ev.damage);
        }
        break;
      }
      case "shieldBreak": {
        f.hurt = { side: ev.defenderSide, slot: ev.defenderSlot };
        f.float = { side: ev.defenderSide, slot: ev.defenderSlot, text: "POP!", key: ev.seq };
        break;
      }
      case "poison": {
        f.hurt = { side: ev.defenderSide, slot: ev.defenderSlot };
        f.float = { side: ev.defenderSide, slot: ev.defenderSlot, text: "poison", key: ev.seq };
        const d = logic(ev.defenderSide);
        if (d[ev.defenderSlot]) d[ev.defenderSlot].health = 0;
        const dd = display(ev.defenderSide);
        if (dd[ev.defenderSlot]) dd[ev.defenderSlot].health = 0;
        break;
      }
      case "death":
        f.dying = { side: ev.side, slot: ev.slot };
        break;
      case "deathrattle": {
        if (ev.effect === "buff_ally") {
          f.buffed = { side: ev.side, slots: ev.affectedSlots };
          for (const s of ev.affectedSlots) {
            const w = logic(ev.side)[s];
            if (w) { w.attack += 1; w.health += 1; }
            const v = display(ev.side)[s];
            if (v) { v.attack += 1; v.health += 1; }
          }
        } else if (ev.effect === "summon") {
          f.buffed = { side: ev.side, slots: ev.affectedSlots };
          for (const s of ev.affectedSlots) {
            const token: UnitState = {
              instanceId: `sum_${ev.seq}`,
              templateId: "murloc_tadpole",
              attack: 1,
              health: 1,
              keywords: [],
              golden: false
            };
            const w = logic(ev.side);
            if (s >= w.length) w.push({ ...token });
            const v = display(ev.side);
            if (s >= v.length) v.push({ ...token });
          }
        }
        break;
      }
      case "reborn":
      case "resurrect": {
        f.buffed = { side: ev.side, slots: [ev.slot] };
        const w = logic(ev.side);
        if (ev.slot >= w.length) {
          w.push({ instanceId: `${ev.kind}_${ev.seq}`, templateId: ev.templateId, attack: 1, health: 1, keywords: [], golden: false });
        } else {
          w[ev.slot].health = 1;
        }
        const v = display(ev.side);
        if (ev.slot >= v.length) {
          v.push({ instanceId: `${ev.kind}_${ev.seq}`, templateId: ev.templateId, attack: 1, health: 1, keywords: [], golden: false });
        } else {
          v[ev.slot].health = 1;
        }
        break;
      }
    }

    frames.push(f);
    // The working boards carry splices forward (as combat did), so later
    // frames' slots line up with the log.
    if (ev.kind === "death") logic(ev.side).splice(ev.slot, 1);
    player0 = work.player;
    enemy0 = work.enemy;
  }
  return frames;
}

export function Playback({ log, player, enemy, won, onDone }: Props) {
  const frames = useMemo(() => buildFrames(log, player, enemy), [log, player, enemy]);
  const [frameIdx, setFrameIdx] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const skipRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<FxCanvasHandle>(null);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  function centerOf(side: Side, slot: number): { x: number; y: number } {
    const overlay = overlayRef.current;
    const unit = frames[Math.min(frameIdx, frames.length - 1)];
    const board = side === "player" ? unit.player : unit.enemy;
    const u = board[slot];
    const el = u ? tileRefs.current.get(`${side}:${u.instanceId}`) : null;
    if (!overlay || !el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const a = overlay.getBoundingClientRect();
    return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 };
  }

  function tileEl(side: Side, slot: number): HTMLDivElement | null {
    const unit = frames[Math.min(frameIdx, frames.length - 1)];
    const board = side === "player" ? unit.player : unit.enemy;
    const u = board[slot];
    if (!u) return null;
    return tileRefs.current.get(`${side}:${u.instanceId}`) ?? null;
  }

  function finish(): void {
    if (banner !== null) return;
    setBanner(won ? "Victory!" : "Defeat...");
    if (won) sfx.victory();
    else sfx.defeat();
    window.setTimeout(() => {
      if (!skipRef.current) onDone();
    }, 900);
  }

  useEffect(() => {
    if (frames.length === 0 || reduceMotion) {
      finish();
      return;
    }
    if (frameIdx >= frames.length) {
      finish();
      return;
    }
    const f = frames[frameIdx];
    const ev = f.event;

    // Sound per event
    if (ev.kind === "attack") sfx.hit();
    else if (ev.kind === "shieldBreak") sfx.shield();
    else if (ev.kind === "poison") sfx.hit();
    else if (ev.kind === "death") sfx.death();
    else sfx.tick();

    // Attacker lunge
    if (f.attacker) {
      const el = tileEl(f.attacker.side, f.attacker.slot);
      if (el) {
        const dy = f.attacker.side === "player" ? -22 : 22;
        el.animate(
          [
            { transform: "translateY(0) scale(1)" },
            { transform: `translateY(${dy}px) scale(1.06)` },
            { transform: "translateY(0) scale(1)" }
          ],
          { duration: 340, easing: "ease-in-out" }
        );
      }
    }

    // Defender hurt flash
    if (f.hurt) {
      const el = tileEl(f.hurt.side, f.hurt.slot);
      if (el) {
        el.animate(
          [
            { filter: "none", transform: "translateX(0)" },
            { filter: "brightness(2.2) saturate(1.8)", transform: "translateX(3px)" },
            { filter: "none", transform: "translateX(-2px)" },
            { filter: "none", transform: "translateX(0)" }
          ],
          { duration: 300, easing: "ease-in-out" }
        );
      }
      if (ev.kind === "attack" && fxRef.current) {
        const pos = centerOf(f.hurt.side, f.hurt.slot);
        fxRef.current.burst("spark", pos.x, pos.y, { count: 6, ttl: 0.35 });
      }
      if (ev.kind === "shieldBreak" && fxRef.current) {
        const pos = centerOf(f.hurt.side, f.hurt.slot);
        fxRef.current.burst("shield", pos.x, pos.y, { count: 4, ttl: 0.5, size: 26 });
      }
    }

    // Death dissolve plus a soul made of the unit's own portrait
    if (f.dying) {
      const el = tileEl(f.dying.side, f.dying.slot);
      if (el) {
        el.animate(
          [
            { transform: "rotate(0deg) scale(1)", opacity: 1 },
            { transform: "rotate(14deg) scale(0.15)", opacity: 0 }
          ],
          { duration: 400, easing: "ease-in", fill: "forwards" }
        );
        const img = el.querySelector("img");
        if (img instanceof HTMLImageElement && fxRef.current) {
          const pos = centerOf(f.dying.side, f.dying.slot);
          fxRef.current.burst("soul", pos.x, pos.y, { image: img, ttl: 0.8, size: 30 });
        }
        if (fxRef.current) {
          const pos = centerOf(f.dying.side, f.dying.slot);
          fxRef.current.burst("puff", pos.x, pos.y, { count: 5, ttl: 0.5 });
        }
      }
    }

    const delay =
      f.dying ? 800 :
      ev.kind === "attack" ? 420 :
      ev.kind === "deathrattle" ? 320 :
      300;
    const t = window.setTimeout(() => {
      if (!skipRef.current) setFrameIdx((i) => i + 1);
    }, delay);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameIdx, frames]);

  function skip(): void {
    skipRef.current = true;
    onDone();
  }

  const frame = frames[Math.min(frameIdx, Math.max(0, frames.length - 1))];

  return (
    <div className="playback-overlay" ref={overlayRef}>
      <h2>{banner ?? "Fight!"}</h2>
      <div className="pb-stage" ref={stageRef}>
        <FxCanvas ref={fxRef} />
        {(["enemy", "player"] as Side[]).map((side) => (
          <div className="pb-board" key={side}>
            {(side === "player" ? frame?.player : frame?.enemy)?.map((u, slot) => {
              const key = `${side}:${u.instanceId}`;
              return (
                <div
                  key={key}
                  className="unit pb-tile"
                  ref={(el) => {
                    if (el) tileRefs.current.set(key, el);
                    else tileRefs.current.delete(key);
                  }}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}assets/${u.templateId}.png`}
                    alt={u.templateId}
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                  <div>{u.templateId}</div>
                  <div className="muted">{u.attack}/{u.health}</div>
                  {frame?.float && frame.float.side === side && frame.float.slot === slot && (
                    <span className="float-num" key={frame.float.key}>
                      {frame.float.text}
                    </span>
                  )}
                  {frame?.buffed && frame.buffed.side === side && frame.buffed.slots.includes(slot) && (
                    <span className="float-num" key={`b${frame.event.seq}`}>
                      +1
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="row">
        <button className="primary" onClick={skip}>
          {banner ? "Continue" : "Skip"}
        </button>
      </div>
    </div>
  );
}
