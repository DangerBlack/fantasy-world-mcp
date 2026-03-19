/**
 * Hero module
 * Handles hero spawning, quest assignment, and hero legacy creation
 */

import { WorldState, Hero, HeroStatus, HeroClass, Quest, QuestStatus, Craft, Population, QuestType, CraftRarity, CraftCategory } from '../../types';
import { SeededRandom } from '../../utils/random';
import { generateEventId, generateHeroId, generateCraftId } from '../../utils/idGenerator';
import { isMonstrous, getTechLevel } from '../../utils/raceTraits';

export class HeroModule {
  private rng: SeededRandom;

  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  /**
   * Check if heroes should spawn for open quests
   */
  checkHeroSpawning(world: WorldState, currentYear: number): { spawned: Hero[]; events: any[] } {
    const spawned: Hero[] = [];
    const events: any[] = [];

    if (!world.quests || !world.heroes) {
      return { spawned, events };
    }

    const openQuests = world.quests.filter(q => 
      q.status === QuestStatus.OPEN && 
      (q.requiredHeroes ?? 0) > 0 &&
      (q.assignedHeroes?.length ?? 0) < (q.requiredHeroes ?? 0)
    );

    for (const quest of openQuests) {
      const originPop = world.society.populations.find(p => p.id === quest.originPopulationId);
      if (!originPop) continue;

      // Check spawn conditions
      if (!this.canSpawnHero(world, originPop, quest, currentYear)) {
        continue;
      }

      // Calculate how many heroes to spawn
      const heroesNeeded = (quest.requiredHeroes ?? 1) - (quest.assignedHeroes?.length ?? 0);
      const maxSpawn = Math.min(heroesNeeded, this.calculateMaxSpawn(world, originPop, quest));

      for (let i = 0; i < maxSpawn; i++) {
        const hero = this.generateHero(world, originPop, quest, currentYear);
        spawned.push(hero);
        
        // Assign hero to quest
        if (!quest.assignedHeroes) quest.assignedHeroes = [];
        quest.assignedHeroes.push(hero.id);

        // Update world heroes array
        world.heroes.push(hero);
        if (!world.society.heroes) world.society.heroes = [];
        if (!world.society.heroes.includes(hero.id)) {
          world.society.heroes.push(hero.id);
        }

        events.push({
          type: 'hero_spawned',
          title: `Hero Born: ${hero.name}`,
          description: `${hero.name}, a ${hero.heroClass} from ${originPop.culture}, emerges to answer the call of ${quest.title}`,
          year: currentYear,
        });
      }
    }

    return { spawned, events };
  }

  private canSpawnHero(
    world: WorldState, 
    population: Population, 
    quest: Quest, 
    year: number
  ): boolean {
    // Cannot spawn heroes from monstrous populations
    if (isMonstrous(population)) return false;
    
    // Tech level requirement - lowered to allow heroes in earlier eras
    // Critical: tech 1+, High: tech 2+, Medium: tech 3+, Low: tech 4+
    const popTechLevel = getTechLevel(population);
    const minTechLevel = quest.urgency === 'critical' ? 1 : quest.urgency === 'high' ? 2 : quest.urgency === 'medium' ? 3 : 4;
    if (popTechLevel < minTechLevel) {
      return false;
    }

    // Population size requirement - lowered to allow smaller groups to call heroes
    // Critical: 20+, High: 50+, Medium: 100+, Low: 150+
    const minPopulation = quest.urgency === 'critical' ? 20 : quest.urgency === 'high' ? 50 : quest.urgency === 'medium' ? 100 : 150;
    if (population.size < minPopulation) {
      return false;
    }

    // Calculate spawn chance based on quest age and urgency
    // Base chance starts low and increases over time, asymptotically approaching max
    const baseChance = quest.urgency === 'critical' ? 0.8 : 
                       quest.urgency === 'high' ? 0.5 : 
                       quest.urgency === 'medium' ? 0.3 : 0.1;
    
    // Calculate quest age in years
    const questAge = year - quest.createdAt;
    
    // Increasing factor: starts at 5% for first 10 years, 10% for second 10 years, etc.
    // Formula: additionalChance = min(0.05 * (questAge / 10), 0.55)
    // This gives: 5% at 10y, 10% at 20y, 15% at 30y, ... up to 55% max
    const additionalChance = Math.min(0.05 * (questAge / 10), 0.55);
    
    // Total chance = base + additional, capped at 60% for non-critical, 95% for critical
    const maxChance = quest.urgency === 'critical' ? 0.95 : 0.60;
    const spawnChance = Math.min(baseChance + additionalChance, maxChance);
    
    return this.rng.boolean(spawnChance);
  }

