/**
 * MCP Tool handlers
 */

import { WorldManager } from '../core/worldManager';
import { SimulationEngine } from '../simulation/engine';
import { InitialConditions, SimulationParams } from '../types';
import { ExportFormatter } from '../utils/export';

export class ToolHandler {
  private worldManager: WorldManager;
  private simulationEngine: SimulationEngine;
  private exportFormatter: ExportFormatter;

  constructor(seed: string) {
    this.worldManager = new WorldManager(seed);
    this.simulationEngine = new SimulationEngine(this.worldManager, seed);
    this.exportFormatter = new ExportFormatter();
  }

  initializeWorld(args: {
    seed?: string;
    event: string;
    locationType: string;
    region: string;
    climate: string;
    resources?: Record<string, number>;
    population: any | any[]; // Single population or array
  }): { worldId: string; world: any } {
    // Define input population type (simpler, without generated fields)
    interface InputPopulation {
      name: string;
      size: number;
      race?: string;
      culture: string;
      organization: string;
    }

    // Normalize to array format for flexible input
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

    const world = this.worldManager.createWorld(conditions);
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
      timespan: args.timespan,
      stepSize: args.stepSize ?? 10,
      complexity: (args.complexity ?? 'moderate') as any,
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

  listWorlds(): string[] {
    return this.worldManager.listWorlds();
  }

  deleteWorld(args: { worldId: string }): { success: boolean } {
    this.worldManager.deleteWorld(args.worldId);
    return { success: true };
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
