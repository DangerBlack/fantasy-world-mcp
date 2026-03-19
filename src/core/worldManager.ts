/**
 * Core world state management
 */

import { generateWorldId, generatePopulationId, generateLocationId, generateEventId, generateBeliefId } from '../utils/idGenerator';
import { SeededRandom } from '../utils/random';
import { getRaceTraits, isMonstrous, getDefaultBeliefType, getPreferredDomains, getDefaultTolerance } from '../utils/raceTraits';
import {
  WorldState,
  Event,
  EventId,
  Location,
  LocationId,
  GeographyLayer,
  SocietyLayer,
  Population,
  InitialConditions,
  EventType,
  LocationType,
  TerrainType,
  Resource,
  Change,
  Timeline,
  MonsterType,
  MonsterBehavior,
  Belief,
  BeliefType,
  DeityDomain,
} from '../types';
import { WorldPersistence } from './worldPersistence';

export class WorldManager {
  private worlds: Map<string, WorldState> = new Map();
  private rng: SeededRandom;
  private persistence: WorldPersistence;
  private autoSaveEnabled: boolean;

  constructor(seed: string, autoSave: boolean = true) {
    this.rng = new SeededRandom(seed);
    this.persistence = new WorldPersistence();
    this.autoSaveEnabled = autoSave;
    this.initializePersistence();
  }

  private async initializePersistence(): Promise<void> {
    await this.persistence.initialize();
    
    // Load all saved worlds on startup
    const savedWorlds = await this.persistence.loadAllWorlds();
    for (const [worldId, world] of savedWorlds) {
      this.worlds.set(worldId, world);
    }
  }

  private async autoSave(world: WorldState): Promise<void> {
    if (this.autoSaveEnabled) {
      await this.persistence.saveWorld(world);
    }
  }