  private calculateMaxSpawn(
    world: WorldState,
    population: Population,
    quest: Quest
  ): number {
    // Base on population size and urgency
    const baseSpawn = Math.floor(population.size / 100);
    const urgencyMultiplier = quest.urgency === 'critical' ? 2 : 
                              quest.urgency === 'high' ? 1.5 : 1;
    
    return Math.min(
      Math.floor(baseSpawn * urgencyMultiplier),
      quest.requiredHeroes ?? 1
    );
  }

  private generateHero(
    world: WorldState,
    population: Population,
    quest: Quest,
    year: number
  ): Hero {
    const heroClass = this.determineHeroClass(quest, population.technologyLevel);
    const name = this.generateHeroName(population.culture, heroClass);

    return {
      id: generateHeroId(),
      name,
      race: population.race,
      culture: population.culture,
      heroClass,
      status: HeroStatus.ALIVE,
      stats: this.generateStats(heroClass),
      skills: this.generateSkills(heroClass, population),
      inventory: [], // Will be populated if they take crafts
      quests: [quest.id],
      achievements: [],
      originPopulationId: population.id,
      spawnedYear: year,
      lineage: this.checkForLineage(world, population),
    };
  }

  private determineHeroClass(quest: Quest, techLevel: number): HeroClass {
    // Get available hero classes based on tech level
    const availableClasses = this.getAvailableHeroClasses(techLevel);
    
    // Filter class options by quest type and tech level
    const classByQuest: Record<Quest['type'], HeroClass[]> = {
      [QuestType.MONSTER_HUNT]: [HeroClass.WARRIOR, HeroClass.RANGER, HeroClass.PALADIN],
      [QuestType.DISEASE_CURE]: [HeroClass.CLERIC, HeroClass.MAGE],
      [QuestType.RESOURCE_RECOVERY]: [HeroClass.RANGER, HeroClass.WARRIOR, HeroClass.ROGUE],
      [QuestType.ARTIFACT_RETRIEVAL]: [HeroClass.MAGE, HeroClass.ROGUE, HeroClass.PALADIN],
      [QuestType.PROTECTION]: [HeroClass.WARRIOR, HeroClass.PALADIN, HeroClass.BARBARIAN],
      [QuestType.RECONCILIATION]: [HeroClass.BARD, HeroClass.CLERIC, HeroClass.PALADIN],
      [QuestType.SURVIVAL]: [HeroClass.RANGER, HeroClass.BARBARIAN, HeroClass.WARRIOR],
      [QuestType.MYSTERY]: [HeroClass.MAGE, HeroClass.ROGUE, HeroClass.BARD],
      [QuestType.PILGRIMAGE]: [HeroClass.CLERIC, HeroClass.PALADIN, HeroClass.BARD],
      [QuestType.TEMPLE_RESTORE]: [HeroClass.CLERIC, HeroClass.WARRIOR, HeroClass.PALADIN],
      [QuestType.HERESY_SUPPRESS]: [HeroClass.CLERIC, HeroClass.PALADIN, HeroClass.WARRIOR],
    };

    const questClasses = classByQuest[quest.type] || [HeroClass.WARRIOR];
    
    // Filter to only classes available at this tech level
    const filteredClasses = questClasses.filter(c => availableClasses.includes(c));
    
    // If no matching classes, fall back to available basic classes
    const finalClasses = filteredClasses.length > 0 ? filteredClasses : availableClasses;
    
    return this.rng.pick(finalClasses);
  }

