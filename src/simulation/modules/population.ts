/**
 * Population dynamics module
 * Handles population growth, decline, and organization evolution
 */

import { Event, Population, Resource } from '../../types';
import { WorldState } from '../../types';
import { SeededRandom } from '../../utils/random';

export class PopulationModule {
  private rng: SeededRandom;

  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  checkPopulationDynamics(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];

    for (const population of world.society.populations) {
      const foodAvailability = world.geography.resources[Resource.FOOD];
      const waterAvailability = world.geography.resources[Resource.WATER];
      
      // Base growth rate reduced significantly
      let growthRate = 0.005;
      
      // Food impact: CRITICAL - no food means population decline
      if (foodAvailability <= 0) {
        // Starvation: population decreases by 5-10% per step
        growthRate = -0.05 - (this.rng.next() * 0.05);
      } else if (foodAvailability < 20) {
        // Severe food shortage: slow decline
        growthRate = -0.02 + (foodAvailability / 100) * 0.01;
      } else {
        // Normal food: small positive growth based on availability
        growthRate += (foodAvailability / 100) * 0.02;
      }
      
      // Water impact
      if (waterAvailability <= 0) {
        growthRate -= 0.03; // Death by dehydration
      } else {
        growthRate += (waterAvailability / 100) * 0.01;
      }
      
      // Technology reduces growth slightly (lower birth rates in advanced societies)
      growthRate -= (population.technologyLevel > 5) ? 0.005 : 0;
      
      const change = Math.floor(population.size * growthRate);
      
      if (Math.abs(change) > 0) {
        population.size = Math.max(0, population.size + change);
        
        const eventType = change > 0 ? 'social' : 'conflict';
        const title = change > 0 ? 'Population Growth' : 'Population Decline';
        const description = change > 0 
          ? `${population.name} population grew by ${Math.abs(change)} people`
          : `${population.name} population declined by ${Math.abs(change)} people${foodAvailability <= 0 ? ' due to starvation' : ''}`;
        
        events.push({
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          year: nextYear,
          type: eventType as any,
          title,
          description,
          causes: [],
          effects: [],
          impact: {
            society: [{
              type: change > 0 ? 'increase' : 'decrease',
              target: population.name,
              value: Math.abs(change),
              description: `Population: ${population.size}`,
            }],
          },
        });
      }

      this.checkOrganizationEvolution(world, population, currentYear, nextYear, events);
    }

    return events;
  }

  checkOrganizationEvolution(
    world: WorldState,
    population: Population,
    currentYear: number,
    nextYear: number,
    events: Event[]
  ): void {
    const organizationProgression: Population['organization'][] = [
      'nomadic', 'tribal', 'feudal', 'kingdom', 'empire',
    ];

    const currentIndex = organizationProgression.indexOf(population.organization);
    if (currentIndex >= organizationProgression.length - 1) return;

    const sizeRequirement = [0, 50, 200, 500, 1000];
    const techRequirement = [0, 2, 4, 6, 8];

    if (
      population.size >= sizeRequirement[currentIndex + 1] &&
      population.technologyLevel >= techRequirement[currentIndex + 1]
    ) {
      const newOrg = organizationProgression[currentIndex + 1];
      const oldOrg = population.organization;
      population.organization = newOrg;

      events.push({
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        year: nextYear,
        type: 'social' as any,
        title: `${population.name} becomes ${newOrg}`,
        description: `${population.name} evolves from ${oldOrg} to ${newOrg} organization`,
        causes: [],
        effects: [],
        impact: {
          society: [{
            type: 'transform',
            target: population.name,
            description: `Social organization: ${oldOrg} → ${newOrg}`,
          }],
        },
      });
    }
  }
}
