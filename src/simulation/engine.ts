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

    if (params.enableTechProgress && params.complexity !== 'simple') {
      const techEvents = this.checkTechnologicalProgress(world, currentYear, nextYear);
      events.push(...techEvents);
    }

    if (params.enableConflict && params.complexity === 'complex') {
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

    this.linkEventsCausally(world, events);

    return events;
  }

  private checkPopulationDynamics(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];

    for (const population of world.society.populations) {
      const foodAvailability = world.geography.resources[Resource.FOOD];
      const waterAvailability = world.geography.resources[Resource.WATER];
      
      let growthRate = 0.02;
      growthRate += (foodAvailability / 100) * 0.03;
      growthRate += (waterAvailability / 100) * 0.02;
      growthRate -= (population.technologyLevel > 5) ? 0.01 : 0;
      
      const change = Math.floor(population.size * growthRate);
      
      if (Math.abs(change) > 0) {
        population.size += change;
        
        const eventType = change > 0 ? EventType.SOCIAL : EventType.CONFLICT;
        const title = change > 0 ? 'Population Growth' : 'Population Decline';
        
        events.push({
          id: uuidv4(),
          year: nextYear,
          type: eventType,
          title,
          description: `${population.name} population ${change > 0 ? 'grew' : 'shrank'} by ${Math.abs(change)} people`,
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
      const consumptionRate = population.size * 0.1;
      
      const foodConsumed = Math.min(
        world.geography.resources[Resource.FOOD],
        consumptionRate * 0.5
      );
      world.geography.resources[Resource.FOOD] -= foodConsumed;

      if (population.organization !== 'nomadic') {
        const woodConsumed = Math.min(
          world.geography.resources[Resource.WOOD],
          consumptionRate * 0.2
        );
        world.geography.resources[Resource.WOOD] -= woodConsumed;
      }
    }

    const regenRate = 0.05;
    for (const resource of Object.values(Resource)) {
      if (resource === Resource.FOOD || resource === Resource.WATER) continue;
      
      const current = world.geography.resources[resource];
      if (current < 100) {
        world.geography.resources[resource] = Math.min(100, current + regenRate);
      }
    }

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

      if (foodStress || overpopulation) {
        if (this.rng.boolean(0.3)) {
          const newLocation: Location = {
            id: uuidv4(),
            type: LocationType.SETTLEMENT,
            name: this.generateNewLocationName(world),
            description: 'A new settlement established by migrating group',
            geography: {},
            inhabitants: [],
            history: [],
            features: ['temporary shelters', 'trail markers'],
            connections: [world.locations[0]?.id].filter(Boolean) as string[],
            dangerLevel: 0,
            complexity: 1,
          };

          world.locations.push(newLocation);

          events.push({
            id: uuidv4(),
            year: nextYear,
            type: EventType.MIGRATION,
            title: 'Migration',
            description: `${population.name} establishes new settlement: ${newLocation.name}`,
            causes: [],
            effects: [],
            location: newLocation.id,
            impact: {
              society: [{
                type: 'create',
                target: newLocation.name,
                description: 'New settlement founded',
              }],
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
          const totalDefense = defenseBonus + organizationBonus;
          
          // Raid damage reduced by defense
          const baseDamage = Math.floor(monster.size * (monster.dangerLevel / 10) * 0.5);
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
}
