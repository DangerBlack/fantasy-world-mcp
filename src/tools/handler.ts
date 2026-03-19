/**
 * MCP Tool handlers
 */

import { WorldManager } from '../core/worldManager';
import { SimulationEngine } from '../simulation/engine';
import { InitialConditions, SimulationParams, Craft, CraftCategory, CraftRarity, Quest, QuestType, QuestStatus, EventType, WorldState } from '../types';
import { ExportFormatter } from '../utils/export';
import { generateEventId, generatePopulationId, generateCraftId } from '../utils/idGenerator';
import { HeroModule } from '../simulation/modules/heroes';
import { SeededRandom } from '../utils/random';

export class ToolHandler {
  private worldManager: WorldManager;
  private simulationEngine: SimulationEngine;
  private exportFormatter: ExportFormatter;
  private heroModule: HeroModule;

  constructor(seed: string) {
    this.worldManager = new WorldManager(seed);
    this.simulationEngine = new SimulationEngine(this.worldManager, seed);
    this.exportFormatter = new ExportFormatter();
    // Use the hero module from simulation engine to ensure shared RNG for deterministic behavior
    this.heroModule = this.simulationEngine.getHeroModule();
  }

  async initializeWorld(args: {
    seed?: string;
    event: string;
    locationType: string;
    region: string;
    climate: string;
    resources?: Record<string, number>;
    population: any | any[];
  }): Promise<{ worldId: string; world: any }> {
    interface InputPopulation {
      name: string;
      size: number;
      race?: string;
      culture: string;
      organization: string;
    }

    const populations: InputPopulation[] = Array.isArray(args.population) 
      ? args.population.map((p: any) => ({
          name: p.name,
          size: p.size,
          race: p.race || 'human',
          culture: p.culture,
          organization: p.organization,
        }))
      : [{
          name: args.population.name,
          size: args.population.size,
          race: args.population.race || 'human',
          culture: args.population.culture,
          organization: args.population.organization,
        }];

    const conditions: InitialConditions = {
      event: args.event,
      locationType: args.locationType as any,
      region: args.region as any,
      climate: args.climate as any,
      resources: args.resources || {},
      population: populations.length === 1 ? populations[0] as any : populations as any,
    };

    const world = await this.worldManager.createWorld(conditions);
    return { worldId: world.id, world };
  }

  async loadWorld(args: { worldData: string }): Promise<{ worldId: string; world: any }> {
    // AI passes back previously saved world data
    const world = JSON.parse(args.worldData);
    await this.worldManager.updateWorld(world.id, world);
    return { worldId: world.id, world };
  }

  simulate(args: {
    worldId: string;
    timespan: number;
    stepSize?: number;
    complexity?: string;
    enableConflict?: boolean;
    enableMigration?: boolean;
    enableTechProgress?: boolean;
  }): { world: any; events: any[]; eras: any[] } {
    const params: SimulationParams = {
      timespan: args.timespan || 100,
      stepSize: args.stepSize || 10,
      complexity: (args.complexity ?? 'complex') as any,
      enableConflict: args.enableConflict ?? true,
      enableMigration: args.enableMigration ?? true,
      enableTechProgress: args.enableTechProgress ?? true,
    };

    const world = this.simulationEngine.simulate(args.worldId, params);
    return {
      world,
      events: world.events,
      eras: world.timeline.eras,
    };
  }

  getWorldState(args: { worldId: string; year?: number }): any {
    const world = this.worldManager.getWorld(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }

    if (args.year !== undefined) {
      // Return snapshot at specific year
      return this.getSnapshotAt(world, args.year);
    }

    return world;
  }

  getTimeline(args: { worldId: string; startYear?: number; endYear?: number }): {
    events: any[];
    eras: any[];
  } {
    const world = this.worldManager.getWorld(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }

    let events = world.events;
    
    if (args.startYear !== undefined) {
      events = events.filter(e => e.year >= args.startYear!);
    }
    if (args.endYear !== undefined) {
      events = events.filter(e => e.year <= args.endYear!);
    }

    return {
      events,
      eras: world.timeline.eras,
    };
  }

  generateLocation(args: {
    worldId: string;
    locationType: string;
    name?: string;
    description?: string;
  }): any {
    const world = this.worldManager.getWorld(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }

    // Simple location generation based on world state
    const location: any = {
      id: `loc_${Date.now()}`,
      type: args.locationType as any,
      name: args.name || `New ${args.locationType}`,
      description: args.description || `A newly discovered ${args.locationType}`,
      geography: world.geography,
      inhabitants: world.society.populations.map(p => p.id),
      history: [],
      features: this.generateLocationFeatures(args.locationType, world),
      connections: world.locations.map(l => l.id),
      dangerLevel: args.locationType === 'dungeon' ? 5 : 0,
      complexity: 3,
    };

    world.locations.push(location);
    return location;
  }

