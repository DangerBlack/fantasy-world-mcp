/**
 * Core world state management
 */
import { v4 as uuidv4 } from 'uuid';
import { SeededRandom } from '../utils/random.js';
import { EventType, LocationType, TerrainType, Resource, } from '../types/index.js';
export class WorldManager {
    worlds = new Map();
    rng;
    constructor(seed) {
        this.rng = new SeededRandom(seed);
    }
    createWorld(conditions) {
        const worldId = uuidv4();
        const seed = this.rng.next().toString(36);
        const initialGeography = {
            terrain: conditions.region,
            climate: conditions.climate,
            resources: this.initializeResources(conditions.resources),
            features: this.generateInitialFeatures(conditions),
            modifications: [],
        };
        const initialPopulation = {
            id: uuidv4(),
            name: conditions.population.name,
            size: conditions.population.size,
            culture: conditions.population.culture,
            technologyLevel: 1,
            organization: conditions.population.organization,
            beliefs: [],
            relations: {},
        };
        const initialLocation = {
            id: uuidv4(),
            type: conditions.locationType,
            name: this.generateLocationName(conditions.locationType, conditions.region),
            description: conditions.event,
            geography: {},
            inhabitants: [initialPopulation.id],
            history: [],
            features: [],
            connections: [],
            dangerLevel: 0,
            complexity: 1,
        };
        const initialState = {
            id: uuidv4(),
            year: 0,
            type: EventType.NATURAL,
            title: 'Beginning',
            description: conditions.event,
            causes: [],
            effects: [],
            location: initialLocation.id,
            impact: {
                society: [{
                        type: 'create',
                        target: conditions.population.name,
                        description: `${conditions.population.size} ${conditions.population.culture} people arrive`,
                    }],
            },
        };
        const world = {
            id: worldId,
            seed,
            timestamp: 0,
            geography: initialGeography,
            society: {
                populations: [initialPopulation],
                cultures: [conditions.population.culture],
                technologies: [],
                conflicts: [],
                tradeRoutes: [],
            },
            locations: [initialLocation],
            events: [initialState],
            timeline: {
                events: [initialState],
                eras: [{
                        name: 'Age of Beginning',
                        startYear: 0,
                        endYear: 0,
                        summary: 'The initial event that started it all',
                    }],
            },
            metadata: {
                createdAt: new Date().toISOString(),
                simulationSteps: 0,
                lastUpdate: new Date().toISOString(),
            },
        };
        this.worlds.set(worldId, world);
        return world;
    }
    getWorld(worldId) {
        return this.worlds.get(worldId);
    }
    updateWorld(worldId, world) {
        this.worlds.set(worldId, world);
    }
    deleteWorld(worldId) {
        this.worlds.delete(worldId);
    }
    listWorlds() {
        return Array.from(this.worlds.keys());
    }
    initializeResources(custom) {
        const base = {
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
        const terrainAdjustments = {
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
        const terrain = Object.keys(terrainAdjustments)[0];
        const adjustments = terrainAdjustments[terrain] || {};
        for (const [resource, value] of Object.entries(adjustments)) {
            base[resource] = Math.min(100, base[resource] + value);
        }
        // Apply custom overrides
        for (const [resource, value] of Object.entries(custom)) {
            base[resource] = Math.min(100, Math.max(0, value));
        }
        return base;
    }
    generateInitialFeatures(conditions) {
        const features = [];
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
    generateLocationName(type, terrain) {
        const prefixes = ['Dark', 'Iron', 'Stone', 'Green', 'High', 'Deep', 'Old', 'New', 'Hidden', 'Lost'];
        const roots = {
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
        return `${prefix} ${root}`;
    }
}
//# sourceMappingURL=worldManager.js.map