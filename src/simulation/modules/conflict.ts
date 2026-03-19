/**
 * Conflict module
 * Handles conflict generation, migration, and religious conflicts
 */

import { Event, Population, Location, LocationType } from '../../types';
import { WorldState } from '../../types';
import { Resource } from '../../types';
import { SeededRandom } from '../../utils/random';
import { generateEventId, generatePopulationId, generateLocationId } from '../../utils/idGenerator';
import { isMonstrous } from '../../utils/raceTraits';

export class ConflictModule {
  private rng: SeededRandom;

  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  checkConflictGeneration(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];

    if (world.society.populations.length < 2) return events;

    if (world.geography.resources[Resource.FOOD] < 30) {
      const pop1 = world.society.populations[0];
      const pop2 = world.society.populations[1];

      if (pop1 && pop2) {
        pop1.relations[pop2.id] = 'hostile';
        pop2.relations[pop1.id] = 'hostile';

        world.society.conflicts.push({
          parties: [pop1.id, pop2.id],
          status: 'ongoing',
          cause: 'Resource scarcity',
        });

        events.push({
          id: generateEventId(),
          year: nextYear,
          type: 'conflict' as any,
          title: 'Resource Conflict',
          description: `${pop1.name} and ${pop2.name} begin fighting over scarce resources`,
          causes: [],
          effects: [],
          impact: {
            society: [{
              type: 'transform',
              target: 'relations',
              description: `${pop1.name} vs ${pop2.name}: relations turn hostile`,
            }],
          },
        });
      }
    }

    return events;
  }

  checkMigration(world: WorldState, currentYear: number, nextYear: number, generateName: () => string): Event[] {
    const events: Event[] = [];

    for (const population of world.society.populations) {
      const foodStress = world.geography.resources[Resource.FOOD] < 20;
      const overpopulation = population.size > 800;

      if ((foodStress || overpopulation) && population.size > 50) {
        if (this.rng.boolean(0.3)) {
          // Migrate 10-30% of population
          const migrationSize = Math.floor(population.size * (0.1 + this.rng.next() * 0.2));
          const remainingSize = population.size - migrationSize;
          
          population.size = remainingSize;
          
          const newLocation: Location = {
            id: generateLocationId(),
            type: LocationType.SETTLEMENT,
            name: generateName(),
            description: 'A new settlement established by migrating group',
            geography: {},
            inhabitants: [population.id], // Same population ID (now split)
            history: [],
            features: ['temporary shelters', 'trail markers'],
            connections: [world.locations[0]?.id].filter(Boolean) as string[],
            dangerLevel: 0,
            complexity: 1,
          };

          // Create new population for migrants
          const migrantPopulation: any = {
            ...population,
            id: generatePopulationId(),
            name: `${population.name} Colonists`,
            size: migrationSize,
          };
          
          world.society.populations.push(migrantPopulation);
          world.locations.push(newLocation);

          events.push({
            id: generateEventId(),
            year: nextYear,
            type: 'migration' as any,
            title: 'Migration',
            description: `${migrationSize} people from ${population.name} establish new settlement: ${newLocation.name}`,
            causes: [],
            effects: [],
            location: newLocation.id,
            impact: {
              society: [
                {
                  type: 'decrease',
                  target: population.name,
                  value: migrationSize,
                  description: 'Population migrated',
                },
                {
                  type: 'create',
                  target: newLocation.name,
                  description: `${migrationSize} colonists founded new settlement`,
                },
              ],
            },
          });
        }
      }
    }

    return events;
  }

  checkReligiousConflict(world: WorldState, year: number): { pop1: Population; pop2: Population; beliefConflict: string } | null {
    const civilizedPops = world.society.populations.filter(p => !isMonstrous(p) && p.dominantBelief);
    
    if (civilizedPops.length < 2) return null;
    
    for (const pop1 of civilizedPops) {
      for (const pop2 of civilizedPops) {
        if (pop1.id === pop2.id) continue;
        
        const belief1 = world.beliefs.find(b => b.id === pop1.dominantBelief);
        const belief2 = world.beliefs.find(b => b.id === pop2.dominantBelief);
        
        if (!belief1 || !belief2) continue;
        
        // Different beliefs with intolerance
        if (belief1.id !== belief2.id) {
          const conflictChance = 
            (pop1.religiousTolerance === 'intolerant' || pop2.religiousTolerance === 'intolerant') ? 0.3 :
            (belief1.alignment !== belief2.alignment && (belief1.alignment === 'evil' || belief2.alignment === 'evil')) ? 0.2 :
            0.05;
          
          if (this.rng.boolean(conflictChance)) {
            return {
              pop1,
              pop2,
              beliefConflict: `${belief1.name} vs ${belief2.name}`,
            };
          }
        }
      }
    }
    
    return null;
  }
}