  exportWorld(args: {
    worldId: string;
    format?: string;
    includeTimeline?: boolean;
    includeLocations?: boolean;
  }): string {
    const world = this.worldManager.getWorld(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }

    return this.exportFormatter.format(world, {
      format: args.format as any,
      includeTimeline: args.includeTimeline ?? true,
      includeLocations: args.includeLocations ?? true,
    });
  }

  async exportWorldToFile(args: {
    worldId: string;
    format?: string;
    includeTimeline?: boolean;
    includeLocations?: boolean;
    filePath?: string;
  }): Promise<{ filePath: string; size: number; format: string }> {
    const world = this.worldManager.getWorld(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }

    const format = (args.format || 'markdown') as any;
    const defaultPath = `exports/${args.worldId}_${Date.now()}.${format === 'json' ? 'json' : 'md'}`;
    const filePath = args.filePath || defaultPath;

    await this.exportFormatter.exportWorldToFile(world, {
      format,
      includeTimeline: args.includeTimeline ?? true,
      includeLocations: args.includeLocations ?? true,
    }, filePath);

    const stats = await import('fs').then(fs => fs.promises.stat(filePath));
    
    return {
      filePath,
      size: stats.size,
      format,
    };
  }

  async readExportFile(args: {
    filePath: string;
    startLine?: number;
    endLine?: number;
    startByte?: number;
    endByte?: number;
  }): Promise<{
    content: string;
    totalLines: number;
    totalBytes: number;
    lineRange: [number, number];
    byteRange: [number, number];
    hasMore: boolean;
  }> {
    return this.exportFormatter.readExportFile(args.filePath, {
      startLine: args.startLine,
      endLine: args.endLine,
      startByte: args.startByte,
      endByte: args.endByte,
    });
  }

  async listHeroes(args: {
    worldId: string;
    status?: string;
  }): Promise<{ heroes: any[] }> {
    const world = this.worldManager.getWorld(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }

    let heroes = world.heroes || [];
    
    if (args.status) {
      heroes = heroes.filter(h => h.status === args.status);
    }

    return { heroes };
  }

  async getHero(args: {
    worldId: string;
    heroId: string;
  }): Promise<{ hero: any }> {
    const world = this.worldManager.getWorld(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }

    const hero = world.heroes?.find(h => h.id === args.heroId);
    if (!hero) {
      throw new Error(`Hero ${args.heroId} not found in world ${args.worldId}`);
    }

    return { hero };
  }

  async listWorlds(): Promise<string[]> {
    return await this.worldManager.listWorlds();
  }

  async deleteWorld(args: { worldId: string }): Promise<{ success: boolean }> {
    await this.worldManager.deleteWorld(args.worldId);
    return { success: true };
  }

  async addPopulation(args: {
    worldId: string;
    name: string;
    size: number;
    race: string;
    culture: string;
    organization: string;
    monsterType?: string;
    dangerLevel?: number;
    behavior?: string;
  }): Promise<{ success: boolean; populationId: string }> {
    const population: any = {
      id: generatePopulationId(),
      name: args.name,
      size: args.size,
      race: args.race,
      culture: args.culture,
      technologyLevel: args.race === 'monster' ? 0 : 2,
      organization: args.organization as any,
      beliefs: [],
      relations: {},
    };

    if (args.race === 'monster') {
      population.monsterType = args.monsterType as any;
      population.dangerLevel = args.dangerLevel || 5;
      population.behavior = args.behavior as any || 'aggressive';
      population.raidFrequency = 0.3;
      population.isDormant = args.behavior === 'dormant';
    }

    const success = await this.worldManager.addPopulation(args.worldId, population);
    if (!success) {
      throw new Error(`World ${args.worldId} not found`);
    }

    return { success: true, populationId: population.id };
  }