  async createWorld(conditions: InitialConditions): Promise<WorldState> {
    const worldId = generateWorldId();
    const seed = this.rng.next().toString(36);

    const initialGeography: GeographyLayer = {
      terrain: conditions.region,
      climate: conditions.climate,
      resources: this.initializeResources(conditions.resources),
      features: this.generateInitialFeatures(conditions),
      modifications: [],
    };

    // Support single population or array of populations
    const populationsArray = Array.isArray(conditions.population) 
      ? conditions.population 
      : [conditions.population];

    const initialPopulations: Population[] = populationsArray.map((pop, index) => {
      const race = pop.race || 'human';
      const traits = getRaceTraits(race, pop.traits);
      
      return {
        id: generatePopulationId(),
        name: pop.name,
        race: race,
        size: pop.size,
        culture: pop.culture,
        traits: traits, // Store complete merged traits (defaults + custom overrides)
        technologyLevel: traits.baseTechLevel, // Use trait-based tech level
        organization: pop.organization || traits.organizationDefault,
        beliefs: [],
        religiousTolerance: 'tolerant', // Will be set by generateReligiousTolerance
        relations: {},
        crafts: [],
      };
    });

    // Create initial location(s) - one per population or shared
    const initialLocations: Location[] = [];
    
    if (populationsArray.length === 1) {
      // Single population - shared location
      const initialLocation: Location = {
        id: generateLocationId(),
        type: conditions.locationType,
        name: this.generateLocationName(conditions.locationType, conditions.region),
        description: conditions.event,
        geography: {},
        inhabitants: [initialPopulations[0].id],
        history: [],
        features: [],
        connections: [],
        dangerLevel: 0,
        complexity: 1,
      };
      initialLocations.push(initialLocation);
    } else {
      // Multiple populations - each gets their own starting location near the main event
      populationsArray.forEach((pop, index) => {
        const location: Location = {
          id: generateLocationId(),
          type: index === 0 ? conditions.locationType : conditions.locationType,
          name: this.generateLocationName(conditions.locationType, conditions.region, pop.race),
          description: `${pop.name} settle near ${conditions.event}`,
          geography: {},
          inhabitants: [initialPopulations[index].id],
          history: [],
          features: [],
          connections: initialLocations.map(l => l.id),
          dangerLevel: 0,
          complexity: 1,
        };
        initialLocations.push(location);
      });
    }

    // Create initial events for each population
    const initialEvents: Event[] = [
      {
        id: generateEventId(),
        year: 0,
        type: EventType.NATURAL,
        title: 'Beginning',
        description: conditions.event,
        causes: [],
        effects: initialPopulations.map((_, i) => initialLocations[i]?.id).filter(Boolean) as string[],
        location: initialLocations[0]?.id,
        impact: {
          society: [{
            type: 'create',
            target: initialPopulations.map(p => `${p.race} ${p.name}`).join(', '),
            description: `${initialPopulations.map(p => `${p.size} ${p.race} ${p.name}`).join(', ')} arrive`,
          }],
        },
      },
    ];

    // Set up inter-population relations
    if (initialPopulations.length > 1) {
      for (let i = 0; i < initialPopulations.length; i++) {
        for (let j = i + 1; j < initialPopulations.length; j++) {
          const pop1 = initialPopulations[i];
          const pop2 = initialPopulations[j];
          
          // Monsters are naturally hostile to civilizations
          if (isMonstrous(pop1)) {
            pop1.relations[pop2.id] = 'hostile';
            pop2.relations[pop1.id] = 'hostile';
          } else if (isMonstrous(pop2)) {
            pop1.relations[pop2.id] = 'hostile';
            pop2.relations[pop1.id] = 'hostile';
          } else {
            pop1.relations[pop2.id] = 'neutral';
            pop2.relations[pop1.id] = 'neutral';
          }
        }
      }
    }

    // Add monster populations if enabled
    if (conditions.enableMonsters !== false && conditions.monsterCount && conditions.monsterCount > 0) {
      const monsterLocations = initialLocations.filter(l => l.type === LocationType.CAVE || l.type === LocationType.DUNGEON || l.type === LocationType.RUINS);
      const lairLocation = monsterLocations.length > 0 ? monsterLocations[0].id : initialLocations[0]?.id;

      for (let i = 0; i < conditions.monsterCount; i++) {
        const monsterTypes = Object.values(MonsterType).filter(t => t !== MonsterType.CUSTOM);
        const monsterType = this.rng.pick(monsterTypes);
        
        const monsterNames: Record<MonsterType, string> = {
          [MonsterType.DRAGON]: 'Dragon Horde',
          [MonsterType.GIANT]: 'Giant Clan',
          [MonsterType.ORC]: 'Orc Warband',
          [MonsterType.GOBLIN]: 'Goblin Tribe',
          [MonsterType.UNDEAD]: 'Undead Legion',
          [MonsterType.BEAST]: 'Beast Pack',
          [MonsterType.DEMON]: 'Demon Cult',
          [MonsterType.ABERRATION]: 'Aberration Swarm',
          [MonsterType.FAE]: 'Fae Court',
          [MonsterType.CUSTOM]: 'Monster Clan',
        };

        const monsterBehaviors = Object.values(MonsterBehavior);
        const behavior = this.rng.pick(monsterBehaviors);

        const monster: Population = {
          id: generatePopulationId(),
          name: monsterNames[monsterType],
          race: 'monster',
          size: 10 + this.rng.nextInt(0, 20),
          culture: `${monsterType} ${behavior}`,
          technologyLevel: 0,
          organization: 'tribal',
          beliefs: [],
          religiousTolerance: 'tolerant',
          relations: {},
          crafts: [],
          monsterType,
          monsterSubtype: `${this.rng.pick(['Ancient', 'Wild', 'Dark', 'Cursed', 'Feral'])} ${monsterType}`,
          dangerLevel: 3 + this.rng.nextInt(0, 6),
          behavior,
          lairLocation,
          raidFrequency: behavior === MonsterBehavior.AGGRESSIVE ? 0.6 : behavior === MonsterBehavior.TERRITORIAL ? 0.4 : 0.2,
          isDormant: behavior === MonsterBehavior.DORMANT,
        };

        initialPopulations.push(monster);
      }
    }

    const world: WorldState = {
      id: worldId,
      seed,
      timestamp: 0,
      geography: initialGeography,
      society: {
        populations: initialPopulations,
        cultures: [...new Set(initialPopulations.map(p => p.culture))],
        technologies: [],
        crafts: [],
        quests: [],
        heroes: [],
        conflicts: [],
        tradeRoutes: [],
      },
      locations: initialLocations,
      events: initialEvents,
      crafts: [],
      quests: [],
      heroes: [],
      beliefs: [],
      timeline: {
        events: initialEvents,
        eras: [{
          name: 'Age of Beginning',
          startYear: 0,
          endYear: 0,
          summary: `The arrival of ${initialPopulations.map(p => p.race === 'monster' ? `${p.monsterSubtype} ${p.name}` : p.race).join(' and ')}`,
        }],
      },
      metadata: {
        createdAt: new Date().toISOString(),
        simulationSteps: 0,
        lastUpdate: new Date().toISOString(),
        ...(conditions.enableMonsters !== false ? { enableMonsters: true } : {}),
      },
    };

    // Generate beliefs for civilization populations
    for (const pop of initialPopulations) {
      if (isMonstrous(pop)) continue;
      
      // 50% chance to generate a belief at start
      if (this.rng.boolean(0.5)) {
        const belief = this.generateBelief(world, pop, 0);
        pop.beliefs.push(belief.id);
        pop.dominantBelief = belief.id;
        pop.religiousTolerance = this.generateReligiousTolerance(pop, belief);
      }
    }

    this.worlds.set(worldId, world);
    await this.autoSave(world);
    return world;
  }

