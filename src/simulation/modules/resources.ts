/**
 * Resource dynamics module
 * Handles resource consumption, regeneration, and technological progress
 */

import { Event, Resource, Population } from '../../types';
import { WorldState } from '../../types';
import { SeededRandom } from '../../utils/random';

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
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      if (population.race === 'monster') continue;

      // Technology progression chance based on current level
      const techProgressChance = 0.02 + (population.technologyLevel * 0.005);
      
      if (this.rng.boolean(techProgressChance)) {
        // Determine what technology to discover
        const availableTechnologies = this.getAvailableTechnologies(population.technologyLevel);
        
        if (availableTechnologies.length > 0) {
          const newTech = this.rng.pick(availableTechnologies);
          
          if (!world.society.technologies.includes(newTech)) {
            world.society.technologies.push(newTech);
            
            // Increase population technology level if they've reached certain milestones
            const techLevelMapping: Record<string, number> = {
              'Agriculture': 2,
              'Pottery': 2,
              'Bronze Working': 3,
              'Iron Working': 4,
              'Wheel': 3,
              'Writing': 4,
              'Mathematics': 5,
              'Architecture': 5,
              'Medicine': 6,
              'Irrigation': 6,
              'Steel': 7,
              'Gunpowder': 8,
              'Printing': 7,
              'Navigation': 5,
            };
            
            const newLevel = techLevelMapping[newTech];
            if (newLevel && population.technologyLevel < newLevel) {
              population.technologyLevel = newLevel;
            }

            events.push({
              id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

  private getAvailableTechnologies(techLevel: number): string[] {
    const technologiesByLevel: Record<number, string[]> = {
      0: ['Agriculture', 'Pottery'],
      2: ['Bronze Working', 'Wheel'],
      3: ['Iron Working', 'Writing'],
      4: ['Mathematics', 'Architecture'],
      5: ['Navigation', 'Medicine', 'Irrigation'],
      6: ['Steel', 'Printing'],
      7: ['Gunpowder'],
    };

    const available: string[] = [];
    for (let level = 0; level <= techLevel; level++) {
      if (technologiesByLevel[level]) {
        available.push(...technologiesByLevel[level]);
      }
    }

    return available;
  }
}
