/**
 * Locations module
 * Handles location evolution, generation, and decay
 */

import { Event, Location, LocationType } from '../../types';
import { WorldState } from '../../types';
import { SeededRandom } from '../../utils/random';
import { v4 as uuidv4 } from 'uuid';

export class LocationModule {
  private rng: SeededRandom;

  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  checkLocationEvolution(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];
    const age = nextYear;

    for (const location of world.locations) {
      // Check for abandoned locations (no inhabitants)
      if (location.inhabitants.length === 0 && location.type !== LocationType.RUINS) {
        // Location is abandoned - start decay process
        if (location.history.length > 0) {
          // Assume abandoned 20-50 years ago if no recent events
          const yearsSinceAbandonment = 20 + this.rng.nextInt(0, 30);
          
          if (yearsSinceAbandonment > 50 && this.rng.boolean(0.3)) {
            location.type = LocationType.RUINS;
            location.features = ['crumbling structures', 'overgrown paths', 'collapsed roofs'];
            location.description = `The abandoned ruins of ${location.name}, reclaimed by nature`;
            location.dangerLevel = Math.max(1, Math.floor(location.dangerLevel / 2));

            events.push({
              id: uuidv4(),
              year: nextYear,
              type: 'social' as any,
              title: `${location.name} Abandoned`,
              description: `Without inhabitants, ${location.name} falls into disrepair and becomes ruins`,
              causes: [],
              effects: [],
              location: location.id,
              impact: {
                geography: [{
                  type: 'transform',
                  target: location.name,
                  description: 'Settlement abandoned, decaying into ruins',
                }],
              },
            });
          }
        }
      }

      // Location growth and development based on inhabitants
      for (const popId of location.inhabitants) {
        const population = world.society.populations.find(p => p.id === popId);
        if (!population) continue;

        // Village to town/city progression
        if (location.type === LocationType.VILLAGE && population.size > 200) {
          if (this.rng.boolean(0.1)) {
            location.type = LocationType.SETTLEMENT;
            location.features.push('expanding market', 'new buildings');
            location.description = `${location.name} grows into a thriving settlement`;

            events.push({
              id: uuidv4(),
              year: nextYear,
              type: 'social' as any,
              title: `${location.name} Grows`,
              description: `${location.name} expands from a village into a larger settlement`,
              causes: [],
              effects: [],
              location: location.id,
              impact: {
                geography: [{
                  type: 'transform',
                  target: location.name,
                  description: 'Village grows into settlement',
                }],
              },
            });
          }
        }

        // Settlement to city progression
        if (location.type === LocationType.SETTLEMENT && population.size > 500 && population.technologyLevel >= 4) {
          if (this.rng.boolean(0.05)) {
            location.type = LocationType.CITY;
            location.features = ['stone walls', 'marketplace', 'temple district', 'residential quarters'];
            location.description = `${location.name} has grown into a prosperous city`;
            location.dangerLevel = 2;

            events.push({
              id: uuidv4(),
              year: nextYear,
              type: 'social' as any,
              title: `${location.name} Becomes a City`,
              description: `${location.name} has grown into a major city with walls and organized districts`,
              causes: [],
              effects: [],
              location: location.id,
              impact: {
                geography: [{
                  type: 'transform',
                  target: location.name,
                  description: 'Settlement becomes a city',
                }],
              },
            });
          }
        }

        // Fortress construction
        if (location.type === LocationType.CITY && population.organization === 'kingdom' && this.rng.boolean(0.02)) {
          location.type = LocationType.FORTRESS;
          location.features.push('strong fortifications', 'guard towers', 'barracks');
          location.dangerLevel = 3;

          events.push({
            id: uuidv4(),
            year: nextYear,
            type: 'social' as any,
            title: `${location.name} Fortified`,
            description: `${location.name} is transformed into a formidable fortress`,
            causes: [],
            effects: [],
            location: location.id,
            impact: {
              geography: [{
                type: 'transform',
                target: location.name,
                description: 'City becomes a fortress',
              }],
            },
          });
        }

        // Temple construction
        if (population.dominantBelief && location.type !== LocationType.TEMPLE && this.rng.boolean(0.03)) {
          const temple: Location = {
            id: uuidv4(),
            type: LocationType.TEMPLE,
            name: `${location.name} Temple`,
            description: `A sacred temple dedicated to the worship of ${population.dominantBelief}`,
            geography: {},
            inhabitants: [popId],
            history: [],
            features: ['holy sanctum', 'ritual chambers', 'offerings', 'statues'],
            connections: [location.id],
            dangerLevel: 0,
            complexity: 2,
          };
          
          world.locations.push(temple);
          
          // Add to belief's holy sites
          const belief = world.beliefs.find(b => b.id === population.dominantBelief);
          if (belief && !belief.holySites.includes(temple.id)) {
            belief.holySites.push(temple.id);
          }

          events.push({
            id: uuidv4(),
            year: nextYear,
            type: 'social' as any,
            title: `Temple Built at ${location.name}`,
            description: `A new temple has been constructed in ${location.name}`,
            causes: [],
            effects: [],
            location: temple.id,
            impact: {
              geography: [{
                type: 'create',
                target: temple.name,
                description: 'New temple constructed',
              }],
            },
          });
        }
      }
    }

    return events;
  }

  generateNewLocationName(world: WorldState): string {
    const terrain = world.geography.terrain;
    const culture = world.society.populations[0]?.culture || 'unknown';
    
    const prefixes = {
      mountains: ['Stone', 'Peak', 'High', 'Rock', 'Mountain'],
      forest: ['Green', 'Wood', 'Leaf', 'Forest', 'Tree'],
      plains: ['Wind', 'Open', 'Plain', 'Field', 'Meadow'],
      desert: ['Sand', 'Sun', 'Dune', 'Dry', 'Heat'],
      swamp: ['Mire', 'Bog', 'Fen', 'Marsh', 'Wet'],
      coastal: ['Sea', 'Tide', 'Wave', 'Ocean', 'Beach'],
      hills: ['Hill', 'Rise', 'Slope', 'Valley', 'Down'],
      tundra: ['Ice', 'Frost', 'Cold', 'Snow', 'Winter'],
      jungle: ['Jungle', 'Wild', 'Thick', 'Deep', 'Green'],
    };
    
    const suffixes = ['hold', 'gard', 'heim', 'ton', 'ville', 'burg', 'fort', 'haven', 'rest', 'watch'];
    
    const prefixList = prefixes[terrain as keyof typeof prefixes] || prefixes.plains;
    const prefix = this.rng.pick(prefixList);
    const suffix = this.rng.pick(suffixes);
    
    return `${prefix}${suffix}`;
  }
}
