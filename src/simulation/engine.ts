/**
 * Simulation engine for world evolution
 * Handles time progression and rule evaluation
 * 
 * Refactored to use modular simulation components
 */

import { WorldState, Event, SimulationParams, Change, Resource, EventType, QuestStatus } from '../types';
import { WorldManager } from '../core/worldManager';
import { SeededRandom } from '../utils/random';
import { EventDeduplicator } from './utils/eventDeduplicator';
import {
  PopulationModule,
  MonsterModule,
  LocationModule,
  QuestModule,
  CraftModule,
  BeliefModule,
  ResourceModule,
  ConflictModule,
  HeroModule,
} from './modules';
import { generateEventId, generatePopulationId } from '../utils/idGenerator';

export class SimulationEngine {
  private worldManager: WorldManager;
  private rng: SeededRandom;
  private eventDeduplicator: EventDeduplicator;
  
  // Modular simulation components
  private populationModule: PopulationModule;
  private monsterModule: MonsterModule;
  private locationModule: LocationModule;
  private questModule: QuestModule;
  private craftModule: CraftModule;
  private beliefModule: BeliefModule;
  private resourceModule: ResourceModule;
  private conflictModule: ConflictModule;
  private heroModule: HeroModule;

  constructor(worldManager: WorldManager, seed: string) {
    this.worldManager = worldManager;
    this.rng = new SeededRandom(seed);
    this.eventDeduplicator = new EventDeduplicator(0.8);
    
    // Initialize modules with shared RNG for deterministic behavior
    this.populationModule = new PopulationModule(this.rng);
    this.monsterModule = new MonsterModule(this.rng);
    this.locationModule = new LocationModule(this.rng);
    this.questModule = new QuestModule(this.rng);
    this.craftModule = new CraftModule(this.rng);
    this.beliefModule = new BeliefModule(this.rng);
    this.resourceModule = new ResourceModule(this.rng);
    this.conflictModule = new ConflictModule(this.rng);
    this.heroModule = new HeroModule(this.rng);
  }

