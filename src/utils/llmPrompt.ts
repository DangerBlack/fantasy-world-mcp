/**
 * LLM Prompt Helper for generating world state summaries
 * 
 * This module provides utilities to format world state data into
 * structured prompts suitable for LLM consumption.
 */

import { WorldState, Population, Resource, LLMWorldContext } from '../types';
import { getDangerLevel } from './raceTraits';

/**
 * Summary of a population for LLM prompts
 */
export interface PopulationSummary {
  id: string;
  name: string;
  race: string;
  size: number;
  culture: string;
  organization: string;
  technologyLevel: number;
  knownTechnologies: string[];
  beliefs: string[];
  relations: Record<string, string>;
}

/**
 * Summary of world resources for LLM prompts
 */
export interface ResourceSummary {
  resources: Record<string, number>;
  abundant: string[];
  scarce: string[];
  depleted: string[];
}

/**
 * Summary of world relations for LLM prompts
 */
export interface RelationsSummary {
  friendly: Array<{ population1: string; population2: string }>;
  hostile: Array<{ population1: string; population2: string; reason?: string }>;
  neutral: Array<{ population1: string; population2: string }>;
}

/**
 * Complete world state summary for LLM prompts
 */
export interface WorldStateSummary {
  currentYear: number;
  populations: PopulationSummary[];
  resources: ResourceSummary;
  technologies: string[];
  relations: RelationsSummary;
  recentEvents: Array<{
    year: number;
    type: string;
    title: string;
    description: string;
  }>;
  activeQuests: Array<{
    id: string;
    title: string;
    urgency: string;
    originPopulation: string;
    description: string;
  }>;
}

/**
 * Generate a world state summary optimized for LLM prompts
 * 
 * @param world - The current world state
 * @param eventCount - Number of recent events to include (default: 10)
 * @returns Structured world state summary
 */
export function generateWorldStateSummary(world: WorldState, eventCount: number = 10): WorldStateSummary {
  // Generate population summaries
  const populations: PopulationSummary[] = world.society.populations.map(pop => ({
    id: pop.id,
    name: pop.name,
    race: pop.race,
    size: pop.size,
    culture: pop.culture,
    organization: pop.organization,
    technologyLevel: pop.technologyLevel,
    knownTechnologies: getPopulationTechnologies(pop, world.society.technologies),
    beliefs: pop.beliefs,
    relations: pop.relations,
  }));

  // Generate resource summary
  const resources = generateResourceSummary(world.geography.resources);

  // Generate relations summary
  const relations = generateRelationsSummary(world.society.populations);

  // Get recent events
  const recentEvents = world.events
    .slice(-eventCount)
    .map(event => ({
      year: event.year,
      type: event.type,
      title: event.title,
      description: event.description,
    }));

  // Get active quests
  const activeQuests = (world.quests || [])
    .filter(q => q.status === 'open' || q.status === 'in_progress')
    .map(quest => {
      const originPop = world.society.populations.find(p => p.id === quest.originPopulationId);
      return {
        id: quest.id,
        title: quest.title,
        urgency: quest.urgency,
        originPopulation: originPop?.name || 'Unknown',
        description: quest.description,
      };
    });

  return {
    currentYear: world.timestamp,
    populations,
    resources,
    technologies: world.society.technologies,
    relations,
    recentEvents,
    activeQuests,
  };
}

/**
 * Generate a resource summary from world geography
 */
function generateResourceSummary(resources: Record<Resource, number>): ResourceSummary {
  const abundant: string[] = [];
  const scarce: string[] = [];
  const depleted: string[] = [];

  for (const [resource, amount] of Object.entries(resources)) {
    if (amount >= 70) {
      abundant.push(resource);
    } else if (amount <= 20) {
      scarce.push(resource);
    }
    if (amount <= 0) {
      depleted.push(resource);
    }
  }

  return {
    resources: { ...resources },
    abundant,
    scarce,
    depleted,
  };
}

/**
 * Generate a relations summary from populations
 */
function generateRelationsSummary(populations: Population[]): RelationsSummary {
  const friendly: Array<{ population1: string; population2: string }> = [];
  const hostile: Array<{ population1: string; population2: string; reason?: string }> = [];
  const neutral: Array<{ population1: string; population2: string }> = [];

  for (const pop of populations) {
    for (const [otherId, relation] of Object.entries(pop.relations)) {
      // Avoid duplicates by only adding when pop.id < otherId (lexicographically)
      if (pop.id < otherId) {
        const otherPop = populations.find(p => p.id === otherId);
        if (!otherPop) continue;

        const entry = { population1: pop.name, population2: otherPop.name };
        
        switch (relation) {
          case 'friendly':
          case 'allied':
            friendly.push(entry);
            break;
          case 'hostile':
            hostile.push({ ...entry, reason: getConflictReason(pop, otherPop) });
            break;
          default:
            neutral.push(entry);
        }
      }
    }
  }

  return { friendly, hostile, neutral };
}

