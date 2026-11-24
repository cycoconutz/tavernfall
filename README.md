# Tavernfall

A single-player roguelite auto battler for the browser. Hearthstone Battlegrounds style tavern economy, wrapped in a short linear dungeon run.

Live: **https://cycoconutz.github.io/tavernfall/**

## Stack

- TypeScript, Vite, React
- Vitest for the sim and framework tests
- Art generated through the Pollinations proxy in a sibling generator project

## Layout

```
data/           units.json, heroes.json, relics.json (hand editable)
src/sim/        deterministic rules engine (rng, combat, types)
src/game/       run loop, shop, modifiers, reducer, persistence
src/App.tsx     playable UI
scripts/        simulate-run, balance-report, generate-art
tests/          vitest suites
public/assets/  generated portraits (id.png)
```

## Architecture notes

- `src/sim/combat.ts` is a pure function of `(player, enemy, seed)`. Same seed, same outcome.
- `src/game/reducer.ts` is the single entry point for state changes. State is plain JSON, so localStorage save, resume and seed sharing all work.
- All randomness flows through `Rng` (mulberry32) with seeds derived from the run seed plus a per-action offset.
- Hero powers and relics are applied in `src/game/modifiers.ts`, so they never leak into the raw engine.

## Commands

```bash
npm install
npm run dev              # play at http://localhost:5173
npm test                 # sim + framework tests
npm run build            # production bundle
npm run simulate:sample-run
npm run balance:report
npm run art:generate -- --dry-run
```

## Art generation

`npm run art:generate` posts each prompt from `data/*.json` to the generator project's `/api/generate` (default `http://localhost:3001`, override with `GEN_BASE`). Pollinations allows roughly one image per 45 seconds per IP, so a full 33 image pass takes about 25 minutes. Existing files are skipped unless `--force` is passed.

## Status

Framework first. Working: deterministic combat, tavern economy, linear 9 node run, hero powers (warrior, ranger, mage), relic offers with static effects, reducer, persistence, seed codes. Pending: richer relic hooks, drag and drop ordering, mobile layout, audio.
