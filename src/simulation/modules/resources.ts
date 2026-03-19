/**
 * Resource dynamics module
 * Handles resource consumption, regeneration, and technological progress
 */

import { Event, Resource, Population, WorldState, EventType, CraftRarity } from '../../types';
import { WorldState as WorldStateType } from '../../types';
import { SeededRandom } from '../../utils/random';
import { generateEventId } from '../../utils/idGenerator';
import { isMonstrous } from '../../utils/raceTraits';
import { LLMStepDecision, LLMTechnologicalProgress, LLMDecisionValidation, LLMEventDecision } from '../../types/llmDecision';

export class ResourceModule {
  private rng: SeededRandom;

  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  checkResourceDynamics(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];

    for (const population of world.society.populations) {
      // Consumption rate reduced significantly (was 0.1, now 0.01)
      const consumptionRate = population.size * 0.01;
      
      const foodConsumed = Math.min(
        world.geography.resources[Resource.FOOD],
        consumptionRate
      );
      world.geography.resources[Resource.FOOD] -= foodConsumed;

      if (population.organization !== 'nomadic') {
        const woodConsumed = Math.min(
          world.geography.resources[Resource.WOOD],
          consumptionRate * 0.5
        );
        world.geography.resources[Resource.WOOD] -= woodConsumed;
      }
    }

    // Food and water regeneration based on technology and environment
    const agricultureTech = world.society.technologies.includes('Agriculture');
    
    // Food regeneration: base + agriculture bonus + technology bonus
    // Agriculture is MUCH more effective now
    let foodRegen = 0.5; // Base natural regeneration (increased from 0.1)
    if (agricultureTech) {
      foodRegen += 2.0; // Agriculture provides substantial food production (increased from 0.3)
    }
    
    // Check if any population has irrigation technology
    const hasIrrigation = world.society.populations.some(p => p.technologyLevel >= 6);
    if (hasIrrigation) {
      foodRegen += 1.5; // Irrigation greatly improves yields (increased from 0.2)
    }
    
    // Apply food regeneration
    world.geography.resources[Resource.FOOD] = Math.min(
      100,
      world.geography.resources[Resource.FOOD] + foodRegen
    );

    // Water regeneration (slower, but more stable)
    const waterRegen = 0.3 + (world.geography.resources[Resource.WATER] < 50 ? 0.2 : 0);
    world.geography.resources[Resource.WATER] = Math.min(
      100,
      world.geography.resources[Resource.WATER] + waterRegen
    );

    // Other resources regenerate very slowly
    for (const resource of Object.values(Resource)) {
      if (resource === Resource.FOOD || resource === Resource.WATER) continue;
      
      const currentAmount = world.geography.resources[resource] || 0;
      if (currentAmount < 100) {
        // Very slow natural regeneration
        const regen = 0.1;
        world.geography.resources[resource] = Math.min(100, currentAmount + regen);
      }
    }

    // Resource depletion events
    for (const resource of Object.values(Resource)) {
      const amount = world.geography.resources[resource] || 0;
      if (amount <= 5 && amount > 0) {
        events.push({
          id: generateEventId(),
          year: nextYear,
          type: 'resource_depletion' as any,
          title: `${resource} Critically Low`,
          description: `${resource} reserves are nearly depleted (${Math.floor(amount)} remaining)`,
          causes: [],
          effects: [],
          impact: {
            resources: [{
              type: 'decrease',
              target: resource,
              value: amount,
              description: 'Critically low',
            }],
          },
        });
      } else if (amount <= 0) {
        events.push({
          id: generateEventId(),
          year: nextYear,
          type: 'resource_depletion' as any,
          title: `${resource} Depleted`,
          description: `${resource} reserves have been completely exhausted`,
          causes: [],
          effects: [],
          impact: {
            resources: [{
              type: 'destroy',
              target: resource,
              description: 'Completely depleted',
            }],
          },
        });
      }
    }

