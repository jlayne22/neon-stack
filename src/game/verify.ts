import { shuffledBag } from "./bag";
import { collapseRows, emptyBoard, fits, fullRows } from "./board";
import { cellsFor, kicksFor } from "./pieces";
import { comboBonus, dropInterval, lineClearScore } from "./scoring";
import { COLS, PIECE_IDS, type PieceId } from "./types";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

function sameCells(id: PieceId) {
  const a = cellsFor(id, 0).map((c) => c.join(",")).sort().join("|");
  const b = cellsFor(id, 4).map((c) => c.join(",")).sort().join("|");
  assert(a === b, `${id} rotation 4 should match 0`);
}

for (const id of PIECE_IDS) sameCells(id);

const o0 = cellsFor("O", 0).map((c) => c.join(",")).sort().join("|");
const o1 = cellsFor("O", 1).map((c) => c.join(",")).sort().join("|");
assert(o0 === o1, "O piece should not change shape");

assert(cellsFor("I", 0).length === 4, "I has 4 cells");
assert(kicksFor("T", 0, 1).length === 5, "T has SRS kicks");
assert(kicksFor("I", 0, 1)[1][0] === -2, "I first kick offset");
assert(kicksFor("O", 0, 1).length === 1, "O has no wall kicks");

const board = emptyBoard();
assert(fits(board, "T", 0, 3, 0), "spawn fits");
assert(!fits(board, "T", 0, -2, 0), "off-board left blocked");

for (let x = 0; x < COLS; x++) board[19][x] = 1;
assert(fullRows(board).join(",") === "19", "bottom row detected");
const collapsed = collapseRows(board, [19]);
assert(collapsed[19].every((c) => c === 0), "cleared row is empty");
assert(collapsed.length === 20, "board height preserved");

assert(lineClearScore(4, 2, false) === 1600, "quad score");
assert(lineClearScore(4, 2, true) === 2400, "back-to-back quad");
assert(comboBonus(3, 2) === 200, "combo bonus");
assert(dropInterval(1) === 1000, "level 1 gravity");

const bag = shuffledBag(() => 0.5);
assert(new Set(bag).size === 7, "bag has 7 unique pieces");

let kicksWork = false;
const wall = emptyBoard();
for (const [kx, ky] of kicksFor("J", 0, 1)) {
  if (fits(wall, "J", 1, 0 + kx, 18 + ky)) {
    kicksWork = true;
    break;
  }
}
assert(kicksWork, "J can rotate near the floor");

console.log("neon stack logic ok");