  /**
   * Get available hero classes based on population tech level
   * - Level 2+: Can spawn basic heroes (Warrior, Rogue)
   * - Level 3+: Can spawn specialized heroes (Ranger, Cleric)
   * - Level 4+: Can spawn elite heroes (Paladin, Barbarian)
   * - Level 5+: Can spawn rare heroes (Mage, Bard)
   */
  getAvailableHeroClasses(techLevel: number): HeroClass[] {
    const basicHeroes = [HeroClass.WARRIOR, HeroClass.ROGUE];
    const specializedHeroes = [HeroClass.RANGER, HeroClass.CLERIC];
    const eliteHeroes = [HeroClass.PALADIN, HeroClass.BARBARIAN];
    const rareHeroes = [HeroClass.MAGE, HeroClass.BARD];

    const available: HeroClass[] = [...basicHeroes];
    
    if (techLevel >= 3) {
      available.push(...specializedHeroes);
    }
    if (techLevel >= 4) {
      available.push(...eliteHeroes);
    }
    if (techLevel >= 5) {
      available.push(...rareHeroes);
    }

    return available;
  }

  private generateHeroName(culture: string, heroClass: HeroClass): string {
    const namePrefixes: Record<string, string[]> = {
      'Mountain Folk': ['Thorin', 'Balin', 'Dwalin', 'Gimli', 'Brom'],
      'Riverfolk': ['Aldric', 'Edwin', 'Maren', 'Elara', 'Soren'],
      'Hill Dwellers': ['Peregrin', 'Meriadoc', 'Samwise', 'Rosie', 'Bilbo'],
      'Forest Folk': ['Legolas', 'Arwen', 'Thranduil', 'Galadriel', 'Elrond'],
      'Desert Nomads': ['Zahra', 'Khalid', 'Amara', 'Rashid', 'Nadia'],
      'Coastal Traders': ['Finn', 'Aria', 'Marin', 'Corvin', 'Sera'],
      'Northern Clans': ['Bjorn', 'Astrid', 'Erik', 'Ingrid', 'Haakon'],
    };

    const prefixes = namePrefixes[culture] || ['Aldric', 'Maren', 'Soren', 'Elara', 'Theron'];
    return this.rng.pick(prefixes);
  }

  private generateStats(heroClass: HeroClass): Hero['stats'] {
    const baseStats = {
      strength: 10 + this.rng.nextInt(0, 6),
      dexterity: 10 + this.rng.nextInt(0, 6),
      intelligence: 10 + this.rng.nextInt(0, 6),
      charisma: 10 + this.rng.nextInt(0, 6),
      constitution: 10 + this.rng.nextInt(0, 6),
    };

    // Boost stats based on class
    switch (heroClass) {
      case HeroClass.WARRIOR:
        baseStats.strength += 4;
        baseStats.constitution += 3;
        break;
      case HeroClass.MAGE:
        baseStats.intelligence += 5;
        baseStats.charisma += 2;
        break;
      case HeroClass.ROGUE:
        baseStats.dexterity += 5;
        baseStats.intelligence += 2;
        break;
      case HeroClass.CLERIC:
        baseStats.charisma += 4;
        baseStats.intelligence += 3;
        break;
      case HeroClass.RANGER:
        baseStats.dexterity += 4;
        baseStats.constitution += 2;
        break;
      case HeroClass.PALADIN:
        baseStats.strength += 3;
        baseStats.charisma += 4;
        baseStats.constitution += 2;
        break;
      case HeroClass.BARBARIAN:
        baseStats.strength += 5;
        baseStats.constitution += 4;
        break;
      case HeroClass.BARD:
        baseStats.charisma += 5;
        baseStats.intelligence += 3;
        break;
    }

    return baseStats;
  }

