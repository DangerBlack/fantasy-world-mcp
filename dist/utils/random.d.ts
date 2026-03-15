/**
 * Seeded random number generator for deterministic simulations
 */
export declare class SeededRandom {
    private seed;
    private originalSeed;
    constructor(seed: string | number);
    private hashString;
    next(): number;
    nextInt(min: number, max: number): number;
    nextFloat(min: number, max: number): number;
    pick<T>(array: T[]): T;
    shuffle<T>(array: T[]): T[];
    boolean(probability?: number): boolean;
    reset(): void;
    clone(): SeededRandom;
}
//# sourceMappingURL=random.d.ts.map