#!/usr/bin/env node
/**
 * World Evolution MCP Server
 * 
 * A Model Context Protocol server for procedural fantasy world evolution simulation.
 * Generates anthropological and geographical changes over time from simple starting events.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ToolHandler } from './tools/handler.js';

// Tool definitions for MCP
const TOOLS: Tool[] = [
  {
    name: 'initializeWorld',
    description: 'Create a new world simulation. REQUIRED: Include all fields including resources:{} (can be empty).',
    inputSchema: {
      type: 'object',
      properties: {
        seed: {
          type: 'string',
          description: 'Random seed for deterministic generation (optional)',
        },
        event: {
          type: 'string',
          description: 'Initial event, e.g., "a small cave discovered by refugees"',
        },
        locationType: {
          type: 'string',
          enum: ['cave', 'settlement', 'city', 'dungeon', 'fortress', 'temple', 'village', 'trade_post', 'ruins', 'landmark'],
          description: 'Starting location type',
        },
        region: {
          type: 'string',
          enum: ['plains', 'mountains', 'forest', 'desert', 'swamp', 'hills', 'coastal', 'tundra', 'jungle'],
          description: 'Terrain type',
        },
        climate: {
          type: 'string',
          enum: ['arctic', 'temperate', 'tropical', 'arid', 'continental'],
          description: 'Climate type',
        },
        resources: {
          type: 'object',
          description: 'Resource abundance (0-100). REQUIRED: Include even if empty {}. Example: {iron: 50, food: 40}',
          additionalProperties: {
            type: 'number',
            minimum: 0,
            maximum: 100,
          },
        },
        population: {
          type: 'array',
          description: 'Array of populations (supports multiple races like human, dwarf, elf, dragonborn, orc, etc.). Can also be a single object.',
          items: {
            type: 'object',
            description: 'Population details. For monsters, set race: "monster"',
            properties: {
              name: { type: 'string', description: 'Population name' },
              size: { type: 'number', description: 'Initial population count' },
              race: { 
                type: 'string', 
                description: 'Race/species (human, dwarf, elf, dragonborn, orc, halfling, goblin, tiefling, or "monster" for monsters)',
                default: 'human'
              },
              culture: { type: 'string', description: 'Cultural identity' },
              organization: {
                type: 'string',
                enum: ['nomadic', 'tribal', 'feudal', 'kingdom', 'empire'],
                description: 'Social organization level',
              },
              // Monster-specific (only used if race="monster")
              monsterType: {
                type: 'string',
                enum: ['dragon', 'giant', 'orc', 'goblin', 'undead', 'beast', 'demon', 'aberration', 'fae'],
                description: 'Monster type (only for monsters)',
              },
              dangerLevel: {
                type: 'number',
                description: 'Threat level 1-10 (only for monsters)',
              },
              behavior: {
                type: 'string',
                enum: ['aggressive', 'territorial', 'nomadic', 'dormant', 'hiding'],
                description: 'Monster behavior pattern (only for monsters)',
              },
            },
            required: ['name', 'size', 'culture', 'organization'],
          },
        },
        enableMonsters: {
          type: 'boolean',
          description: 'Enable monster spawning during simulation (default: true)',
          default: true,
        },
        monsterCount: {
          type: 'number',
          description: 'Number of monster populations to spawn initially (0-3, default: 1)',
          default: 1,
        },
      },
      required: ['event', 'locationType', 'region', 'climate', 'population', 'resources'],
    },
  },
  {
    name: 'simulate',
    description: 'Run simulation forward in time',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID to simulate',
        },
        timespan: {
          type: 'number',
          description: 'Number of years to simulate',
        },
        stepSize: {
          type: 'number',
          description: 'Years per simulation step (default: 10)',
        },
        complexity: {
          type: 'string',
          enum: ['simple', 'moderate', 'complex'],
          description: 'Simulation complexity level',
        },
        enableConflict: {
          type: 'boolean',
          description: 'Enable conflict events',
        },
        enableMigration: {
          type: 'boolean',
          description: 'Enable migration events',
        },
        enableTechProgress: {
          type: 'boolean',
          description: 'Enable technological progress',
        },
      },
      required: ['worldId', 'timespan'],
    },
  },
  {
    name: 'getWorldState',
    description: 'Get current state of a world',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID to retrieve',
        },
        year: {
          type: 'number',
          description: 'Specific year snapshot (optional)',
        },
      },
      required: ['worldId'],
    },
  },
  {
    name: 'getTimeline',
    description: 'Get timeline of events for a world',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID',
        },
        startYear: {
          type: 'number',
          description: 'Start year filter',
        },
        endYear: {
          type: 'number',
          description: 'End year filter',
        },
      },
      required: ['worldId'],
    },
  },
  {
    name: 'generateLocation',
    description: 'Generate a new location (dungeon, city, etc.) based on world context',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID',
        },
        locationType: {
          type: 'string',
          enum: ['dungeon', 'city', 'village', 'fortress', 'temple', 'landmark'],
          description: 'Type of location to generate',
        },
        name: {
          type: 'string',
          description: 'Custom name for the location',
        },
        description: {
          type: 'string',
          description: 'Custom description',
        },
      },
      required: ['worldId', 'locationType'],
    },
  },
  {
    name: 'exportWorld',
    description: 'Export world data in various formats',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID to export',
        },
        format: {
          type: 'string',
          enum: ['json', 'markdown', 'narrative', 'gm_notes'],
          description: 'Export format',
        },
        includeTimeline: {
          type: 'boolean',
          description: 'Include full timeline',
        },
        includeLocations: {
          type: 'boolean',
          description: 'Include location details',
        },
      },
      required: ['worldId'],
    },
  },
  {
    name: 'listWorlds',
    description: 'List all created worlds',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'deleteWorld',
    description: 'Delete a world',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID to delete',
        },
      },
      required: ['worldId'],
    },
  },
  {
    name: 'loadWorld',
    description: 'Load a world from previously saved JSON data. Use this when resuming a world from AI context.',
    inputSchema: {
      type: 'object',
      properties: {
        worldData: {
          type: 'string',
          description: 'Full JSON data of the world (copy from previous getWorldState or exportWorld result)',
        },
      },
      required: ['worldData'],
    },
  },
  {
    name: 'addPopulation',
    description: 'Add a new population (including monsters) to an existing world. Use this to add orcs, elves, etc. after world creation.',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID to add population to',
        },
        name: {
          type: 'string',
          description: 'Name of the population (e.g., "Orc Warband", "Elven Clan")',
        },
        size: {
          type: 'number',
          description: 'Initial population size (e.g., 50 for a small group, 500 for a tribe)',
        },
        race: {
          type: 'string',
          description: 'Race: human, dwarf, elf, orc, monster, etc. Use "monster" for monsters',
        },
        culture: {
          type: 'string',
          description: 'Cultural identity (e.g., "Hill Dwellers", "River Folk")',
        },
        organization: {
          type: 'string',
          enum: ['nomadic', 'tribal', 'feudal', 'kingdom', 'empire'],
          description: 'Social organization level',
        },
        monsterType: {
          type: 'string',
          enum: ['dragon', 'giant', 'orc', 'goblin', 'undead', 'beast', 'demon', 'aberration', 'fae'],
          description: 'Monster type (only if race="monster")',
        },
        dangerLevel: {
          type: 'number',
          description: 'Threat level 1-10 (only for monsters, default: 5)',
        },
        behavior: {
          type: 'string',
          enum: ['aggressive', 'territorial', 'nomadic', 'dormant', 'hiding'],
          description: 'Monster behavior (only for monsters)',
        },
      },
      required: ['worldId', 'name', 'size', 'race', 'culture', 'organization'],
    },
  },
  {
    name: 'createCraft',
    description: 'Create a new craft/item/heritage object. AI should generate creative names and descriptions for magical items, weapons, books, artifacts, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID',
        },
        name: {
          type: 'string',
          description: 'Name of the craft (e.g., "Sword of Dawn", "Tome of Ancient Secrets", "Dragonhide Barricade")',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the item and its properties',
        },
        category: {
          type: 'string',
          enum: ['weapon', 'armor', 'tool', 'artifact', 'book', 'jewelry', 'structure', 'relic'],
          description: 'Type of craft',
        },
        rarity: {
          type: 'string',
          enum: ['common', 'uncommon', 'rare', 'legendary', 'mythic'],
          description: 'Rarity level',
        },
        requiredTechLevel: {
          type: 'number',
          description: 'Minimum technology level required (0-10)',
        },
        requiredResources: {
          type: 'object',
          description: 'Resources needed to create (e.g., {iron: 50, magic: 30})',
          additionalProperties: { type: 'number' },
        },
        creatorPopulationId: {
          type: 'string',
          description: 'ID of population that created this',
        },
        location: {
          type: 'string',
          description: 'Current location (optional)',
        },
        isHidden: {
          type: 'boolean',
          description: 'If true, the item is hidden/lost (location unknown)',
        },
        effects: {
          type: 'array',
          items: { type: 'string' },
          description: 'Special effects or properties (e.g., "+3 damage", "grants night vision")',
        },
      },
      required: ['worldId', 'name', 'description', 'category', 'rarity', 'requiredTechLevel', 'creatorPopulationId'],
    },
  },
  {
    name: 'completeQuest',
    description: 'Mark a quest as completed or failed. Heroes (AI-controlled) or players can complete quests.',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID',
        },
        questId: {
          type: 'string',
          description: 'Quest ID to complete',
        },
        success: {
          type: 'boolean',
          description: 'Whether the quest was successful',
        },
        completionNotes: {
          type: 'string',
          description: 'How the quest was completed (if successful)',
        },
        failureReason: {
          type: 'string',
          description: 'Why the quest failed (if failed)',
        },
      },
      required: ['worldId', 'questId', 'success'],
    },
  },
];

// Server instance - persists across tool calls
let toolHandler: ToolHandler | null = null;

const server = new Server(
  {
    name: 'world-evolution',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Initialize tool handler ONCE when server starts
  if (!toolHandler) {
    toolHandler = new ToolHandler('persistent-seed');
    console.error('ToolHandler initialized');
  }

  console.error(`Tool called: ${name}`, args ? JSON.stringify(args).substring(0, 100) : '');

  try {
    if (!args && name !== 'listWorlds') {
      throw new Error('No arguments provided');
    }

    switch (name) {
      case 'initializeWorld': {
        const result = toolHandler.initializeWorld(args as any);
        console.error(`World created: ${result.worldId}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                worldId: result.worldId,
                message: `World created successfully. Starting event: ${result.world.events[0]?.title}`,
              }, null, 2),
            },
          ],
        };
      }

      case 'simulate': {
        const simArgs = args as any;
        const result = toolHandler.simulate(simArgs);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                worldId: simArgs.worldId,
                yearsSimulated: result.world.timestamp,
                eventsGenerated: result.events.length,
                eras: result.eras.length,
                message: `Simulated ${result.world.timestamp} years. Generated ${result.events.length} events across ${result.eras.length} eras.`,
              }, null, 2),
            },
          ],
        };
      }

      case 'getWorldState': {
        const result = toolHandler.getWorldState(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'getTimeline': {
        const result = toolHandler.getTimeline(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'generateLocation': {
        const result = toolHandler.generateLocation(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                location: result,
                message: `Generated ${result.type}: ${result.name}`,
              }, null, 2),
            },
          ],
        };
      }

      case 'exportWorld': {
        const result = toolHandler.exportWorld(args as any);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'listWorlds': {
        const result = toolHandler.listWorlds();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                worlds: result,
                count: result.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'deleteWorld': {
        const result = toolHandler.deleteWorld(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'loadWorld': {
        const result = toolHandler.loadWorld(args as any);
        console.error(`World loaded: ${result.worldId}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                worldId: result.worldId,
                message: `World loaded successfully. Current year: ${result.world.timestamp}`,
              }, null, 2),
            },
          ],
        };
      }

      case 'addPopulation': {
        const addArgs = args as any;
        const result = toolHandler.addPopulation(addArgs);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                populationId: result.populationId,
                message: `Added ${addArgs.race} population: ${addArgs.name} (${addArgs.size} people)`,
              }, null, 2),
            },
          ],
        };
      }

      case 'createCraft': {
        const craftArgs = args as any;
        const result = toolHandler.createCraft(craftArgs);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                craftId: result.craftId,
                craft: result.craft,
                message: `Created ${craftArgs.rarity} ${craftArgs.category}: ${craftArgs.name}`,
              }, null, 2),
            },
          ],
        };
      }

      case 'completeQuest': {
        const questArgs = args as any;
        const result = toolHandler.completeQuest(questArgs);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                quest: result.quest,
                message: `Quest ${questArgs.success ? 'completed' : 'failed'}: ${result.quest.title}`,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('World Evolution MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
