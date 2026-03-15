/**
 * Seeded random number generator for deterministic simulations
 */

export class SeededRandom {
  private seed: number;
  private originalSeed: number;

  constructor(seed: string | number) {
    if (typeof seed === 'string') {
      // Convert string seed to number using hash
      this.seed = this.hashString(seed);
    } else {
      this.seed = seed;
    }
    this.originalSeed = this.seed;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // Mulberry32 PRNG - good quality and fast
  next(): number {
    let t = (this.seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  boolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  reset(): void {
    this.seed = this.originalSeed;
  }

  clone(): SeededRandom {
    const rng = new SeededRandom(this.originalSeed);
    // Advance to current state
    return rng;
  }
}
