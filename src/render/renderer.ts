import { cellsFor } from "../game/pieces";
import { LINE_NAMES } from "../game/scoring";
import { COLORS, INDEX_PIECE, type GameEvent, type PieceId, type Snapshot } from "../game/types";
import { mix, rgba } from "./color";
import { computeLayout, type Layout, type Rect } from "./layout";
import { burst, drawParticles, dust, stepParticles, type Particle } from "./particles";

interface Floater {
  text: string;
  sub?: string;
  x: number;
  y: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface FlashCell {
  t: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private boardLayer: HTMLCanvasElement;
  private glowLayer: HTMLCanvasElement;
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private flashes = new Map<string, FlashCell>();
  private time = 0;
  private shake = 0;
  private quad = 0;
  private flash = 0;
  private blooms: Array<{ x: number; y: number; w: number; h: number; life: number; max: number; color: string }> = [];
  private pulse = 0;
  private visX = 0;
  private visY = 0;
  private visSerial = -1;
  private displayScore = 0;
  private layout: Layout;
  private reduced: boolean;
  private dpr = 1;
  private beams: Array<{ y: number; speed: number; w: number; hue: number }> = [];

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas unavailable");
    this.ctx = ctx;
    this.boardLayer = document.createElement("canvas");
    this.glowLayer = document.createElement("canvas");
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.layout = computeLayout(1, 1, false);
    for (let i = 0; i < 5; i++) {
      this.beams.push({
        y: Math.random(),
        speed: 0.02 + Math.random() * 0.04,
        w: 0.08 + Math.random() * 0.2,
        hue: Math.random() * 40,
      });
    }
  }

  resize(width: number, height: number, touch: boolean) {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.layout = computeLayout(width, height, touch);
    this.boardLayer.width = Math.max(1, Math.floor(this.layout.board.w * this.dpr));
    this.boardLayer.height = Math.max(1, Math.floor(this.layout.board.h * this.dpr));
    this.glowLayer.width = this.boardLayer.width;
    this.glowLayer.height = this.boardLayer.height;
  }

