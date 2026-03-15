/**
 * Monsters module
 * Handles monster activity, raids, growth, and combat
 */

import { Event, MonsterPopulation, MonsterType, Location, Population, Quest, QuestType, QuestStatus, LocationType } from '../../types';
import { WorldState } from '../../types';
import { SeededRandom } from '../../utils/random';
import { v4 as uuidv4 } from 'uuid';

export class MonsterModule {
  private rng: SeededRandom;

  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  checkMonsterActivity(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];
    
    // Get all monster populations
    const monsters = world.society.populations.filter(p => p.race === 'monster') as MonsterPopulation[];
    
    if (monsters.length === 0) return events;

    // Monster growth (faster than civilizations)
    for (const monster of monsters) {
      if (monster.isDormant) {
        // Chance to wake up
        if (this.rng.boolean(0.05)) {
          monster.isDormant = false;
          events.push({
            id: uuidv4(),
            year: nextYear,
            type: 'monster_dormancy' as any,
            title: `${monster.monsterSubtype || monster.name} Awakens`,
            description: `The ${monster.monsterType} ${monster.name} emerges from dormancy`,
            causes: [],
            effects: [],
            location: monster.lairLocation,
            impact: {
              society: [{
                type: 'transform',
                target: monster.name,
                description: 'Dormant monster awakens and becomes active',
              }],
            },
          });
        }
        continue;
      }

      // Monster population growth - varies by monster type
      const baseGrowthRate = this.getMonsterGrowthRate(monster.monsterType);
      const growthRate = baseGrowthRate + (monster.raidFrequency || 0.3) * 0.02;
      const change = Math.floor(monster.size * growthRate);
      if (change > 0) {
        monster.size += change;
        events.push({
          id: uuidv4(),
          year: nextYear,
          type: 'monster_infestation' as any,
          title: `${monster.name} Population Grows`,
          description: `${monster.monsterSubtype || monster.name} breeding increases their numbers by ${change}`,
          causes: [],
          effects: [],
          location: monster.lairLocation,
          impact: {
            society: [{
              type: 'increase',
              target: monster.name,
              value: change,
              description: `Monster threat level: ${monster.dangerLevel}`,
            }],
          },
        });
      }

      // Raid settlements
      if (this.rng.boolean(monster.raidFrequency || 0.3)) {
        const civilizedPops = world.society.populations.filter(p => p.race !== 'monster');
        if (civilizedPops.length > 0) {
          const target = this.rng.pick(civilizedPops);
          
          // Defense calculation: location type + population size + organization
          const defenseBonus = Math.min(0.8, (target.size / 1000) * 0.2);
          const organizationBonus = ({
            'nomadic': 0.1, 'tribal': 0.2, 'feudal': 0.4, 'kingdom': 0.6, 'empire': 0.8
          }[target.organization] || 0);
          
          // Location-based defense bonus
          const targetLocation = world.locations.find(l => l.inhabitants.includes(target.id));
          const locationBonus = ({
            'cave': 0.3,           // Natural fortification, narrow entrances
            'settlement': 0.1,      // Basic shelters, some organization
            'village': 0.2,         // Central well, communal defense
            'city': 0.5,            // Stone walls, organized guard
            'fortress': 0.7,        // Built for defense, strategic position
            'dungeon': 0.4,         // Underground, known passages
            'temple': 0.2,          // Sacred protection, elevated position
            'ruins': 0.0,           // No defense - crumbling structures
            'landmark': 0.1,        // Natural features, minimal protection
            'trade_post': 0.15,     // Some fortification, guards
          }[targetLocation?.type || 'settlement'] || 0.1);
          
          // Faith-based defense bonus (delegate to BeliefModule)
          const faithBonus = 0; // Will be calculated by engine using BeliefModule
          
          const totalDefense = Math.min(0.95, defenseBonus + organizationBonus + locationBonus + faithBonus);
          
          // Raid damage based on danger level - monsters with higher danger are exponentially more deadly
          // Base damage scales with danger level (not just monster.size)
          const baseDamageByDanger = Math.pow(monster.dangerLevel, 2) * 2; // danger 9 = 162 base damage
          const sizeMultiplier = 0.3 + (monster.size / 100); // Small bonus for larger monster populations
          const typeMultiplier = this.getMonsterRaidMultiplier(monster.monsterType);
          const baseDamage = Math.floor(baseDamageByDanger * sizeMultiplier * typeMultiplier);
          const raidDamage = Math.max(1, Math.floor(baseDamage * (1 - totalDefense)));
          target.size = Math.max(0, target.size - raidDamage);

          // Check for extinction
          if (target.size === 0) {
            // Population extinct!
            const extinctPopIndex = world.society.populations.findIndex(p => p.id === target.id);
            if (extinctPopIndex > -1) {
              world.society.populations.splice(extinctPopIndex, 1);
              
              // Convert location to ruins
              const targetLocation = world.locations.find(l => l.inhabitants.includes(target.id));
              if (targetLocation) {
                targetLocation.type = LocationType.RUINS;
                targetLocation.features = ['abandoned buildings', 'overgrown paths', 'remnants of daily life'];
                targetLocation.description = `The ruins of ${targetLocation.name}, once home to ${target.name}`;
                targetLocation.inhabitants = [];
                targetLocation.dangerLevel = monster.dangerLevel;
              }

              events.push({
                id: uuidv4(),
                year: nextYear,
                type: 'conflict' as any,
                title: `${target.name} Extinct!`,
                description: `${target.name} has been completely wiped out by ${monster.name}. Their settlement lies in ruins.`,
                causes: [],
                effects: [],
                location: targetLocation?.id,
                impact: {
                  society: [
                    {
                      type: 'destroy',
                      target: target.name,
                      description: 'Population extinct, settlement abandoned',
                    },
                    {
                      type: 'transform',
                      target: targetLocation?.name || 'settlement',
                      description: 'Settlement becomes ruins',
                    },
                  ],
                },
              });

              // Generate quest for revenge/reconstruction
              if (world.society.populations.some(p => p.race !== 'monster')) {
                const quest: any = {
                  id: `quest_${uuidv4()}`,
                  title: `Avenge ${target.name}`,
                  description: `${target.name} has been exterminated by ${monster.name}. Their ruins stand as a testament to the threat. Heroes must either slay the monster or rebuild what was lost.`,
                  type: QuestType.MONSTER_HUNT,
                  status: QuestStatus.OPEN,
                  urgency: 'critical',
                  relatedMonsterId: monster.id,
                  relatedLocationId: targetLocation?.id,
                  reward: 'The legacy of a fallen people, their treasures, and the chance to restore glory',
                  requiredHeroes: 5,
                  assignedHeroes: [],
                  deadline: nextYear + 50,
                  failureConsequences: `${monster.name} continues to terrorize the land unchecked`,
                  successConsequences: 'Justice is served, or the land is reborn from ashes',
                  createdAt: nextYear,
                };
                
                if (!world.quests) world.quests = [];
                if (!world.society.quests) world.society.quests = [];
                world.quests.push(quest);
                world.society.quests.push(quest.id);
              }
            }
          }

          // Update relations
          target.relations[monster.id] = 'hostile';
          monster.relations[target.id] = 'hostile';

          events.push({
            id: uuidv4(),
            year: nextYear,
            type: 'monster_raid' as any,
            title: `${monster.monsterSubtype || 'Monster'} Raid`,
            description: `${monster.name} attacks ${target.name}, killing/capturing ${raidDamage} people`,
            causes: [],
            effects: [],
            location: world.locations.find(l => l.inhabitants.includes(target.id))?.id,
            impact: {
              society: [
                {
                  type: 'decrease',
                  target: target.name,
                  value: raidDamage,
                  description: 'Casualties from monster raid',
                },
                {
                  type: 'transform',
                  target: 'relations',
                  description: `${target.name} now hostile to ${monster.name}`,
                },
              ],
            },
          });

          // Counter-attack: If target is hostile and has sufficient size, they fight back!
          // This simulates dragon hunters, warriors, or organized resistance
          if (target.relations[monster.id] === 'hostile' && target.size > 20 && this.rng.boolean(0.35)) {
            // Calculate counter-attack damage based on target's size, organization, and tech
            const attackBonus = Math.min(0.6, (target.size / 400) * 0.25);
            const orgAttackBonus = ({
              'nomadic': 0.1, 'tribal': 0.3, 'feudal': 0.5, 'kingdom': 0.7, 'empire': 0.9
            }[target.organization] || 0);
            const techAttackBonus = Math.floor(target.technologyLevel / 2) * 0.08;
            const totalAttack = Math.min(0.95, attackBonus + orgAttackBonus + techAttackBonus);
            
            // Monster defense is lower than civilization defense
            const monsterDefense = Math.min(0.5, (monster.size / 80) * 0.15 + 0.1);
            
            // Damage to monster - scaled to be meaningful
            const monsterDamageBase = Math.floor(target.size * totalAttack * 1.2);
            const monsterDamage = Math.max(1, Math.floor(monsterDamageBase * (1 - monsterDefense)));
            monster.size = Math.max(0, monster.size - monsterDamage);

            events.push({
              id: uuidv4(),
              year: nextYear,
              type: 'conflict' as any,
              title: `${target.name} Counter-attacks`,
              description: `${target.name} fights back against ${monster.name}, inflicting ${monsterDamage} casualties`,
              causes: [],
              effects: [],
              location: monster.lairLocation,
              impact: {
                society: [
                  {
                    type: 'decrease',
                    target: monster.name,
                    value: monsterDamage,
                    description: 'Monster casualties from counter-attack',
                  },
                ],
              },
            });

            // Chance to kill the monster if damage is significant and monster is weakened
            if (monster.size <= 5 && this.rng.boolean(0.25)) {
              // Monster defeated!
              const monsterIndex = world.society.populations.findIndex(p => p.id === monster.id);
              if (monsterIndex > -1) {
                world.society.populations.splice(monsterIndex, 1);
                
                events.push({
                  id: uuidv4(),
                  year: nextYear,
                  type: 'monster_invasion' as any,
                  title: `${monster.name} Defeated!`,
                  description: `${target.name} has slain the legendary ${monster.name}! The threat is ended.`,
                  causes: [],
                  effects: [],
                  location: monster.lairLocation,
                  impact: {
                    society: [
                      {
                        type: 'destroy',
                        target: monster.name,
                        description: 'Monster population eliminated',
                      },
                    ],
                  },
                });

                // Remove monster quests
                if (world.quests) {
                  world.quests = world.quests.filter(q => q.relatedMonsterId !== monster.id);
                }
                if (world.society.quests) {
                  world.society.quests = world.society.quests.filter(qid => {
                    const quest = world.quests?.find(q => q.id === qid);
                    return quest?.relatedMonsterId !== monster.id;
                  });
                }
              }
            }
          }

          // Chance to turn location into ruins
          const raidLocation = world.locations.find(l => l.inhabitants.includes(target.id));
          if (raidLocation && raidLocation.type === 'city' && this.rng.boolean(0.1)) {
            raidLocation.type = LocationType.RUINS;
            raidLocation.features = ['crumbling walls', 'monster lair', 'scorch marks'];
            raidLocation.dangerLevel = monster.dangerLevel;
            
            events.push({
              id: uuidv4(),
              year: nextYear,
              type: 'monster_invasion' as any,
              title: `${raidLocation.name} Overrun`,
              description: `${monster.name} has taken over ${raidLocation.name}, turning it into a monster lair`,
              causes: [],
              effects: [],
              location: raidLocation.id,
              impact: {
                geography: [{
                  type: 'transform',
                  target: raidLocation.name,
                  description: 'City becomes monster-infested ruins',
                }],
              },
            });
          }
        }
      }
    }

