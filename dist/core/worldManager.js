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
        // Support single population or array of populations
        const populationsArray = Array.isArray(conditions.population)
            ? conditions.population
            : [conditions.population];
        const initialPopulations = populationsArray.map((pop, index) => ({
            id: uuidv4(),
            name: pop.name,
            race: pop.race || 'human',
            size: pop.size,
            culture: pop.culture,
            technologyLevel: 1,
            organization: pop.organization,
            beliefs: [],
            relations: {},
        }));
        // Create initial location(s) - one per population or shared
        const initialLocations = [];
        if (populationsArray.length === 1) {
            // Single population - shared location
            const initialLocation = {
                id: uuidv4(),
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
        }
        else {
            // Multiple populations - each gets their own starting location near the main event
            populationsArray.forEach((pop, index) => {
                const location = {
                    id: uuidv4(),
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
        const initialEvents = [
            {
                id: uuidv4(),
                year: 0,
                type: EventType.NATURAL,
                title: 'Beginning',
                description: conditions.event,
                causes: [],
                effects: initialPopulations.map((_, i) => initialLocations[i]?.id).filter(Boolean),
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
                    pop1.relations[pop2.id] = 'neutral';
                    pop2.relations[pop1.id] = 'neutral';
                }
            }
        }
        const world = {
            id: worldId,
            seed,
            timestamp: 0,
            geography: initialGeography,
            society: {
                populations: initialPopulations,
                cultures: [...new Set(initialPopulations.map(p => p.culture))],
                technologies: [],
                conflicts: [],
                tradeRoutes: [],
            },
            locations: initialLocations,
            events: initialEvents,
            timeline: {
                events: initialEvents,
                eras: [{
                        name: 'Age of Beginning',
                        startYear: 0,
                        endYear: 0,
                        summary: `The arrival of ${initialPopulations.map(p => p.race).join(' and ')}`,
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
    generateLocationName(type, terrain, race) {
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
        if (race) {
            return `${prefix} ${root} (${race})`;
        }
        return `${prefix} ${root}`;
    }
}
//# sourceMappingURL=worldManager.js.map