  private generateBelief(world: WorldState, population: Population, year: number): Belief {
    const beliefTypes = Object.values(BeliefType);
    const domains = Object.values(DeityDomain);
    
    // Use trait system for belief type
    const beliefTypeStr = getDefaultBeliefType(population);
    const beliefTypeMap: Record<string, BeliefType> = {
      'pantheon': BeliefType.PANTHEON,
      'monotheism': BeliefType.MONOTHEISM,
      'animism': BeliefType.ANIMISM,
      'philosophy': BeliefType.PHILOSOPHY,
      'cult': BeliefType.CULT,
      'folk': BeliefType.FOLK,
    };
    let beliefType: BeliefType = beliefTypeMap[beliefTypeStr] || BeliefType.PANTHEON;
    
    // For humans, add some randomness
    if (population.race.toLowerCase().includes('human') && !population.traits?.defaultBeliefType) {
      beliefType = this.rng.boolean(0.5) ? BeliefType.PANTHEON : BeliefType.PHILOSOPHY;
    }
    
    // Generate belief name and details
    const beliefNames: Record<BeliefType, string[]> = {
      [BeliefType.PANTHEON]: ['The Pantheon of the Ancients', 'The Divine Circle', 'The Eternal Council'],
      [BeliefType.MONOTHEISM]: ['The One Truth', 'The Eternal Flame', 'The Stone Father', 'The Forest Mother'],
      [BeliefType.ANIMISM]: ['Spirit Ways', 'The Living Land', 'Ancestral Spirits'],
      [BeliefType.PHILOSOPHY]: ['The Path of Balance', 'The Golden Rule', 'The Way of Reason'],
      [BeliefType.CULT]: ['The Strength Doctrine', 'The Blood Oath', 'The Dark Pact'],
      [BeliefType.FOLK]: ['Old Traditions', 'Village Ways', 'Ancestor Honor'],
    };
    
    const name = this.rng.pick(beliefNames[beliefType]);
    
    // Select domains - prefer race-specific domains from traits
    const domainCount = beliefType === BeliefType.PANTHEON ? 3 : beliefType === BeliefType.MONOTHEISM ? 2 : 1;
    const selectedDomains: DeityDomain[] = [];
    const preferredDomains = getPreferredDomains(population);
    const availableDomains = [...domains];
    
    // First, try to select preferred domains
    for (const preferred of preferredDomains) {
      if (selectedDomains.length >= domainCount) break;
      if (availableDomains.includes(preferred)) {
        selectedDomains.push(preferred);
        const idx = availableDomains.indexOf(preferred);
        availableDomains.splice(idx, 1);
      }
    }
    
    // Fill remaining slots with random domains
    for (let i = selectedDomains.length; i < domainCount && availableDomains.length > 0; i++) {
      const idx = this.rng.nextInt(0, availableDomains.length - 1);
      selectedDomains.push(availableDomains[idx]);
      availableDomains.splice(idx, 1);
    }
    
    // Domains are already selected from preferences above, no need for race-specific overrides
    
    const alignment = beliefType === BeliefType.CULT ? (this.rng.boolean(0.6) ? 'evil' : 'chaotic') :
                      beliefType === BeliefType.PHILOSOPHY ? 'neutral' :
                      this.rng.pick(['good', 'neutral', 'lawful'] as const);
    
    const belief: Belief = {
      id: generateBeliefId(),
      type: beliefType,
      name,
      deityName: beliefType === BeliefType.MONOTHEISM ? this.rng.pick(['Thorin', 'Aelindra', 'Gorm', 'Sylvara']) : undefined,
      domains: selectedDomains,
      description: `${name} teaches its followers to ${selectedDomains[0]} above all else.`,
      holySites: [],
      practices: ['daily prayers', 'sacred rituals', 'community gatherings'],
      taboos: ['desecration of holy sites', 'breaking oaths'],
      alignment,
      followers: [population.id],
      foundedYear: year,
      isOrganized: beliefType === BeliefType.PANTHEON || beliefType === BeliefType.MONOTHEISM || beliefType === BeliefType.PHILOSOPHY,
      holyText: beliefType === BeliefType.PHILOSOPHY ? 'The Book of Wisdom' : undefined,
    };
    
    world.beliefs.push(belief);
    return belief;
  }

