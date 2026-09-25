import { rgba } from "./color";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  gravity: number;
  drag: number;
  kind: "spark" | "shard" | "dust" | "star";
}

export function burst(
  list: Particle[],
  x: number,
  y: number,
  color: string,
  count: number,
  power: number,
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = power * (0.35 + Math.random() * 0.85);
    const max = 0.4 + Math.random() * 0.55;
    list.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - power * 0.25,
      life: max,
      max,
      size: 2 + Math.random() * 5,
      color,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 10,
      gravity: 520 + Math.random() * 200,
      drag: 0.35,
      kind: Math.random() > 0.55 ? "shard" : Math.random() > 0.5 ? "star" : "spark",
    });
  }
}

export function dust(list: Particle[], x: number, y: number, color: string) {
  for (let i = 0; i < 8; i++) {
    const max = 0.25 + Math.random() * 0.25;
    list.push({
      x: x + (Math.random() - 0.5) * 10,
      y,
      vx: (Math.random() - 0.5) * 90,
      vy: -20 - Math.random() * 70,
      life: max,
      max,
      size: 2 + Math.random() * 3,
      color,
      rot: 0,
      vr: 0,
      gravity: 180,
      drag: 2.4,
      kind: "dust",
    });
  }
}

export function stepParticles(list: Particle[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.vx *= Math.max(0, 1 - p.drag * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  if (list.length > 480) list.splice(0, list.length - 480);
}

export function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of list) {
    const t = Math.max(0, p.life / p.max);
    ctx.globalAlpha = t;
    ctx.fillStyle = p.color;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.kind === "spark") {
      ctx.fillStyle = rgba(p.color, t);
      ctx.fillRect(-p.size * 1.8, -1.1, p.size * 3.6, 2.2);
    } else if (p.kind === "star") {
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = t;
      ctx.fillRect(-p.size * 0.3, -p.size, p.size * 0.6, p.size * 2);
      ctx.fillRect(-p.size, -p.size * 0.3, p.size * 2, p.size * 0.6);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.72);
    }
    ctx.restore();
  }
  ctx.restore();
}
