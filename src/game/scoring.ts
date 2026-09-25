export const LINE_NAMES = ["", "SINGLE", "DOUBLE", "TRIPLE", "QUAD"] as const;

const LINE_SCORE = [0, 100, 300, 500, 800];

export function dropInterval(level: number): number {
  const l = Math.min(Math.max(level, 1), 18) - 1;
  const base = 0.8 - l * 0.007;
  return Math.max(45, Math.pow(base, l) * 1000);
}

export function lineClearScore(lines: number, level: number, backToBack: boolean): number {
  const base = (LINE_SCORE[lines] ?? 0) * level;
  if (lines === 4 && backToBack) return Math.round(base * 1.5);
  return base;
}

export function comboBonus(chain: number, level: number): number {
  if (chain <= 1) return 0;
  return 50 * (chain - 1) * level;
}

export const PERFECT_CLEAR_BONUS = 2000;
export const SOFT_DROP_SCORE = 1;
export const HARD_DROP_SCORE = 2;
export const LINES_PER_LEVEL = 10;
