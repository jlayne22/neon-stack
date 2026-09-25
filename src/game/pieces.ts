import type { PieceId } from "./types";

type Kick = readonly [number, number];

const BASE: Record<PieceId, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

function rotateMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const next = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      next[x][n - 1 - y] = matrix[y][x];
    }
  }
  return next;
}

function cellsFrom(matrix: number[][]): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (matrix[y][x]) cells.push([x, y]);
    }
  }
  return cells;
}

const ROTATIONS: Record<PieceId, Array<Array<[number, number]>>> = {
  I: [],
  O: [],
  T: [],
  S: [],
  Z: [],
  J: [],
  L: [],
};

(Object.keys(BASE) as PieceId[]).forEach((id) => {
  let matrix = BASE[id].map((row) => row.slice());
  for (let i = 0; i < 4; i++) {
    ROTATIONS[id].push(cellsFrom(matrix));
    matrix = rotateMatrix(matrix);
  }
});

/** Wall kicks with +y downward. Translated from the common SRS tables. */
const JLSTZ_CW: Kick[][] = [
  [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
];

const JLSTZ_CCW: Kick[][] = [
  [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
];

const I_CW: Kick[][] = [
  [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
  [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
];

const I_CCW: Kick[][] = [
  [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
  [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
];

export function cellsFor(id: PieceId, rot: number): Array<[number, number]> {
  if (id === "O") return ROTATIONS.O[0];
  return ROTATIONS[id][((rot % 4) + 4) % 4];
}

export function kicksFor(id: PieceId, from: number, dir: 1 | -1): readonly Kick[] {
  if (id === "O") return [[0, 0]];
  const table = id === "I" ? (dir === 1 ? I_CW : I_CCW) : dir === 1 ? JLSTZ_CW : JLSTZ_CCW;
  return table[((from % 4) + 4) % 4];
}

export const SPAWN_X = 3;
export const SPAWN_Y = 0;
