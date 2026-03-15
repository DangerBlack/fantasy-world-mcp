/**
 * Beliefs module
 * Handles religious mechanics and faith-based bonuses
 */

import { Population, Location, DeityDomain } from '../../types';
import { WorldState } from '../../types';
import { SeededRandom } from '../../utils/random';

export class BeliefModule {
  private rng: SeededRandom;

  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  calculateFaithDefenseBonus(world: WorldState, population: Population, location?: Location): number {
    if (!population.dominantBelief) return 0;
    
    const belief = world.beliefs.find(b => b.id === population.dominantBelief);
    if (!belief) return 0;
    
    let bonus = 0;
    
    // Organized religion with war domain gives holy warriors/courage
    if (belief.isOrganized && belief.domains.includes(DeityDomain.WAR)) {
      bonus += 0.15;
    }
    
    // Holy site at location provides divine protection
    if (location && belief.holySites.includes(location.id)) {
      bonus += 0.10;
    }
    
    // High religious tolerance reduces internal conflict
    if (population.religiousTolerance === 'pluralistic') {
      bonus += 0.05;
    }
    
    return Math.min(0.25, bonus); // Max +0.25 defense bonus
  }
}
