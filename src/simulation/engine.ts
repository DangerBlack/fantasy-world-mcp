/**
 * Simulation engine for world evolution
 * Handles time progression and rule evaluation
 */

import { v4 as uuidv4 } from 'uuid';
import { SeededRandom } from '../utils/random';
import {
  WorldState,
  Event,
  EventId,
  EventType,
  SimulationParams,
  Change,
  Location,
  LocationType,
  Resource,
  Population,
  MonsterType,
  MonsterBehavior,
  MonsterPopulation,
  Quest,
  QuestType,
  QuestStatus,
  Craft,
  CraftCategory,
  CraftRarity,
} from '../types';
import { WorldManager } from '../core/worldManager';

export class SimulationEngine {
  private worldManager: WorldManager;
  private rng: SeededRandom;

  constructor(worldManager: WorldManager, seed: string) {
    this.worldManager = worldManager;
    this.rng = new SeededRandom(seed);
  }

  simulate(worldId: string, params: SimulationParams): WorldState {
    const world = this.worldManager.getWorld(worldId);
    if (!world) {
      throw new Error(`World ${worldId} not found`);
    }

    const steps = Math.ceil(params.timespan / params.stepSize);
    
    for (let step = 0; step < steps; step++) {
      const currentYear = world.timestamp;
      const nextYear = currentYear + params.stepSize;

      // Evaluate all active rules
      const newEvents = this.evaluateRules(world, currentYear, nextYear, params);
      
      // Apply event effects
      for (const event of newEvents) {
        this.applyEventEffects(world, event);
        world.events.push(event);
        world.timeline.events.push(event);
      }

      // Update timestamp
      world.timestamp = nextYear;
      
      // Create era boundaries at milestones
      this.updateEras(world, params);
    }

    world.metadata.lastUpdate = new Date().toISOString();
    world.metadata.simulationSteps += steps;
    
    this.worldManager.updateWorld(worldId, world);
    return world;
  }

  private applyEventEffects(world: WorldState, event: Event): void {
    if (!event.impact) return;

    if (event.impact.geography) {
      for (const change of event.impact.geography) {
        this.applyGeographyChange(world, change);
      }
    }

    if (event.impact.society) {
      for (const change of event.impact.society) {
        this.applySocietyChange(world, change);
      }
    }

    if (event.impact.resources) {
      for (const change of event.impact.resources) {
        this.applyResourceChange(world, change);
      }
    }
  }

  private applyGeographyChange(world: WorldState, change: Change): void {
    switch (change.type) {
      case 'transform':
        break;
      case 'create':
        world.geography.features.push(change.target);
        break;
      case 'destroy':
        const idx = world.geography.features.indexOf(change.target);
        if (idx > -1) world.geography.features.splice(idx, 1);
        break;
      case 'increase':
      case 'decrease':
        break;
    }
    world.geography.modifications.push(change);
  }

  private applySocietyChange(world: WorldState, change: Change): void {
    // Handled inline
  }

  private applyResourceChange(world: WorldState, change: Change): void {
    if (change.type === 'decrease' && change.target === 'water') {
      world.geography.resources[Resource.WATER] = Math.max(0, 
        world.geography.resources[Resource.WATER] - (change.value || 10));
    }
    if (change.type === 'increase' && change.target === 'water') {
      world.geography.resources[Resource.WATER] = Math.min(100,
        world.geography.resources[Resource.WATER] + (change.value || 10));
    }
    if (change.type === 'decrease' && change.target === 'wood') {
      world.geography.resources[Resource.WOOD] = Math.max(0,
        world.geography.resources[Resource.WOOD] - (change.value || 10));
    }
  }

  private evaluateRules(
    world: WorldState,
    currentYear: number,
    nextYear: number,
    params: SimulationParams
  ): Event[] {
    const events: Event[] = [];

    if (params.complexity !== 'simple') {
      const popEvents = this.checkPopulationDynamics(world, currentYear, nextYear);
      events.push(...popEvents);
    }

    const resourceEvents = this.checkResourceDynamics(world, currentYear, nextYear);
    events.push(...resourceEvents);

    if (params.enableTechProgress) {
      const techEvents = this.checkTechnologicalProgress(world, currentYear, nextYear);
      events.push(...techEvents);
    }

    if (params.enableConflict && params.complexity !== 'simple') {
      const conflictEvents = this.checkConflictGeneration(world, currentYear, nextYear);
      events.push(...conflictEvents);
    }

    if (params.enableMigration && params.complexity !== 'simple') {
      const migrationEvents = this.checkMigration(world, currentYear, nextYear);
      events.push(...migrationEvents);
    }

    const locationEvents = this.checkLocationEvolution(world, currentYear, nextYear);
    events.push(...locationEvents);

    const naturalEvents = this.checkNaturalEvents(world, currentYear, nextYear);
    events.push(...naturalEvents);

    // Monster events (if enabled in world)
    const worldMeta = world.metadata as any;
    if (worldMeta.enableMonsters !== false) {
      const monsterEvents = this.checkMonsterActivity(world, currentYear, nextYear);
      events.push(...monsterEvents);
    }

    // Quest generation (if populations face unsolvable problems)
    const questEvents = this.checkQuestGeneration(world, currentYear, nextYear);
    events.push(...questEvents);

    // Craft/heritage generation (magical items, artifacts, legendary weapons)
    // Enabled by default (complex), disabled only in 'simple' mode
    if (params.complexity !== 'simple') {
      const craftEvents = this.checkCraftGeneration(world, currentYear, nextYear);
      events.push(...craftEvents);
    }

    this.linkEventsCausally(world, events);

    return events;
  }

  private checkPopulationDynamics(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];

    for (const population of world.society.populations) {
      const foodAvailability = world.geography.resources[Resource.FOOD];
      const waterAvailability = world.geography.resources[Resource.WATER];
      
      // Base growth rate reduced significantly
      let growthRate = 0.005;
      
      // Food impact: CRITICAL - no food means population decline
      if (foodAvailability <= 0) {
        // Starvation: population decreases by 5-10% per step
        growthRate = -0.05 - (this.rng.next() * 0.05);
      } else if (foodAvailability < 20) {
        // Severe food shortage: slow decline
        growthRate = -0.02 + (foodAvailability / 100) * 0.01;
      } else {
        // Normal food: small positive growth based on availability
        growthRate += (foodAvailability / 100) * 0.02;
      }
      
      // Water impact
      if (waterAvailability <= 0) {
        growthRate -= 0.03; // Death by dehydration
      } else {
        growthRate += (waterAvailability / 100) * 0.01;
      }
      
      // Technology reduces growth slightly (lower birth rates in advanced societies)
      growthRate -= (population.technologyLevel > 5) ? 0.005 : 0;
      
      const change = Math.floor(population.size * growthRate);
      
      if (Math.abs(change) > 0) {
        population.size = Math.max(0, population.size + change);
        
        const eventType = change > 0 ? EventType.SOCIAL : EventType.CONFLICT;
        const title = change > 0 ? 'Population Growth' : 'Population Decline';
        const description = change > 0 
          ? `${population.name} population grew by ${Math.abs(change)} people`
          : `${population.name} population declined by ${Math.abs(change)} people${foodAvailability <= 0 ? ' due to starvation' : ''}`;
        
        events.push({
          id: uuidv4(),
          year: nextYear,
          type: eventType,
          title,
          description,
          causes: [],
          effects: [],
          impact: {
            society: [{
              type: change > 0 ? 'increase' : 'decrease',
              target: population.name,
              value: Math.abs(change),
              description: `Population: ${population.size}`,
            }],
          },
        });
      }

      this.checkOrganizationEvolution(world, population, currentYear, nextYear, events);
    }

