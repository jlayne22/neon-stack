export type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export const PIECE_IDS: PieceId[] = ["I", "O", "T", "S", "Z", "J", "L"];

export const COLS = 10;
export const ROWS = 20;
export const PREVIEW_COUNT = 5;

export const COLORS: Record<PieceId, string> = {
  I: "#3df0ff",
  O: "#ffd24a",
  T: "#e85bff",
  S: "#7dff6b",
  Z: "#ff4d6a",
  J: "#5b8cff",
  L: "#ff8a3d",
};

export const PIECE_INDEX: Record<PieceId, number> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
};

export const INDEX_PIECE: (PieceId | null)[] = [
  null,
  "I",
  "O",
  "T",
  "S",
  "Z",
  "J",
  "L",
];

export type Phase = "menu" | "playing" | "paused" | "over";

export interface ActivePiece {
  id: PieceId;
  rot: number;
  x: number;
  y: number;
  serial: number;
}

export interface CellPos {
  x: number;
  y: number;
  id: PieceId;
}

export type GameEvent =
  | { type: "move" }
  | { type: "rotate" }
  | { type: "hold" }
  | { type: "lock"; cells: CellPos[] }
  | { type: "hard-drop"; distance: number; cells: CellPos[] }
  | {
      type: "clear";
      rows: number[];
      cells: CellPos[];
      lines: number;
      combo: number;
      backToBack: boolean;
      perfect: boolean;
      scoreGain: number;
    }
  | { type: "level"; level: number }
  | { type: "spawn" }
  | { type: "over" };

export interface Snapshot {
  phase: Phase;
  board: number[][];
  active: ActivePiece | null;
  ghostY: number;
  hold: PieceId | null;
  holdLocked: boolean;
  queue: PieceId[];
  score: number;
  lines: number;
  level: number;
  combo: number;
  backToBack: boolean;
  highScore: number;
  clearingRows: number[];
  clearProgress: number;
  danger: number;
  muted: boolean;
}
