/**
 * Race Trait System
 * 
 * Provides trait definitions for different races and utilities for trait-based logic.
 * Replaces hardcoded race checks with a flexible, extensible trait system.
 */

import { DeityDomain, Population, PopulationTraits } from '../types';

/**
 * Default trait presets for common races
 * These can be extended or overridden per-population
 */
const RACE_TRAIT_PRESETS: Record<string, PopulationTraits> = {
  // Civilizations
  human: {
    isMonstrous: false,
    canCraft: true,
    canQuest: true,
    canBelieve: true,
    baseTechLevel: 2,
    aggression: 0.3,
    raidFrequency: 0,
    populationGrowth: 0.5,
    defaultBeliefType: 'pantheon',
    preferredDomains: [DeityDomain.WAR, DeityDomain.LOVE, DeityDomain.KNOWLEDGE],
    toleranceDefault: 'tolerant',
    organizationDefault: 'feudal',
    dangerLevelDefault: 1,
    behaviorDefault: 'territorial',
  },
  
  dwarf: {
    isMonstrous: false,
    canCraft: true,
    canQuest: true,
    canBelieve: true,
    baseTechLevel: 3,
    aggression: 0.4,
    raidFrequency: 0,
    populationGrowth: 0.3,
    defaultBeliefType: 'monotheism',
    preferredDomains: [DeityDomain.FORTRESS, DeityDomain.WAR, DeityDomain.TRADE],
    toleranceDefault: 'tolerant',
    organizationDefault: 'feudal',
    dangerLevelDefault: 2,
    behaviorDefault: 'territorial',
  },
  
  elf: {
    isMonstrous: false,
    canCraft: true,
    canQuest: true,
    canBelieve: true,
    baseTechLevel: 2,
    aggression: 0.2,
    raidFrequency: 0,
    populationGrowth: 0.2,
    defaultBeliefType: 'animism',
    preferredDomains: [DeityDomain.NATURE, DeityDomain.KNOWLEDGE, DeityDomain.HEALING],
    toleranceDefault: 'pluralistic',
    organizationDefault: 'tribal',
    dangerLevelDefault: 1,
    behaviorDefault: 'territorial',
  },
  
  orc: {
    isMonstrous: false,
    canCraft: true,
    canQuest: true,
    canBelieve: true,
    baseTechLevel: 2,
    aggression: 0.6,
    raidFrequency: 0,
    populationGrowth: 0.7,
    defaultBeliefType: 'cult',
    preferredDomains: [DeityDomain.WAR, DeityDomain.FIRE, DeityDomain.DEATH],
    toleranceDefault: 'intolerant',
    organizationDefault: 'tribal',
    dangerLevelDefault: 3,
    behaviorDefault: 'aggressive',
  },
  
  goblin: {
    isMonstrous: false,
    canCraft: true,
    canQuest: true,
    canBelieve: true,
    baseTechLevel: 1,
    aggression: 0.5,
    raidFrequency: 0.2,
    populationGrowth: 0.8,
    defaultBeliefType: 'cult',
    preferredDomains: [DeityDomain.TRICKERY, DeityDomain.KNOWLEDGE, DeityDomain.WAR],
    toleranceDefault: 'tolerant',
    organizationDefault: 'tribal',
    dangerLevelDefault: 2,
    behaviorDefault: 'aggressive',
  },
  
  halfling: {
    isMonstrous: false,
    canCraft: true,
    canQuest: true,
    canBelieve: true,
    baseTechLevel: 2,
    aggression: 0.1,
    raidFrequency: 0,
    populationGrowth: 0.6,
    defaultBeliefType: 'folk',
    preferredDomains: [DeityDomain.LOVE, DeityDomain.NATURE, DeityDomain.TRADE],
    toleranceDefault: 'tolerant',
    organizationDefault: 'tribal',
    dangerLevelDefault: 1,
    behaviorDefault: 'territorial',
  },
  
  dragonborn: {
    isMonstrous: false,
    canCraft: true,
    canQuest: true,
    canBelieve: true,
    baseTechLevel: 3,
    aggression: 0.5,
    raidFrequency: 0,
    populationGrowth: 0.3,
    defaultBeliefType: 'monotheism',
    preferredDomains: [DeityDomain.FIRE, DeityDomain.WAR, DeityDomain.SKY],
    toleranceDefault: 'tolerant',
    organizationDefault: 'feudal',
    dangerLevelDefault: 4,
    behaviorDefault: 'territorial',
  },
  
  tiefling: {
    isMonstrous: false,
    canCraft: true,
    canQuest: true,
    canBelieve: true,
    baseTechLevel: 2,
    aggression: 0.4,
    raidFrequency: 0,
    populationGrowth: 0.4,
    defaultBeliefType: 'philosophy',
    preferredDomains: [DeityDomain.KNOWLEDGE, DeityDomain.DARKNESS, DeityDomain.DEATH],
    toleranceDefault: 'pluralistic',
    organizationDefault: 'feudal',
    dangerLevelDefault: 2,
    behaviorDefault: 'hiding',
  },
  
  // Monsters
  monster: {
    isMonstrous: true,
    canCraft: false,
    canQuest: false,
    canBelieve: false,
    baseTechLevel: 0,
    aggression: 0.8,
    raidFrequency: 0.5,
    populationGrowth: 0.6,
    defaultBeliefType: 'cult',
    preferredDomains: [DeityDomain.DEATH, DeityDomain.WAR],
    toleranceDefault: 'intolerant',
    organizationDefault: 'tribal',
    dangerLevelDefault: 5,
    behaviorDefault: 'aggressive',
  },
};

