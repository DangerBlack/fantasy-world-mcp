/**
 * MCP Tool handlers
 */
export declare class ToolHandler {
    private worldManager;
    private simulationEngine;
    private exportFormatter;
    constructor(seed: string);
    initializeWorld(args: {
        seed?: string;
        event: string;
        locationType: string;
        region: string;
        climate: string;
        resources?: Record<string, number>;
        population: any | any[];
    }): {
        worldId: string;
        world: any;
    };
    simulate(args: {
        worldId: string;
        timespan: number;
        stepSize?: number;
        complexity?: string;
        enableConflict?: boolean;
        enableMigration?: boolean;
        enableTechProgress?: boolean;
    }): {
        world: any;
        events: any[];
        eras: any[];
    };
    getWorldState(args: {
        worldId: string;
        year?: number;
    }): any;
    getTimeline(args: {
        worldId: string;
        startYear?: number;
        endYear?: number;
    }): {
        events: any[];
        eras: any[];
    };
    generateLocation(args: {
        worldId: string;
        locationType: string;
        name?: string;
        description?: string;
    }): any;
    exportWorld(args: {
        worldId: string;
        format?: string;
        includeTimeline?: boolean;
        includeLocations?: boolean;
    }): string;
    listWorlds(): string[];
    deleteWorld(args: {
        worldId: string;
    }): {
        success: boolean;
    };
    private getSnapshotAt;
    private generateLocationFeatures;
}
//# sourceMappingURL=handler.d.ts.map