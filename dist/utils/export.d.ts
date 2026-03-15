/**
 * Export formatting utilities
 */
import { WorldState } from '../types';
export interface ExportOptions {
    format: 'json' | 'markdown' | 'narrative' | 'gm_notes';
    includeTimeline: boolean;
    includeLocations: boolean;
}
export declare class ExportFormatter {
    format(world: WorldState, options: ExportOptions): string;
    private formatJSON;
    private formatMarkdown;
    private formatNarrative;
    private formatGMNotes;
    private generateAdventureHooks;
}
//# sourceMappingURL=export.d.ts.map