  async createCraft(args: {
    worldId: string;
    name: string;
    description: string;
    category: string;
    rarity: string;
    requiredTechLevel: number;
    requiredResources?: Record<string, number>;
    creatorPopulationId: string;
    location?: string;
    isHidden?: boolean;
    effects?: string[];
  }): Promise<{ success: boolean; craftId: string; craft: any }> {
    const world = this.worldManager.getWorld(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }

    const craft: Craft = {
      id: generateCraftId(),
      name: args.name,
      description: args.description,
      category: args.category as CraftCategory,
      rarity: args.rarity as CraftRarity,
      requiredTechLevel: args.requiredTechLevel,
      requiredResources: args.requiredResources || {},
      creatorPopulationId: args.creatorPopulationId,
      creationYear: world.timestamp,
      location: args.location,
      isHidden: args.isHidden || false,
      hiddenLocation: args.isHidden ? args.location : undefined,
      effects: args.effects || [],
      history: [`Created in year ${world.timestamp} by ${args.creatorPopulationId}`],
    };

    // Add craft to world
    if (!world.crafts) {
      world.crafts = [];
    }
    world.crafts.push(craft);

    // Add craft ID to society
    if (!world.society.crafts) {
      world.society.crafts = [];
    }
    world.society.crafts.push(craft.id);

    // Add craft to creator population
    const creator = world.society.populations.find(p => p.id === args.creatorPopulationId);
    if (creator) {
      if (!creator.crafts) {
        creator.crafts = [];
      }
      creator.crafts.push(craft.id);
    }

    // Create event for craft creation
    const event = {
      id: generateEventId(),
      year: world.timestamp,
      type: 'craft_creation' as any,
      title: `Creation of ${args.name}`,
      description: args.description,
      causes: [],
      effects: [],
      location: args.location,
      impact: {
        society: [{
          type: 'create' as const,
          target: args.name,
          description: `${args.category} crafted: ${args.rarity} rarity`,
        }],
      },
    };
    world.events.push(event);
    world.timeline.events.push(event);

    await this.worldManager.updateWorld(args.worldId, world);

    return { success: true, craftId: craft.id, craft };
  }

  async completeQuest(args: {
    worldId: string;
    questId: string;
    success: boolean;
    completionNotes?: string;
    failureReason?: string;
  }): Promise<{ success: boolean; quest: any }> {
    const world = this.worldManager.getWorld(args.worldId);
    if (!world || !world.quests) {
      throw new Error(`World ${args.worldId} not found or no quests`);
    }

    const questIndex = world.quests.findIndex(q => q.id === args.questId);
    if (questIndex === -1) {
      throw new Error(`Quest ${args.questId} not found`);
    }

    const quest = world.quests[questIndex];
    quest.status = args.success ? QuestStatus.COMPLETED : QuestStatus.FAILED;
    quest.completedAt = world.timestamp;
    
    if (args.success) {
      quest.completionNotes = args.completionNotes;
    } else {
      quest.failureReason = args.failureReason;
    }

    // Handle hero quest completion consequences
    const heroResult = this.heroModule.handleQuestCompletion(world, quest, args.success, args.completionNotes);
    
    // Process hero deaths - create HERO_DEATH events
    for (const hero of heroResult.deaths) {
      const event = {
        id: generateEventId(),
        year: world.timestamp,
        type: EventType.HERO_DEATH,
        title: `${hero.name} Falls`,
        description: `${hero.name} dies: ${hero.deathCause}`,
        causes: [],
        effects: [],
        impact: {
          society: [{
            type: 'destroy' as const,
            target: hero.name,
            description: `Hero ${hero.name} has died`,
          }],
        },
      };
      world.events.push(event);
      world.timeline.events.push(event);
    }

    // Process commemorations - they are already created by handleQuestCompletion
    for (const commemoration of heroResult.commemorations) {
      // Add commemoration to world crafts
      if (!world.crafts) world.crafts = [];
      world.crafts.push(commemoration);
      
      // Add to society crafts
      if (!world.society.crafts) world.society.crafts = [];
      if (!world.society.crafts.includes(commemoration.id)) {
        world.society.crafts.push(commemoration.id);
      }

      // Create commemoration event
      const event = {
        id: generateEventId(),
        year: world.timestamp,
        type: EventType.COMMEMORATION_CREATED,
        title: `${commemoration.name}`,
        description: commemoration.description,
        causes: [],
        effects: [],
        impact: {
          society: [{
            type: 'create' as const,
            target: commemoration.name,
            description: `Created ${commemoration.category} to honor hero's deeds`,
          }],
        },
      };
      world.events.push(event);
      world.timeline.events.push(event);
    }

    // Process hero achievements - create HERO_ACHIEVEMENT events for all assigned heroes
    if (quest.assignedHeroes) {
      for (const heroId of quest.assignedHeroes) {
        const hero = world.heroes?.find(h => h.id === heroId);
        if (!hero) continue;
        
        // Check for new achievements (either success or failure)
        if (quest.status === QuestStatus.COMPLETED || quest.status === QuestStatus.FAILED) {
          const achievementText = quest.status === QuestStatus.COMPLETED 
            ? `Completed: ${quest.title}`
            : `Failed: ${quest.title}`;
          
          // Only create event if hero has this achievement
          if (hero.achievements && hero.achievements.includes(achievementText)) {
            const event = {
              id: generateEventId(),
              year: world.timestamp,
              type: EventType.HERO_ACHIEVEMENT,
              title: `${hero.name} Achieves: ${quest.title}`,
              description: `${hero.name} has ${quest.status === QuestStatus.COMPLETED ? 'completed' : 'failed'} the quest "${quest.title}"`,
              causes: [],
              effects: [],
              impact: {
                society: [{
                  type: 'create' as const,
                  target: hero.name,
                  description: `Hero achieved: ${quest.title}`,
                }],
              },
            };
            world.events.push(event);
            world.timeline.events.push(event);
          }
        }
      }
    }

    // Create quest completion event
    const eventType = args.success ? EventType.QUEST_COMPLETED : EventType.QUEST_FAILED;
    const event = {
      id: generateEventId(),
      year: world.timestamp,
      type: eventType,
      title: args.success ? `Quest Completed: ${quest.title}` : `Quest Failed: ${quest.title}`,
      description: args.success 
        ? (quest.completionNotes || `${quest.title} has been completed successfully`)
        : (args.failureReason || `${quest.title} has failed: ${quest.failureConsequences}`),
      causes: [],
      effects: [],
      impact: {
        society: [{
          type: args.success ? 'create' as const : 'destroy' as const,
          target: quest.title,
          description: args.success ? quest.successConsequences : quest.failureConsequences,
        }],
      },
    };
    
    world.events.push(event);
    world.timeline.events.push(event);

    await this.worldManager.updateWorld(args.worldId, world);

    return { success: true, quest };
  }