/**
 * Get technologies known by a specific population
 */
function getPopulationTechnologies(population: Population, allTechnologies: string[]): string[] {
  // Populations know technologies up to their technology level
  const techLevels: Record<string, number> = {
    'Stone Tools': 0, 'Fire Mastery': 0, 'Basic Shelter': 0,
    'Language Development': 1, 'Social Cooperation': 1,
    'Agriculture': 2, 'Pottery': 2, 'Domestication': 2, 'Basic Medicine': 2,
    'Bronze Working': 3, 'Wheel': 3, 'Writing': 3, 'Irrigation': 3, 'Mining': 3,
    'Iron Working': 4, 'Architecture': 4, 'Mathematics': 4, 'Law': 4,
    'Steel': 5, 'Navigation': 5, 'Philosophy': 5, 'Advanced Medicine': 5,
    'Gunpowder': 6, 'Printing': 6, 'Telescope': 6, 'Banking': 6,
    'Industrial Revolution': 7, 'Steam Power': 7, 'Electricity': 7,
    'Telegraph': 8, 'Railways': 8, 'Mass Production': 8,
    'Electricity Grid': 9, 'Internal Combustion': 9, 'Aviation': 9,
    'Modern Computing': 10, 'Internet': 10, 'Space Technology': 10,
  };

  return allTechnologies.filter(tech => {
    const level = techLevels[tech];
    return level !== undefined && level <= population.technologyLevel;
  });
}

/**
 * Get a conflict reason between two populations
 */
function getConflictReason(pop1: Population, pop2: Population): string {
  // Check for resource competition
  // This is a simplified version - real implementation would check world state
  return 'Territorial dispute';
}

/**
 * Format world state summary as a structured prompt for LLM
 * 
 * @param summary - World state summary
 * @param task - The task/instruction for the LLM
 * @returns Formatted prompt string
 */
export function formatLLMPrompt(summary: WorldStateSummary, task: string): string {
  const lines: string[] = [];

  lines.push('=== WORLD SIMULATION STATE ===\n');
  
  lines.push(`Current Year: ${summary.currentYear}\n`);

  // Populations
  lines.push('=== POPULATIONS ===');
  for (const pop of summary.populations) {
    lines.push(`\n${pop.name} (${pop.race})`);
    lines.push(`  Culture: ${pop.culture}`);
    lines.push(`  Organization: ${pop.organization}`);
    lines.push(`  Population: ${pop.size}`);
    lines.push(`  Technology Level: ${pop.technologyLevel}`);
    lines.push(`  Known Technologies: ${pop.knownTechnologies.join(', ') || 'None'}`);
    lines.push(`  Beliefs: ${pop.beliefs.join(', ') || 'None'}`);
  }

  // Resources
  lines.push('\n=== RESOURCES ===');
  lines.push(`Abundant: ${summary.resources.abundant.join(', ') || 'None'}`);
  lines.push(`Scarce: ${summary.resources.scarce.join(', ') || 'None'}`);
  lines.push(`Depleted: ${summary.resources.depleted.join(', ') || 'None'}`);

  // Relations
  lines.push('\n=== RELATIONS ===');
  if (summary.relations.friendly.length > 0) {
    lines.push('Friendly/Allied:');
    for (const rel of summary.relations.friendly) {
      lines.push(`  - ${rel.population1} ↔ ${rel.population2}`);
    }
  }
  if (summary.relations.hostile.length > 0) {
    lines.push('Hostile:');
    for (const rel of summary.relations.hostile) {
      lines.push(`  - ${rel.population1} ↔ ${rel.population2}: ${rel.reason || 'Conflict'}`);
    }
  }
  if (summary.relations.neutral.length > 0) {
    lines.push('Neutral:');
    for (const rel of summary.relations.neutral) {
      lines.push(`  - ${rel.population1} ↔ ${rel.population2}`);
    }
  }

  // Recent Events
  if (summary.recentEvents.length > 0) {
    lines.push('\n=== RECENT EVENTS ===');
    for (const event of summary.recentEvents) {
      lines.push(`Year ${event.year}: ${event.title}`);
      lines.push(`  ${event.description}`);
    }
  }

  // Active Quests
  if (summary.activeQuests.length > 0) {
    lines.push('\n=== ACTIVE QUESTS ===');
    for (const quest of summary.activeQuests) {
      lines.push(`[${quest.urgency.toUpperCase()}] ${quest.title}`);
      lines.push(`  Origin: ${quest.originPopulation}`);
      lines.push(`  ${quest.description}`);
    }
  }

  // Task
  lines.push('\n=== YOUR TASK ===');
  lines.push(task);

  return lines.join('\n');
}

