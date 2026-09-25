import { SevenBag } from "./bag";
import { collapseRows, emptyBoard, fits, fullRows, ghostY, isPerfect, stackHeight } from "./board";
import type { InputFrame } from "./input";
import { cellsFor, kicksFor, SPAWN_X, SPAWN_Y } from "./pieces";
import {
  HARD_DROP_SCORE,
  LINES_PER_LEVEL,
  PERFECT_CLEAR_BONUS,
  SOFT_DROP_SCORE,
  comboBonus,
  dropInterval,
  lineClearScore,
} from "./scoring";
import {
  INDEX_PIECE,
  PIECE_INDEX,
  PREVIEW_COUNT,
  type ActivePiece,
  type CellPos,
  type GameEvent,
  type Phase,
  type PieceId,
  type Snapshot,
} from "./types";

const HIGH_KEY = "neon-stack-high-score";
const DAS = 0.14;
const ARR = 0.03;
const LOCK_DELAY = 0.5;
const MAX_LOCK_RESETS = 15;
const CLEAR_TIME = 0.46;
const SOFT_INTERVAL = 0.045;

function readHigh(): number {
  const raw = localStorage.getItem(HIGH_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

export class Game {
  phase: Phase = "menu";
  board = emptyBoard();
  active: ActivePiece | null = null;
  hold: PieceId | null = null;
  holdLocked = false;
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  backToBack = false;
  highScore = 0;
  clearingRows: number[] = [];
  clearProgress = 0;
  serial = 1;

  private bag = new SevenBag();
  private events: GameEvent[] = [];
  private dropAcc = 0;
  private lockAcc = 0;
  private lockResets = 0;
  private grounded = false;
  private dasDir = 0;
  private dasTimer = 0;
  private dasCharged = false;
  private clearLeft = 0;
  private resumePhase: Phase = "playing";

  constructor() {
    this.highScore = readHigh();
  }

  snapshot(): Snapshot {
    const active = this.active;
    return {
      phase: this.phase,
      board: this.board,
      active,
      ghostY: active ? ghostY(this.board, active.id, active.rot, active.x, active.y) : 0,
      hold: this.hold,
      holdLocked: this.holdLocked,
      queue: this.phase === "menu" ? [] : this.bag.preview(PREVIEW_COUNT),
      score: this.score,
      lines: this.lines,
      level: this.level,
      combo: this.combo,
      backToBack: this.backToBack,
      highScore: this.highScore,
      clearingRows: this.clearingRows.slice(),
      clearProgress: this.clearProgress,
      danger: stackHeight(this.board) / 20,
      muted: false,
    };
  }

  drainEvents(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  start() {
    this.resetRun();
    this.phase = "playing";
    this.spawn();
  }

  restart() {
    this.start();
  }

  togglePause() {
    if (this.phase === "playing") {
      this.resumePhase = "playing";
      this.phase = "paused";
    } else if (this.phase === "paused") {
      this.phase = this.resumePhase;
    }
  }

  update(dt: number, input: InputFrame) {
    if (this.phase === "menu") {
      if (input.start) this.start();
      return;
    }
    if (this.phase === "over") {
      if (input.restart || input.start) this.restart();
      return;
    }
    if (input.pause) {
      this.togglePause();
      return;
    }
    if (this.phase === "paused") {
      if (input.restart) this.restart();
      return;
    }

    if (this.clearLeft > 0) {
      this.clearLeft -= dt;
      this.clearProgress = 1 - Math.max(0, this.clearLeft) / CLEAR_TIME;
      if (this.clearLeft <= 0) this.finishClear();
      return;
    }

    const piece = this.active;
    if (!piece) return;

    if (input.hold) this.tryHold();
    if (input.rotCW) this.tryRotate(1);
    if (input.rotCCW) this.tryRotate(-1);
    this.handleShift(dt, input);

    if (input.hard) {
      this.hardDrop();
      return;
    }

    const interval = input.soft ? Math.min(SOFT_INTERVAL, dropInterval(this.level) / 8) : dropInterval(this.level);
    this.dropAcc += dt * 1000;
    let softMoved = false;
    while (this.dropAcc >= interval && this.active) {
      this.dropAcc -= interval;
      const moved = this.tryDown();
      if (moved && input.soft) {
        this.addScore(SOFT_DROP_SCORE);
        softMoved = true;
      }
      if (!moved) break;
    }
    if (softMoved) this.events.push({ type: "soft" });

    this.updateLock(dt, input.soft);
  }

  private resetRun() {
    this.board = emptyBoard();
    this.bag = new SevenBag();
    this.active = null;
    this.hold = null;
    this.holdLocked = false;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = 0;
    this.backToBack = false;
    this.clearingRows = [];
    this.clearProgress = 0;
    this.clearLeft = 0;
    this.dropAcc = 0;
    this.lockAcc = 0;
    this.lockResets = 0;
    this.grounded = false;
    this.dasDir = 0;
    this.dasCharged = false;
    this.serial = 1;
  }

  private spawn(id?: PieceId) {
    const pieceId = id ?? this.bag.pull();
    const piece: ActivePiece = {
      id: pieceId,
      rot: 0,
      x: SPAWN_X,
      y: SPAWN_Y,
      serial: this.serial++,
    };
    if (!fits(this.board, piece.id, piece.rot, piece.x, piece.y)) {
      this.active = null;
      this.phase = "over";
      this.commitHigh();
      this.events.push({ type: "over" });
      return;
    }
    this.active = piece;
    this.holdLocked = id ? true : false;
    if (!id) this.holdLocked = false;
    this.dropAcc = 0;
    this.lockAcc = 0;
    this.lockResets = 0;
    this.grounded = !fits(this.board, piece.id, piece.rot, piece.x, piece.y + 1);
    this.events.push({ type: "spawn" });
  }

  private tryHold() {
    const piece = this.active;
    if (!piece || this.holdLocked) return;
    const previous = this.hold;
    this.hold = piece.id;
    this.events.push({ type: "hold" });
    if (previous) {
      this.holdLocked = true;
      const next: ActivePiece = {
        id: previous,
        rot: 0,
        x: SPAWN_X,
        y: SPAWN_Y,
        serial: this.serial++,
      };
      if (!fits(this.board, next.id, next.rot, next.x, next.y)) {
        this.active = null;
        this.phase = "over";
        this.commitHigh();
        this.events.push({ type: "over" });
        return;
      }
      this.active = next;
      this.dropAcc = 0;
      this.lockAcc = 0;
      this.lockResets = 0;
      this.grounded = !fits(this.board, next.id, next.rot, next.x, next.y + 1);
    } else {
      this.holdLocked = true;
      this.spawn();
      this.holdLocked = true;
    }
  }

  private tryRotate(dir: 1 | -1) {
    const piece = this.active;
    if (!piece || piece.id === "O") {
      if (piece?.id === "O") this.events.push({ type: "rotate" });
      return;
    }
    const nextRot = (piece.rot + dir + 4) % 4;
    for (const [kx, ky] of kicksFor(piece.id, piece.rot, dir)) {
      if (fits(this.board, piece.id, nextRot, piece.x + kx, piece.y + ky)) {
        piece.rot = nextRot;
        piece.x += kx;
        piece.y += ky;
        this.onManipulate();
        this.events.push({ type: "rotate" });
        return;
      }
    }
  }

  private handleShift(dt: number, input: InputFrame) {
    const dir = input.left === input.right ? 0 : input.left ? -1 : 1;
    if (dir === 0) {
      this.dasDir = 0;
      this.dasCharged = false;
      this.dasTimer = 0;
      return;
    }
    if (dir !== this.dasDir) {
      this.dasDir = dir;
      this.dasCharged = false;
      this.dasTimer = 0;
      this.tryShift(dir);
      return;
    }
    this.dasTimer += dt;
    const limit = this.dasCharged ? ARR : DAS;
    if (this.dasTimer >= limit) {
      this.dasTimer = 0;
      this.dasCharged = true;
      this.tryShift(dir);
    }
  }

  private tryShift(dir: number) {
    const piece = this.active;
    if (!piece) return;
    if (fits(this.board, piece.id, piece.rot, piece.x + dir, piece.y)) {
      piece.x += dir;
      this.onManipulate();
      this.events.push({ type: "move" });
    }
  }

  private tryDown(): boolean {
    const piece = this.active;
    if (!piece) return false;
    if (!fits(this.board, piece.id, piece.rot, piece.x, piece.y + 1)) {
      this.grounded = true;
      return false;
    }
    piece.y += 1;
    this.grounded = !fits(this.board, piece.id, piece.rot, piece.x, piece.y + 1);
    this.lockAcc = 0;
    return true;
  }

  private updateLock(dt: number, soft: boolean) {
    const piece = this.active;
    if (!piece) return;
    const onGround = !fits(this.board, piece.id, piece.rot, piece.x, piece.y + 1);
    if (!onGround) {
      this.grounded = false;
      this.lockAcc = 0;
      return;
    }
    this.grounded = true;
    this.lockAcc += soft ? dt * 8 : dt;
    if (this.lockAcc >= LOCK_DELAY) this.lockPiece(false);
  }

  private onManipulate() {
    const piece = this.active;
    if (!piece) return;
    const onGround = !fits(this.board, piece.id, piece.rot, piece.x, piece.y + 1);
    if (onGround && this.grounded && this.lockResets < MAX_LOCK_RESETS) {
      this.lockAcc = 0;
      this.lockResets++;
    }
    this.grounded = onGround;
  }

  private hardDrop() {
    const piece = this.active;
    if (!piece) return;
    const gy = ghostY(this.board, piece.id, piece.rot, piece.x, piece.y);
    const distance = gy - piece.y;
    piece.y = gy;
    if (distance > 0) this.addScore(distance * HARD_DROP_SCORE);
    const cells = this.pieceCells(piece);
    this.events.push({ type: "hard-drop", distance, cells });
    this.lockPiece(true);
  }

  private lockPiece(fromHard: boolean) {
    const piece = this.active;
    if (!piece) return;
    const cells = this.pieceCells(piece);
    let above = false;
    for (const cell of cells) {
      if (cell.y < 0) {
        above = true;
        continue;
      }
      this.board[cell.y][cell.x] = PIECE_INDEX[cell.id];
    }
    this.active = null;
    if (!fromHard) this.events.push({ type: "lock", cells });

    if (above) {
      this.phase = "over";
      this.commitHigh();
      this.events.push({ type: "over" });
      return;
    }

    const rows = fullRows(this.board);
    if (rows.length === 0) {
      this.combo = 0;
      this.spawn();
      return;
    }

    const clearCells: CellPos[] = [];
    for (const y of rows) {
      for (let x = 0; x < this.board[y].length; x++) {
        const id = INDEX_PIECE[this.board[y][x]];
        if (id) clearCells.push({ x, y, id });
      }
    }

    const wasB2B = this.backToBack;
    const difficult = rows.length === 4;
    const b2b = difficult && wasB2B;
    const chain = this.combo + 1;
    const gain =
      lineClearScore(rows.length, this.level, b2b) + comboBonus(chain, this.level);
    this.combo = chain;
    this.backToBack = difficult;
    this.addScore(gain);
    this.clearingRows = rows;
    this.clearLeft = CLEAR_TIME;
    this.clearProgress = 0;
    this.events.push({
      type: "clear",
      rows,
      cells: clearCells,
      lines: rows.length,
      combo: chain,
      backToBack: b2b,
      perfect: false,
      scoreGain: gain,
    });
  }

  private finishClear() {
    const rows = this.clearingRows;
    const count = rows.length;
    this.board = collapseRows(this.board, rows);
    this.clearingRows = [];
    this.clearProgress = 0;
    this.clearLeft = 0;
    const prevLevel = this.level;
    this.lines += count;
    this.level = 1 + Math.floor(this.lines / LINES_PER_LEVEL);
    if (isPerfect(this.board)) {
      this.addScore(PERFECT_CLEAR_BONUS * this.level);
      this.events.push({
        type: "clear",
        rows: [],
        cells: [],
        lines: count,
        combo: this.combo,
        backToBack: false,
        perfect: true,
        scoreGain: PERFECT_CLEAR_BONUS * this.level,
      });
    }
    if (this.level > prevLevel) this.events.push({ type: "level", level: this.level });
    this.spawn();
  }

  private pieceCells(piece: ActivePiece): CellPos[] {
    return cellsFor(piece.id, piece.rot).map(([cx, cy]) => ({
      x: piece.x + cx,
      y: piece.y + cy,
      id: piece.id,
    }));
  }

  private addScore(amount: number) {
    if (amount <= 0) return;
    this.score += amount;
    this.commitHigh();
  }

  private commitHigh() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(HIGH_KEY, String(this.highScore));
    }
  }
}
