// Deterministic Seedable PRNG (Mulberry32) with Serializable State & Unbiased Fisher-Yates Shuffle
export class SeededRng {
  public state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0 || 0x6d2b79f5;
  }

  public nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Inclusive integer in [min, max]
  public intInclusive(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }

  // Unbiased Fisher-Yates shuffle: j in [0..i] inclusive!
  public shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.intInclusive(0, i);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  public pick<T>(arr: readonly T[]): T {
    return arr[this.intInclusive(0, arr.length - 1)];
  }
}
