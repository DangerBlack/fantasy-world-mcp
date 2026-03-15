/**
 * MCP Tool definitions for World Evolution Server
 */
import { z } from 'zod';
export declare const InitializeWorldSchema: z.ZodObject<{
    seed: z.ZodOptional<z.ZodString>;
    event: z.ZodString;
    locationType: z.ZodEnum<{
        cave: "cave";
        settlement: "settlement";
        city: "city";
        dungeon: "dungeon";
        fortress: "fortress";
        temple: "temple";
        village: "village";
        trade_post: "trade_post";
        ruins: "ruins";
        landmark: "landmark";
    }>;
    region: z.ZodEnum<{
        plains: "plains";
        mountains: "mountains";
        forest: "forest";
        desert: "desert";
        swamp: "swamp";
        hills: "hills";
        coastal: "coastal";
        tundra: "tundra";
        jungle: "jungle";
    }>;
    climate: z.ZodEnum<{
        arctic: "arctic";
        temperate: "temperate";
        tropical: "tropical";
        arid: "arid";
        continental: "continental";
    }>;
    resources: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
        iron: "iron";
        gold: "gold";
        silver: "silver";
        copper: "copper";
        wood: "wood";
        stone: "stone";
        food: "food";
        water: "water";
        magic: "magic";
        gems: "gems";
    }>, z.ZodNumber>>;
    population: z.ZodObject<{
        name: z.ZodString;
        size: z.ZodNumber;
        culture: z.ZodString;
        organization: z.ZodEnum<{
            nomadic: "nomadic";
            tribal: "tribal";
            feudal: "feudal";
            kingdom: "kingdom";
            empire: "empire";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SimulateSchema: z.ZodObject<{
    worldId: z.ZodString;
    timespan: z.ZodNumber;
    stepSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    complexity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        simple: "simple";
        moderate: "moderate";
        complex: "complex";
    }>>>;
    enableConflict: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    enableMigration: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    enableTechProgress: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const GetWorldStateSchema: z.ZodObject<{
    worldId: z.ZodString;
    year: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const GetTimelineSchema: z.ZodObject<{
    worldId: z.ZodString;
    startYear: z.ZodOptional<z.ZodNumber>;
    endYear: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const GenerateLocationSchema: z.ZodObject<{
    worldId: z.ZodString;
    locationType: z.ZodEnum<{
        city: "city";
        dungeon: "dungeon";
        fortress: "fortress";
        temple: "temple";
        village: "village";
        landmark: "landmark";
    }>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ExportWorldSchema: z.ZodObject<{
    worldId: z.ZodString;
    format: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        json: "json";
        markdown: "markdown";
        narrative: "narrative";
        gm_notes: "gm_notes";
    }>>>;
    includeTimeline: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    includeLocations: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const ListWorldsSchema: z.ZodObject<{}, z.core.$strip>;
export declare const DeleteWorldSchema: z.ZodObject<{
    worldId: z.ZodString;
}, z.core.$strip>;
export declare const ToolSchemas: {
    initializeWorld: z.ZodObject<{
        seed: z.ZodOptional<z.ZodString>;
        event: z.ZodString;
        locationType: z.ZodEnum<{
            cave: "cave";
            settlement: "settlement";
            city: "city";
            dungeon: "dungeon";
            fortress: "fortress";
            temple: "temple";
            village: "village";
            trade_post: "trade_post";
            ruins: "ruins";
            landmark: "landmark";
        }>;
        region: z.ZodEnum<{
            plains: "plains";
            mountains: "mountains";
            forest: "forest";
            desert: "desert";
            swamp: "swamp";
            hills: "hills";
            coastal: "coastal";
            tundra: "tundra";
            jungle: "jungle";
        }>;
        climate: z.ZodEnum<{
            arctic: "arctic";
            temperate: "temperate";
            tropical: "tropical";
            arid: "arid";
            continental: "continental";
        }>;
        resources: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
            iron: "iron";
            gold: "gold";
            silver: "silver";
            copper: "copper";
            wood: "wood";
            stone: "stone";
            food: "food";
            water: "water";
            magic: "magic";
            gems: "gems";
        }>, z.ZodNumber>>;
        population: z.ZodObject<{
            name: z.ZodString;
            size: z.ZodNumber;
            culture: z.ZodString;
            organization: z.ZodEnum<{
                nomadic: "nomadic";
                tribal: "tribal";
                feudal: "feudal";
                kingdom: "kingdom";
                empire: "empire";
            }>;
        }, z.core.$strip>;
    }, z.core.$strip>;
    simulate: z.ZodObject<{
        worldId: z.ZodString;
        timespan: z.ZodNumber;
        stepSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        complexity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            simple: "simple";
            moderate: "moderate";
            complex: "complex";
        }>>>;
        enableConflict: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        enableMigration: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        enableTechProgress: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>;
    getWorldState: z.ZodObject<{
        worldId: z.ZodString;
        year: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    getTimeline: z.ZodObject<{
        worldId: z.ZodString;
        startYear: z.ZodOptional<z.ZodNumber>;
        endYear: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    generateLocation: z.ZodObject<{
        worldId: z.ZodString;
        locationType: z.ZodEnum<{
            city: "city";
            dungeon: "dungeon";
            fortress: "fortress";
            temple: "temple";
            village: "village";
            landmark: "landmark";
        }>;
        name: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    exportWorld: z.ZodObject<{
        worldId: z.ZodString;
        format: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            json: "json";
            markdown: "markdown";
            narrative: "narrative";
            gm_notes: "gm_notes";
        }>>>;
        includeTimeline: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        includeLocations: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>;
    listWorlds: z.ZodObject<{}, z.core.$strip>;
    deleteWorld: z.ZodObject<{
        worldId: z.ZodString;
    }, z.core.$strip>;
};
export type ToolSchema = typeof ToolSchemas;
//# sourceMappingURL=schemas.d.ts.map