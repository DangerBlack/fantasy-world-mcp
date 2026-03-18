/**
 * Event Deduplication Utility
 * 
 * Provides functionality to detect and merge duplicate or similar events
 * in the fantasy world simulation to reduce noise and improve narrative quality.
 * 
 * Features:
 * - Exact duplicate detection using event signatures
 * - Fuzzy matching for similar events (80% similarity threshold)
 * - Event merging that combines descriptions and effects
 */

import { Event, EventType } from '../../types';

/**
 * Event signature for deduplication comparison
 * Contains key attributes that define event identity
 */
export interface EventSignature {
  year: number;
  type: EventType;
  location?: string;
  targetPopulation?: string;
  title: string;
}

/**
 * Similarity result for event comparison
 */
export interface SimilarityResult {
  isSimilar: boolean;
  similarityScore: number;
  matchingFields: string[];
}

/**
 * Merged event result
 */
export interface MergedEvent {
  event: Event;
  mergedWith: string[]; // IDs of events merged into this one
}

/**
 * EventDeduplicator class
 * 
 * Handles detection and merging of duplicate/similar events
 * in the world simulation timeline.
 */
export class EventDeduplicator {
  private similarityThreshold: number;

  /**
   * Create a new EventDeduplicator
   * @param similarityThreshold - Minimum similarity score (0-1) to consider events similar (default: 0.8)
   */
  constructor(similarityThreshold: number = 0.8) {
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * Determine if a new event should be added based on existing events
   * 
   * @param existing - Array of existing events to check against
   * @param newEvent - The new event to evaluate
   * @returns true if the event should be added, false if it's a duplicate
   */
  shouldAddEvent(existing: Event[], newEvent: Event): boolean {
    for (const existingEvent of existing) {
      // Check for exact duplicate first
      if (this.isExactDuplicate(existingEvent, newEvent)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if two events are exact duplicates based on signature
   * 
   * @param event1 - First event
   * @param event2 - Second event
   * @returns true if events are exact duplicates
   */
  isExactDuplicate(event1: Event, event2: Event): boolean {
    const sig1 = this.createEventSignature(event1);
    const sig2 = this.createEventSignature(event2);
    
    return (
      sig1.year === sig2.year &&
      sig1.type === sig2.type &&
      sig1.location === sig2.location &&
      sig1.targetPopulation === sig2.targetPopulation &&
      sig1.title === sig2.title
    );
  }

  /**
   * Create a signature for an event used in deduplication
   * 
   * Signature includes:
   * - Year of the event
   * - Event type
   * - Location (if present)
   * - Target population (extracted from description/impact)
   * - Title
   * 
   * @param event - The event to create a signature for
   * @returns EventSignature object
   */
  createEventSignature(event: Event): EventSignature {
    const signature: EventSignature = {
      year: event.year,
      type: event.type,
      location: event.location,
      targetPopulation: this.extractTargetPopulation(event),
      title: event.title,
    };
    
    return signature;
  }

  /**
   * Extract target population from event description or impact
   * 
   * @param event - The event to analyze
   * @returns Population name if found, undefined otherwise
   */
  private extractTargetPopulation(event: Event): string | undefined {
    // Check society impact for population targets
    if (event.impact?.society) {
      for (const change of event.impact.society) {
        if (change.target && change.target !== 'world') {
          return change.target;
        }
      }
    }
    
    // Check geography impact
    if (event.impact?.geography) {
      for (const change of event.impact.geography) {
        if (change.target && change.target !== 'world') {
          return change.target;
        }
      }
    }
    
    return undefined;
  }

  /**
   * Check if two events are similar using fuzzy matching
   * 
   * Uses a combination of:
   * - Word overlap analysis for titles
   * - Levenshtein distance for description similarity
   * - Signature field matching
   * 
   * @param event1 - First event
   * @param event2 - Second event
   * @returns SimilarityResult with score and matching fields
   */
  checkSimilarity(event1: Event, event2: Event): SimilarityResult {
    const matchingFields: string[] = [];
    let totalScore = 0;
    let maxScore = 0;

    // Check year match (exact match = 100% for this field)
    maxScore += 1;
    if (event1.year === event2.year) {
      totalScore += 1;
      matchingFields.push('year');
    }

    // Check type match
    maxScore += 1;
    if (event1.type === event2.type) {
      totalScore += 1;
      matchingFields.push('type');
    }

    // Check location match
    maxScore += 1;
    if (event1.location === event2.location) {
      totalScore += 1;
      matchingFields.push('location');
    }

    // Check title similarity using word overlap
    maxScore += 1;
    const titleSimilarity = this.calculateTitleSimilarity(event1.title, event2.title);
    totalScore += titleSimilarity;
    if (titleSimilarity >= 0.5) {
      matchingFields.push('title');
    }

    // Check description similarity using Levenshtein distance
    maxScore += 1;
    const descSimilarity = this.calculateDescriptionSimilarity(event1.description, event2.description);
    totalScore += descSimilarity;
    if (descSimilarity >= 0.5) {
      matchingFields.push('description');
    }

    const similarityScore = maxScore > 0 ? totalScore / maxScore : 0;

    return {
      isSimilar: similarityScore >= this.similarityThreshold,
      similarityScore,
      matchingFields,
    };
  }

  /**
   * Calculate similarity between two titles using word overlap
   * 
   * @param title1 - First title
   * @param title2 - Second title
   * @returns Similarity score (0-1)
   */
  private calculateTitleSimilarity(title1: string, title2: string): number {
    const words1 = this.tokenize(title1);
    const words2 = this.tokenize(title2);

    if (words1.length === 0 || words2.length === 0) {
      return 0;
    }

    // Count common words
    const commonWords = words1.filter(word => words2.includes(word));
    const overlap = commonWords.length / Math.max(words1.length, words2.length);

    return overlap;
  }

  /**
   * Calculate similarity between two descriptions using Levenshtein distance
   * 
   * @param desc1 - First description
   * @param desc2 - Second description
   * @returns Similarity score (0-1)
   */
  private calculateDescriptionSimilarity(desc1: string, desc2: string): number {
    if (desc1 === desc2) {
      return 1;
    }

    if (desc1.length === 0 || desc2.length === 0) {
      return 0;
    }

    const distance = this.levenshteinDistance(desc1, desc2);
    const maxLength = Math.max(desc1.length, desc2.length);
    
    // Convert distance to similarity (1 - normalized distance)
    const similarity = 1 - (distance / maxLength);
    
    return similarity;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * 
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Edit distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Create distance matrix
    const dp: number[][] = Array(m + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));

    // Initialize base cases
    for (let i = 0; i <= m; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return dp[m][n];
  }

  /**
   * Tokenize a string into words (lowercase, alphanumeric only)
   * 
   * @param text - Text to tokenize
   * @returns Array of words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Merge two similar events into one
   * 
   * Merging strategy:
   * - Keep the first event's ID and primary data
   * - Combine descriptions with "Also: " prefix
   * - Merge effects and causes arrays (deduplicated)
   * - Keep the more impactful event's impact data
   * 
   * @param event1 - First event (will be kept)
   * @param event2 - Second event (will be merged into first)
   * @returns MergedEvent with combined data
   */
  mergeEvents(event1: Event, event2: Event): MergedEvent {
    const mergedDescription = this.combineDescriptions(event1.description, event2.description);
    const mergedEffects = this.mergeStringArrays(event1.effects, event2.effects);
    const mergedCauses = this.mergeStringArrays(event1.causes, event2.causes);
    
    // Keep the event with more significant impact
    const primaryEvent = this.getMoreImpactfulEvent(event1, event2);
    const secondaryEvent = primaryEvent === event1 ? event2 : event1;

    const mergedEvent: Event = {
      ...primaryEvent,
      description: mergedDescription,
      effects: mergedEffects,
      causes: mergedCauses,
    };

    return {
      event: mergedEvent,
      mergedWith: [secondaryEvent.id],
    };
  }

  /**
   * Combine two event descriptions
   * 
   * @param desc1 - First description
   * @param desc2 - Second description
   * @returns Combined description
   */
  private combineDescriptions(desc1: string, desc2: string): string {
    if (desc1 === desc2) {
      return desc1;
    }
    return `${desc1}. Also: ${desc2}`;
  }

  /**
   * Merge two string arrays, removing duplicates
   * 
   * @param arr1 - First array
   * @param arr2 - Second array
   * @returns Merged array with unique values
   */
  private mergeStringArrays(arr1: string[], arr2: string[]): string[] {
    const combined = [...arr1, ...arr2];
    return [...new Set(combined)];
  }

  /**
   * Determine which event is more impactful (to keep as primary)
   * 
   * @param event1 - First event
   * @param event2 - Second event
   * @returns The more impactful event
   */
  private getMoreImpactfulEvent(event1: Event, event2: Event): Event {
    const impact1 = this.calculateImpact(event1);
    const impact2 = this.calculateImpact(event2);
    return impact1 >= impact2 ? event1 : event2;
  }

  /**
   * Calculate impact score for an event
   * 
   * @param event - Event to score
   * @returns Impact score
   */
  private calculateImpact(event: Event): number {
    let score = 0;
    
    score += (event.impact?.geography?.length || 0) * 2;
    score += (event.impact?.society?.length || 0) * 2;
    score += (event.impact?.resources?.length || 0) * 2;
    score += event.effects.length;
    score += event.causes.length;
    
    return score;
  }

  /**
   * Deduplicate an array of events
   * 
   * Process:
   * 1. Sort events by year
   * 2. Check each event against existing (non-duplicate) events
   * 3. If exact duplicate, skip it
   * 4. If similar event found, merge them
   * 5. Return deduplicated/merged events
   * 
   * @param events - Array of events to deduplicate
   * @returns Array of deduplicated/merged events
   */
  deduplicateEvents(events: Event[]): Event[] {
    if (events.length === 0) {
      return [];
    }

    // Sort events by year for consistent processing
    const sortedEvents = [...events].sort((a, b) => a.year - b.year);
    
    const result: Event[] = [];
    const mergedIds = new Set<string>();

    for (const event of sortedEvents) {
      // Skip if this event was already merged into another
      if (mergedIds.has(event.id)) {
        continue;
      }

      let foundMatch = false;

      // Check against existing result events
      for (const existingEvent of result) {
        // First check for exact duplicate
        if (this.isExactDuplicate(existingEvent, event)) {
          foundMatch = true;
          break;
        }

        // Then check for similar events
        const similarity = this.checkSimilarity(existingEvent, event);
        if (similarity.isSimilar) {
          // Merge the events
          const merged = this.mergeEvents(existingEvent, event);
          
          // Remove the old event from results
          const existingIndex = result.findIndex(e => e.id === existingEvent.id);
          if (existingIndex !== -1) {
            result[existingIndex] = merged.event;
          }
          
          // Mark the new event as merged
          mergedIds.add(event.id);
          foundMatch = true;
          break;
        }
      }

      // If no match found, add the event to results
      if (!foundMatch) {
        result.push(event);
      }
    }

    return result;
  }
}

/**
 * Convenience function to create an EventDeduplicator with default settings
 * @returns EventDeduplicator instance
 */
export function createEventDeduplicator(): EventDeduplicator {
  return new EventDeduplicator(0.8);
}