  /**
   * Get the hero module for external tool handlers
   * Ensures all hero operations use the same RNG instance for determinism
   */
  public getHeroModule(): HeroModule {
    return this.heroModule;
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

      // Check for quests with expired deadlines
      this.checkQuestDeadlines(world, nextYear);

      // Evaluate all active rules using modules
      const newEvents = this.evaluateRules(world, currentYear, nextYear, params);
      
      // Deduplicate events to reduce noise and improve narrative quality
      const deduplicatedEvents = this.deduplicateEvents(newEvents);
      
      // Apply event effects
      for (const event of deduplicatedEvents) {
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

  private checkQuestDeadlines(world: WorldState, currentYear: number): void {
    if (!world.quests) return;

    for (const quest of world.quests) {
      // Skip already completed/failed/abandoned quests
      if (quest.status !== QuestStatus.OPEN && quest.status !== QuestStatus.IN_PROGRESS) {
        continue;
      }

      // Check if deadline has passed
      if (quest.deadline !== undefined && currentYear > quest.deadline) {
        // Mark quest as failed
        quest.status = QuestStatus.FAILED;
        quest.failureReason = `Deadline expired at year ${quest.deadline}`;
        quest.completedAt = currentYear;

        // Handle hero consequences for failed quest
        const heroResult = this.heroModule.handleQuestCompletion(world, quest, false, undefined);

        // Create quest failed event
        const event: Event = {
          id: generateEventId(),
          year: currentYear,
          type: EventType.QUEST_FAILED,
          title: `Quest Failed: ${quest.title}`,
          description: `The quest "${quest.title}" failed due to expired deadline. ${quest.failureConsequences}`,
          causes: [],
          effects: [],
          impact: {
            society: [{
              type: 'destroy',
              target: quest.title,
              description: quest.failureConsequences,
            }],
          },
        };

        world.events.push(event);
        world.timeline.events.push(event);

        // Process hero deaths from failed quest
        for (const hero of heroResult.deaths) {
          const deathEvent: Event = {
            id: generateEventId(),
            year: currentYear,
            type: EventType.HERO_DEATH,
            title: `${hero.name} Falls`,
            description: `${hero.name} dies: ${hero.deathCause}`,
            causes: [],
            effects: [],
            impact: {
              society: [{
                type: 'destroy',
                target: hero.name,
                description: `Hero ${hero.name} has died`,
              }],
            },
          };
          world.events.push(deathEvent);
          world.timeline.events.push(deathEvent);
        }

        // Process commemorations
        for (const commemoration of heroResult.commemorations) {
          if (!world.crafts) world.crafts = [];
          world.crafts.push(commemoration);
          
          if (!world.society.crafts) world.society.crafts = [];
          if (!world.society.crafts.includes(commemoration.id)) {
            world.society.crafts.push(commemoration.id);
          }

          const commEvent: Event = {
            id: generateEventId(),
            year: currentYear,
            type: EventType.COMMEMORATION_CREATED,
            title: `${commemoration.name}`,
            description: commemoration.description,
            causes: [],
            effects: [],
            impact: {
              society: [{
                type: 'create',
                target: commemoration.name,
                description: `Created ${commemoration.category} to honor hero's deeds`,
              }],
            },
          };
          world.events.push(commEvent);
          world.timeline.events.push(commEvent);
        }
      }
    }
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
    if (change.type === 'increase') {
      const target = change.target as Resource;
      world.geography.resources[target] = 
        Math.min(100, (world.geography.resources[target] || 0) + (change.value || 10));
    } else if (change.type === 'decrease') {
      const target = change.target as Resource;
      world.geography.resources[target] = 
        Math.max(0, (world.geography.resources[target] || 0) - (change.value || 10));
    } else if (change.type === 'transform') {
      // Terrain transformation would go here
    }
  }

  private applySocietyChange(world: WorldState, change: Change): void {
    // Society changes are handled by the modules that created them
    // This is for any additional effects
  }

  private applyResourceChange(world: WorldState, change: Change): void {
    if (change.type === 'increase') {
      const target = change.target as Resource;
      world.geography.resources[target] = 
        Math.min(100, (world.geography.resources[target] || 0) + (change.value || 10));
    } else if (change.type === 'decrease') {
      const target = change.target as Resource;
      world.geography.resources[target] = 
        Math.max(0, (world.geography.resources[target] || 0) - (change.value || 10));
    } else if (change.type === 'destroy') {
      const target = change.target as Resource;
      world.geography.resources[target] = 0;
    }
  }

  private evaluateRules(
    world: WorldState,
    currentYear: number,
    nextYear: number,
    params: SimulationParams
  ): Event[] {
    const events: Event[] = [];

    // Population dynamics
    if (params.enableConflict !== false) {
      events.push(...this.populationModule.checkPopulationDynamics(world, currentYear, nextYear));
    }

    // Resource dynamics and technology
    events.push(...this.resourceModule.checkResourceDynamics(world, currentYear, nextYear));
    if (params.enableTechProgress !== false) {
      events.push(...this.resourceModule.checkTechnologicalProgress(world, currentYear, nextYear));
    }

    // Conflict generation
    if (params.enableConflict !== false) {
      events.push(...this.conflictModule.checkConflictGeneration(world, currentYear, nextYear));
    }

    // Migration
    if (params.enableMigration !== false) {
      events.push(...this.conflictModule.checkMigration(world, currentYear, nextYear, () => 
        this.locationModule.generateNewLocationName(world)));
    }

    // Monster activity
    events.push(...this.monsterModule.checkMonsterActivity(world, currentYear, nextYear));

    // Location evolution
    events.push(...this.locationModule.checkLocationEvolution(world, currentYear, nextYear));

    // Quest generation
    events.push(...this.questModule.checkQuestGeneration(world, currentYear, nextYear));

    // Hero spawning for open quests
    const heroResult = this.heroModule.checkHeroSpawning(world, nextYear);
    for (const hero of heroResult.spawned) {
      events.push({
        id: generateEventId(),
        year: nextYear,
        type: 'hero_spawned' as any,
        title: `Hero Born: ${hero.name}`,
        description: `${hero.name}, a ${hero.heroClass} from ${hero.culture}, emerges to answer the call`,
        causes: [],
        effects: [],
        impact: {
          society: [{
            type: 'create',
            target: hero.name,
            description: `New hero ${hero.name} spawned`,
          }],
        },
      });
    }

    // Craft generation
    events.push(...this.craftModule.checkCraftGeneration(world, currentYear, nextYear));

    // Natural events
    events.push(...this.checkNaturalEvents(world, currentYear, nextYear));

    // Link events causally
    this.linkEventsCausally(world, events);

    return events;
  }

  private checkNaturalEvents(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];
    
    // Random natural events
    if (this.rng.boolean(0.05)) {
      const eventTypes = [
        { type: 'natural_disaster', title: 'Earthquake', impact: 'geography' },
        { type: 'natural_disaster', title: 'Flood', impact: 'geography' },
        { type: 'natural_disaster', title: 'Drought', impact: 'resources' },
        { type: 'natural_event', title: 'Bountiful Harvest', impact: 'resources' },
        { type: 'natural_event', title: 'Meteor Shower', impact: 'society' },
      ];
      
      const event = this.rng.pick(eventTypes);
      
      events.push({
        id: generateEventId(),
        year: nextYear,
        type: event.type as any,
        title: event.title,
        description: `${event.title} occurs in the world`,
        causes: [],
        effects: [],
        impact: {
          [event.impact]: [{
            type: 'transform',
            target: 'world',
            description: event.title,
          }],
        },
      });
    }

    return events;
  }

  private linkEventsCausally(world: WorldState, newEvents: Event[]): void {
    // Simple causal linking: events in the same year may be related
    for (let i = 0; i < newEvents.length; i++) {
      for (let j = i + 1; j < newEvents.length; j++) {
        if (this.rng.boolean(0.1)) {
          newEvents[i].effects?.push(newEvents[j].id);
          newEvents[j].causes?.push(newEvents[i].id);
        }
      }
    }
  }

  /**
   * Deduplicate an array of events to reduce noise and improve narrative quality
   * 
   * This method uses the EventDeduplicator to:
   * - Remove exact duplicates (same year, type, location, target, title)
   * - Merge similar events (80% similarity threshold)
   * - Combine descriptions and effects of merged events
   * 
   * @param events - Array of events to deduplicate
   * @returns Deduplicated/merged array of events
   */
  private deduplicateEvents(events: Event[]): Event[] {
    return this.eventDeduplicator.deduplicateEvents(events);
  }

  /**
   * Create a signature for an event used in deduplication
   * 
   * The signature includes key attributes that define event identity:
   * - Year of the event
   * - Event type
   * - Location (if present)
   * - Target population (extracted from description/impact)
   * - Title
   * 
   * @param event - The event to create a signature for
   * @returns Event signature object
   */
  private createEventSignature(event: Event): any {
    return this.eventDeduplicator.createEventSignature(event);
  }

  private updateEras(world: WorldState, params: SimulationParams): void {
    const eraMilestones = [100, 500, 1000, 2000, 5000];
    
    for (const milestone of eraMilestones) {
      if (world.timestamp >= milestone && !world.timeline.eras.some(e => e.endYear === milestone)) {
        const eraSummary = this.generateEraSummary(world, 
          world.timeline.eras.length > 0 ? world.timeline.eras[world.timeline.eras.length - 1].endYear : 0, 
          milestone);
        
        world.timeline.eras.push({
          name: `Era of ${milestone}`,
          startYear: world.timeline.eras.length > 0 ? world.timeline.eras[world.timeline.eras.length - 1].endYear : 0,
          endYear: milestone,
          summary: eraSummary,
        });
      }
    }
  }

  private generateEraSummary(world: WorldState, startYear: number, endYear: number): string {
    const eraEvents = world.events.filter(e => e.year >= startYear && e.year <= endYear);
    return `${eraEvents.length} significant events occurred between years ${startYear} and ${endYear}`;
  }
}