  private generateReligiousTolerance(population: Population, belief: Belief): 'intolerant' | 'tolerant' | 'pluralistic' {
    // Use trait-based default if available
    if (population.traits?.toleranceDefault) {
      return population.traits.toleranceDefault;
    }
    
    if (belief.alignment === 'evil' || belief.type === BeliefType.CULT) {
      return this.rng.boolean(0.6) ? 'intolerant' : 'tolerant';
    }
    if (belief.type === BeliefType.PHILOSOPHY) {
      return 'pluralistic';
    }
    const defaultTolerance = getDefaultTolerance(population);
    if (defaultTolerance !== 'tolerant') {
      return defaultTolerance;
    }
    return this.rng.pick(['tolerant', 'tolerant', 'pluralistic', 'intolerant'] as const);
  }

  private createTempleLocation(world: WorldState, belief: Belief, population: Population, year: number): Location {
    const location: Location = {
      id: generateLocationId(),
      type: LocationType.TEMPLE,
      name: `${belief.name.split(' ')[0]} ${this.rng.pick(['Temple', 'Sanctuary', 'Shrine', 'Keep'])}`,
      description: `A sacred ${belief.type} dedicated to ${belief.domains[0]}`,
      geography: {},
      inhabitants: [],
      history: [],
      features: ['holy altar', 'prayer chambers', 'sacred relics'],
      connections: world.locations.map(l => l.id),
      dangerLevel: 0,
      complexity: 3,
    };
    
    belief.holySites.push(location.id);
    world.locations.push(location);
    
    // Add temple event
    const event: Event = {
      id: generateEventId(),
      year,
      type: EventType.TEMPLE_BUILT,
      title: `${location.name} Constructed`,
      description: `${population.name} builds a temple to their gods`,
      causes: [],
      effects: [],
      location: location.id,
      impact: {
        society: [{
          type: 'create',
          target: location.name,
          description: `Holy site established for ${belief.name}`,
        }],
      },
    };
    
    world.events.push(event);
    world.timeline.events.push(event);
    
    return location;
  }

  getWorld(worldId: string): WorldState | undefined {
    return this.worlds.get(worldId);
  }

  async updateWorld(worldId: string, world: WorldState): Promise<void> {
    this.worlds.set(worldId, world);
    await this.autoSave(world);
  }

  async deleteWorld(worldId: string): Promise<boolean> {
    this.worlds.delete(worldId);
    return await this.persistence.deleteWorld(worldId);
  }

  async listWorlds(): Promise<string[]> {
    const inMemory = Array.from(this.worlds.keys());
    const onDisk = await this.persistence.listWorlds();
    return [...new Set([...inMemory, ...onDisk])];
  }

  async loadWorld(worldId: string): Promise<WorldState | null> {
    // Check in-memory first
    const inMemory = this.worlds.get(worldId);
    if (inMemory) return inMemory;
    
    // Load from disk
    return await this.persistence.loadWorld(worldId);
  }

  async addPopulation(worldId: string, population: Population): Promise<boolean> {
    const world = this.getWorld(worldId);
    if (!world) return false;

    world.society.populations.push(population);
    
    // Set up relations with existing populations
    for (const existingPop of world.society.populations) {
      if (existingPop.id === population.id) continue;
      
      // Monsters are hostile to civilizations
      if (isMonstrous(population) || isMonstrous(existingPop)) {
        population.relations[existingPop.id] = 'hostile';
        existingPop.relations[population.id] = 'hostile';
      } else {
        population.relations[existingPop.id] = 'neutral';
        existingPop.relations[population.id] = 'neutral';
      }
    }
    
    await this.autoSave(world);
    return true;
  }

