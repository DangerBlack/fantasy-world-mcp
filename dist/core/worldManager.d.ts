/**
 * Core world state management
 */
import { WorldState, InitialConditions } from '../types';
export declare class WorldManager {
    private worlds;
    private rng;
    constructor(seed: string);
    createWorld(conditions: InitialConditions): WorldState;
    getWorld(worldId: string): WorldState | undefined;
    updateWorld(worldId: string, world: WorldState): void;
    deleteWorld(worldId: string): void;
    listWorlds(): string[];
    private initializeResources;
    private generateInitialFeatures;
    private generateLocationName;
}
//# sourceMappingURL=worldManager.d.ts.map