  async assignHeroToQuest(args: {
    worldId: string;
    questId: string;
    heroId: string;
  }): Promise<{ success: boolean; message: string }> {
    const world = this.worldManager.getWorld(args.worldId);
    if (!world || !world.quests) {
      throw new Error(`World ${args.worldId} not found or no quests`);
    }

    const quest = world.quests.find(q => q.id === args.questId);
    if (!quest) {
      throw new Error(`Quest ${args.questId} not found`);
    }

    const hero = world.heroes?.find(h => h.id === args.heroId);
    if (!hero) {
      throw new Error(`Hero ${args.heroId} not found`);
    }

    // Check if hero is already assigned
    if (quest.assignedHeroes?.includes(args.heroId)) {
      return { success: true, message: `Hero ${args.heroId} is already assigned to quest ${args.questId}` };
    }

    // Add hero to quest
    if (!quest.assignedHeroes) {
      quest.assignedHeroes = [];
    }
    quest.assignedHeroes.push(args.heroId);

    // Add quest to hero's quest list
    if (!hero.quests) {
      hero.quests = [];
    }
    if (!hero.quests.includes(args.questId)) {
      hero.quests.push(args.questId);
    }

    // Update quest status to in_progress if it was open
    if (quest.status === QuestStatus.OPEN) {
      quest.status = QuestStatus.IN_PROGRESS;
    }

    // Create event
    const event = {
      id: generateEventId(),
      year: world.timestamp,
      type: EventType.QUEST_GENERATED,
      title: `Hero Assigned: ${hero.name} to ${quest.title}`,
      description: `${hero.name} has been assigned to the quest "${quest.title}"`,
      causes: [],
      effects: [],
      impact: {
        society: [{
          type: 'create' as const,
          target: hero.name,
          description: `Hero assigned to quest`,
        }],
      },
    };
    world.events.push(event);
    world.timeline.events.push(event);

    await this.worldManager.updateWorld(args.worldId, world);

    return { success: true, message: `Hero ${args.heroId} assigned to quest ${args.questId}` };
  }

  private getSnapshotAt(world: any, year: number): any {
    // Simplified snapshot - in production, would reconstruct state at year
    const eventsUpToYear = world.events.filter((e: any) => e.year <= year);
    return {
      ...world,
      timestamp: year,
      events: eventsUpToYear,
      snapshot: true,
    };
  }

  private generateLocationFeatures(type: string, world: any): string[] {
    const baseFeatures: Record<string, string[]> = {
      dungeon: ['dark corridors', 'traps', 'treasure chambers', 'monster lairs'],
      city: ['marketplace', 'temple district', 'residential quarters', 'walls'],
      village: ['central well', 'crop fields', 'communal fire'],
      fortress: ['strong walls', 'guard towers', 'barracks', 'armory'],
      temple: ['holy sanctum', 'ritual chambers', 'offerings', 'statues'],
      landmark: ['unique formation', 'ancient ruins', 'viewpoint'],
    };

    return baseFeatures[type] || ['interesting features'];
  }
}
