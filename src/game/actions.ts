export type Action =
  | { type: "START"; heroId: string; seed: number }
  | { type: "BUY"; index: number }
  | { type: "SELL"; index: number }
  | { type: "MOVE_BOARD"; from: number; to: number }
  | { type: "REROLL" }
  | { type: "UPGRADE" }
  | { type: "FREEZE" }
  | { type: "FIGHT" }
  | { type: "ADVANCE" }
  | { type: "CHOOSE_RELIC"; relicId: string }
  | { type: "LOAD"; state: string }; // JSON string of GameState