    return events;
  }

  getMonsterGrowthRate(monsterType: MonsterType): number {
    // Different monster types have vastly different growth rates
    // Based on realistic breeding cycles and lifespans
    const growthRates: Record<MonsterType, number> = {
      [MonsterType.DRAGON]: 0.005,     // Extremely slow - centuries to mature
      [MonsterType.GIANT]: 0.01,        // Very slow - long lifespans, few offspring
      [MonsterType.ORC]: 0.035,         // Fast - short lives, large families
      [MonsterType.GOBLIN]: 0.05,       // Very fast - reproduce rapidly
      [MonsterType.UNDEAD]: 0.02,       // Medium - depends on source of undead
      [MonsterType.BEAST]: 0.025,       // Medium - natural animal breeding rates
      [MonsterType.DEMON]: 0.03,        // Fast - if they can manifest from planes
      [MonsterType.ABERRATION]: 0.015,  // Slow - mysterious reproduction
      [MonsterType.FAE]: 0.02,          // Medium - varies greatly by type
      [MonsterType.CUSTOM]: 0.025,      // Default medium rate
    };
    
    return growthRates[monsterType] || 0.025;
  }

  getMonsterRaidMultiplier(monsterType: MonsterType): number {
    // Different monster types have different raid devastation levels
    // Dragons and giants cause massive destruction even in small numbers
    const multipliers: Record<MonsterType, number> = {
      [MonsterType.DRAGON]: 5.0,        // Single dragon can destroy a village
      [MonsterType.GIANT]: 3.0,         // Giants crush buildings and armies
      [MonsterType.ORC]: 1.2,           // Organized warbands, moderate damage
      [MonsterType.GOBLIN]: 0.8,        // Hit-and-run, low individual damage
      [MonsterType.UNDEAD]: 2.0,        // Fear and supernatural terror
      [MonsterType.BEAST]: 1.0,         // Natural predators
      [MonsterType.DEMON]: 2.5,         // Chaotic destruction
      [MonsterType.ABERRATION]: 1.8,    // Unpredictable and terrifying
      [MonsterType.FAE]: 1.0,           // Varies - can be mischievous or deadly
      [MonsterType.CUSTOM]: 1.0,        // Default
    };
    
    return multipliers[monsterType] || 1.0;
  }
}
