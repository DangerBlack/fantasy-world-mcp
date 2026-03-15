/**
 * Core type definitions for the World Evolution Simulation
 */
export type EventId = string;
export type WorldId = string;
export type LocationId = string;
export declare enum EventType {
    NATURAL = "natural",
    SOCIAL = "social",
    CONFLICT = "conflict",
    TECHNOLOGICAL = "technological",
    MIGRATION = "migration",
    CULTURAL = "cultural"
}
export declare enum LocationType {
    CAVE = "cave",
    SETTLEMENT = "settlement",
    CITY = "city",
    DUNGEON = "dungeon",
    FORTRESS = "fortress",
    TEMPLE = "temple",
    VILLAGE = "village",
    TRADE_POST = "trade_post",
    RUINS = "ruins",
    LANDMARK = "landmark"
}
export declare enum TerrainType {
    PLAINS = "plains",
    MOUNTAINS = "mountains",
    FOREST = "forest",
    DESERT = "desert",
    SWAMP = "swamp",
    HILLS = "hills",
    COASTAL = "coastal",
    TUNDRA = "tundra",
    JUNGLE = "jungle"
}
export declare enum Resource {
    IRON = "iron",
    GOLD = "gold",
    SILVER = "silver",
    COPPER = "copper",
    WOOD = "wood",
    STONE = "stone",
    FOOD = "food",
    WATER = "water",
    MAGIC = "magic",
    GEMS = "gems"
}
export interface Change {
    type: 'increase' | 'decrease' | 'transform' | 'create' | 'destroy';
    target: string;
    value?: number;
    description: string;
}
export interface Event {
    id: EventId;
    year: number;
    type: EventType;
    title: string;
    description: string;
    causes: EventId[];
    effects: EventId[];
    impact: {
        geography?: Change[];
        society?: Change[];
        resources?: Change[];
    };
    location?: LocationId;
}
export interface Population {
    id: string;
    name: string;
    race: string;
    size: number;
    culture: string;
    technologyLevel: number;
    organization: 'nomadic' | 'tribal' | 'feudal' | 'kingdom' | 'empire';
    beliefs: string[];
    relations: Record<string, 'hostile' | 'neutral' | 'friendly' | 'allied'>;
}
export interface GeographyLayer {
    terrain: TerrainType;
    climate: 'arctic' | 'temperate' | 'tropical' | 'arid' | 'continental';
    resources: Record<Resource, number>;
    features: string[];
    modifications: Change[];
}
export interface SocietyLayer {
    populations: Population[];
    cultures: string[];
    technologies: string[];
    conflicts: {
        parties: string[];
        status: 'ongoing' | 'resolved' | 'potential';
        cause: string;
    }[];
    tradeRoutes: {
        from: LocationId;
        to: LocationId;
        goods: Resource[];
    }[];
}
export interface Location {
    id: LocationId;
    type: LocationType;
    name: string;
    description: string;
    geography: Partial<GeographyLayer>;
    inhabitants: string[];
    history: EventId[];
    features: string[];
    connections: LocationId[];
    dangerLevel: number;
    complexity: number;
}
export interface Timeline {
    events: Event[];
    eras: {
        name: string;
        startYear: number;
        endYear: number;
        summary: string;
    }[];
}
export interface WorldState {
    id: WorldId;
    seed: string;
    timestamp: number;
    geography: GeographyLayer;
    society: SocietyLayer;
    locations: Location[];
    events: Event[];
    timeline: Timeline;
    metadata: {
        createdAt: string;
        simulationSteps: number;
        lastUpdate: string;
    };
}
export interface SimulationParams {
    timespan: number;
    stepSize: number;
    complexity: 'simple' | 'moderate' | 'complex';
    enableConflict: boolean;
    enableMigration: boolean;
    enableTechProgress: boolean;
}
export interface InitialConditions {
    event: string;
    locationType: LocationType;
    region: TerrainType;
    climate: GeographyLayer['climate'];
    resources: Partial<Record<Resource, number>>;
    population: Population | Population[];
}
//# sourceMappingURL=index.d.ts.map