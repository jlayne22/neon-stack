export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  width: number;
  height: number;
  cell: number;
  portrait: boolean;
  board: Rect;
  hold: Rect;
  next: Rect;
  stats: Rect;
  title: Rect;
}

export function computeLayout(width: number, height: number, touch: boolean): Layout {
  const portrait = width < 900 || height > width;
  const pad = portrait ? 12 : 26;
  const touchReserve = touch ? (portrait ? 124 : 92) : 18;
  const titleH = portrait ? 46 : 58;

  if (portrait) {
    const gap = 10;
    const top = pad + titleH;
    const sideH = Math.max(72, Math.min(96, height * 0.11));
    const availW = width - pad * 2;
    const availH = height - top - sideH - gap - touchReserve - pad;
    const cell = Math.max(12, Math.floor(Math.min(availW / 10, availH / 20)));
    const boardW = cell * 10;
    const boardH = cell * 20;
    const boardX = Math.round((width - boardW) / 2);
    const boardY = Math.round(top + sideH + gap);
    const holdW = Math.min(boardW * 0.28, 120);
    return {
      width,
      height,
      cell,
      portrait,
      title: { x: pad, y: pad, w: width - pad * 2, h: titleH },
      hold: { x: boardX, y: top, w: holdW, h: sideH },
      stats: {
        x: boardX + holdW + 8,
        y: top,
        w: boardW - holdW * 2 - 16,
        h: sideH,
      },
      next: { x: boardX + boardW - holdW, y: top, w: holdW, h: sideH },
      board: { x: boardX, y: boardY, w: boardW, h: boardH },
    };
  }

  const gap = 18;
  const sideW = Math.min(210, Math.max(150, width * 0.16));
  const availH = height - pad * 2 - titleH - touchReserve;
  const availW = width - pad * 2 - sideW * 2 - gap * 2;
  const cell = Math.max(14, Math.floor(Math.min(availW / 10, availH / 20)));
  const boardW = cell * 10;
  const boardH = cell * 20;
  const clusterW = sideW + gap + boardW + gap + sideW;
  const left = Math.round((width - clusterW) / 2);
  const boardX = left + sideW + gap;
  const boardY = Math.round(pad + titleH + Math.max(0, (availH - boardH) / 2));
  return {
    width,
    height,
    cell,
    portrait,
    title: { x: left, y: pad, w: clusterW, h: titleH },
    hold: { x: left, y: boardY, w: sideW, h: cell * 5.2 },
    next: { x: boardX + boardW + gap, y: boardY, w: sideW, h: cell * 11.2 },
    stats: {
      x: left,
      y: boardY + cell * 5.2 + 14,
      w: sideW,
      h: boardH - cell * 5.2 - 14,
    },
    board: { x: boardX, y: boardY, w: boardW, h: boardH },
  };
}
