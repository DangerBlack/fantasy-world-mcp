/**
 * Simulation engine for world evolution
 * Handles time progression and rule evaluation
 */
import { WorldState, SimulationParams } from '../types';
import { WorldManager } from '../core/worldManager';
export declare class SimulationEngine {
    private worldManager;
    private rng;
    constructor(worldManager: WorldManager, seed: string);
    simulate(worldId: string, params: SimulationParams): WorldState;
    private applyEventEffects;
    private applyGeographyChange;
    private applySocietyChange;
    private applyResourceChange;
    private evaluateRules;
    private checkPopulationDynamics;
    private checkOrganizationEvolution;
    private checkResourceDynamics;
    private checkTechnologicalProgress;
    private checkConflictGeneration;
    private checkMigration;
    private checkLocationEvolution;
    private checkNaturalEvents;
    private linkEventsCausally;
    private updateEras;
    private generateEraSummary;
    private generateNewLocationName;
}
//# sourceMappingURL=engine.d.ts.map