/**
 * Create a prompt for technological discovery decisions
 * 
 * @param summary - World state summary
 * @returns Formatted prompt for LLM tech discovery
 */
export function createTechDiscoveryPrompt(summary: WorldStateSummary): string {
  const task = `Based on the current world state, decide which populations should make technological discoveries in the next simulation step.

Consider:
- Population technology levels (can only discover technologies at or below their current level)
- Available resources (some technologies require specific resources)
- Recent events and quests that might influence discoveries
- The narrative flow of the world

Respond with JSON in this format:
{
  "technologicalProgress": [
    {
      "populationId": "<population_id>",
      "technology": "<technology_name>",
      "narrative": "<description of how/why this discovery happened>"
    }
  ],
  "events": [
    {
      "type": "<event_type>",
      "title": "<event_title>",
      "description": "<event_description>",
      "populations": ["<population_id>", ...]
    }
  ],
  "populationChanges": [
    {
      "populationId": "<population_id>",
      "sizeDelta": <number>,
      "technologyLevel": <number>
    }
  ]
}

If no discoveries should happen, return empty arrays.`;

  return formatLLMPrompt(summary, task);
}

/**
 * Generate a world context snapshot optimized for LLM prompts
 * 
 * This function creates a structured representation of the world state
 * that includes populations, resources, relations, recent events, and threats.
 * It's designed to be serialized as JSON and sent to an LLM for decision-making.
 * 
 * @param world - The current world state
 * @param lastNEvents - Number of recent events to include (default: 3)
 * @returns Structured LLM world context
 */
export function generateLLMContext(world: WorldState, lastNEvents: number = 3): LLMWorldContext {
  // Build population list with location info
  const populations = world.society.populations.map(pop => {
    // Find location for this population
    const location = world.locations.find(loc => loc.inhabitants.includes(pop.id));
    
    return {
      id: pop.id,
      name: pop.name,
      race: pop.race,
      size: pop.size,
      technologyLevel: pop.technologyLevel,
      culture: pop.culture,
      location: location?.name,
    };
  });

  // Build resources object
  const resources: Record<string, number> = {};
  for (const [resource, amount] of Object.entries(world.geography.resources)) {
    resources[resource] = amount;
  }

  // Build relations object (population ID -> { otherPopId -> relation })
  const relations: Record<string, Record<string, string>> = {};
  for (const pop of world.society.populations) {
    relations[pop.id] = { ...pop.relations };
  }

  // Get recent events
  const recentEvents = world.events
    .slice(-lastNEvents)
    .map(event => ({
      year: event.year,
      title: event.title,
      description: event.description,
    }));

  // Identify threats (monsters, conflicts, critical quests)
  const threats: Array<{ type: string; target: string; severity: number }> = [];

  // Monster threats
  for (const pop of world.society.populations) {
    if (pop.race === 'monster' || pop.traits?.isMonstrous) {
      const danger = getDangerLevel(pop);
      if (danger >= 5) {
        threats.push({
          type: 'monster',
          target: pop.name,
          severity: danger,
        });
      }
    }
  }

  // Critical quest threats
  const criticalQuests = (world.quests || []).filter(q => 
    q.urgency === 'critical' && (q.status === 'open' || q.status === 'in_progress')
  );
  for (const quest of criticalQuests) {
    const originPop = world.society.populations.find(p => p.id === quest.originPopulationId);
    threats.push({
      type: 'quest',
      target: quest.title,
      severity: 8, // Critical quests are high severity
    });
  }

  // Resource depletion threats
  for (const [resource, amount] of Object.entries(world.geography.resources)) {
    if (amount <= 10) {
      threats.push({
        type: 'resource_depletion',
        target: resource,
        severity: amount <= 0 ? 10 : 7,
      });
    }
  }

  return {
    worldId: world.id,
    currentYear: world.timestamp,
    populations,
    resources,
    relations,
    recentEvents,
    threats,
  };
}