  private initializeResources(custom: Partial<Record<Resource, number>>): Record<Resource, number> {
    const base: Record<Resource, number> = {
      [Resource.IRON]: 20,
      [Resource.GOLD]: 5,
      [Resource.SILVER]: 10,
      [Resource.COPPER]: 30,
      [Resource.WOOD]: 50,
      [Resource.STONE]: 60,
      [Resource.FOOD]: 40,
      [Resource.WATER]: 70,
      [Resource.MAGIC]: 10,
      [Resource.GEMS]: 5,
    };

    // Adjust based on terrain
    const terrainAdjustments: Record<TerrainType, Partial<Record<Resource, number>>> = {
      [TerrainType.MOUNTAINS]: { [Resource.IRON]: 50, [Resource.GOLD]: 20, [Resource.STONE]: 90, [Resource.GEMS]: 25 },
      [TerrainType.FOREST]: { [Resource.WOOD]: 95, [Resource.FOOD]: 60 },
      [TerrainType.PLAINS]: { [Resource.FOOD]: 80, [Resource.WATER]: 60 },
      [TerrainType.DESERT]: { [Resource.WATER]: 10, [Resource.GEMS]: 15, [Resource.GOLD]: 15 },
      [TerrainType.SWAMP]: { [Resource.WOOD]: 70, [Resource.WATER]: 80, [Resource.MAGIC]: 25 },
      [TerrainType.HILLS]: { [Resource.COPPER]: 40, [Resource.STONE]: 50 },
      [TerrainType.COASTAL]: { [Resource.WATER]: 100, [Resource.FOOD]: 70 },
      [TerrainType.TUNDRA]: { [Resource.FOOD]: 20, [Resource.WATER]: 50 },
      [TerrainType.JUNGLE]: { [Resource.WOOD]: 90, [Resource.FOOD]: 75, [Resource.MAGIC]: 20 },
    };

    const terrain = Object.keys(terrainAdjustments)[0] as TerrainType;
    const adjustments = terrainAdjustments[terrain] || {};

    for (const [resource, value] of Object.entries(adjustments)) {
      base[resource as Resource] = Math.min(100, base[resource as Resource] + value);
    }

    // Apply custom overrides
    for (const [resource, value] of Object.entries(custom)) {
      base[resource as Resource] = Math.min(100, Math.max(0, value));
    }

    return base;
  }

  private generateInitialFeatures(conditions: InitialConditions): string[] {
    const features: string[] = [];
    
    switch (conditions.locationType) {
      case LocationType.CAVE:
        features.push('narrow entrance', 'damp walls', 'echoing chambers');
        break;
      case LocationType.SETTLEMENT:
        features.push('basic shelters', 'communal fire', 'storage pits');
        break;
      case LocationType.VILLAGE:
        features.push('thatched huts', 'central well', 'crop fields');
        break;
      case LocationType.CITY:
        features.push('stone walls', 'market square', 'temple district');
        break;
    }

    switch (conditions.region) {
      case TerrainType.MOUNTAINS:
        features.push('steep cliffs', 'mountain pass', 'eagle nests');
        break;
      case TerrainType.FOREST:
        features.push('ancient trees', 'forest paths', 'wildlife');
        break;
      case TerrainType.PLAINS:
        features.push('open vistas', 'grasslands', 'migratory paths');
        break;
    }

    return features;
  }

  private generateLocationName(type: LocationType, terrain: TerrainType, race?: string): string {
    const prefixes = race 
      ? {
          'dwarf': ['Deep', 'Stone', 'Iron', 'Mountain'],
          'elf': ['Green', 'Star', 'Moon', 'Forest'],
          'dragonborn': ['Fire', 'Scale', 'Ash', 'Dragon'],
          'orc': ['Red', 'Blood', 'War', 'Iron'],
          'human': ['New', 'High', 'Old', 'Free'],
          'halfling': ['Hill', 'Green', 'Cozy', 'Shire'],
        }[race.toLowerCase()] || ['New', 'High', 'Old']
      : ['Dark', 'Iron', 'Stone', 'Green', 'High', 'Deep', 'Old', 'New', 'Hidden', 'Lost'];
    
    const roots: Record<LocationType, string[]> = {
      [LocationType.CAVE]: ['Cavern', 'Hollow', 'Den', 'Grotto', 'Chamber'],
      [LocationType.SETTLEMENT]: ['Haven', 'Rest', 'Outpost', 'Camp'],
      [LocationType.VILLAGE]: ['Village', 'Hamlet', 'Town'],
      [LocationType.CITY]: ['City', 'Metropolis', 'Capital'],
      [LocationType.DUNGEON]: ['Dungeon', 'Underkeep', 'Warren', 'Labyrinth'],
      [LocationType.FORTRESS]: ['Fortress', 'Keep', 'Stronghold', 'Bastion'],
      [LocationType.TEMPLE]: ['Temple', 'Sanctuary', 'Shrine', 'Oracle'],
      [LocationType.TRADE_POST]: ['Post', 'Station', 'Exchange'],
      [LocationType.RUINS]: ['Ruins', 'Remains', 'Echoes'],
      [LocationType.LANDMARK]: ['Spire', 'Peak', 'Mound', 'Towers'],
    };

    const prefix = this.rng.pick(prefixes);
    const root = this.rng.pick(roots[type]);
    
    if (race) {
      return `${prefix} ${root} (${race})`;
    }
    return `${prefix} ${root}`;
  }
}