  render(snapshot: Snapshot, events: GameEvent[], dt: number) {
    this.time += dt;
    this.consume(snapshot, events, dt);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.quad = Math.max(0, this.quad - dt);
    this.flash = Math.max(0, this.flash - dt * 1.8);
    for (let i = this.blooms.length - 1; i >= 0; i--) {
      this.blooms[i].life -= dt;
      if (this.blooms[i].life <= 0) this.blooms.splice(i, 1);
    }
    this.pulse = Math.max(0, this.pulse - dt * 0.8);
    stepParticles(this.particles, dt);
    const k = 1 - Math.exp(-8 * dt);
    this.displayScore += (snapshot.score - this.displayScore) * k;

    const ctx = this.ctx;
    const { width, height } = this.layout;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground(ctx, width, height, snapshot);
    this.drawTitle(ctx, snapshot);
    this.drawPanel(ctx, this.layout.hold, "HOLD");
    this.drawPanel(ctx, this.layout.next, "NEXT");
    this.drawPanel(ctx, this.layout.stats, "SCORE");
    this.drawHold(ctx, snapshot);
    this.drawNext(ctx, snapshot);
    this.drawStats(ctx, snapshot);

    const mag = this.shake * this.shake * (this.reduced ? 2 : this.quad > 0 ? 26 : 8);
    const sx = (Math.random() - 0.5) * mag;
    const sy = (Math.random() - 0.5) * mag;
    this.drawBoard(snapshot, dt);
    ctx.save();
    ctx.translate(sx, sy);
    this.blitBoard(ctx, snapshot);
    ctx.restore();
    ctx.save();
    ctx.translate(sx, sy);
    drawParticles(ctx, this.particles);
    ctx.restore();
    this.drawBlooms(ctx);
    this.drawFloaters(ctx, dt);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.22})`;
      ctx.fillRect(0, 0, width, height);
    }
    this.drawVignette(ctx, width, height, snapshot);
  }

  private consume(snapshot: Snapshot, events: GameEvent[], dt: number) {
    const cell = this.layout.cell;
    const board = this.layout.board;
    const centerOf = (x: number, y: number) => ({
      x: board.x + (x + 0.5) * cell,
      y: board.y + (y + 0.5) * cell,
    });

    for (const event of events) {
      if (event.type === "lock" || event.type === "hard-drop") {
        for (const c of event.cells) {
          if (c.y < 0) continue;
          this.flashes.set(`${c.x},${c.y}`, { t: 0.28 });
          const p = centerOf(c.x, c.y + 0.45);
          dust(this.particles, p.x, board.y + (c.y + 1) * cell, COLORS[c.id]);
        }
        this.shake = Math.min(1, this.shake + (event.type === "hard-drop" ? 0.28 : 0.12));
      }
      if (event.type === "hard-drop") {
          this.visY = (snapshot.active?.y ?? event.cells[0]?.y ?? this.visY);
          if (event.distance > 1) {
            for (const c of event.cells) {
              const steps = Math.min(event.distance, 12);
              for (let i = 1; i < steps; i++) {
                const p = centerOf(c.x, c.y - (event.distance * i) / steps);
                burst(this.particles, p.x, p.y, COLORS[c.id], 2, 40);
              }
            }
          }
        }
      if (event.type === "clear") {
        if (event.perfect) {
          this.floaters.push({
            text: "PERFECT",
            sub: "CLEAR",
            x: board.x + board.w / 2,
            y: board.y + board.h * 0.42,
            life: 1.4,
            max: 1.4,
            color: "#fff6c8",
            size: cell * 1.15,
          });
          this.flash = 1;
          this.pulse = 1;
          continue;
        }
        for (const c of event.cells) {
          const p = centerOf(c.x, c.y);
          burst(this.particles, p.x, p.y, COLORS[c.id], event.lines >= 4 ? 16 : 8, event.lines >= 4 ? 280 : 160);
        }
        const name = LINE_NAMES[event.lines] ?? "CLEAR";
        this.floaters.push({
          text: name,
          sub: event.backToBack ? "BACK TO BACK" : event.combo > 1 ? `COMBO x${event.combo}` : `+${event.scoreGain}`,
          x: board.x + board.w / 2,
          y: board.y + board.h * 0.38,
          life: 1.15,
          max: 1.15,
          color: event.lines >= 4 ? "#fff1a8" : "#d9fbff",
          size: cell * (event.lines >= 4 ? 1.35 : 1.05),
        });
        const bandTop = Math.min(...event.rows);
        const bandBot = Math.max(...event.rows);
        this.blooms.push({
          x: board.x - 8,
          y: board.y + bandTop * cell,
          w: board.w + 16,
          h: (bandBot - bandTop + 1) * cell,
          life: event.lines >= 4 ? 0.55 : 0.32,
          max: event.lines >= 4 ? 0.55 : 0.32,
          color: event.lines >= 4 ? "#fff6c2" : "#9cf6ff",
        });
        if (event.lines >= 4) {
          this.shake = 1;
          this.quad = 0.42;
          this.flash = 1;
        } else {
          this.shake = Math.min(1, this.shake + 0.16 * event.lines);
          this.flash = Math.min(1, 0.25 + event.lines * 0.18);
        }
        this.pulse = 1;
      }
      if (event.type === "level") {
        this.floaters.push({
          text: `LEVEL ${event.level}`,
          x: board.x + board.w / 2,
          y: board.y + board.h * 0.22,
          life: 1.2,
          max: 1.2,
          color: "#9cf7ff",
          size: cell * 0.9,
        });
        this.pulse = 1;
        this.flash = 0.45;
      }
    }

    const active = snapshot.active;
    if (!active) return;
    if (active.serial !== this.visSerial) {
      this.visSerial = active.serial;
      this.visX = active.x;
      this.visY = active.y;
      return;
    }
    const follow = 1 - Math.exp(-16 * dt);
    this.visX += (active.x - this.visX) * follow;
    this.visY += (active.y - this.visY) * follow;
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, snap: Snapshot) {
    const g = ctx.createLinearGradient(0, 0, w * 0.2, h);
    g.addColorStop(0, "#14061f");
    g.addColorStop(0.45, "#070314");
    g.addColorStop(1, "#03101c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const t = this.time;
    const orbs = [
      { x: w * (0.2 + Math.sin(t * 0.17) * 0.06), y: h * 0.25, r: w * 0.28, c: "rgba(255, 40, 170, 0.22)" },
      { x: w * (0.78 + Math.cos(t * 0.13) * 0.05), y: h * 0.62, r: w * 0.32, c: "rgba(0, 210, 255, 0.16)" },
      { x: w * 0.5, y: h * (0.85 + Math.sin(t * 0.2) * 0.02), r: w * 0.36, c: "rgba(120, 70, 255, 0.18)" },
    ];
    for (const orb of orbs) {
      const rg = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
      rg.addColorStop(0, orb.c);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.globalAlpha = 0.35 + this.pulse * 0.25;
    ctx.strokeStyle = "rgba(80, 230, 255, 0.25)";
    ctx.lineWidth = 1;
    const horizon = h * 0.42;
    const vanishX = w * 0.5;
    for (let i = 0; i < 16; i++) {
      const p = ((i / 16 + t * 0.08) % 1);
      const y = horizon + Math.pow(p, 1.6) * (h - horizon);
      const spread = (y - horizon) / (h - horizon);
      ctx.globalAlpha = spread * 0.45;
      ctx.beginPath();
      ctx.moveTo(vanishX - spread * w * 0.85, y);
      ctx.lineTo(vanishX + spread * w * 0.85, y);
      ctx.stroke();
    }
    for (let i = -8; i <= 8; i++) {
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.moveTo(vanishX, horizon);
      ctx.lineTo(vanishX + i * w * 0.09, h + 20);
      ctx.stroke();
    }
    ctx.restore();

    for (const beam of this.beams) {
      beam.y = (beam.y + beam.speed * 0.016) % 1;
      const y = beam.y * h;
      const grad = ctx.createLinearGradient(0, y, w, y);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.5, `rgba(80, 220, 255, ${0.05 + snap.danger * 0.05})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, w, 2 + beam.w * 8);
    }
  }

  private drawTitle(ctx: CanvasRenderingContext2D, snap: Snapshot) {
    const { title } = this.layout;
    ctx.save();
    ctx.font = `700 ${this.layout.portrait ? 22 : 30}px Orbitron, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const label = "NEON STACK";
    const gradient = ctx.createLinearGradient(title.x, title.y, title.x + 280, title.y);
    gradient.addColorStop(0, "#9cf6ff");
    gradient.addColorStop(0.5, "#ffffff");
    gradient.addColorStop(1, "#ff8ae2");
    ctx.fillStyle = gradient;
    ctx.shadowColor = "#3df0ff";
    ctx.shadowBlur = 16;
    ctx.fillText(label, title.x, title.y + title.h * 0.45);
    ctx.shadowBlur = 0;
    ctx.textAlign = "right";
    ctx.font = `600 ${this.layout.portrait ? 13 : 16}px Rajdhani, sans-serif`;
    ctx.fillStyle = "rgba(210, 245, 255, 0.8)";
    ctx.fillText(snap.phase === "playing" ? "LIVE" : snap.phase.toUpperCase(), title.x + title.w, title.y + title.h * 0.45);
    ctx.restore();
  }

  private drawPanel(ctx: CanvasRenderingContext2D, rect: Rect, label: string) {
    if (rect.w < 8 || rect.h < 8) return;
    ctx.save();
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 18);
    ctx.fillStyle = "rgba(8, 12, 28, 0.55)";
    ctx.fill();
    const sheen = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    sheen.addColorStop(0, "rgba(255,255,255,0.14)");
    sheen.addColorStop(0.25, "rgba(255,255,255,0.03)");
    sheen.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = sheen;
    ctx.fill();
    ctx.strokeStyle = "rgba(150, 236, 255, 0.38)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = `700 ${this.layout.portrait ? 11 : 13}px Orbitron, sans-serif`;
    ctx.fillStyle = "rgba(190, 236, 255, 0.72)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(label, rect.x + 14, rect.y + 10);
    ctx.restore();
  }

  private drawHold(ctx: CanvasRenderingContext2D, snap: Snapshot) {
    if (!snap.hold) return;
    const rect = this.layout.hold;
    const size = Math.min(rect.w, rect.h) * (this.layout.portrait ? 0.18 : 0.16);
    this.drawMini(ctx, snap.hold, rect.x + rect.w / 2, rect.y + rect.h * 0.62, size, snap.holdLocked ? 0.35 : 1);
  }

  private drawNext(ctx: CanvasRenderingContext2D, snap: Snapshot) {
    const rect = this.layout.next;
    const count = this.layout.portrait ? Math.min(1, snap.queue.length) : Math.min(5, snap.queue.length);
    if (this.layout.portrait) {
      const shown = snap.queue.slice(0, 3);
      const size = Math.min(18, rect.w * 0.16);
      shown.forEach((id, index) => {
        const x = rect.x + rect.w * ((index + 1) / (shown.length + 1));
        this.drawMini(ctx, id, x, rect.y + rect.h * 0.62, size, index === 0 ? 1 : 0.7);
      });
      return;
    }
    const size = rect.w * 0.11;
    snap.queue.slice(0, count).forEach((id, index) => {
      const y = rect.y + 48 + index * (rect.h - 58) / count;
      this.drawMini(ctx, id, rect.x + rect.w / 2, y, size * (index === 0 ? 1.15 : 0.92), index === 0 ? 1 : 0.78);
    });
  }

  private drawStats(ctx: CanvasRenderingContext2D, snap: Snapshot) {
    const rect = this.layout.stats;
    const score = Math.round(this.displayScore).toLocaleString("en-US");
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (this.layout.portrait) {
      ctx.font = "700 28px Rajdhani, sans-serif";
      ctx.fillStyle = "#f4fdff";
      ctx.fillText(score, rect.x + 8, rect.y + 28);
      ctx.font = "600 13px Rajdhani, sans-serif";
      ctx.fillStyle = "rgba(190,230,255,0.75)";
      ctx.fillText(`LV ${snap.level}   ${snap.lines} LINES`, rect.x + 8, rect.y + rect.h - 22);
      ctx.restore();
      return;
    }
    const rows = [
      ["SCORE", score],
      ["BEST", snap.highScore.toLocaleString("en-US")],
      ["LEVEL", String(snap.level)],
      ["LINES", String(snap.lines)],
      ["COMBO", snap.combo > 1 ? `x${snap.combo}` : "—"],
    ];
    rows.forEach((row, i) => {
      const y = rect.y + 42 + i * ((rect.h - 56) / rows.length);
      ctx.font = "600 13px Orbitron, sans-serif";
      ctx.fillStyle = "rgba(170, 214, 230, 0.62)";
      ctx.fillText(row[0], rect.x + 16, y);
      ctx.font = `700 ${i === 0 ? 36 : 26}px Rajdhani, sans-serif`;
      ctx.fillStyle = i === 0 ? "#ffffff" : "#d7f7ff";
      ctx.fillText(row[1], rect.x + 16, y + 16);
    });
    ctx.restore();
  }

  private drawMini(ctx: CanvasRenderingContext2D, id: PieceId, cx: number, cy: number, size: number, alpha: number) {
    const cells = cellsFor(id, 0);
    let minX = 4, minY = 4, maxX = 0, maxY = 0;
    for (const [x, y] of cells) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (const [x, y] of cells) {
      const px = cx + (x - minX - w / 2) * size;
      const py = cy + (y - minY - h / 2) * size;
      drawMino(ctx, px, py, size, COLORS[id], 1);
    }
    ctx.restore();
  }

  private drawBoard(snap: Snapshot, dt: number) {
    const ctx = this.boardLayer.getContext("2d");
    const glow = this.glowLayer.getContext("2d");
    if (!ctx || !glow) return;
    const { cell, board } = this.layout;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    glow.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, board.w, board.h);
    glow.clearRect(0, 0, board.w, board.h);

    ctx.fillStyle = "rgba(4, 8, 20, 0.72)";
    ctx.fillRect(0, 0, board.w, board.h);
    ctx.strokeStyle = "rgba(120, 210, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 1; x < 10; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, board.h);
      ctx.stroke();
    }
    for (let y = 1; y < 20; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(board.w, y * cell + 0.5);
      ctx.stroke();
    }

    const clearing = new Set(snap.clearingRows);
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 10; x++) {
        const id = INDEX_PIECE[snap.board[y][x]];
        if (!id) continue;
        const flash = this.flashes.get(`${x},${y}`);
        if (flash) {
          flash.t -= dt;
          if (flash.t <= 0) this.flashes.delete(`${x},${y}`);
        }
        const progress = clearing.has(y) ? snap.clearProgress : 0;
        const scale = 1 - progress * 0.85;
        const px = x * cell + (cell * (1 - scale)) / 2;
        const py = y * cell + cell * (1 - scale) * 0.5;
        const color = progress > 0 ? mix(COLORS[id], "#ffffff", progress) : COLORS[id];
        if (progress < 0.98) {
          stampGlow(glow, px, py, cell * scale, color);
          drawMino(ctx, px, py, cell * scale, color, 1 - progress * 0.2);
          if (flash && flash.t > 0) {
            ctx.save();
            ctx.globalAlpha = flash.t / 0.28;
            drawMino(ctx, px, py, cell * scale, "#ffffff", 0.8);
            ctx.restore();
          }
        }
      }
    }

    const active = snap.active;
    if (active && snap.phase !== "over") {
      const drawY = this.visY;
      const drawX = this.visX;
      if (snap.ghostY > active.y + 0.2) {
        for (const [cx, cy] of cellsFor(active.id, active.rot)) {
          const x = active.x + cx;
          const y = snap.ghostY + cy;
          if (y < 0) continue;
          drawGhost(ctx, x * cell, y * cell, cell, COLORS[active.id]);
        }
      }
      for (const [cx, cy] of cellsFor(active.id, active.rot)) {
        const x = drawX + cx;
        const y = drawY + cy;
        if (y < -1) continue;
        stampGlow(glow, x * cell, y * cell, cell, COLORS[active.id]);
        drawMino(ctx, x * cell, y * cell, cell, COLORS[active.id], 1);
      }
    }

    const bctx = ctx;
    bctx.save();
    bctx.globalCompositeOperation = "lighter";
    bctx.globalAlpha = 0.75;
    bctx.filter = "blur(14px)";
    bctx.drawImage(this.glowLayer, 0, 0, board.w, board.h);
    bctx.restore();
  }

  private blitBoard(ctx: CanvasRenderingContext2D, snap: Snapshot) {
    const { board } = this.layout;
    ctx.save();
    rounded(ctx, board.x - 8, board.y - 8, board.w + 16, board.h + 16, 22);
    const hue = 185 + Math.sin(this.time * 1.4) * 28 + this.pulse * 40;
    ctx.strokeStyle = snap.danger > 0.72 ? `rgba(255, 70, 110, ${0.45 + Math.sin(this.time * 6) * 0.25})` : `hsla(${hue}, 100%, 70%, 0.85)`;
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 18 + this.pulse * 16;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(2, 6, 16, 0.35)";
    ctx.fill();
    rounded(ctx, board.x, board.y, board.w, board.h, 10);
    ctx.clip();
    ctx.drawImage(this.boardLayer, board.x, board.y, board.w, board.h);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.translate(board.x, board.y + board.h + 8);
    ctx.scale(1, -0.22);
    rounded(ctx, 0, 0, board.w, board.h, 10);
    ctx.clip();
    ctx.drawImage(this.boardLayer, 0, 0, board.w, board.h);
    ctx.restore();
  }

  private drawBlooms(ctx: CanvasRenderingContext2D) {
    if (this.blooms.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const bloom of this.blooms) {
      const t = Math.max(0, bloom.life / bloom.max);
      const grad = ctx.createLinearGradient(bloom.x, bloom.y, bloom.x, bloom.y + bloom.h);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, bloom.color);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalAlpha = t * 0.85;
      ctx.fillStyle = grad;
      ctx.fillRect(bloom.x, bloom.y - bloom.h * 0.35, bloom.w, bloom.h * 1.7);
      ctx.shadowColor = bloom.color;
      ctx.shadowBlur = 28;
      ctx.fillRect(bloom.x, bloom.y, bloom.w, Math.max(2, bloom.h * t));
    }
    ctx.restore();
  }

  private drawFloaters(ctx: CanvasRenderingContext2D, dt: number) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.floaters.splice(i, 1);
        continue;
      }
      const t = f.life / f.max;
      const rise = (1 - t) * 36;
      const pop = Math.min(1, (1 - t) * 6);
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.4);
      ctx.translate(f.x, f.y - rise);
      ctx.scale(0.7 + pop * 0.3, 0.7 + pop * 0.3);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${f.size}px Orbitron, sans-serif`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(4, 8, 20, 0.65)";
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 18;
      ctx.fillText(f.text, 0, 0);
      if (f.sub) {
        ctx.font = `700 ${f.size * 0.38}px Rajdhani, sans-serif`;
        ctx.shadowBlur = 10;
        ctx.fillText(f.sub, 0, f.size * 0.62);
      }
      ctx.restore();
    }
  }

  private drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, snap: Snapshot) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (snap.danger > 0.7 && snap.phase === "playing") {
      const a = (snap.danger - 0.7) * (0.35 + Math.sin(this.time * 6) * 0.15);
      ctx.fillStyle = `rgba(255, 30, 70, ${a})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawMino(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  const m = Math.max(1, size * 0.08);
  const rx = x + m;
  const ry = y + m;
  const w = size - m * 2;
  const h = size - m * 2;
  if (w <= 1 || h <= 1) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  rounded(ctx, rx, ry, w, h, size * 0.16);
  const body = ctx.createLinearGradient(rx, ry, rx, ry + h);
  body.addColorStop(0, mix(color, "#ffffff", 0.55));
  body.addColorStop(0.45, color);
  body.addColorStop(1, mix(color, "#140814", 0.45));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = rgba("#ffffff", 0.45);
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.stroke();
  rounded(ctx, rx + w * 0.16, ry + h * 0.1, w * 0.68, h * 0.22, size * 0.08);
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.fill();
  ctx.restore();
}

function drawGhost(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const m = size * 0.12;
  ctx.save();
  rounded(ctx, x + m, y + m, size - m * 2, size - m * 2, size * 0.14);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.45;
  ctx.stroke();
  ctx.restore();
}

function stampGlow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const m = size * 0.16;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  rounded(ctx, x + m, y + m, size - m * 2, size - m * 2, size * 0.12);
  ctx.fill();
  ctx.restore();
}