    return events;
  }

  checkTechnologicalProgress(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];

    for (const population of world.society.populations) {
      if (isMonstrous(population)) continue;

      // NEW TECH PROGRESSION FORMULA
      // Base chance: 5%
      let techChance = 0.05;

      // Population size bonus: +0.1% per 100 people (max +5%)
      const popBonus = Math.min(population.size / 1000, 0.05);
      techChance += popBonus;

      // Organization bonus
      const orgBonuses = { 'nomadic': 0, 'tribal': 0, 'feudal': 0.02, 'kingdom': 0.04, 'empire': 0.06 };
      techChance += orgBonuses[population.organization] || 0;

      // Active critical quests bonus: +3% per quest (max +9%)
      const criticalQuests = this.countCriticalQuestsForPopulation(world, population.id);
      const questBonus = Math.min(criticalQuests * 0.03, 0.09);
      techChance += questBonus;

      // Problem overload penalty: -2% if >5 critical quests
      if (criticalQuests > 5) {
        techChance -= 0.02;
      }

      // Resource abundance bonus: +1% per abundant resource (resource > 60)
      const abundantResources = this.countAbundantResources(world, population);
      techChance += abundantResources * 0.01;

      // Relic/artifact bonus: +5% if population has legendary/mythic item
      const hasLegendaryRelic = this.populationHasLegendaryRelic(world, population.id);
      if (hasLegendaryRelic) {
        techChance += 0.05;
      }

      // Trade route bonus: +2% if population has active trade routes
      const hasTradeRoutes = this.populationHasTradeRoutes(world, population.id);
      if (hasTradeRoutes) {
        techChance += 0.02;
      }

      // Cap at 50% max
      techChance = Math.min(techChance, 0.50);

      if (this.rng.boolean(techChance)) {
        // Determine what technology to discover based on tech tree
        const availableTechnologies = this.getAvailableTechnologies(population.technologyLevel, world.society.technologies);
        
        if (availableTechnologies.length > 0) {
          const newTech = this.rng.pick(availableTechnologies);
          
          if (!world.society.technologies.includes(newTech)) {
            world.society.technologies.push(newTech);
            
            // Get the tech level for this technology
            const newTechLevel = this.getTechLevelForTechnology(newTech);
            
            // Update population technology level if they've reached a new milestone
            if (newTechLevel && population.technologyLevel < newTechLevel) {
              const oldLevel = population.technologyLevel;
              population.technologyLevel = newTechLevel;
              
              // Create TECH_MILESTONE event
              events.push({
                id: generateEventId(),
                year: nextYear,
                type: EventType.TECH_MILESTONE,
                title: `Tech Level ${newTechLevel}: ${newTech}`,
                description: `${population.name} has reached technology level ${newTechLevel} with the discovery of ${newTech}`,
                causes: [],
                effects: [],
                impact: {
                  society: [{
                    type: 'create',
                    target: `TechLevel_${newTechLevel}`,
                    description: `Population advanced to tech level ${newTechLevel}`,
                  }],
                },
              });
            }

            events.push({
              id: generateEventId(),
              year: nextYear,
              type: 'technological_progress' as any,
              title: `Discovery: ${newTech}`,
              description: `${population.name} has discovered ${newTech}`,
              causes: [],
              effects: [],
              impact: {
                society: [{
                  type: 'create',
                  target: newTech,
                  description: 'New technology discovered',
                }],
              },
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Count active critical quests for a population
   */
  countCriticalQuestsForPopulation(world: WorldState, populationId: string): number {
    if (!world.quests) return 0;
    
    return world.quests.filter(q => 
      q.originPopulationId === populationId &&
      q.urgency === 'critical' &&
      (q.status === 'open' || q.status === 'in_progress')
    ).length;
  }

  /**
   * Count abundant resources (value > 60) for a population
   */
  countAbundantResources(world: WorldState, population: Population): number {
    let count = 0;
    for (const resource of Object.values(Resource)) {
      if (resource === Resource.FOOD || resource === Resource.WATER) continue;
      const amount = world.geography.resources[resource] || 0;
      if (amount > 60) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if population has legendary or mythic crafts
   */
  populationHasLegendaryRelic(world: WorldState, populationId: string): boolean {
    if (!world.crafts) return false;
    
    const population = world.society.populations.find(p => p.id === populationId);
    if (!population) return false;
    
    const populationCrafts = world.crafts.filter(c => 
      c.creatorPopulationId === populationId || 
      population.crafts.includes(c.id)
    );
    
    return populationCrafts.some(c => 
      c.rarity === CraftRarity.LEGENDARY || 
      c.rarity === CraftRarity.MYTHIC
    );
  }

  /**
   * Check if population has active trade routes
   */
  populationHasTradeRoutes(world: WorldState, populationId: string): boolean {
    // Find locations inhabited by this population
    const populationLocations = world.locations
      .filter(loc => loc.inhabitants.includes(populationId))
      .map(loc => loc.id);
    
    // Check if any trade routes connect to these locations
    return world.society.tradeRoutes.some(route => 
      populationLocations.includes(route.from) || 
      populationLocations.includes(route.to)
    );
  }

  /**
   * Get the tech level for a specific technology
   */
  getTechLevelForTechnology(techName: string): number | null {
    const techLevelMapping: Record<string, number> = {
      // Level 0 - Stone Age
      'Stone Tools': 0,
      'Fire Mastery': 0,
      'Basic Shelter': 0,
      
      // Level 1 - Social Development
      'Language Development': 1,
      'Social Cooperation': 1,
      
      // Level 2 - Neolithic
      'Agriculture': 2,
      'Pottery': 2,
      'Domestication': 2,
      'Basic Medicine': 2,
      
      // Level 3 - Bronze Age
      'Bronze Working': 3,
      'Wheel': 3,
      'Writing': 3,
      'Irrigation': 3,
      'Mining': 3,
      
      // Level 4 - Iron Age
      'Iron Working': 4,
      'Architecture': 4,
      'Mathematics': 4,
      'Law': 4,
      
      // Level 5 - Classical
      'Steel': 5,
      'Navigation': 5,
      'Philosophy': 5,
      'Advanced Medicine': 5,
      
      // Level 6 - Medieval
      'Gunpowder': 6,
      'Printing': 6,
      'Telescope': 6,
      'Banking': 6,
      
      // Level 7 - Early Modern
      'Industrial Revolution': 7,
      'Steam Power': 7,
      'Electricity': 7,
      
      // Level 8 - Industrial
      'Telegraph': 8,
      'Railways': 8,
      'Mass Production': 8,
      
      // Level 9 - Modern
      'Electricity Grid': 9,
      'Internal Combustion': 9,
      'Aviation': 9,
      
      // Level 10 - Contemporary (cap)
      'Modern Computing': 10,
      'Internet': 10,
      'Space Technology': 10,
    };
    
    return techLevelMapping[techName] ?? null;
  }

  /**
   * Get available technologies based on current tech level
   * Technologies unlock in order - can't discover level N+1 without completing level N
   */
  private getAvailableTechnologies(techLevel: number, societyTechnologies: string[]): string[] {
    // Complete tech tree with prerequisites
    const techTree: Record<number, string[]> = {
      0: ['Stone Tools', 'Fire Mastery', 'Basic Shelter'],
      1: ['Language Development', 'Social Cooperation'],
      2: ['Agriculture', 'Pottery', 'Domestication', 'Basic Medicine'],
      3: ['Bronze Working', 'Wheel', 'Writing', 'Irrigation', 'Mining'],
      4: ['Iron Working', 'Architecture', 'Mathematics', 'Law'],
      5: ['Steel', 'Navigation', 'Philosophy', 'Advanced Medicine'],
      6: ['Gunpowder', 'Printing', 'Telescope', 'Banking'],
      7: ['Industrial Revolution', 'Steam Power', 'Electricity'],
      8: ['Telegraph', 'Railways', 'Mass Production'],
      9: ['Electricity Grid', 'Internal Combustion', 'Aviation'],
      10: ['Modern Computing', 'Internet', 'Space Technology'],  // Cap
    };

    // Can only access technologies up to current level
    const available: string[] = [];
    for (let level = 0; level <= Math.min(techLevel, 10); level++) {
      if (techTree[level]) {
        available.push(...techTree[level]);
      }
    }

    // Filter out technologies already discovered
    return available.filter(tech => !societyTechnologies.includes(tech));
  }

  /**
   * Validate if a population can discover a specific technology
   * Checks:
   * 1. Population exists and is not monstrous
   * 2. Technology is at or below population's tech level
   * 3. Technology prerequisites are met (all lower-level techs discovered)
   * 4. Required resources are available
   * 
   * @param world - Current world state
   * @param populationId - ID of the population
   * @param technology - Name of the technology to discover
   * @returns Validation result with error message if invalid
   */
  validateTechDiscovery(
    world: WorldState,
    populationId: string,
    technology: string
  ): { valid: boolean; error?: string } {
    // Check population exists
    const population = world.society.populations.find(p => p.id === populationId);
    if (!population) {
      return { valid: false, error: `Population with ID ${populationId} not found` };
    }

    // Check population is not monstrous
    if (isMonstrous(population)) {
      return { valid: false, error: `Monstrous populations cannot discover technologies` };
    }

    // Check technology exists in tech tree
    const techLevel = this.getTechLevelForTechnology(technology);
    if (techLevel === null) {
      return { valid: false, error: `Unknown technology: ${technology}` };
    }

    // Check population has sufficient tech level
    if (population.technologyLevel < techLevel) {
      return { 
        valid: false, 
        error: `Population tech level ${population.technologyLevel} is insufficient for ${technology} (requires level ${techLevel})` 
      };
    }

    // Check prerequisites - all technologies at lower levels must be discovered
    for (let level = 0; level < techLevel; level++) {
      const levelTechs = this.getTechnologiesForLevel(level);
      const hasAllLevelTechs = levelTechs.every(tech => 
        world.society.technologies.includes(tech)
      );
      if (!hasAllLevelTechs && levelTechs.length > 0) {
        // Check if at least one tech from this level is discovered
        const hasAnyLevelTech = levelTechs.some(tech => 
          world.society.technologies.includes(tech)
        );
        if (!hasAnyLevelTech && level > 0) {
          return {
            valid: false,
            error: `Prerequisite technologies from level ${level} not discovered: ${levelTechs.join(', ')}`
          };
        }
      }
    }

    // Check resource requirements
    const requiredResources = this.getTechnologyResourceRequirements(technology);
    for (const [resource, requiredAmount] of Object.entries(requiredResources)) {
      const availableAmount = world.geography.resources[resource as Resource] || 0;
      if (availableAmount < requiredAmount) {
        return {
          valid: false,
          error: `Insufficient ${resource}: have ${Math.floor(availableAmount)}, need ${requiredAmount}`
        };
      }
    }

    // Check if technology already discovered
    if (world.society.technologies.includes(technology)) {
      return { valid: false, error: `Technology ${technology} already discovered` };
    }

    return { valid: true };
  }

  /**
   * Get technologies available at a specific tech level
   */
  private getTechnologiesForLevel(level: number): string[] {
    const techTree: Record<number, string[]> = {
      0: ['Stone Tools', 'Fire Mastery', 'Basic Shelter'],
      1: ['Language Development', 'Social Cooperation'],
      2: ['Agriculture', 'Pottery', 'Domestication', 'Basic Medicine'],
      3: ['Bronze Working', 'Wheel', 'Writing', 'Irrigation', 'Mining'],
      4: ['Iron Working', 'Architecture', 'Mathematics', 'Law'],
      5: ['Steel', 'Navigation', 'Philosophy', 'Advanced Medicine'],
      6: ['Gunpowder', 'Printing', 'Telescope', 'Banking'],
      7: ['Industrial Revolution', 'Steam Power', 'Electricity'],
      8: ['Telegraph', 'Railways', 'Mass Production'],
      9: ['Electricity Grid', 'Internal Combustion', 'Aviation'],
      10: ['Modern Computing', 'Internet', 'Space Technology'],
    };
    return techTree[level] || [];
  }

  /**
   * Get resource requirements for a technology
   */
  private getTechnologyResourceRequirements(technology: string): Record<string, number> {
    const requirements: Record<string, Record<string, number>> = {
      'Bronze Working': { copper: 20, tin: 10 },
      'Iron Working': { iron: 30, coal: 10 },
      'Steel': { iron: 40, coal: 20 },
      'Architecture': { stone: 30, wood: 20 },
      'Mining': { stone: 10 },
      'Gunpowder': { sulfur: 10, coal: 15 },
      'Industrial Revolution': { iron: 50, coal: 40 },
      'Steam Power': { iron: 30, coal: 30 },
      'Electricity': { copper: 30, coal: 20 },
    };
    return requirements[technology] || {};
  }

  /**
   * Apply an LLM-forced technological discovery
   * 
   * This method validates and applies a technology discovery decision from an LLM,
   * creating appropriate events and updating world state.
   * 
   * @param world - Current world state (modified in place)
   * @param population - The population making the discovery
   * @param technology - The technology being discovered
   * @param narrative - Narrative description of the discovery
   * @param year - Current simulation year
   * @returns Event created for this discovery, or null if validation failed
   */
  applyLLMTechDiscovery(
    world: WorldState,
    population: Population,
    technology: string,
    narrative: string,
    year: number
  ): Event | null {
    // Validate the discovery
    const validation = this.validateTechDiscovery(world, population.id, technology);
    if (!validation.valid) {
      console.warn(`LLM tech discovery validation failed: ${validation.error}`);
      return null;
    }

    // Add technology to society
    if (!world.society.technologies.includes(technology)) {
      world.society.technologies.push(technology);
    }

    // Get the tech level for this technology
    const newTechLevel = this.getTechLevelForTechnology(technology);
    
    // Update population technology level if they've reached a new milestone
    if (newTechLevel && population.technologyLevel < newTechLevel) {
      population.technologyLevel = newTechLevel;
    }

    // Create technological progress event
    const event: Event = {
      id: generateEventId(),
      year,
      type: EventType.TECHNOLOGICAL,
      title: `Discovery: ${technology}`,
      description: `${population.name} has discovered ${technology}. ${narrative}`,
      causes: [],
      effects: [],
      impact: {
        society: [{
          type: 'create',
          target: technology,
          description: `New technology discovered by ${population.name}`,
        }],
      },
    };

    // Create tech milestone event if this is a level-up
    if (newTechLevel && population.technologyLevel === newTechLevel) {
      const milestoneEvent: Event = {
        id: generateEventId(),
        year,
        type: EventType.TECH_MILESTONE,
        title: `Tech Level ${newTechLevel}: ${technology}`,
        description: `${population.name} has reached technology level ${newTechLevel} with the discovery of ${technology}`,
        causes: [],
        effects: [event.id],
        impact: {
          society: [{
            type: 'create',
            target: `TechLevel_${newTechLevel}`,
            description: `Population advanced to tech level ${newTechLevel}`,
          }],
        },
      };
      world.events.push(milestoneEvent);
      world.timeline.events.push(milestoneEvent);
    }

    return event;
  }

  /**
   * Validate and apply LLM decisions for a simulation step
   * 
   * @param world - Current world state
   * @param decision - LLM decision to apply
   * @param year - Current simulation year
   * @returns Validation result with applied events
   */
  applyLLMDecision(
    world: WorldState,
    decision: LLMStepDecision,
    year: number
  ): { validation: LLMDecisionValidation; events: Event[] } {
    const events: Event[] = [];
    const errors: LLMDecisionValidation['errors'] = [];
    const validTechProgress: LLMTechnologicalProgress[] = [];
    const validEvents: LLMEventDecision[] = [];
    const validPopChanges = decision.populationChanges ? [...decision.populationChanges] : [];

    // Validate and apply technological progress
    for (let i = 0; i < (decision.technologicalProgress?.length || 0); i++) {
      const progress = decision.technologicalProgress?.[i];
      if (!progress) continue;
      const validation = this.validateTechDiscovery(world, progress.populationId, progress.technology);
      
      if (validation.valid) {
        validTechProgress.push(progress);
        const population = world.society.populations.find(p => p.id === progress.populationId);
        if (population) {
          const event = this.applyLLMTechDiscovery(world, population, progress.technology, progress.narrative, year);
          if (event) {
            events.push(event);
          }
        }
      } else {
        errors.push({
          decisionType: 'technologicalProgress',
          index: i,
          message: validation.error || 'Unknown validation error',
        });
      }
    }

    // Validate and apply custom events
    for (let i = 0; i < (decision.events?.length || 0); i++) {
      const eventDecision = decision.events?.[i];
      if (!eventDecision) continue;
      
      // Validate that all populations exist
      const invalidPopulations = eventDecision.populations.filter(
        popId => !world.society.populations.find(p => p.id === popId)
      );
      
      if (invalidPopulations.length > 0) {
        errors.push({
          decisionType: 'events',
          index: i,
          message: `Unknown populations: ${invalidPopulations.join(', ')}`,
        });
      } else {
        validEvents.push(eventDecision);
        const event: Event = {
          id: generateEventId(),
          year,
          type: eventDecision.type as EventType,
          title: eventDecision.title,
          description: eventDecision.description,
          causes: [],
          effects: [],
          impact: {
            society: eventDecision.populations.map(popId => ({
              type: 'create',
              target: eventDecision.title,
              description: `${eventDecision.title} affects ${world.society.populations.find(p => p.id === popId)?.name || popId}`,
            })),
          },
        };
        events.push(event);
      }
    }

    // Apply population changes
    for (const change of validPopChanges || []) {
      const population = world.society.populations.find(p => p.id === change.populationId);
      if (population) {
        if (change.sizeDelta !== undefined) {
          population.size = Math.max(0, population.size + change.sizeDelta);
        }
        if (change.technologyLevel !== undefined) {
          // Validate tech level change
          if (change.technologyLevel >= 0 && change.technologyLevel <= 10) {
            population.technologyLevel = change.technologyLevel;
          }
        }
      }
    }

    const validation: LLMDecisionValidation = {
      isValid: errors.length === 0,
      errors,
      validDecisions: {
        technologicalProgress: validTechProgress,
        events: validEvents,
        populationChanges: validPopChanges,
      },
    };

    return { validation, events };
  }
}
