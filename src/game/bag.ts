import { PIECE_IDS, type PieceId } from "./types";

export function shuffledBag(rng: () => number = Math.random): PieceId[] {
  const bag = PIECE_IDS.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = bag[i];
    bag[i] = bag[j];
    bag[j] = swap;
  }
  return bag;
}

export class SevenBag {
  private queue: PieceId[] = [];
  private readonly rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  private fill(min: number) {
    while (this.queue.length < min) {
      this.queue.push(...shuffledBag(this.rng));
    }
  }

  pull(): PieceId {
    this.fill(1);
    return this.queue.shift() as PieceId;
  }

  preview(count: number): PieceId[] {
    this.fill(count);
    return this.queue.slice(0, count);
  }
}