  private generateSkills(heroClass: HeroClass, population: Population): string[] {
    const classSkills: Record<HeroClass, string[]> = {
      [HeroClass.WARRIOR]: ['swordsmanship', 'shield defense', 'tactics', 'endurance'],
      [HeroClass.MAGE]: ['spellcasting', 'arcane lore', 'research', 'enchantment'],
      [HeroClass.ROGUE]: ['stealth', 'lockpicking', 'sleight of hand', 'intimidation'],
      [HeroClass.CLERIC]: ['healing', 'divine magic', 'theology', 'exorcism'],
      [HeroClass.RANGER]: ['tracking', 'archery', 'survival', 'wilderness lore'],
      [HeroClass.PALADIN]: ['holy smite', 'lay on hands', 'protective aura', 'swordsmanship'],
      [HeroClass.BARBARIAN]: ['berserker rage', 'unarmed combat', 'survival', 'intimidation'],
      [HeroClass.BARD]: ['performance', 'storytelling', 'inspiration', 'diplomacy'],
    };

    const skills = [...classSkills[heroClass]];
    
    // Add culture-specific skills
    const cultureSkills: Record<string, string[]> = {
      'Mountain Folk': ['mining', 'stonemasonry', 'forging'],
      'Riverfolk': ['fishing', 'navigation', 'boat building'],
      'Forest Folk': ['archery', 'nature magic', 'herbalism'],
      'Desert Nomads': ['camel riding', 'sand navigation', 'poison resistance'],
      'Coastal Traders': ['sailing', 'negotiation', 'cartography'],
      'Northern Clans': ['ice survival', 'wolf riding', 'frost resistance'],
    };

    const cultureSkillSet = cultureSkills[population.culture] || [];
    if (cultureSkillSet.length > 0) {
      skills.push(this.rng.pick(cultureSkillSet));
    }

    return skills;
  }

  private checkForLineage(world: WorldState, population: Population): string | undefined {
    // Check if there are dead heroes from this population that could be ancestors
    const deadHeroes = world.heroes.filter(
      h => h.originPopulationId === population.id && 
           h.status === HeroStatus.DEAD && 
           h.achievements.length > 0
    );

    if (deadHeroes.length > 0 && this.rng.boolean(0.2)) {
      const ancestor = this.rng.pick(deadHeroes);
      return ancestor.name;
    }

    return undefined;
  }

  /**
   * Handle quest completion - determine hero fate and create commemoration
   */
  handleQuestCompletion(
    world: WorldState,
    quest: Quest,
    success: boolean,
    completionNotes?: string
  ): { deaths: Hero[]; commemorations: Craft[]; events: any[] } {
    const deaths: Hero[] = [];
    const commemorations: Craft[] = [];
    const events: any[] = [];

    if (!quest.assignedHeroes || quest.assignedHeroes.length === 0) {
      return { deaths, commemorations, events };
    }

    for (const heroId of quest.assignedHeroes) {
      const hero = world.heroes.find(h => h.id === heroId);
      if (!hero || hero.status !== HeroStatus.ALIVE) continue;

      if (success) {
        // Hero survives and gains achievement
        hero.achievements.push(`Completed: ${quest.title}`);
        
        // Chance for commemoration on significant achievements
        if (quest.urgency === 'critical' || quest.urgency === 'high') {
          const commemoration = this.createCommemoration(world, hero, quest, true);
          if (commemoration) {
            commemorations.push(commemoration);
            hero.commemorationCraftId = commemoration.id;
            events.push({
              type: 'commemoration_created',
              title: `${hero.name} Honored`,
              description: `A ${commemoration.category} called "${commemoration.name}" is created to honor ${hero.name}'s deeds`,
              year: world.timestamp,
            });
          }
        }
      } else {
        // Hero may die on failed quest
        const deathChance = quest.urgency === 'critical' ? 0.7 : 
                           quest.urgency === 'high' ? 0.5 : 
                           quest.urgency === 'medium' ? 0.3 : 0.1;
        
        if (this.rng.boolean(deathChance)) {
          hero.status = HeroStatus.DEAD;
          hero.deathYear = world.timestamp;
          hero.deathCause = `Failed ${quest.title}: ${quest.failureConsequences}`;
          deaths.push(hero);

          // Create commemoration book
          const commemoration = this.createCommemoration(world, hero, quest, false);
          if (commemoration) {
            commemorations.push(commemoration);
            hero.commemorationCraftId = commemoration.id;
            
            // Drop inventory items
            for (const craftId of hero.inventory) {
              const craft = world.crafts?.find(c => c.id === craftId);
              if (craft) {
                craft.isHidden = true;
                craft.location = undefined;
              }
            }

            events.push({
              type: 'hero_death',
              title: `${hero.name} Falls`,
              description: `${hero.name} dies in the failed quest "${quest.title}". A book is written to remember their sacrifice.`,
              year: world.timestamp,
            });
          }
        } else {
          // Hero survives but quest failed
          hero.achievements.push(`Failed: ${quest.title}`);
        }
      }
    }

    return { deaths, commemorations, events };
  }

