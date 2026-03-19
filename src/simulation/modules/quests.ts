/**
 * Quest module
 * Handles quest generation for various scenarios
 */

import { Event, Population, MonsterPopulation, Quest, QuestType, QuestStatus, Resource } from '../../types';
import { WorldState } from '../../types';
import { SeededRandom } from '../../utils/random';
import { generateEventId, generateQuestId } from '../../utils/idGenerator';
import { isMonstrous } from '../../utils/raceTraits';

export class QuestModule {
  private rng: SeededRandom;

  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  checkQuestGeneration(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];

    for (const population of world.society.populations) {
      if (isMonstrous(population)) continue;

      // Quest generation chance based on world state
      let questChance = 0.05; // Base 5% chance per population per step

      // Increase chance if there are monsters
      const monsters = world.society.populations.filter(p => isMonstrous(p)) as MonsterPopulation[];
      if (monsters.length > 0) {
        questChance += monsters.length * 0.02;
      }

      // Increase chance if resources are low
      if (world.geography.resources[Resource.FOOD] < 30) {
        questChance += 0.03;
      }

      // Increase chance if there are conflicts
      if (world.society.conflicts.length > 0) {
        questChance += world.society.conflicts.length * 0.01;
      }

      if (this.rng.boolean(questChance)) {
        // Determine quest type based on world state
        const quest = this.generateAppropriateQuest(world, population, nextYear);
        
        if (quest) {
          if (!world.quests) world.quests = [];
          if (!world.society.quests) world.society.quests = [];
          
          world.quests.push(quest);
          world.society.quests.push(quest.id);

          events.push({
            id: generateEventId(),
            year: nextYear,
            type: 'quest_generation' as any,
            title: `New Quest: ${quest.title}`,
            description: `A new quest has arisen: ${quest.description.substring(0, 50)}...`,
            causes: [],
            effects: [],
            impact: {
              society: [{
                type: 'create',
                target: quest.title,
                description: 'New quest available',
              }],
            },
          });
        }
      }
    }

