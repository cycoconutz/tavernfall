import { useEffect, useReducer, useState } from "react";
import { reduce } from "./game/reducer";
import type { GameState } from "./game/state";
import type { Action } from "./game/actions";
import { currentEncounter } from "./game/run";
import { saveRun, loadRun, clearRun, encodeSeed, decodeSeed } from "./game/persist";
import { relicLabel } from "./game/relics";
import { heroPower, heroList } from "./game/heroes";


function init(): GameState | null {
  return loadRun();
}

function reducer(state: GameState | null, action: Action): GameState | null {
  return reduce(state, action);
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, init);
  const [seedCode, setSeedCode] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (state) saveRun(state);
  }, [state]);

  function start(heroId: string) {
    const seed = seedCode ? decodeSeed(seedCode) : Math.floor(Math.random() * 1e9);
    dispatch({ type: "START", heroId, seed });
    setSeedCode(null);
  }

  function restart() {
    clearRun();
    window.location.reload();
  }

  if (!state) {
    return (
      <div className="app">
        <h1>Tavernfall</h1>
        <p className="muted">A single-player roguelite auto battler. Pick a hero to start a 15 minute run.</p>
        <div className="grid">
          {heroList().map((h) => (
            <div key={h.id} className="card">
              <img
                src={`${import.meta.env.BASE_URL}assets/hero_${h.id}.png`}
                alt={h.id}
                style={{ width: 96, height: 96, borderRadius: 8 }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <h3>{h.name}</h3>
              <p className="muted">{heroPower(h.id)}</p>
              <button className="primary" onClick={() => start(h.id)}>
                Start run
              </button>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <label className="muted">
            Seed code (optional):
            <input
              value={seedCode ?? ""}
              onChange={(e) => setSeedCode(e.target.value.toUpperCase())}
              placeholder="e.g. 5F3K9"
              style={{ marginLeft: 8 }}
            />
          </label>
        </div>
      </div>
    );
  }

  const enc = currentEncounter(state);

  return (
    <div className="app">
      <h1>Tavernfall</h1>
      <div className="row">
        <span className="stat">HP {state.health}/{state.maxHealth}</span>
        <span className="stat">Gold {state.gold}</span>
        <span className="stat">Tier {state.tier}</span>
        <span className="stat">W{state.stats.wins}/L{state.stats.losses}</span>
        <span className="muted">seed {encodeSeed(state.seed)}</span>
        <button onClick={restart}>New run</button>
      </div>

      {state.pendingRelics && (
        <div className="card">
          <h3>Choose a relic</h3>
          <div className="row">
            {state.pendingRelics.map((r) => (
              <button
                key={r}
                className="primary"
                onClick={() => dispatch({ type: "CHOOSE_RELIC", relicId: r })}
              >
                {relicLabel(r)}
              </button>
            ))}
          </div>
        </div>
      )}

      {enc && (
        <>
          <h2>
            Encounter {state.encounterIndex + 1}/{state.encounters.length}: {enc.label} ({enc.kind})
          </h2>
          <div className="card">
            <strong>Enemy board</strong>
            <div className="row">
              {enc.enemy.map((u, i) => (
                <div key={i} className="unit">
                  <img src={`${import.meta.env.BASE_URL}assets/${u.templateId}.png`} alt={u.templateId} onError={(e) => (e.currentTarget.style.display = "none")} />
                  <div>{u.templateId}</div>
                  <div className="muted">{u.attack}/{u.health}</div>
                </div>
              ))}
              {enc.enemy.length === 0 && <span className="muted">none</span>}
            </div>
          </div>
        </>
      )}

      <div className="card">
        <strong>Your board ({state.board.length}/7)</strong>
        <div className="row">
          {state.board.map((u, i) => (
            <div
              key={u.instanceId}
              className={`unit${dragIndex === i ? " dragging" : ""}${
                dragIndex !== null && dragIndex !== i ? " drop-target" : ""
              }`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
                setDragIndex(i);
              }}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIndex ?? Number(e.dataTransfer.getData("text/plain"));
                if (!Number.isNaN(from) && from !== i) {
                  dispatch({ type: "MOVE_BOARD", from, to: i });
                }
                setDragIndex(null);
              }}
            >
              <img src={`${import.meta.env.BASE_URL}assets/${u.templateId}.png`} alt={u.templateId} onError={(e) => (e.currentTarget.style.display = "none")} />
              <div>{u.templateId}</div>
              <div className="muted">
                {u.attack}/{u.health}
                {u.golden ? " star" : ""}
              </div>
              <div className="row">
                <button onClick={() => dispatch({ type: "MOVE_BOARD", from: i, to: Math.max(0, i - 1) })} disabled={i === 0}>Up</button>
                <button onClick={() => dispatch({ type: "MOVE_BOARD", from: i, to: Math.min(state.board.length - 1, i + 1) })} disabled={i === state.board.length - 1}>Down</button>
                <button onClick={() => dispatch({ type: "SELL", index: i })}>Sell</button>
              </div>
            </div>
          ))}
          {state.board.length === 0 && <span className="muted">empty, buy units below</span>}
        </div>
      </div>

      {state.status === "playing" && (
        <>
          <div className="card">
            <div className="row">
              <strong>Shop</strong>
              <button onClick={() => dispatch({ type: "REROLL" })}>Reroll (-1)</button>
              <button onClick={() => dispatch({ type: "UPGRADE" })}>Upgrade tier</button>
              <button onClick={() => dispatch({ type: "FREEZE" })}>{state.frozen ? "Unfreeze" : "Freeze"}</button>
              <button className="primary" onClick={() => dispatch({ type: "FIGHT" })}>
                Fight
              </button>
              <button onClick={() => dispatch({ type: "ADVANCE" })} disabled={!!state.pendingRelics}>Advance</button>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              {state.shop.map((u, i) => (
                <div key={u.instanceId} className="unit">
                  <img src={`${import.meta.env.BASE_URL}assets/${u.templateId}.png`} alt={u.templateId} onError={(e) => (e.currentTarget.style.display = "none")} />
                  <div>{u.templateId}</div>
                  <div className="muted">{u.attack}/{u.health}</div>
                  <button onClick={() => dispatch({ type: "BUY", index: i })}>Buy (3)</button>
                </div>
              ))}
              {state.shop.length === 0 && <span className="muted">shop empty, reroll or advance</span>}
            </div>
          </div>

          <div className="card">
            <strong>Log</strong>
            <div className="log">
              {state.log.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
            {state.lastFight.length > 0 && (
              <div className="log" style={{ marginTop: 8 }}>
                <strong>Last fight:</strong>
                {state.lastFight.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {state.status !== "playing" && (
        <div className="card">
          <h2>{state.status.toUpperCase()}</h2>
          <p>
            Final HP {state.health}, gold {state.gold}, W{state.stats.wins}/L{state.stats.losses}.
          </p>
        </div>
      )}
    </div>
  );
}
