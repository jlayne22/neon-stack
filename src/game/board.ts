import { cellsFor } from "./pieces";
import { COLS, ROWS, type PieceId } from "./types";

export function emptyBoard(): number[][] {
  return Array.from({ length: ROWS }, () => Array<number>(COLS).fill(0));
}

export function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => row.slice());
}

export function fits(
  board: number[][],
  id: PieceId,
  rot: number,
  x: number,
  y: number,
): boolean {
  for (const [cx, cy] of cellsFor(id, rot)) {
    const bx = x + cx;
    const by = y + cy;
    if (bx < 0 || bx >= COLS || by >= ROWS) return false;
    if (by >= 0 && board[by][bx] !== 0) return false;
  }
  return true;
}

export function ghostY(
  board: number[][],
  id: PieceId,
  rot: number,
  x: number,
  y: number,
): number {
  let gy = y;
  while (fits(board, id, rot, x, gy + 1)) gy++;
  return gy;
}

export function fullRows(board: number[][]): number[] {
  const rows: number[] = [];
  for (let y = 0; y < ROWS; y++) {
    if (board[y].every((cell) => cell !== 0)) rows.push(y);
  }
  return rows;
}

export function collapseRows(board: number[][], rows: number[]): number[][] {
  const drop = new Set(rows);
  const kept = board.filter((_, y) => !drop.has(y));
  while (kept.length < ROWS) kept.unshift(Array<number>(COLS).fill(0));
  return kept;
}

export function stackHeight(board: number[][]): number {
  for (let y = 0; y < ROWS; y++) {
    if (board[y].some((cell) => cell !== 0)) return ROWS - y;
  }
  return 0;
}

export function isPerfect(board: number[][]): boolean {
  return board.every((row) => row.every((cell) => cell === 0));
}