    return events;
  }

  private generateAppropriateQuest(world: WorldState, population: Population, year: number): Quest | null {
    const monsters = world.society.populations.filter(p => isMonstrous(p)) as MonsterPopulation[];
    
    // Priority 1: Monster threat
    const dangerousMonster = monsters.find(m => m.dangerLevel >= 5 && !m.isDormant);
    if (dangerousMonster) {
      return this.createMonsterHuntQuest(world, population, dangerousMonster, year);
    }

    // Priority 2: Food crisis
    if (world.geography.resources[Resource.FOOD] <= 20) {
      return this.createFamineQuest(world, population, year);
    }

    // Priority 3: Resource scarcity
    const criticalResources = Object.entries(world.geography.resources)
      .filter(([_, amount]) => amount < 20)
      .map(([resource]) => resource);
    
    if (criticalResources.length > 0) {
      return this.createResourceRecoveryQuest(world, population, criticalResources[0] as Resource, year);
    }

    // Priority 4: Contextual quest
    const contextualQuest = this.generateContextualQuest(world, population, 'adaptive', year);
    if (contextualQuest) {
      return contextualQuest;
    }

    return null;
  }

  calculatePopulationDefense(population: Population): number {
    // Defense based on organization, tech level, and size
    const orgDefense = ({
      'nomadic': 1, 'tribal': 2, 'feudal': 4, 'kingdom': 6, 'empire': 8
    }[population.organization] || 2);
    
    const techDefense = Math.floor(population.technologyLevel / 2);
    const sizeDefense = population.size > 1000 ? 2 : population.size > 500 ? 1 : 0;
    
    return orgDefense + techDefense + sizeDefense;
  }

  createMonsterHuntQuest(
    world: WorldState,
    population: Population,
    monster: MonsterPopulation,
    year: number
  ): Quest {
    const urgency = monster.dangerLevel >= 8 ? 'critical' : monster.dangerLevel >= 6 ? 'high' : 'medium';
    const requiredHeroes = monster.dangerLevel >= 8 ? 5 : monster.dangerLevel >= 6 ? 3 : 1;
    
    return {
      id: generateQuestId(),
      title: `Eliminate the ${monster.monsterSubtype || monster.name}`,
      description: `The ${monster.monsterSubtype} ${monster.name} (Danger: ${monster.dangerLevel}/10) has been raiding ${population.name}'s settlements. Their lair must be found and destroyed before more lives are lost.`,
      type: QuestType.MONSTER_HUNT,
      status: QuestStatus.OPEN,
      urgency,
      originPopulationId: population.id,
      relatedMonsterId: monster.id,
      relatedLocationId: monster.lairLocation,
      reward: `The ${population.name} will reward heroes with gold, land, and honors`,
      requiredHeroes: requiredHeroes,
      assignedHeroes: [],
      deadline: year + (urgency === 'critical' ? 10 : urgency === 'high' ? 25 : 50),
      failureConsequences: `${monster.monsterSubtype} raids intensify, settlements destroyed, population decimated`,
      successConsequences: `${population.name} gains security, heroes are celebrated, trade routes become safe`,
      createdAt: year,
    };
  }

  createDiseaseCureQuest(world: WorldState, population: Population, year: number): Quest {
    const diseases = [
      'the Blazing Fever', 'the Wasting Plague', 'the Shadow Sickness', 'the Crimson Rot', 'the Bone Blight'
    ];
    const disease = this.rng.pick(diseases);
    
    return {
      id: generateQuestId(),
      title: `Cure ${disease}`,
      description: `A terrible plague called ${disease} is sweeping through ${population.name}'s lands. Physicians are powerless. Heroes must find a cure in ancient texts, distant lands, or from mysterious healers.`,
      type: QuestType.DISEASE_CURE,
      status: QuestStatus.OPEN,
      urgency: 'critical',
      originPopulationId: population.id,
      reward: 'The entire population will owe you their lives; vast rewards promised',
      requiredHeroes: 2,
      assignedHeroes: [],
      deadline: year + 20,
      failureConsequences: `${population.name} is decimated, cities become ghost towns`,
      successConsequences: `${population.name} survives and honors heroes for generations`,
      createdAt: year,
    };
  }

  createFamineQuest(world: WorldState, population: Population, year: number): Quest {
    const foodAvailability = world.geography.resources[Resource.FOOD];
    const urgency = foodAvailability <= 0 ? 'critical' : 'high';
    
    const famineScenarios = [
      {
        title: 'Find Food Sources',
        description: `The granaries of ${population.name} are empty. ${foodAvailability <= 0 ? 'Starvation has begun' : 'Food is critically low'}. Heroes must venture into the wilderness to find edible plants, hunt game, or locate abandoned caches before the entire population perishes.`,
        failure: `${population.name} faces extinction. Children starve, adults eat leather and bark, and the village becomes a graveyard.`,
        success: `${population.name} survives the famine. The heroes are remembered as saviors, and new food storage practices are established.`,
      },
      {
        title: 'Establish Irrigation Systems',
        description: `The crops have failed and ${population.name} faces ${foodAvailability <= 0 ? 'total starvation' : 'severe hunger'}. Heroes must find master engineers or ancient texts to build irrigation systems that will ensure future harvests.`,
        failure: 'Without water for the fields, the famine continues. The population disperses or dies, and the land becomes barren.',
        success: 'Irrigation channels bring life to the fields. ${population.name} not only survives but thrives, with abundant harvests for generations.',
      },
      {
        title: 'Trade for Food',
        description: `${population.name}'s stores are empty. Heroes must brave dangerous journeys to establish trade routes with distant settlements willing to exchange food for the village's resources (stone, wood, iron).`,
        failure: 'No trade routes established in time. The village is abandoned as survivors scatter to find food elsewhere.',
        success: 'Trade caravans arrive with grain and provisions. ${population.name} establishes lasting trade partnerships and becomes a hub of commerce.',
      },
    ];
    
    const scenario = this.rng.pick(famineScenarios);
    
    return {
      id: generateQuestId(),
      title: scenario.title,
      description: scenario.description,
      type: QuestType.SURVIVAL,
      status: QuestStatus.OPEN,
      urgency,
      originPopulationId: population.id,
      reward: `${population.name} will share everything they have - gold, land, honors, and eternal gratitude`,
      requiredHeroes: urgency === 'critical' ? 3 : 2,
      assignedHeroes: [],
      deadline: year + (urgency === 'critical' ? 5 : 15),
      failureConsequences: scenario.failure,
      successConsequences: scenario.success,
      createdAt: year,
    };
  }

  generateContextualQuest(
    world: WorldState, 
    population: Population, 
    context: string,
    year: number
  ): Quest | null {
    const terrain = world.geography.terrain;
    const climate = world.geography.climate;
    const resources = world.geography.resources;
    const techLevel = population.technologyLevel;
    const org = population.organization;
    
    const contextData = {
      population: population.name,
      race: population.race,
      size: population.size,
      culture: population.culture,
      organization: org,
      technologyLevel: techLevel,
      terrain,
      climate,
      resources: {
        iron: resources[Resource.IRON] || 0,
        gold: resources[Resource.GOLD] || 0,
        wood: resources[Resource.WOOD] || 0,
        stone: resources[Resource.STONE] || 0,
        food: resources[Resource.FOOD] || 0,
        water: resources[Resource.WATER] || 0,
        magic: resources[Resource.MAGIC] || 0,
        gems: resources[Resource.GEMS] || 0,
      },
      locations: world.locations.map(l => ({
        name: l.name,
        type: l.type,
        dangerLevel: l.dangerLevel,
      })),
      monsters: world.society.populations
        .filter(p => isMonstrous(p))
        .map(m => {
          const monster = m as MonsterPopulation;
          return {
            name: monster.monsterSubtype || monster.name,
            dangerLevel: monster.dangerLevel || 5,
            behavior: monster.behavior,
          };
        }),
      technologies: world.society.technologies,
      conflicts: world.society.conflicts,
    };

    const questTemplates: Record<string, (data: typeof contextData, year: number) => Quest | null> = {
      'famine': (data, year) => this.createFamineQuestFromContext(data, year),
      'adaptive': (data, year) => this.createAdaptiveQuest(data, year),
      'monster': (data, year) => this.createMonsterQuestFromContext(data, year),
      'resource': (data, year) => this.createResourceQuestFromContext(data, year),
    };

    const template = questTemplates[context];
    if (!template) {
      return this.createAdaptiveQuest(contextData, year);
    }

    return template(contextData, year);
  }

  private createFamineQuestFromContext(data: any, year: number): Quest | null {
    const terrainFeatures: Record<string, string> = {
      mountains: 'mountain caves and high-altitude herbs',
      forest: 'ancient forest groves and wild game',
      plains: 'migratory herds and hidden valleys',
      desert: 'oasis networks and underground water',
      swamp: 'reeds, fish, and medicinal bog plants',
      hills: 'terraced farming potential and caves',
      coastal: 'fishing grounds and sea caves',
      tundra: 'ice caves and hardy game',
      jungle: 'exotic fruits and dangerous wildlife',
    };

    const terrainFeature = terrainFeatures[data.terrain as keyof typeof terrainFeatures] || 'wilderness';
    const urgency = data.resources.food <= 0 ? 'critical' : 'high';
    
    return {
      id: generateQuestId(),
      title: `Secure Food from ${terrainFeature.charAt(0).toUpperCase() + terrainFeature.slice(1)}`,
      description: `${data.population} faces ${data.resources.food <= 0 ? 'starvation' : 'severe hunger'}. The ${data.culture} must send heroes to ${terrainFeature} to ${data.terrain === 'coastal' ? 'establish fishing grounds' : data.terrain === 'forest' ? 'hunt and forage' : 'find edible resources'}. Time is running out.`,
      type: QuestType.SURVIVAL,
      status: QuestStatus.OPEN,
      urgency,
      originPopulationId: data.population,
      reward: `${data.population} promises ${data.resources.gold > 50 ? 'treasure' : 'land and honors'} to those who save them`,
      requiredHeroes: urgency === 'critical' ? 3 : 2,
      assignedHeroes: [],
      deadline: year + (urgency === 'critical' ? 5 : 15),
      failureConsequences: `${data.population} perishes or scatters. Their ${data.terrain} settlement becomes a ghost town.`,
      successConsequences: `${data.population} survives and establishes sustainable food sources. The heroes become legends.`,
      createdAt: year,
    };
  }

  private createAdaptiveQuest(data: any, year: number): Quest | null {
    if (data.monsters && data.monsters.length > 0) {
      const threat = data.monsters.find((m: any) => m.dangerLevel > 5);
      if (threat) {
        return {
          id: generateQuestId(),
          title: `Stop the ${threat.name}`,
          description: `The ${threat.name} (Danger: ${threat.dangerLevel}/10) has been ${threat.behavior === 'aggressive' ? 'raiding' : 'terrorizing'} ${data.population}. Their ${data.terrain} lair must be destroyed before more lives are lost.`,
          type: QuestType.MONSTER_HUNT,
          status: QuestStatus.OPEN,
          urgency: threat.dangerLevel >= 7 ? 'critical' : 'high',
          originPopulationId: data.population,
          reward: `${data.population} will reward heroes with ${data.resources.iron > 50 ? 'weapons and armor' : 'gold and land'}`,
          requiredHeroes: threat.dangerLevel >= 7 ? 4 : 2,
          assignedHeroes: [],
          deadline: year + 20,
          failureConsequences: `${threat.name} destroys ${data.population}'s settlements. The ${data.terrain} region becomes uninhabitable.`,
          successConsequences: `${data.population} gains security. Trade routes become safe. Heroes are celebrated.`,
          createdAt: year,
        };
      }
    }

    if (data.resources.iron < 20) {
      return {
        id: generateQuestId(),
        title: 'Find New Iron Mines',
        description: `${data.population}'s iron reserves are depleted. Without iron, their ${data.technologies.join(', ')} will fail. Heroes must explore the ${data.terrain} to find new deposits or ancient caches.`,
        type: QuestType.RESOURCE_RECOVERY,
        status: QuestStatus.OPEN,
        urgency: 'high',
        originPopulationId: data.population,
        reward: `Generous payment in ${data.resources.gold > 30 ? 'gold' : 'land'} and permanent mining rights`,
        requiredHeroes: 3,
        assignedHeroes: [],
        deadline: year + 40,
        failureConsequences: `${data.population}'s technology regresses. They become vulnerable to attack.`,
        successConsequences: `${data.population} thrives with renewed resources. New trade routes established.`,
        createdAt: year,
      };
    }

    if (data.conflicts && data.conflicts.length > 0) {
      const conflict = data.conflicts[0];
      return {
        id: generateQuestId(),
        title: 'End the Growing Conflict',
        description: `${data.population} is at odds with another group over ${conflict.cause}. Heroes must negotiate peace or resolve the dispute before war erupts.`,
        type: QuestType.RECONCILIATION,
        status: QuestStatus.OPEN,
        urgency: 'medium',
        originPopulationId: data.population,
        reward: 'Peace, stability, and gratitude from both sides',
        requiredHeroes: 2,
        assignedHeroes: [],
        deadline: year + 50,
        failureConsequences: 'War breaks out. Both populations suffer devastating losses.',
        successConsequences: 'Peaceful coexistence. Trade and cultural exchange flourish.',
        createdAt: year,
      };
    }

    return null;
  }

  private createMonsterQuestFromContext(data: any, year: number): Quest | null {
    return this.createMonsterHuntQuest(
      { society: { populations: [{ id: data.population, ...data }] } as any, locations: [] } as any, 
      { id: data.population, name: data.population, size: data.size, culture: data.culture, technologyLevel: data.technologyLevel, organization: data.organization, beliefs: [], relations: [], crafts: [] } as any,
      { id: 'monster_1', name: data.monsters[0]?.name || 'Monster', size: 50, race: 'monster', culture: 'monster', technologyLevel: 0, organization: 'tribal', beliefs: [], relations: [], crafts: [], monsterType: 'orc', monsterSubtype: data.monsters[0]?.name, dangerLevel: data.monsters[0]?.dangerLevel || 5, behavior: 'aggressive', raidFrequency: 0.3, isDormant: false } as any,
      year
    );
  }

  private createResourceQuestFromContext(data: any, year: number): Quest | null {
    return this.createResourceRecoveryQuest(
      { geography: { resources: { iron: data.resources.iron } } } as any,
      { id: data.population, name: data.population, size: data.size, culture: data.culture, technologyLevel: data.technologyLevel, organization: data.organization, beliefs: [], relations: [], crafts: [] } as any,
      Resource.IRON, year
    );
  }

  createResourceRecoveryQuest(
    world: WorldState,
    population: Population,
    resource: Resource,
    year: number
  ): Quest {
    const resourceNames: Record<Resource, string> = {
      [Resource.IRON]: 'iron', [Resource.GOLD]: 'gold', [Resource.SILVER]: 'silver',
      [Resource.COPPER]: 'copper', [Resource.WOOD]: 'timber', [Resource.STONE]: 'stone',
      [Resource.FOOD]: 'food', [Resource.WATER]: 'water', [Resource.MAGIC]: 'magical artifacts',
      [Resource.GEMS]: 'precious gems',
    };
    
    return {
      id: generateQuestId(),
      title: `Secure new ${resourceNames[resource]} sources`,
      description: `${population.name}'s ${resource} reserves are critically depleted. Expeditions must venture into dangerous territories to find new sources or ancient caches.`,
      type: QuestType.RESOURCE_RECOVERY,
      status: QuestStatus.OPEN,
      urgency: 'high',
      originPopulationId: population.id,
      reward: `Generous payment in ${resource} and land grants`,
      requiredHeroes: 3,
      assignedHeroes: [],
      deadline: year + 40,
      failureConsequences: `${population.name}'s economy collapses, technology regresses, weakness invites invasion`,
      successConsequences: `${population.name} thrives, new trade routes established`,
      createdAt: year,
    };
  }
}