    return events;
  }

  private checkOrganizationEvolution(
    world: WorldState,
    population: Population,
    currentYear: number,
    nextYear: number,
    events: Event[]
  ): void {
    const organizationProgression: Population['organization'][] = [
      'nomadic', 'tribal', 'feudal', 'kingdom', 'empire',
    ];

    const currentIndex = organizationProgression.indexOf(population.organization);
    if (currentIndex >= organizationProgression.length - 1) return;

    const sizeRequirement = [0, 50, 200, 500, 1000];
    const techRequirement = [0, 2, 4, 6, 8];

    if (
      population.size >= sizeRequirement[currentIndex + 1] &&
      population.technologyLevel >= techRequirement[currentIndex + 1]
    ) {
      const newOrg = organizationProgression[currentIndex + 1];
      const oldOrg = population.organization;
      population.organization = newOrg;

      events.push({
        id: uuidv4(),
        year: nextYear,
        type: EventType.SOCIAL,
        title: `${population.name} becomes ${newOrg}`,
        description: `${population.name} evolves from ${oldOrg} to ${newOrg} organization`,
        causes: [],
        effects: [],
        impact: {
          society: [{
            type: 'transform',
            target: population.name,
            description: `Social organization: ${oldOrg} → ${newOrg}`,
          }],
        },
      });
    }
  }

  private checkResourceDynamics(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];

    for (const population of world.society.populations) {
      // Consumption rate reduced significantly (was 0.1, now 0.01)
      const consumptionRate = population.size * 0.01;
      
      const foodConsumed = Math.min(
        world.geography.resources[Resource.FOOD],
        consumptionRate
      );
      world.geography.resources[Resource.FOOD] -= foodConsumed;

      if (population.organization !== 'nomadic') {
        const woodConsumed = Math.min(
          world.geography.resources[Resource.WOOD],
          consumptionRate * 0.5
        );
        world.geography.resources[Resource.WOOD] -= woodConsumed;
      }
    }

    // Food and water regeneration based on technology and environment
    const agricultureTech = world.society.technologies.includes('Agriculture');
    
    // Food regeneration: base + agriculture bonus + technology bonus
    // Agriculture is MUCH more effective now
    let foodRegen = 0.5; // Base natural regeneration (increased from 0.1)
    if (agricultureTech) {
      foodRegen += 2.0; // Agriculture provides substantial food production (increased from 0.3)
    }
    
    // Check if any population has irrigation technology
    const hasIrrigation = world.society.populations.some(p => p.technologyLevel >= 6);
    if (hasIrrigation) {
      foodRegen += 1.5; // Irrigation greatly improves yields (increased from 0.2)
    }
    
    // Technology level bonus (better farming techniques)
    const avgTechLevel = world.society.populations.reduce((sum, p) => sum + p.technologyLevel, 0) / 
                         world.society.populations.length;
    foodRegen += avgTechLevel * 0.3; // Each tech level adds 0.3 regen
    
    // Water availability affects food production (but not as severely)
    const waterFactor = 0.5 + (world.geography.resources[Resource.WATER] / 200); // Min 0.5, max 1.0
    foodRegen *= waterFactor;
    
    world.geography.resources[Resource.FOOD] = Math.min(100, 
      world.geography.resources[Resource.FOOD] + foodRegen);
    
    // Water regenerates slowly (rainfall, springs)
    world.geography.resources[Resource.WATER] = Math.min(100,
      world.geography.resources[Resource.WATER] + 0.05);

    if (world.geography.resources[Resource.FOOD] < 10) {
      events.push({
        id: uuidv4(),
        year: nextYear,
        type: EventType.NATURAL,
        title: 'Food Shortage',
        description: 'Resources are running low, causing hardship',
        causes: [],
        effects: [],
        impact: {
          resources: [{
            type: 'decrease',
            target: 'food',
            value: world.geography.resources[Resource.FOOD],
            description: 'Critical food shortage',
          }],
        },
      });
    }

    return events;
  }

  private checkTechnologicalProgress(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];

    for (const population of world.society.populations) {
      const techChance = 0.1 + (population.size / 1000) * 0.1;
      
      if (this.rng.boolean(techChance)) {
        population.technologyLevel = Math.min(10, population.technologyLevel + 1);
        
        const techDiscoveries: Record<number, { name: string; description: string }> = {
          2: { name: 'Agriculture', description: 'Farming techniques discovered' },
          3: { name: 'Pottery', description: 'Ceramic vessels for storage' },
          4: { name: 'Bronze Working', description: 'First metal tools' },
          5: { name: 'Masonry', description: 'Stone construction techniques' },
          6: { name: 'Iron Working', description: 'Superior metal tools and weapons' },
          7: { name: 'Writing', description: 'Record keeping and history' },
          8: { name: 'Mathematics', description: 'Advanced calculations and engineering' },
          9: { name: 'Architecture', description: 'Grand construction projects' },
          10: { name: 'Philosophy', description: 'Deep cultural and intellectual development' },
        };

        const tech = techDiscoveries[population.technologyLevel];
        if (tech) {
          world.society.technologies.push(tech.name);
          
          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.TECHNOLOGICAL,
            title: tech.name,
            description: tech.description,
            causes: [],
            effects: [],
            impact: {
              society: [{
                type: 'create',
                target: tech.name,
                description: `${population.name} discovers ${tech.name}`,
              }],
            },
          });
        }
      }
    }

    return events;
  }

  private checkConflictGeneration(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];

    if (world.society.populations.length < 2) return events;

    if (world.geography.resources[Resource.FOOD] < 30) {
      const pop1 = world.society.populations[0];
      const pop2 = world.society.populations[1];

      if (pop1 && pop2) {
        pop1.relations[pop2.id] = 'hostile';
        pop2.relations[pop1.id] = 'hostile';

        world.society.conflicts.push({
          parties: [pop1.id, pop2.id],
          status: 'ongoing',
          cause: 'Resource scarcity',
        });

        events.push({
          id: uuidv4(),
          year: nextYear,
          type: EventType.CONFLICT,
          title: 'Resource Conflict',
          description: `${pop1.name} and ${pop2.name} begin fighting over scarce resources`,
          causes: [],
          effects: [],
          impact: {
            society: [{
              type: 'transform',
              target: 'relations',
              description: `${pop1.name} vs ${pop2.name}: relations turn hostile`,
            }],
          },
        });
      }
    }

    return events;
  }

  private checkMigration(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];

    for (const population of world.society.populations) {
      const foodStress = world.geography.resources[Resource.FOOD] < 20;
      const overpopulation = population.size > 800;

      if ((foodStress || overpopulation) && population.size > 50) {
        if (this.rng.boolean(0.3)) {
          // Migrate 10-30% of population
          const migrationSize = Math.floor(population.size * (0.1 + this.rng.next() * 0.2));
          const remainingSize = population.size - migrationSize;
          
          population.size = remainingSize;
          
          const newLocation: Location = {
            id: uuidv4(),
            type: LocationType.SETTLEMENT,
            name: this.generateNewLocationName(world),
            description: 'A new settlement established by migrating group',
            geography: {},
            inhabitants: [population.id], // Same population ID (now split)
            history: [],
            features: ['temporary shelters', 'trail markers'],
            connections: [world.locations[0]?.id].filter(Boolean) as string[],
            dangerLevel: 0,
            complexity: 1,
          };

          // Create new population for migrants
          const migrantPopulation: any = {
            ...population,
            id: `pop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${population.name} Colonists`,
            size: migrationSize,
          };
          
          world.society.populations.push(migrantPopulation);
          world.locations.push(newLocation);

          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.MIGRATION,
            title: 'Migration',
            description: `${migrationSize} people from ${population.name} establish new settlement: ${newLocation.name}`,
            causes: [],
            effects: [],
            location: newLocation.id,
            impact: {
              society: [
                {
                  type: 'decrease',
                  target: population.name,
                  value: migrationSize,
                  description: 'Population migrated',
                },
                {
                  type: 'create',
                  target: newLocation.name,
                  description: `${migrationSize} colonists founded new settlement`,
                },
              ],
            },
          });
        }
      }
    }

    return events;
  }

  private checkLocationEvolution(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];
    const age = nextYear;

    for (const location of world.locations) {
      if (location.type === LocationType.CAVE && age > 50) {
        const population = world.society.populations.find(p => 
          location.inhabitants.includes(p.id)
        );
        
        if (population && population.size > 30 && population.technologyLevel >= 3) {
          location.type = LocationType.SETTLEMENT;
          location.name = `${population.name}'s Rest`;
          location.features.push('permanent shelters', 'storage areas', 'workshops');
          location.description = 'A permanent settlement established near the original cave';

          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.SOCIAL,
            title: 'Settlement Established',
            description: `${location.name} grows from cave dwelling to permanent settlement`,
            causes: [],
            effects: [],
            location: location.id,
            impact: {
              geography: [{
                type: 'transform',
                target: location.name,
                description: 'Cave becomes settlement',
              }],
            },
          });
        }
      }

      if (location.type === LocationType.SETTLEMENT && age > 100) {
        const population = world.society.populations.find(p => 
          location.inhabitants.includes(p.id)
        );
        
        if (population && population.size > 100 && population.technologyLevel >= 5) {
          location.type = LocationType.VILLAGE;
          location.features.push('central well', 'crop fields', 'communal buildings');
          location.description = 'A thriving village with established agriculture';

          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.SOCIAL,
            title: 'Village Founded',
            description: `${location.name} grows into a proper village`,
            causes: [],
            effects: [],
            location: location.id,
            impact: {
              geography: [{
                type: 'transform',
                target: location.name,
                description: 'Settlement becomes village',
              }],
            },
          });
        }
      }

      if (location.type === LocationType.VILLAGE && age > 200) {
        const population = world.society.populations.find(p => 
          location.inhabitants.includes(p.id)
        );
        
        if (population && population.size > 300 && population.organization === 'kingdom') {
          location.type = LocationType.CITY;
          location.features.push('stone walls', 'market square', 'temple district', 'administrative buildings');
          location.description = 'A major city and center of power';

          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.SOCIAL,
            title: 'City Founded',
            description: `${location.name} becomes a major city`,
            causes: [],
            effects: [],
            location: location.id,
            impact: {
              geography: [{
                type: 'transform',
                target: location.name,
                description: 'Village becomes city',
              }],
            },
          });
        }
      }

      if (location.type === LocationType.CITY && age > 300) {
        const hasHostileRelations = world.society.populations.some(p => 
          Object.values(p.relations).includes('hostile')
        );
        
        if (hasHostileRelations && this.rng.boolean(0.2)) {
          location.type = LocationType.RUINS;
          location.features.push('crumbling walls', 'overgrown streets', 'collapsed buildings');
          location.description = 'Ancient ruins of a once-great city';
          location.dangerLevel = 5;

          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.CONFLICT,
            title: 'City Abandoned',
            description: `${location.name} falls into ruin after conflict`,
            causes: [],
            effects: [],
            location: location.id,
            impact: {
              geography: [{
                type: 'transform',
                target: location.name,
                description: 'City becomes ruins',
              }],
            },
          });
        }
      }
    }

    return events;
  }

  private checkNaturalEvents(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];

    const naturalEventChance = 0.05;
    
    if (this.rng.boolean(naturalEventChance)) {
      const eventsByTerrain: Record<string, { title: string; description: string; impact: Change[] }> = {
        mountains: {
          title: 'Earthquake',
          description: 'The mountains shake, altering the landscape',
          impact: [{ type: 'transform', target: 'terrain', description: 'New caves or blocked passages' }],
        },
        forest: {
          title: 'Forest Fire',
          description: 'A great fire sweeps through the woods',
          impact: [{ type: 'decrease', target: 'wood', value: 20, description: 'Forest damaged' }],
        },
        plains: {
          title: 'Drought',
          description: 'Rain fails to come for many seasons',
          impact: [{ type: 'decrease', target: 'water', value: 30, description: 'Water sources dry up' }],
        },
        swamp: {
          title: 'Flood',
          description: 'Rising waters reshape the marshlands',
          impact: [{ type: 'increase', target: 'water', value: 20, description: 'New waterways form' }],
        },
      };

      const terrain = world.geography.terrain;
      const event = eventsByTerrain[terrain] || {
        title: 'Natural Event',
        description: 'An unusual natural occurrence',
        impact: [],
      };

      events.push({
        id: uuidv4(),
        year: nextYear,
        type: EventType.NATURAL,
        title: event.title,
        description: event.description,
        causes: [],
        effects: [],
        impact: { geography: event.impact },
      });
    }

    return events;
  }

  private linkEventsCausally(world: WorldState, newEvents: Event[]): void {
    if (newEvents.length === 0) return;

    const recentEvents = world.events.filter(e => 
      e.year >= world.timestamp - 10 && e.year < world.timestamp
    );

    for (const event of newEvents) {
      for (const recent of recentEvents) {
        if (event.type === recent.type || event.type === EventType.SOCIAL) {
          if (this.rng.boolean(0.3)) {
            event.causes.push(recent.id);
            recent.effects.push(event.id);
          }
        }
      }
    }
  }

  private updateEras(world: WorldState, params: SimulationParams): void {
    const eraMilestones = [50, 100, 200, 300, 500, 750, 1000];
    const eraNames = [
      'Age of Discovery',
      'Age of Settlement',
      'Age of Expansion',
      'Age of Kingdoms',
      'Age of Empires',
      'Age of Decline',
      'Age of Legend',
    ];

    for (let i = 0; i < eraMilestones.length; i++) {
      const milestone = eraMilestones[i];
      
      if (world.timestamp >= milestone && 
          (!world.timeline.eras[i] || world.timeline.eras[i].endYear < milestone)) {
        
        const prevEra = world.timeline.eras[i - 1];
        const startYear = prevEra ? prevEra.endYear : 0;
        
        const eraSummary = this.generateEraSummary(world, startYear, milestone);
        
        if (prevEra) {
          prevEra.endYear = milestone;
        }

        world.timeline.eras.push({
          name: eraNames[i] || `Era ${i + 1}`,
          startYear,
          endYear: milestone,
          summary: eraSummary,
        });
      }
    }
  }

  private generateEraSummary(world: WorldState, startYear: number, endYear: number): string {
    const eraEvents = world.events.filter(e => e.year >= startYear && e.year < endYear);
    const titles = eraEvents.map(e => e.title);
    const uniqueTitles = [...new Set(titles)];
    
    return `Key developments: ${uniqueTitles.slice(0, 5).join(', ')}`;
  }

  private generateNewLocationName(world: WorldState): string {
    const prefixes = ['New', 'Out', 'Trail', 'River', 'Hill'];
    const roots = ['Camp', 'Post', 'Haven', 'Rest', 'Outpost'];
    
    const prefix = this.rng.pick(prefixes);
    const root = this.rng.pick(roots);
    
    return `${prefix}${root}`;
  }

  private checkMonsterActivity(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];
    
    // Get all monster populations
    const monsters = world.society.populations.filter(p => p.race === 'monster') as MonsterPopulation[];
    
    if (monsters.length === 0) return events;

    // Monster growth (faster than civilizations)
    for (const monster of monsters) {
      if (monster.isDormant) {
        // Chance to wake up
        if (this.rng.boolean(0.05)) {
          monster.isDormant = false;
          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.MONSTER_DORMANCY,
            title: `${monster.monsterSubtype || monster.name} Awakens`,
            description: `The ${monster.monsterType} ${monster.name} emerges from dormancy`,
            causes: [],
            effects: [],
            location: monster.lairLocation,
            impact: {
              society: [{
                type: 'transform',
                target: monster.name,
                description: 'Dormant monster awakens and becomes active',
              }],
            },
          });
        }
        continue;
      }

      // Monster population growth - varies by monster type
      const baseGrowthRate = this.getMonsterGrowthRate(monster.monsterType);
      const growthRate = baseGrowthRate + (monster.raidFrequency || 0.3) * 0.02;
      const change = Math.floor(monster.size * growthRate);
      if (change > 0) {
        monster.size += change;
        events.push({
          id: uuidv4(),
          year: nextYear,
          type: EventType.MONSTER_INFESTATION,
          title: `${monster.name} Population Grows`,
          description: `${monster.monsterSubtype || monster.name} breeding increases their numbers by ${change}`,
          causes: [],
          effects: [],
          location: monster.lairLocation,
          impact: {
            society: [{
              type: 'increase',
              target: monster.name,
              value: change,
              description: `Monster threat level: ${monster.dangerLevel}`,
            }],
          },
        });
      }

      // Raid settlements
      if (this.rng.boolean(monster.raidFrequency || 0.3)) {
        const civilizedPops = world.society.populations.filter(p => p.race !== 'monster');
        if (civilizedPops.length > 0) {
          const target = this.rng.pick(civilizedPops);
          
          // Defense calculation: larger/more organized populations defend better
          const defenseBonus = Math.min(0.8, (target.size / 1000) * 0.2);
          const organizationBonus = ({
            'nomadic': 0.1, 'tribal': 0.2, 'feudal': 0.4, 'kingdom': 0.6, 'empire': 0.8
          }[target.organization] || 0);
          const totalDefense = Math.min(0.9, defenseBonus + organizationBonus);
          
          // Raid damage based on danger level - monsters with higher danger are exponentially more deadly
          // Base damage scales with danger level (not just monster.size)
          const baseDamageByDanger = Math.pow(monster.dangerLevel, 2) * 2; // danger 9 = 162 base damage
          const sizeMultiplier = 0.3 + (monster.size / 100); // Small bonus for larger monster populations
          const typeMultiplier = this.getMonsterRaidMultiplier(monster.monsterType);
          const baseDamage = Math.floor(baseDamageByDanger * sizeMultiplier * typeMultiplier);
          const raidDamage = Math.max(1, Math.floor(baseDamage * (1 - totalDefense)));
          target.size = Math.max(0, target.size - raidDamage);

          // Update relations
          target.relations[monster.id] = 'hostile';
          monster.relations[target.id] = 'hostile';

          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.MONSTER_RAID,
            title: `${monster.monsterSubtype || 'Monster'} Raid`,
            description: `${monster.name} attacks ${target.name}, killing/capturing ${raidDamage} people`,
            causes: [],
            effects: [],
            location: world.locations.find(l => l.inhabitants.includes(target.id))?.id,
            impact: {
              society: [
                {
                  type: 'decrease',
                  target: target.name,
                  value: raidDamage,
                  description: 'Casualties from monster raid',
                },
                {
                  type: 'transform',
                  target: 'relations',
                  description: `${target.name} now hostile to ${monster.name}`,
                },
              ],
            },
          });

          // Chance to turn location into ruins
          const targetLocation = world.locations.find(l => l.inhabitants.includes(target.id));
          if (targetLocation && targetLocation.type === 'city' && this.rng.boolean(0.1)) {
            targetLocation.type = LocationType.RUINS;
            targetLocation.features = ['crumbling walls', 'monster lair', 'scorch marks'];
            targetLocation.dangerLevel = monster.dangerLevel;
            
            events.push({
              id: uuidv4(),
              year: nextYear,
              type: EventType.MONSTER_INVASION,
              title: `${targetLocation.name} Overrun`,
              description: `${monster.name} has taken over ${targetLocation.name}, turning it into a monster lair`,
              causes: [],
              effects: [],
              location: targetLocation.id,
              impact: {
                geography: [{
                  type: 'transform',
                  target: targetLocation.name,
                  description: 'City becomes monster-infested ruins',
                }],
              },
            });
          }
        }
      }
    }

    return events;
  }

  private getMonsterGrowthRate(monsterType: MonsterType): number {
    // Different monster types have vastly different growth rates
    // Based on realistic breeding cycles and lifespans
    const growthRates: Record<MonsterType, number> = {
      [MonsterType.DRAGON]: 0.005,     // Extremely slow - centuries to mature
      [MonsterType.GIANT]: 0.01,        // Very slow - long lifespans, few offspring
      [MonsterType.ORC]: 0.035,         // Fast - short lives, large families
      [MonsterType.GOBLIN]: 0.05,       // Very fast - reproduce rapidly
      [MonsterType.UNDEAD]: 0.02,       // Medium - depends on source of undead
      [MonsterType.BEAST]: 0.025,       // Medium - natural animal breeding rates
      [MonsterType.DEMON]: 0.03,        // Fast - if they can manifest from planes
      [MonsterType.ABERRATION]: 0.015,  // Slow - mysterious reproduction
      [MonsterType.FAE]: 0.02,          // Medium - varies greatly by type
      [MonsterType.CUSTOM]: 0.025,      // Default medium rate
    };
    
    return growthRates[monsterType] || 0.025;
  }

  private getMonsterRaidMultiplier(monsterType: MonsterType): number {
    // Different monster types have different raid devastation levels
    // Dragons and giants cause massive destruction even in small numbers
    const multipliers: Record<MonsterType, number> = {
      [MonsterType.DRAGON]: 5.0,        // Single dragon can destroy a village
      [MonsterType.GIANT]: 3.0,         // Giants crush buildings and armies
      [MonsterType.ORC]: 1.2,           // Organized warbands, moderate damage
      [MonsterType.GOBLIN]: 0.8,        // Hit-and-run, low individual damage
      [MonsterType.UNDEAD]: 2.0,        // Fear and supernatural terror
      [MonsterType.BEAST]: 1.0,         // Natural predators
      [MonsterType.DEMON]: 2.5,         // Chaotic destruction
      [MonsterType.ABERRATION]: 1.8,    // Unpredictable and terrifying
      [MonsterType.FAE]: 1.0,           // Varies - can be mischievous or deadly
      [MonsterType.CUSTOM]: 1.0,        // Default
    };
    
    return multipliers[monsterType] || 1.0;
  }

  private checkQuestGeneration(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];
    
    if (!world.quests) {
      world.quests = [];
    }
    if (!world.society.quests) {
      world.society.quests = [];
    }

    // Check each civilization population for unsolvable problems
    const civilizedPops = world.society.populations.filter(p => p.race !== 'monster');
    
    for (const population of civilizedPops) {
      // Check for monster threats that population can't handle
      const monsters = world.society.populations.filter(p => p.race === 'monster') as MonsterPopulation[];
      for (const monster of monsters) {
        const monsterThreatLevel = monster.dangerLevel || 5;
        const populationDefense = this.calculatePopulationDefense(population);
        
        // If monster threat exceeds population defense, generate quest
        if (monsterThreatLevel > populationDefense && this.rng.boolean(0.15)) {
          const quest: Quest = this.createMonsterHuntQuest(world, population, monster, nextYear);
          world.quests.push(quest);
          world.society.quests.push(quest.id);
          
          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.QUEST_GENERATED,
            title: quest.title,
            description: quest.description,
            causes: [],
            effects: [],
            location: world.locations.find(l => l.inhabitants.includes(population.id))?.id,
            impact: {
              society: [{
                type: 'create',
                target: quest.title,
                description: `Urgent quest: ${quest.urgency} priority`,
              }],
            },
          });
        }
      }

      // Check for disease/plague (random chance if population is large and dense)
      if ((population.size > 500 && population.organization === 'kingdom') || population.organization === 'empire') {
        if (this.rng.boolean(0.05)) {
          const quest: Quest = this.createDiseaseCureQuest(world, population, nextYear);
          world.quests.push(quest);
          world.society.quests.push(quest.id);
          
          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.QUEST_GENERATED,
            title: quest.title,
            description: quest.description,
            causes: [],
            effects: [],
            impact: {
              society: [{
                type: 'create',
                target: quest.title,
                description: 'Plague threatens the population',
              }],
            },
          });
        }
      }

      // Check for resource scarcity
      if (world.geography.resources[Resource.IRON] < 20 && this.rng.boolean(0.1)) {
        const quest: Quest = this.createResourceRecoveryQuest(world, population, Resource.IRON, nextYear);
        world.quests.push(quest);
        world.society.quests.push(quest.id);
        
        events.push({
          id: uuidv4(),
          year: nextYear,
          type: EventType.QUEST_GENERATED,
          title: quest.title,
          description: quest.description,
          causes: [],
          effects: [],
          impact: {
            resources: [{
              type: 'decrease',
              target: 'iron',
              description: 'Critical shortage requires expedition',
            }],
          },
        });
      }

      // Check for CRITICAL food shortage (famine) - highest priority
      const foodAvailability = world.geography.resources[Resource.FOOD];
      if (foodAvailability <= 0 && this.rng.boolean(0.25)) {
        const quest = this.generateContextualQuest(world, population, 'famine', nextYear);
        if (quest) {
          world.quests.push(quest);
          world.society.quests.push(quest.id);
          
          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.QUEST_GENERATED,
            title: quest.title,
            description: quest.description,
            causes: [],
            effects: [],
            impact: {
              resources: [{
                type: 'decrease',
                target: 'food',
                description: 'Famine threatens extinction',
              }],
            },
          });
        }
      } else if (foodAvailability < 10 && this.rng.boolean(0.15)) {
        const quest = this.generateContextualQuest(world, population, 'famine', nextYear);
        if (quest) {
          world.quests.push(quest);
          world.society.quests.push(quest.id);
          
          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.QUEST_GENERATED,
            title: quest.title,
            description: quest.description,
            causes: [],
            effects: [],
            impact: {
              resources: [{
                type: 'decrease',
                target: 'food',
                description: 'Severe food shortage',
              }],
            },
          });
        }
      }

      // AI-powered contextual quest generation for other problems
      // Check for various world problems and generate creative quests
      if (this.rng.boolean(0.08)) { // 8% chance per population per step
        const quest = this.generateContextualQuest(world, population, 'adaptive', nextYear);
        if (quest) {
          world.quests.push(quest);
          world.society.quests.push(quest.id);
          
          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.QUEST_GENERATED,
            title: quest.title,
            description: quest.description,
            causes: [],
            effects: [],
            location: world.locations.find(l => l.inhabitants.includes(population.id))?.id,
            impact: {
              society: [{
                type: 'create',
                target: quest.title,
                description: `Contextual quest generated: ${quest.urgency} priority`,
              }],
            },
          });
        }
      }
    }

    return events;
  }

  private calculatePopulationDefense(population: Population): number {
    // Defense based on organization, tech level, and size
    const orgDefense = ({
      'nomadic': 1, 'tribal': 2, 'feudal': 4, 'kingdom': 6, 'empire': 8
    }[population.organization] || 2);
    
    const techDefense = Math.floor(population.technologyLevel / 2);
    const sizeDefense = population.size > 1000 ? 2 : population.size > 500 ? 1 : 0;
    
    return orgDefense + techDefense + sizeDefense;
  }

  private createMonsterHuntQuest(
    world: WorldState,
    population: Population,
    monster: MonsterPopulation,
    year: number
  ): Quest {
    const urgency = monster.dangerLevel >= 8 ? 'critical' : monster.dangerLevel >= 6 ? 'high' : 'medium';
    const requiredHeroes = monster.dangerLevel >= 8 ? 5 : monster.dangerLevel >= 6 ? 3 : 1;
    
    return {
      id: `quest_${uuidv4()}`,
      title: `Eliminate the ${monster.monsterSubtype || monster.name}`,
      description: `The ${monster.monsterSubtype} ${monster.name} (Danger: ${monster.dangerLevel}/10) has been raiding ${population.name}'s settlements. Their lair must be found and destroyed before more lives are lost.`,
      type: QuestType.MONSTER_HUNT,
      status: QuestStatus.OPEN,
      urgency,
      originPopulationId: population.id,
      relatedMonsterId: monster.id,
      relatedLocationId: monster.lairLocation,
      reward: `The ${population.name} will reward heroes with gold, land, and honors`,
      requiredHeroes: requiredHeroes,
      assignedHeroes: [],
      deadline: year + (urgency === 'critical' ? 10 : urgency === 'high' ? 25 : 50),
      failureConsequences: `${monster.monsterSubtype} raids intensify, settlements destroyed, population decimated`,
      successConsequences: `${population.name} gains security, heroes are celebrated, trade routes become safe`,
      createdAt: year,
    };
  }

  private createDiseaseCureQuest(world: WorldState, population: Population, year: number): Quest {
    const diseases = [
      'the Blazing Fever', 'the Wasting Plague', 'the Shadow Sickness', 'the Crimson Rot', 'the Bone Blight'
    ];
    const disease = this.rng.pick(diseases);
    
    return {
      id: `quest_${uuidv4()}`,
      title: `Cure ${disease}`,
      description: `A terrible plague called ${disease} is sweeping through ${population.name}'s lands. Physicians are powerless. Heroes must find a cure in ancient texts, distant lands, or from mysterious healers.`,
      type: QuestType.DISEASE_CURE,
      status: QuestStatus.OPEN,
      urgency: 'critical',
      originPopulationId: population.id,
      reward: 'The entire population will owe you their lives; vast rewards promised',
      requiredHeroes: 2,
      assignedHeroes: [],
      deadline: year + 20,
      failureConsequences: `${population.name} is decimated, cities become ghost towns`,
      successConsequences: `${population.name} survives and honors heroes for generations`,
      createdAt: year,
    };
  }

  private createFamineQuest(world: WorldState, population: Population, year: number): Quest {
    const foodAvailability = world.geography.resources[Resource.FOOD];
    const urgency = foodAvailability <= 0 ? 'critical' : 'high';
    
    const famineScenarios = [
      {
        title: 'Find Food Sources',
        description: `The granaries of ${population.name} are empty. ${foodAvailability <= 0 ? 'Starvation has begun' : 'Food is critically low'}. Heroes must venture into the wilderness to find edible plants, hunt game, or locate abandoned caches before the entire population perishes.`,
        failure: `${population.name} faces extinction. Children starve, adults eat leather and bark, and the village becomes a graveyard.`,
        success: `${population.name} survives the famine. The heroes are remembered as saviors, and new food storage practices are established.`,
      },
      {
        title: 'Establish Irrigation Systems',
        description: `The crops have failed and ${population.name} faces ${foodAvailability <= 0 ? 'total starvation' : 'severe hunger'}. Heroes must find master engineers or ancient texts to build irrigation systems that will ensure future harvests.`,
        failure: 'Without water for the fields, the famine continues. The population disperses or dies, and the land becomes barren.',
        success: 'Irrigation channels bring life to the fields. ${population.name} not only survives but thrives, with abundant harvests for generations.',
      },
      {
        title: 'Trade for Food',
        description: `${population.name}'s stores are empty. Heroes must brave dangerous journeys to establish trade routes with distant settlements willing to exchange food for the village's resources (stone, wood, iron).`,
        failure: 'No trade routes established in time. The village is abandoned as survivors scatter to find food elsewhere.',
        success: 'Trade caravans arrive with grain and provisions. ${population.name} establishes lasting trade partnerships and becomes a hub of commerce.',
      },
    ];
    
    const scenario = this.rng.pick(famineScenarios);
    
    return {
      id: `quest_${uuidv4()}`,
      title: scenario.title,
      description: scenario.description,
      type: QuestType.SURVIVAL,
      status: QuestStatus.OPEN,
      urgency,
      originPopulationId: population.id,
      reward: `${population.name} will share everything they have - gold, land, honors, and eternal gratitude`,
      requiredHeroes: urgency === 'critical' ? 3 : 2,
      assignedHeroes: [],
      deadline: year + (urgency === 'critical' ? 5 : 15),
      failureConsequences: scenario.failure,
      successConsequences: scenario.success,
      createdAt: year,
    };
  }

  private generateContextualQuest(
    world: WorldState, 
    population: Population, 
    context: string,
    year: number
  ): Quest | null {
    // Simulate AI-generated quest based on world context
    // This creates unique quests by combining world state elements
    
    const terrain = world.geography.terrain;
    const climate = world.geography.climate;
    const resources = world.geography.resources;
    const techLevel = population.technologyLevel;
    const org = population.organization;
    
    // Build context summary for "AI" to work with
    const contextData = {
      population: population.name,
      race: population.race,
      size: population.size,
      culture: population.culture,
      organization: org,
      technologyLevel: techLevel,
      terrain,
      climate,
      resources: {
        iron: resources[Resource.IRON] || 0,
        gold: resources[Resource.GOLD] || 0,
        wood: resources[Resource.WOOD] || 0,
        stone: resources[Resource.STONE] || 0,
        food: resources[Resource.FOOD] || 0,
        water: resources[Resource.WATER] || 0,
        magic: resources[Resource.MAGIC] || 0,
        gems: resources[Resource.GEMS] || 0,
      },
      locations: world.locations.map(l => ({
        name: l.name,
        type: l.type,
        dangerLevel: l.dangerLevel,
      })),
      monsters: world.society.populations
        .filter(p => p.race === 'monster')
        .map(m => {
          const monster = m as MonsterPopulation;
          return {
            name: monster.monsterSubtype || monster.name,
            dangerLevel: monster.dangerLevel || 5,
            behavior: monster.behavior,
          };
        }),
      technologies: world.society.technologies,
      conflicts: world.society.conflicts,
    };

    // Quest templates based on context
    const questTemplates: Record<string, (data: typeof contextData, year: number) => Quest | null> = {
      'famine': (data, year) => this.createFamineQuestFromContext(data, year),
      'adaptive': (data, year) => this.createAdaptiveQuest(data, year),
      'monster': (data, year) => this.createMonsterQuestFromContext(data, year),
      'resource': (data, year) => this.createResourceQuestFromContext(data, year),
    };

    const template = questTemplates[context];
    if (!template) {
      // Fallback to adaptive quest if context not found
      return this.createAdaptiveQuest(contextData, year);
    }

    return template(contextData, year);
  }

  private createFamineQuestFromContext(data: any, year: number): Quest | null {
    // Generate famine quest using actual world context
    const terrainFeatures: Record<string, string> = {
      mountains: 'mountain caves and high-altitude herbs',
      forest: 'ancient forest groves and wild game',
      plains: 'migratory herds and hidden valleys',
      desert: 'oasis networks and underground water',
      swamp: 'reeds, fish, and medicinal bog plants',
      hills: 'terraced farming potential and caves',
      coastal: 'fishing grounds and sea caves',
      tundra: 'ice caves and hardy game',
      jungle: 'exotic fruits and dangerous wildlife',
    };

    const terrainFeature = terrainFeatures[data.terrain as keyof typeof terrainFeatures] || 'wilderness';
    const urgency = data.resources.food <= 0 ? 'critical' : 'high';
    
    return {
      id: `quest_${uuidv4()}`,
      title: `Secure Food from ${terrainFeature.charAt(0).toUpperCase() + terrainFeature.slice(1)}`,
      description: `${data.population} faces ${data.resources.food <= 0 ? 'starvation' : 'severe hunger'}. The ${data.culture} must send heroes to ${terrainFeature} to ${data.terrain === 'coastal' ? 'establish fishing grounds' : data.terrain === 'forest' ? 'hunt and forage' : 'find edible resources'}. Time is running out.`,
      type: QuestType.SURVIVAL,
      status: QuestStatus.OPEN,
      urgency,
      originPopulationId: data.population,
      reward: `${data.population} promises ${data.resources.gold > 50 ? 'treasure' : 'land and honors'} to those who save them`,
      requiredHeroes: urgency === 'critical' ? 3 : 2,
      assignedHeroes: [],
      deadline: year + (urgency === 'critical' ? 5 : 15),
      failureConsequences: `${data.population} perishes or scatters. Their ${data.terrain} settlement becomes a ghost town.`,
      successConsequences: `${data.population} survives and establishes sustainable food sources. The heroes become legends.`,
      createdAt: year,
    };
  }

  private createAdaptiveQuest(data: any, year: number): Quest | null {
    // Generate quest based on multiple world factors - truly "AI-like"
    
    // Check for specific problems and generate appropriate quests
    if (data.monsters && data.monsters.length > 0) {
      const threat = data.monsters.find((m: any) => m.dangerLevel > 5);
      if (threat) {
        return {
          id: `quest_${uuidv4()}`,
          title: `Stop the ${threat.name}`,
          description: `The ${threat.name} (Danger: ${threat.dangerLevel}/10) has been ${threat.behavior === 'aggressive' ? 'raiding' : 'terrorizing'} ${data.population}. Their ${data.terrain} lair must be destroyed before more lives are lost.`,
          type: QuestType.MONSTER_HUNT,
          status: QuestStatus.OPEN,
          urgency: threat.dangerLevel >= 7 ? 'critical' : 'high',
          originPopulationId: data.population,
          reward: `${data.population} will reward heroes with ${data.resources.iron > 50 ? 'weapons and armor' : 'gold and land'}`,
          requiredHeroes: threat.dangerLevel >= 7 ? 4 : 2,
          assignedHeroes: [],
          deadline: year + 20,
          failureConsequences: `${threat.name} destroys ${data.population}'s settlements. The ${data.terrain} region becomes uninhabitable.`,
          successConsequences: `${data.population} gains security. Trade routes become safe. Heroes are celebrated.`,
          createdAt: year,
        };
      }
    }

    if (data.resources.iron < 20) {
      return {
        id: `quest_${uuidv4()}`,
        title: 'Find New Iron Mines',
        description: `${data.population}'s iron reserves are depleted. Without iron, their ${data.technologies.join(', ')} will fail. Heroes must explore the ${data.terrain} to find new deposits or ancient caches.`,
        type: QuestType.RESOURCE_RECOVERY,
        status: QuestStatus.OPEN,
        urgency: 'high',
        originPopulationId: data.population,
        reward: `Generous payment in ${data.resources.gold > 30 ? 'gold' : 'land'} and permanent mining rights`,
        requiredHeroes: 3,
        assignedHeroes: [],
        deadline: year + 40,
        failureConsequences: `${data.population}'s technology regresses. They become vulnerable to attack.`,
        successConsequences: `${data.population} thrives with renewed resources. New trade routes established.`,
        createdAt: year,
      };
    }

    if (data.conflicts && data.conflicts.length > 0) {
      const conflict = data.conflicts[0];
      return {
        id: `quest_${uuidv4()}`,
        title: 'End the Growing Conflict',
        description: `${data.population} is at odds with another group over ${conflict.cause}. Heroes must negotiate peace or resolve the dispute before war erupts.`,
        type: QuestType.RECONCILIATION,
        status: QuestStatus.OPEN,
        urgency: 'medium',
        originPopulationId: data.population,
        reward: 'Peace, stability, and gratitude from both sides',
        requiredHeroes: 2,
        assignedHeroes: [],
        deadline: year + 50,
        failureConsequences: 'War breaks out. Both populations suffer devastating losses.',
        successConsequences: 'Peaceful coexistence. Trade and cultural exchange flourish.',
        createdAt: year,
      };
    }

    // No real problems detected - don't generate a mystery quest without a cause
    // This prevents "orphan quests" with no actual threat
    return null as any; // Will be handled by caller
  }

  private createMonsterQuestFromContext(data: any, year: number): Quest | null {
    // Fallback for monster quests
    return this.createMonsterHuntQuest({ society: { populations: [{ id: data.population, ...data }] } as any, locations: [] } as any, 
      { id: data.population, name: data.population, size: data.size, culture: data.culture, technologyLevel: data.technologyLevel, organization: data.organization, beliefs: [], relations: [], crafts: [] } as any,
      { id: 'monster_1', name: data.monsters[0]?.name || 'Monster', size: 50, race: 'monster', culture: 'monster', technologyLevel: 0, organization: 'tribal', beliefs: [], relations: [], crafts: [], monsterType: 'orc', monsterSubtype: data.monsters[0]?.name, dangerLevel: data.monsters[0]?.dangerLevel || 5, behavior: 'aggressive', raidFrequency: 0.3, isDormant: false } as any,
      year);
  }

  private createResourceQuestFromContext(data: any, year: number): Quest | null {
    // Fallback for resource quests
    return this.createResourceRecoveryQuest({ geography: { resources: { iron: data.resources.iron } } } as any,
      { id: data.population, name: data.population, size: data.size, culture: data.culture, technologyLevel: data.technologyLevel, organization: data.organization, beliefs: [], relations: [], crafts: [] } as any,
      Resource.IRON, year);
  }

  private createResourceRecoveryQuest(
    world: WorldState,
    population: Population,
    resource: Resource,
    year: number
  ): Quest {
    const resourceNames: Record<Resource, string> = {
      [Resource.IRON]: 'iron', [Resource.GOLD]: 'gold', [Resource.SILVER]: 'silver',
      [Resource.COPPER]: 'copper', [Resource.WOOD]: 'timber', [Resource.STONE]: 'stone',
      [Resource.FOOD]: 'food', [Resource.WATER]: 'water', [Resource.MAGIC]: 'magical artifacts',
      [Resource.GEMS]: 'precious gems',
    };
    
    return {
      id: `quest_${uuidv4()}`,
      title: `Secure new ${resourceNames[resource]} sources`,
      description: `${population.name}'s ${resource} reserves are critically depleted. Expeditions must venture into dangerous territories to find new sources or ancient caches.`,
      type: QuestType.RESOURCE_RECOVERY,
      status: QuestStatus.OPEN,
      urgency: 'high',
      originPopulationId: population.id,
      reward: `Generous payment in ${resource} and land grants`,
      requiredHeroes: 3,
      assignedHeroes: [],
      deadline: year + 40,
      failureConsequences: `${population.name}'s economy collapses, technology regresses, weakness invites invasion`,
      successConsequences: `${population.name} thrives, new trade routes established`,
      createdAt: year,
    };
  }

  private checkCraftGeneration(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];
    
    // Initialize crafts array if not exists
    if (!world.crafts) {
      world.crafts = [];
    }
    if (!world.society.crafts) {
      world.society.crafts = [];
    }

    // Check for craft creation opportunities
    for (const population of world.society.populations) {
      if (population.race === 'monster') continue;

      // Chance for craft creation based on technology level and resources
      const techBonus = population.technologyLevel * 0.03; // 3% per tech level
      const magicResource = world.geography.resources[Resource.MAGIC] || 0;
      const magicBonus = magicResource > 50 ? 0.20 : magicResource > 30 ? 0.15 : magicResource > 10 ? 0.08 : 0.02;
      const craftChance = 0.05 + techBonus + magicBonus; // Base 5% + tech + magic (minimum 7%)

      if (this.rng.boolean(craftChance)) {
        const craft = this.generateCraft(world, population, nextYear);
        if (craft) {
          world.crafts.push(craft);
          world.society.crafts.push(craft.id);
          
          // Add to creator population
          if (!population.crafts) {
            population.crafts = [];
          }
          population.crafts.push(craft.id);

          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.CRAFT_CREATION,
            title: craft.name,
            description: `The ${craft.category} "${craft.name}" has been created`,
            causes: [],
            effects: [],
            location: world.locations.find(l => l.inhabitants.includes(population.id))?.id,
            impact: {
              society: [{
                type: 'create',
                target: craft.name,
                description: `${craft.rarity} ${craft.category} created by ${population.name}`,
              }],
            },
          });
        }
      }
    }

    // Chance for discovering ancient/lost crafts
    if (this.rng.boolean(0.02)) { // 2% chance per step
      const discovery = this.discoverAncientCraft(world, nextYear);
      if (discovery) {
        world.crafts.push(discovery);
        world.society.crafts.push(discovery.id);

        events.push({
          id: uuidv4(),
          year: nextYear,
          type: EventType.CRAFT_DISCOVERY,
          title: `Discovery: ${discovery.name}`,
          description: `The ancient ${discovery.category} "${discovery.name}" has been rediscovered`,
          causes: [],
          effects: [],
          impact: {
            society: [{
              type: 'create',
              target: discovery.name,
              description: `Lost ${discovery.rarity} artifact found`,
            }],
          },
        });
      }
    }

    // Chance for crafts to be lost/hidden (becoming legendary)
    if (world.crafts.length > 0 && this.rng.boolean(0.01)) { // 1% chance
      const visibleCrafts = world.crafts.filter(c => !c.isHidden);
      if (visibleCrafts.length > 0) {
    const lostCraft = this.rng.pick(visibleCrafts);
    lostCraft.isHidden = true;
    lostCraft.location = undefined;

        events.push({
          id: uuidv4(),
          year: nextYear,
          type: EventType.CRAFT_LOST,
          title: `${lostCraft.name} Lost`,
          description: `The legendary ${lostCraft.name} has disappeared from history`,
          causes: [],
          effects: [],
          impact: {
            society: [{
              type: 'transform',
              target: lostCraft.name,
              description: 'Legendary artifact becomes lost to time',
            }],
          },
        });
      }
    }

    return events;
  }

  private generateCraft(world: WorldState, population: Population, year: number): Craft | null {
    const techLevel = population.technologyLevel;
    const magicResource = world.geography.resources[Resource.MAGIC] || 0;
    
    // Determine rarity based on tech level and magic
    let rarity: CraftRarity;
    const rarityRoll = this.rng.next();
    
    if (techLevel >= 8 && magicResource > 50 && rarityRoll > 0.95) {
      rarity = CraftRarity.MYTHIC;
    } else if (techLevel >= 6 && magicResource > 30 && rarityRoll > 0.90) {
      rarity = CraftRarity.LEGENDARY;
    } else if (techLevel >= 4 && rarityRoll > 0.80) {
      rarity = CraftRarity.RARE;
    } else if (rarityRoll > 0.60) {
      rarity = CraftRarity.UNCOMMON;
    } else {
      rarity = CraftRarity.COMMON;
    }

    // Determine category based on tech level and available resources
    const categories: CraftCategory[] = [];
    
    if (techLevel >= 2) categories.push(CraftCategory.TOOL);
    if (techLevel >= 3) categories.push(CraftCategory.WEAPON, CraftCategory.ARMOR);
    if (techLevel >= 5) categories.push(CraftCategory.JEWELRY);
    if (techLevel >= 6) categories.push(CraftCategory.ARTIFACT);
    if (techLevel >= 7) categories.push(CraftCategory.BOOK);
    if (techLevel >= 8) categories.push(CraftCategory.STRUCTURE);
    
    if (magicResource > 30) {
      categories.push(CraftCategory.ARTIFACT, CraftCategory.RELIC);
    }
    
    const category = categories.length > 0 
      ? this.rng.pick(categories.filter(c => c !== undefined))
      : CraftCategory.TOOL;

    // Generate name and description based on category, rarity, and culture
    const craft = this.createCraftWithNameAndDescription(
      population, 
      category, 
      rarity, 
      world.geography.terrain,
      magicResource,
      year,
      world
    );

    craft.creationYear = year;
    craft.creatorPopulationId = population.id;
    craft.location = world.locations.find(l => l.inhabitants.includes(population.id))?.id;
    
    // Higher rarity crafts have chance to be hidden/lost
    if (rarity === CraftRarity.LEGENDARY || rarity === CraftRarity.MYTHIC) {
      craft.isHidden = this.rng.boolean(0.1); // 10% chance to be immediately lost
    }

    return craft;
  }

  private createCraftWithNameAndDescription(
    population: Population,
    category: CraftCategory,
    rarity: CraftRarity,
    terrain: string,
    magicResource: number,
    year: number,
    world: WorldState
  ): Craft {
    const namePrefixes = {
      weapon: ['Dawn', 'Storm', 'Shadow', 'Iron', 'Blood', 'Soul', 'Fate', 'Dragon', 'Star', 'Void'],
      armor: ['Steel', 'Iron', 'Shadow', 'Dragon', 'Star', 'Ancient', 'Eternal', 'Void', 'Light', 'Dark'],
      tool: ['Wisdom', 'Craft', 'Stone', 'Iron', 'Magic', 'Ancient', 'Eternal', 'Quick', 'Strong'],
      artifact: ['Ancient', 'Lost', 'Forbidden', 'Sacred', 'Cursed', 'Divine', 'Eternal', 'Primordial'],
      book: ['Ancient', 'Forbidden', 'Sacred', 'Lost', 'Eternal', 'Hidden', 'Secret', 'Primordial'],
      jewelry: ['Star', 'Moon', 'Sun', 'Dragon', 'Crystal', 'Diamond', 'Ruby', 'Emerald'],
      structure: ['Stone', 'Iron', 'Ancient', 'Eternal', 'Fortress', 'Temple', 'Tower'],
      relic: ['Ancient', 'Lost', 'Sacred', 'Cursed', 'Divine', 'Forbidden', 'Eternal'],
    };

    const nameRoots = {
      weapon: ['Blade', 'Sword', 'Axe', 'Spear', 'Bow', 'Hammer', 'Dagger', 'Staff', 'Claw', 'Fang'],
      armor: ['Plate', 'Shield', 'Mail', 'Barding', 'Carapace', 'Bastion', 'Aegis', 'Vest'],
      tool: ['Hammer', 'Anvil', 'Tongs', 'Chisel', 'Saw', 'Pick', 'Drill', 'Forge'],
      artifact: ['Orb', 'Crystal', 'Amulet', 'Tome', 'Crown', 'Scepter', 'Chalice', 'Reliquary'],
      book: ['Tome', 'Codex', 'Grimoire', 'Scroll', 'Compendium', 'Chronicle', 'Grimoire'],
      jewelry: ['Amulet', 'Ring', 'Necklace', 'Crown', 'Tiara', 'Brooch', 'Charm'],
      structure: ['Keep', 'Tower', 'Temple', 'Sanctuary', 'Fortress', 'Citadel', 'Spire'],
      relic: ['Shard', 'Fragment', 'Relic', 'Token', 'Talisman', 'Medallion'],
    };

    const descriptions = {
      weapon: [
        'A blade that never dulls, said to be forged from starlight',
        'An ancient weapon imbued with the power of storms',
        'A shadow-wreathed blade that strikes without sound',
        'A dragon-forged weapon of terrible power',
      ],
      armor: [
        'Armor crafted from the scales of an ancient dragon',
        'A shield that glows with protective magic',
        'Plate mail that seems to shift between shadow and light',
        'Ancient armor that grants the wearer unnatural resilience',
      ],
      tool: [
        'A hammer that can shape any material with a single blow',
        'Tools of the ancient masters, still perfect after centuries',
        'A forge that can create magical artifacts',
      ],
      artifact: [
        'An artifact of immense power, pulsing with arcane energy',
        'A relic from a forgotten age, its purpose unknown',
        'A crystalline orb that shows visions of possible futures',
        'An ancient crown that grants dominion over elemental forces',
      ],
      book: [
        'A tome containing secrets lost to time',
        'Forbidden knowledge bound in leather of unknown origin',
        'An ancient codex written in a language no one remembers',
      ],
      jewelry: [
        'An amulet that glows with inner light',
        'A ring forged from a fallen star',
        'A necklace of dragon gems that pulses with power',
      ],
      structure: [
        'A fortress that seems to exist between dimensions',
        'An ancient temple that hums with magical energy',
        'A tower that touches the sky, built by forgotten hands',
      ],
      relic: [
        'A shard of an ancient god, still radiating power',
        'A fragment of the first creation, untouched by time',
        'A talisman that wards off all evil',
      ],
    };

    const key = category as keyof typeof namePrefixes;
    const prefix = namePrefixes[key] ? this.rng.pick(namePrefixes[key]) : 'Ancient';
    const root = nameRoots[key] ? this.rng.pick(nameRoots[key]) : 'Relic';
    
    let name = `${prefix} ${root}`;
    
    // Add terrain-specific modifier
    const terrainModifiers: Record<string, string[]> = {
      mountains: ['Mountain', 'Stone', 'Deep', 'Peak'],
      forest: ['Forest', 'Green', 'Wood', 'Leaf'],
      plains: ['Wind', 'Plain', 'Open', 'Sky'],
      desert: ['Sand', 'Sun', 'Dune', 'Heat'],
      swamp: ['Mire', 'Bog', 'Fen', 'Marsh'],
      coastal: ['Sea', 'Tide', 'Wave', 'Ocean'],
    };
    
    const terrainMod = terrainModifiers[terrain] || [];
    if (terrainMod.length > 0 && this.rng.boolean(0.3)) {
      const mod = this.rng.pick(terrainMod);
      name = `${mod} ${name}`;
    }

    // Add rarity modifier
    const rarityAdjectives = {
      common: ['Simple', 'Basic', 'Ordinary'],
      uncommon: ['Fine', 'Quality', 'Improved'],
      rare: ['Masterwork', 'Exquisite', 'Superior'],
      legendary: ['Legendary', 'Fabled', 'Illustrious'],
      mythic: ['Mythic', 'Primordial', 'Divine'],
    };
    
    if (rarity === CraftRarity.MYTHIC || rarity === CraftRarity.LEGENDARY) {
      const adj = this.rng.pick(rarityAdjectives[rarity]);
      name = `${adj} ${name}`;
    }

    const descKey = key as keyof typeof descriptions;
    const baseDescription = descriptions[descKey] ? this.rng.pick(descriptions[descKey]) : 'An ancient item of unknown purpose';
    
    const description = `${baseDescription}. Created by ${population.culture} during the ${population.organization} era.`;

    // Generate effects based on rarity
    const effects: string[] = [];
    if (rarity === CraftRarity.RARE) {
      effects.push('+2 to relevant checks');
    } else if (rarity === CraftRarity.LEGENDARY) {
      effects.push('+5 to relevant checks', 'Grants special ability');
    } else if (rarity === CraftRarity.MYTHIC) {
      effects.push('+10 to relevant checks', 'Grants legendary ability', 'Sentient artifact');
    }

    return {
      id: `craft_${uuidv4()}`,
      name,
      description,
      category,
      rarity,
      requiredTechLevel: Math.min(10, population.technologyLevel),
      requiredResources: {},
      creatorPopulationId: population.id,
      creationYear: year,
      location: world.locations.find(l => l.inhabitants.includes(population.id))?.id,
      effects: effects.length > 0 ? effects : undefined,
      isHidden: false,
      history: [`Created by ${population.name} in year ${year}`],
    };
  }

  private discoverAncientCraft(world: WorldState, year: number): Craft | null {
    // Generate a random ancient craft that was lost to time
    const categories = Object.values(CraftCategory);
    const category = this.rng.pick(categories);
    
    const rarities = [CraftRarity.RARE, CraftRarity.LEGENDARY, CraftRarity.MYTHIC];
    const rarity = this.rng.pick(rarities);
    
    const names = [
      'Sword of the First Age', 'Crown of Lost Kings', 'Tome of Forgotten Secrets',
      'Amulet of Ancient Powers', 'Shield of the Ancients', 'Staff of Primordial Magic',
      'Ring of Eternal Flame', 'Chalice of the Gods', 'Cloak of Shadows',
    ];
    
    const name = this.rng.pick(names);
    
    const descriptions = [
      'A relic from a civilization that predates recorded history',
      'An artifact of immense power, its origins unknown even to the oldest scholars',
      'A legendary item mentioned in the oldest myths and legends',
      'A creation of the ancient masters, thought to be lost forever',
    ];
    
    const description = `${this.rng.pick(descriptions)}. Recently discovered in ${world.geography.terrain} ruins.`;

    return {
      id: `craft_${uuidv4()}`,
      name,
      description,
      category,
      rarity,
      requiredTechLevel: 5,
      requiredResources: {},
      creatorPopulationId: 'unknown',
      creationYear: year - this.rng.nextInt(100, 1000), // Created 100-1000 years ago
      location: undefined,
      effects: rarity === CraftRarity.MYTHIC ? ['+10 to relevant checks', 'Ancient power'] : 
               rarity === CraftRarity.LEGENDARY ? ['+5 to relevant checks'] : ['+2 to relevant checks'],
      isHidden: false,
      history: [`Discovered in year ${year}`],
    };
  }
}