/**
 * Get traits for a race, with custom overrides
 * 
 * @param race - Race name (e.g., 'human', 'dwarf', 'starforged')
 * @param customTraits - Optional custom trait overrides
 * @returns Complete trait set with defaults and overrides applied
 */
export function getRaceTraits(
  race: string,
  customTraits?: Partial<PopulationTraits>
): PopulationTraits {
  // Get base preset (or use monster defaults if unknown race)
  const basePreset = RACE_TRAIT_PRESETS[race.toLowerCase()] || 
                     RACE_TRAIT_PRESETS['monster'];
  
  // Merge with custom overrides
  return {
    ...basePreset,
    ...customTraits,
    // Deep merge for arrays
    preferredDomains: customTraits?.preferredDomains || basePreset.preferredDomains,
  };
}

/**
 * Check if a population is monstrous (cannot craft, quest, or believe)
 * 
 * @param population - The population to check
 * @returns true if the population is treated as monstrous
 */
export function isMonstrous(population: Population): boolean {
  // Use explicit traits if available, otherwise check race name
  if (population.traits) {
    return population.traits.isMonstrous ?? 
           getRaceTraits(population.race).isMonstrous;
  }
  
  // Legacy check: race === 'monster' or has monsterType
  return population.race === 'monster' || !!population.monsterType;
}

/**
 * Get the effective technology level for a population
 * 
 * @param population - The population
 * @returns The effective tech level (from traits or legacy field)
 */
export function getTechLevel(population: Population): number {
  if (population.traits?.baseTechLevel !== undefined) {
    return population.traits.baseTechLevel;
  }
  // Legacy fallback
  return population.technologyLevel || (isMonstrous(population) ? 0 : 2);
}

/**
 * Check if a population can create crafts
 * 
 * @param population - The population to check
 * @returns true if the population can craft
 */
export function canCraft(population: Population): boolean {
  if (population.traits?.canCraft !== undefined) {
    return population.traits.canCraft;
  }
  return !isMonstrous(population);
}

/**
 * Check if a population can generate/undertake quests
 * 
 * @param population - The population to check
 * @returns true if the population can quest
 */
export function canQuest(population: Population): boolean {
  if (population.traits?.canQuest !== undefined) {
    return population.traits.canQuest;
  }
  return !isMonstrous(population);
}

/**
 * Check if a population can have belief systems
 * 
 * @param population - The population to check
 * @returns true if the population can believe
 */
export function canBelieve(population: Population): boolean {
  if (population.traits?.canBelieve !== undefined) {
    return population.traits.canBelieve;
  }
  return !isMonstrous(population);
}

/**
 * Get the default belief type for a population
 * 
 * @param population - The population
 * @returns The default belief type
 */
export function getDefaultBeliefType(population: Population): PopulationTraits['defaultBeliefType'] {
  if (population.traits?.defaultBeliefType) {
    return population.traits.defaultBeliefType;
  }
  return getRaceTraits(population.race).defaultBeliefType;
}

/**
 * Get preferred deity domains for a population
 * 
 * @param population - The population
 * @returns Array of preferred domains
 */
export function getPreferredDomains(population: Population): DeityDomain[] {
  if (population.traits?.preferredDomains) {
    return population.traits.preferredDomains;
  }
  return getRaceTraits(population.race).preferredDomains;
}

/**
 * Get the default tolerance level for a population
 * 
 * @param population - The population
 * @returns The default tolerance level
 */
export function getDefaultTolerance(population: Population): PopulationTraits['toleranceDefault'] {
  if (population.traits?.toleranceDefault) {
    return population.traits.toleranceDefault;
  }
  return getRaceTraits(population.race).toleranceDefault;
}

/**
 * Get the aggression level for a population (0-1)
 * 
 * @param population - The population
 * @returns Aggression level
 */
export function getAggression(population: Population): number {
  if (population.traits?.aggression !== undefined) {
    return population.traits.aggression;
  }
  return getRaceTraits(population.race).aggression;
}

/**
 * Get the raid frequency for a population (0-1)
 * 
 * @param population - The population
 * @returns Raid frequency
 */
export function getRaidFrequency(population: Population): number {
  if (population.traits?.raidFrequency !== undefined) {
    return population.traits.raidFrequency;
  }
  return getRaceTraits(population.race).raidFrequency;
}

/**
 * Get the default danger level for a population
 * 
 * @param population - The population
 * @returns Danger level (1-10)
 */
export function getDangerLevel(population: Population): number {
  if (population.traits?.dangerLevelDefault !== undefined) {
    return population.traits.dangerLevelDefault;
  }
  if (population.dangerLevel) {
    return population.dangerLevel;
  }
  return getRaceTraits(population.race).dangerLevelDefault;
}

/**
 * Register a new race trait preset
 * 
 * @param race - Race name
 * @param traits - Trait preset to register
 */
export function registerRacePreset(race: string, traits: PopulationTraits): void {
  RACE_TRAIT_PRESETS[race.toLowerCase()] = traits;
}

/**
 * Get all registered race presets
 */
export function getRegisteredRaces(): string[] {
  return Object.keys(RACE_TRAIT_PRESETS);
}
