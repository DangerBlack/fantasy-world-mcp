/**
 * MCP Tool definitions for World Evolution Server
 */

import { z } from 'zod';

// World initialization
export const InitializeWorldSchema = z.object({
  seed: z.string().optional().describe('Random seed for deterministic generation'),
  event: z.string().describe('Initial event description, e.g., "a small cave discovered"'),
  locationType: z.enum(['cave', 'settlement', 'city', 'dungeon', 'fortress', 'temple', 'village', 'trade_post', 'ruins', 'landmark'])
    .describe('Type of starting location'),
  region: z.enum(['plains', 'mountains', 'forest', 'desert', 'swamp', 'hills', 'coastal', 'tundra', 'jungle'])
    .describe('Terrain type of the region'),
  climate: z.enum(['arctic', 'temperate', 'tropical', 'arid', 'continental'])
    .describe('Climate of the region'),
  resources: z.record(z.enum(['iron', 'gold', 'silver', 'copper', 'wood', 'stone', 'food', 'water', 'magic', 'gems']), z.number().min(0).max(100))
    .optional().describe('Resource abundance (0-100) for specific resources'),
  population: z.object({
    name: z.string().describe('Name of the population group'),
    size: z.number().int().positive().describe('Initial population size'),
    culture: z.string().describe('Cultural identity'),
    organization: z.enum(['nomadic', 'tribal', 'feudal', 'kingdom', 'empire'])
      .describe('Social organization level'),
  }).describe('Initial population details'),
});

// Simulation parameters
export const SimulateSchema = z.object({
  worldId: z.string().describe('World ID to simulate'),
  timespan: z.number().int().positive().describe('Number of years to simulate'),
  stepSize: z.number().int().positive().optional().default(10)
    .describe('Years per simulation step'),
  complexity: z.enum(['simple', 'moderate', 'complex']).optional().default('complex')
    .describe('Simulation complexity level'),
  enableConflict: z.boolean().optional().default(true)
    .describe('Enable conflict events'),
  enableMigration: z.boolean().optional().default(true)
    .describe('Enable migration events'),
  enableTechProgress: z.boolean().optional().default(true)
    .describe('Enable technological progress'),
});

// Get world state
export const GetWorldStateSchema = z.object({
  worldId: z.string().describe('World ID to retrieve'),
  year: z.number().int().optional().describe('Specific year snapshot (optional)'),
});

// Get timeline
export const GetTimelineSchema = z.object({
  worldId: z.string().describe('World ID'),
  startYear: z.number().int().optional().describe('Start year filter'),
  endYear: z.number().int().optional().describe('End year filter'),
});

// Generate location
export const GenerateLocationSchema = z.object({
  worldId: z.string().describe('World ID'),
  locationType: z.enum(['dungeon', 'city', 'village', 'fortress', 'temple', 'landmark'])
    .describe('Type of location to generate'),
  name: z.string().optional().describe('Custom name for the location'),
  description: z.string().optional().describe('Custom description'),
});

// Export world
export const ExportWorldSchema = z.object({
  worldId: z.string().describe('World ID to export'),
  format: z.enum(['json', 'markdown', 'narrative', 'gm_notes'])
    .optional().default('markdown').describe('Export format'),
  includeTimeline: z.boolean().optional().default(true)
    .describe('Include full timeline'),
  includeLocations: z.boolean().optional().default(true)
    .describe('Include location details'),
});

// List worlds
export const ListWorldsSchema = z.object({});

// Delete world
export const DeleteWorldSchema = z.object({
  worldId: z.string().describe('World ID to delete'),
});

// Load world from saved data
export const LoadWorldSchema = z.object({
  worldData: z.string().describe('JSON string of previously saved world data'),
});

// Export world to file
export const ExportWorldToFileSchema = z.object({
  worldId: z.string().describe('World ID to export'),
  format: z.enum(['json', 'markdown', 'narrative', 'gm_notes'])
    .optional().default('markdown').describe('Export format'),
  includeTimeline: z.boolean().optional().default(true)
    .describe('Include timeline'),
  includeLocations: z.boolean().optional().default(true)
    .describe('Include location details'),
  filePath: z.string().optional()
    .describe('Custom file path (default: exports/{worldId}_{timestamp}.ext)'),
});

// Read exported file
export const ReadExportFileSchema = z.object({
  filePath: z.string().describe('Path to exported file'),
  startLine: z.number().optional()
    .describe('Start line (1-indexed)'),
  endLine: z.number().optional()
    .describe('End line (inclusive)'),
  startByte: z.number().optional()
    .describe('Start byte offset'),
  endByte: z.number().optional()
    .describe('End byte offset (exclusive)'),
});

// List heroes
export const ListHeroesSchema = z.object({
  worldId: z.string().describe('World ID to list heroes from'),
  status: z.enum(['alive', 'dead', 'missing', 'retired']).optional()
    .describe('Filter by hero status'),
});

// Get hero details
export const GetHeroSchema = z.object({
  worldId: z.string().describe('World ID'),
  heroId: z.string().describe('Hero ID to retrieve'),
});

// Export all schemas
export const ToolSchemas = {
  initializeWorld: InitializeWorldSchema,
  loadWorld: LoadWorldSchema,
  simulate: SimulateSchema,
  getWorldState: GetWorldStateSchema,
  getTimeline: GetTimelineSchema,
  generateLocation: GenerateLocationSchema,
  exportWorld: ExportWorldSchema,
  exportWorldToFile: ExportWorldToFileSchema,
  readExportFile: ReadExportFileSchema,
  listHeroes: ListHeroesSchema,
  getHero: GetHeroSchema,
  listWorlds: ListWorldsSchema,
  deleteWorld: DeleteWorldSchema,
};

export type ToolSchema = typeof ToolSchemas;
