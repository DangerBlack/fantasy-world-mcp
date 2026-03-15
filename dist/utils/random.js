/**
 * Seeded random number generator for deterministic simulations
 */
export class SeededRandom {
    seed;
    originalSeed;
    constructor(seed) {
        if (typeof seed === 'string') {
            // Convert string seed to number using hash
            this.seed = this.hashString(seed);
        }
        else {
            this.seed = seed;
        }
        this.originalSeed = this.seed;
    }
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    // Mulberry32 PRNG - good quality and fast
    next() {
        let t = (this.seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    nextFloat(min, max) {
        return this.next() * (max - min) + min;
    }
    pick(array) {
        return array[this.nextInt(0, array.length - 1)];
    }
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
    boolean(probability = 0.5) {
        return this.next() < probability;
    }
    reset() {
        this.seed = this.originalSeed;
    }
    clone() {
        const rng = new SeededRandom(this.originalSeed);
        // Advance to current state
        return rng;
    }
}
//# sourceMappingURL=random.js.map