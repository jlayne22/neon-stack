export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const n = parseInt(value, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mix(hex: string, target: string, t: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const ch = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
}
