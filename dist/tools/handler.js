/**
 * MCP Tool handlers
 */
import { WorldManager } from '../core/worldManager.js';
import { SimulationEngine } from '../simulation/engine.js';
import { ExportFormatter } from '../utils/export.js';
export class ToolHandler {
    worldManager;
    simulationEngine;
    exportFormatter;
    constructor(seed) {
        this.worldManager = new WorldManager(seed);
        this.simulationEngine = new SimulationEngine(this.worldManager, seed);
        this.exportFormatter = new ExportFormatter();
    }
    initializeWorld(args) {
        const conditions = {
            event: args.event,
            locationType: args.locationType,
            region: args.region,
            climate: args.climate,
            resources: args.resources || {},
            population: {
                name: args.population.name,
                size: args.population.size,
                culture: args.population.culture,
                organization: args.population.organization,
            },
        };
        const world = this.worldManager.createWorld(conditions);
        return { worldId: world.id, world };
    }
    simulate(args) {
        const params = {
            timespan: args.timespan,
            stepSize: args.stepSize ?? 10,
            complexity: (args.complexity ?? 'moderate'),
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
    getWorldState(args) {
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
    getTimeline(args) {
        const world = this.worldManager.getWorld(args.worldId);
        if (!world) {
            throw new Error(`World ${args.worldId} not found`);
        }
        let events = world.events;
        if (args.startYear !== undefined) {
            events = events.filter(e => e.year >= args.startYear);
        }
        if (args.endYear !== undefined) {
            events = events.filter(e => e.year <= args.endYear);
        }
        return {
            events,
            eras: world.timeline.eras,
        };
    }
    generateLocation(args) {
        const world = this.worldManager.getWorld(args.worldId);
        if (!world) {
            throw new Error(`World ${args.worldId} not found`);
        }
        // Simple location generation based on world state
        const location = {
            id: `loc_${Date.now()}`,
            type: args.locationType,
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
    exportWorld(args) {
        const world = this.worldManager.getWorld(args.worldId);
        if (!world) {
            throw new Error(`World ${args.worldId} not found`);
        }
        return this.exportFormatter.format(world, {
            format: args.format,
            includeTimeline: args.includeTimeline ?? true,
            includeLocations: args.includeLocations ?? true,
        });
    }
    listWorlds() {
        return this.worldManager.listWorlds();
    }
    deleteWorld(args) {
        this.worldManager.deleteWorld(args.worldId);
        return { success: true };
    }
    getSnapshotAt(world, year) {
        // Simplified snapshot - in production, would reconstruct state at year
        const eventsUpToYear = world.events.filter((e) => e.year <= year);
        return {
            ...world,
            timestamp: year,
            events: eventsUpToYear,
            snapshot: true,
        };
    }
    generateLocationFeatures(type, world) {
        const baseFeatures = {
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
//# sourceMappingURL=handler.js.map