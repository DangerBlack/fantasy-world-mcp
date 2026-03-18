/**
 * Centralized ID Generation Utility
 * 
 * Provides consistent ID generation across the application.
 * All IDs follow the format: `{type}_{uuid}` for clarity and traceability.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * ID type categories for consistent naming
 */
export enum IdType {
  EVENT = 'event',
  POPULATION = 'pop',
  WORLD = 'world',
  HERO = 'hero',
  QUEST = 'quest',
  CRAFT = 'craft',
  LOCATION = 'loc',
  MONSTER = 'monster',
  BELIEF = 'belief',
  TRADE_ROUTE = 'route',
}

/**
 * Generate a typed ID with UUID
 * 
 * @param type - The type of ID (e.g., 'event', 'hero', 'quest')
 * @param customPrefix - Optional custom prefix instead of type
 * @returns Formatted ID string
 * 
 * @example
 * generateId(IdType.EVENT) // "event_550e8400-e29b-41d4-a716-446655440000"
 * generateId(IdType.POPULATION, 'village') // "village_6ba7b810-9dad-11d1-80b4-00c04fd430c8"
 */
export function generateId(type: IdType, customPrefix?: string): string {
  const prefix = customPrefix || type;
  return `${prefix}_${uuidv4()}`;
}

/**
 * Generate a simple UUID without prefix
 * 
 * @returns UUID string
 * 
 * @example
 * generateSimpleId() // "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateSimpleId(): string {
  return uuidv4();
}

/**
 * Generate an event ID with optional custom prefix
 * 
 * @param customPrefix - Optional custom prefix
 * @returns Event ID string
 */
export function generateEventId(customPrefix?: string): string {
  return generateId(IdType.EVENT, customPrefix);
}

/**
 * Generate a population ID with optional custom prefix
 * 
 * @param customPrefix - Optional custom prefix
 * @returns Population ID string
 */
export function generatePopulationId(customPrefix?: string): string {
  return generateId(IdType.POPULATION, customPrefix);
}

/**
 * Generate a hero ID with optional custom prefix
 * 
 * @param customPrefix - Optional custom prefix
 * @returns Hero ID string
 */
export function generateHeroId(customPrefix?: string): string {
  return generateId(IdType.HERO, customPrefix);
}

/**
 * Generate a quest ID with optional custom prefix
 * 
 * @param customPrefix - Optional custom prefix
 * @returns Quest ID string
 */
export function generateQuestId(customPrefix?: string): string {
  return generateId(IdType.QUEST, customPrefix);
}

/**
 * Generate a craft ID with optional custom prefix
 * 
 * @param customPrefix - Optional custom prefix
 * @returns Craft ID string
 */
export function generateCraftId(customPrefix?: string): string {
  return generateId(IdType.CRAFT, customPrefix);
}

/**
 * Generate a location ID with optional custom prefix
 * 
 * @param customPrefix - Optional custom prefix
 * @returns Location ID string
 */
export function generateLocationId(customPrefix?: string): string {
  return generateId(IdType.LOCATION, customPrefix);
}

/**
 * Generate a monster ID with optional custom prefix
 * 
 * @param customPrefix - Optional custom prefix
 * @returns Monster ID string
 */
export function generateMonsterId(customPrefix?: string): string {
  return generateId(IdType.MONSTER, customPrefix);
}

/**
 * Generate a belief ID with optional custom prefix
 * 
 * @param customPrefix - Optional custom prefix
 * @returns Belief ID string
 */
export function generateBeliefId(customPrefix?: string): string {
  return generateId(IdType.BELIEF, customPrefix);
}

/**
 * Generate a world ID with optional custom prefix
 * 
 * @param customPrefix - Optional custom prefix
 * @returns World ID string
 */
export function generateWorldId(customPrefix?: string): string {
  return generateId(IdType.WORLD, customPrefix);
}