  /**
   * Create a commemorative craft (book, statue, etc.) for a hero
   */
  createCommemoration(
    world: WorldState,
    hero: Hero,
    quest: Quest,
    success: boolean
  ): Craft | null {
    const originPop = world.society.populations.find(p => p.id === hero.originPopulationId);
    if (!originPop) return null;

    // Create a book documenting the hero's deeds
    const bookTitle = success 
      ? `The Chronicles of ${hero.name}`
      : `The Ballad of ${hero.name}`;
    
    const bookDescription = success
      ? `A legendary account of ${hero.name}'s heroic quest to ${quest.title}. The ${hero.heroClass} from ${hero.culture} who ${quest.successConsequences.toLowerCase()}.`
      : `A mournful tale of ${hero.name}'s sacrifice in the failed quest "${quest.title}". Though they fell, their ${hero.achievements.join(', ')} will not be forgotten.`;

    const rarity = quest.urgency === 'critical' ? 
                   (success ? CraftRarity.LEGENDARY : CraftRarity.RARE) :
                   quest.urgency === 'high' ? CraftRarity.UNCOMMON : CraftRarity.COMMON;

    const craft: Craft = {
      id: generateCraftId(),
      name: bookTitle,
      description: bookDescription,
      category: CraftCategory.BOOK,
      rarity,
      requiredTechLevel: originPop.technologyLevel,
      requiredResources: {},
      creatorPopulationId: originPop.id,
      creationYear: world.timestamp,
      location: undefined, // Will be placed in libraries/temples
      isHidden: false,
      history: [
        `Created in year ${world.timestamp} to commemorate ${hero.name}`,
        success 
          ? `${hero.name} succeeded in ${quest.title}`
          : `${hero.name} fell while attempting ${quest.title}`,
      ],
    };

    if (!world.crafts) world.crafts = [];
    world.crafts.push(craft);

    return craft;
  }

  /**
   * Get hero by ID
   */
  getHero(world: WorldState, heroId: string): Hero | undefined {
    return world.heroes?.find(h => h.id === heroId);
  }

  /**
   * List all heroes
   */
  listHeroes(world: WorldState): Hero[] {
    return world.heroes || [];
  }

  /**
   * Get heroes by status
   */
  getHeroesByStatus(world: WorldState, status: HeroStatus): Hero[] {
    return (world.heroes || []).filter(h => h.status === status);
  }

  /**
   * Get heroes assigned to a quest
   */
  getHeroesForQuest(world: WorldState, questId: string): Hero[] {
    const quest = world.quests?.find(q => q.id === questId);
    if (!quest?.assignedHeroes) return [];
    
    return quest.assignedHeroes
      .map(id => world.heroes?.find(h => h.id === id))
      .filter((h): h is Hero => h !== undefined);
  }
}
