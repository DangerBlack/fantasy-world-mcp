/**
 * LLM Decision Interface for forced technological discovery
 * 
 * This module defines the structure for LLM-driven simulation decisions,
 * allowing external AI models to guide world evolution with narrative context.
 */

import { PopulationTraits } from './index';

/**
 * Decision about technological progress made by an LLM
 */
export interface LLMTechnologicalProgress {
  /** ID of the population making the discovery */
  populationId: string;
  /** Name of the technology being discovered */
  technology: string;
  /** Narrative description of how/why this discovery happened */
  narrative: string;
}

/**
 * Event decision made by an LLM
 */
export interface LLMEventDecision {
  /** Type of event (e.g., 'war', 'plague', 'festival', 'discovery') */
  type: string;
  /** Title of the event */
  title: string;
  /** Detailed description of the event */
  description: string;
  /** Population IDs involved in this event */
  populations: string[];
  /** Optional location for the event */
  location?: string;
}

/**
 * Population change decision made by an LLM
 */
export interface LLMPopulationChange {
  /** ID of the population being modified */
  populationId: string;
  /** Change in population size (positive or negative) */
  sizeDelta?: number;
  /** New technology level (absolute value, not delta) */
  technologyLevel?: number;
  /** Optional new name for the population */
  name?: string;
}

/**
 * New population definition for LLM decisions
 */
export interface LLMPopulationDefinition {
  /** Name of the new population */
  name: string;
  /** Race/species of the population */
  race: string;
  /** Initial population size */
  size: number;
  /** Cultural identity */
  culture: string;
  /** Social organization level */
  organization: 'nomadic' | 'tribal' | 'feudal' | 'kingdom' | 'empire';
  /** Monster type (only for monsters) */
  monsterType?: string;
  /** Threat level 1-10 (only for monsters) */
  dangerLevel?: number;
  /** Monster behavior pattern (only for monsters) */
  behavior?: string;
  /** Optional population traits */
  traits?: Partial<PopulationTraits>;
}

/**
 * Complete decision set from an LLM for a simulation step
 * 
 * When provided to the simulation engine, these decisions override
 * the default RNG-based behavior, allowing narrative-driven world evolution.
 * All fields are optional to allow partial decisions.
 */
export interface LLMStepDecision {
  /** Technological discoveries to apply */
  technologicalProgress?: Array<{
    populationId: string;
    technology: string;
    narrative: string;
  }>;
  
  /** Events to create */
  events?: Array<{
    type: string;
    title: string;
    description: string;
    populations: string[];
    location?: string;
  }>;
  
  /** Population changes (size, tech level, etc.) */
  populationChanges?: Array<{
    populationId: string;
    sizeDelta?: number;
    technologyLevel?: number;
    name?: string;
  }>;
  
  /** New populations to add (migration, invasion, etc.) */
  newPopulations?: LLMPopulationDefinition[];
}

/**
 * Validation result for LLM decisions
 */
export interface LLMDecisionValidation {
  /** Whether all decisions are valid */
  isValid: boolean;
  
  /** List of validation errors */
  errors: Array<{
    /** Type of decision that failed validation */
    decisionType: 'technologicalProgress' | 'events' | 'populationChanges';
    /** Index of the failed decision */
    index: number;
    /** Error message */
    message: string;
  }>;
  
  /** List of valid decisions (after filtering out invalid ones) */
  validDecisions?: {
    technologicalProgress: LLMTechnologicalProgress[];
    events: LLMEventDecision[];
    populationChanges: LLMPopulationChange[];
  };
}

/**
 * World state snapshot for LLM context
 */
export interface LLMWorldContext {
  worldId: string;
  currentYear: number;
  populations: Array<{
    id: string;
    name: string;
    race: string;
    size: number;
    technologyLevel: number;
    culture: string;
    location?: string;
  }>;
  resources: Record<string, number>;
  relations: Record<string, Record<string, string>>;
  recentEvents: Array<{
    year: number;
    title: string;
    description: string;
  }>;
  threats: Array<{
    type: string;
    target: string;
    severity: number;
  }>;
}
