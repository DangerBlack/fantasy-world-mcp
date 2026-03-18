/**
 * Crafts module
 * Handles craft generation, discovery, and religious crafts
 */

import { Event, Population, Craft, CraftCategory, CraftRarity, Resource, DeityDomain } from '../../types';
import { WorldState } from '../../types';
import { SeededRandom } from '../../utils/random';
import { generateEventId, generateCraftId } from '../../utils/idGenerator';

export class CraftModule {
  private rng: SeededRandom;

  constructor(rng: SeededRandom) {
    this.rng = rng;
  }

  checkCraftGeneration(world: WorldState, currentYear: number, nextYear: number): Event[] {
    const events: Event[] = [];
    
    if (!world.crafts) {
      world.crafts = [];
    }
    if (!world.society.crafts) {
      world.society.crafts = [];
    }

    for (const population of world.society.populations) {
      if (population.race === 'monster') continue;

      const techBonus = population.technologyLevel * 0.03;
      const magicResource = world.geography.resources[Resource.MAGIC] || 0;
      const magicBonus = magicResource > 50 ? 0.20 : magicResource > 30 ? 0.15 : magicResource > 10 ? 0.08 : 0.02;
      const craftChance = 0.05 + techBonus + magicBonus;

      if (this.rng.boolean(craftChance)) {
        const craft = this.generateCraft(world, population, nextYear);
        if (craft) {
          world.crafts.push(craft);
          world.society.crafts.push(craft.id);
          
          if (!population.crafts) {
            population.crafts = [];
          }
          population.crafts.push(craft.id);

          events.push({
            id: generateEventId(),
            year: nextYear,
            type: 'craft_creation' as any,
            title: craft.name,
            description: `The ${craft.category} "${craft.name}" has been created`,
            causes: [],
            effects: [],
            location: world.locations.find(l => l.inhabitants.includes(population.id))?.id,
            impact: {
              society: [{
                type: 'create',
                target: craft.name,
                description: `${craft.rarity} ${craft.category} created by ${population.name}`,
              }],
            },
          });
        }
      }
    }

    // Chance for discovering ancient/lost crafts
    if (this.rng.boolean(0.02)) {
      const discovery = this.discoverAncientCraft(world, nextYear);
      if (discovery) {
        world.crafts.push(discovery);
        world.society.crafts.push(discovery.id);

        events.push({
          id: generateEventId(),
          year: nextYear,
          type: 'craft_discovery' as any,
          title: `Discovery: ${discovery.name}`,
          description: `The ancient ${discovery.category} "${discovery.name}" has been rediscovered`,
          causes: [],
          effects: [],
          impact: {
            society: [{
              type: 'create',
              target: discovery.name,
              description: `Lost ${discovery.rarity} artifact found`,
            }],
          },
        });
      }
    }

    // Chance for crafts to be lost/hidden
    if (world.crafts.length > 0 && this.rng.boolean(0.01)) {
      const visibleCrafts = world.crafts.filter(c => !c.isHidden);
      if (visibleCrafts.length > 0) {
        const lostCraft = this.rng.pick(visibleCrafts);
        lostCraft.isHidden = true;
        lostCraft.location = undefined;

        events.push({
          id: generateEventId(),
          year: nextYear,
          type: 'craft_lost' as any,
          title: `${lostCraft.name} Lost`,
          description: `The legendary ${lostCraft.name} has disappeared from history`,
          causes: [],
          effects: [],
          impact: {
            society: [{
              type: 'transform',
              target: lostCraft.name,
              description: 'Legendary artifact becomes lost to time',
            }],
          },
        });
      }
    }

    return events;
  }

  generateCraft(world: WorldState, population: Population, year: number): Craft | null {
    const techLevel = population.technologyLevel;
    const magicResource = world.geography.resources[Resource.MAGIC] || 0;
    
    let rarity: CraftRarity;
    const rarityRoll = this.rng.next();
    
    if (techLevel >= 8 && magicResource > 50 && rarityRoll > 0.95) {
      rarity = CraftRarity.MYTHIC;
    } else if (techLevel >= 6 && magicResource > 30 && rarityRoll > 0.90) {
      rarity = CraftRarity.LEGENDARY;
    } else if (techLevel >= 4 && rarityRoll > 0.80) {
      rarity = CraftRarity.RARE;
    } else if (rarityRoll > 0.60) {
      rarity = CraftRarity.UNCOMMON;
    } else {
      rarity = CraftRarity.COMMON;
    }

    const categories: CraftCategory[] = [];
    
    if (techLevel >= 2) categories.push(CraftCategory.TOOL);
    if (techLevel >= 3) categories.push(CraftCategory.WEAPON, CraftCategory.ARMOR);
    if (techLevel >= 5) categories.push(CraftCategory.JEWELRY);
    if (techLevel >= 6) categories.push(CraftCategory.ARTIFACT);
    if (techLevel >= 7) categories.push(CraftCategory.BOOK);
    if (techLevel >= 8) categories.push(CraftCategory.STRUCTURE);
    
    if (magicResource > 30) {
      categories.push(CraftCategory.ARTIFACT, CraftCategory.RELIC);
    }
    
    const category = categories.length > 0 
      ? this.rng.pick(categories.filter(c => c !== undefined))
      : CraftCategory.TOOL;

    const craft = this.createCraftWithNameAndDescription(
      population, 
      category, 
      rarity, 
      world.geography.terrain,
      magicResource,
      year,
      world
    );

    craft.creationYear = year;
    craft.creatorPopulationId = population.id;
    craft.location = world.locations.find(l => l.inhabitants.includes(population.id))?.id;
    
    if (rarity === CraftRarity.LEGENDARY || rarity === CraftRarity.MYTHIC) {
      craft.isHidden = this.rng.boolean(0.1);
    }

    return craft;
  }

  createCraftWithNameAndDescription(
    population: Population,
    category: CraftCategory,
    rarity: CraftRarity,
    terrain: string,
    magicResource: number,
    year: number,
    world: WorldState
  ): Craft {
    const namePrefixes: Record<string, string[]> = {
      weapon: ['Dawn', 'Storm', 'Shadow', 'Iron', 'Blood', 'Soul', 'Fate', 'Dragon', 'Star', 'Void'],
      armor: ['Steel', 'Iron', 'Shadow', 'Dragon', 'Star', 'Ancient', 'Eternal', 'Void', 'Light', 'Dark'],
      tool: ['Wisdom', 'Craft', 'Stone', 'Iron', 'Magic', 'Ancient', 'Eternal', 'Quick', 'Strong'],
      artifact: ['Ancient', 'Lost', 'Forbidden', 'Sacred', 'Cursed', 'Divine', 'Eternal', 'Primordial'],
      book: ['Ancient', 'Forbidden', 'Sacred', 'Lost', 'Eternal', 'Hidden', 'Secret', 'Primordial'],
      jewelry: ['Star', 'Moon', 'Sun', 'Dragon', 'Crystal', 'Diamond', 'Ruby', 'Emerald'],
      structure: ['Stone', 'Iron', 'Ancient', 'Eternal', 'Fortress', 'Temple', 'Tower'],
      relic: ['Ancient', 'Lost', 'Sacred', 'Cursed', 'Divine', 'Forbidden', 'Eternal'],
    };

    const nameRoots: Record<string, string[]> = {
      weapon: ['Blade', 'Sword', 'Axe', 'Spear', 'Bow', 'Hammer', 'Dagger', 'Staff', 'Claw', 'Fang'],
      armor: ['Plate', 'Shield', 'Mail', 'Barding', 'Carapace', 'Bastion', 'Aegis', 'Vest'],
      tool: ['Hammer', 'Anvil', 'Tongs', 'Chisel', 'Saw', 'Pick', 'Drill', 'Forge'],
      artifact: ['Orb', 'Crystal', 'Amulet', 'Tome', 'Crown', 'Scepter', 'Chalice', 'Reliquary'],
      book: ['Tome', 'Codex', 'Grimoire', 'Scroll', 'Compendium', 'Chronicle'],
      jewelry: ['Amulet', 'Ring', 'Necklace', 'Crown', 'Tiara', 'Brooch', 'Charm'],
      structure: ['Keep', 'Tower', 'Temple', 'Sanctuary', 'Fortress', 'Citadel', 'Spire'],
      relic: ['Shard', 'Fragment', 'Relic', 'Token', 'Talisman', 'Medallion'],
    };

    const descriptions: Record<string, string[]> = {
      weapon: [
        'A blade that never dulls, said to be forged from starlight',
        'An ancient weapon imbued with the power of storms',
        'A shadow-wreathed blade that strikes without sound',
        'A dragon-forged weapon of terrible power',
      ],
      armor: [
        'Armor crafted from the scales of an ancient dragon',
        'A shield that glows with protective magic',
        'Plate mail that seems to shift between shadow and light',
        'Ancient armor that grants the wearer unnatural resilience',
      ],
      tool: [
        'A hammer that can shape any material with a single blow',
        'Tools of the ancient masters, still perfect after centuries',
        'A forge that can create magical artifacts',
      ],
      artifact: [
        'An artifact of immense power, pulsing with arcane energy',
        'A relic from a forgotten age, its purpose unknown',
        'A crystalline orb that shows visions of possible futures',
        'An ancient crown that grants dominion over elemental forces',
      ],
      book: [
        'A tome containing secrets lost to time',
        'Forbidden knowledge bound in leather of unknown origin',
        'An ancient codex written in a language no one remembers',
      ],
      jewelry: [
        'An amulet that glows with inner light',
        'A ring forged from a fallen star',
        'A necklace of dragon gems that pulses with power',
      ],
      structure: [
        'A fortress that seems to exist between dimensions',
        'An ancient temple that hums with magical energy',
        'A tower that touches the sky, built by forgotten hands',
      ],
      relic: [
        'A shard of an ancient god, still radiating power',
        'A fragment of the first creation, untouched by time',
        'A talisman that wards off all evil',
      ],
    };

    const key = category as keyof typeof namePrefixes;
    const prefix = namePrefixes[key] ? this.rng.pick(namePrefixes[key]) : 'Ancient';
    const root = nameRoots[key] ? this.rng.pick(nameRoots[key]) : 'Relic';
    
    let name = `${prefix} ${root}`;
    
    const terrainModifiers: Record<string, string[]> = {
      mountains: ['Mountain', 'Stone', 'Deep', 'Peak'],
      forest: ['Forest', 'Green', 'Wood', 'Leaf'],
      plains: ['Wind', 'Plain', 'Open', 'Sky'],
      desert: ['Sand', 'Sun', 'Dune', 'Heat'],
      swamp: ['Mire', 'Bog', 'Fen', 'Marsh'],
      coastal: ['Sea', 'Tide', 'Wave', 'Ocean'],
    };
    
    const terrainMod = terrainModifiers[terrain] || [];
    if (terrainMod.length > 0 && this.rng.boolean(0.3)) {
      const mod = this.rng.pick(terrainMod);
      name = `${mod} ${name}`;
    }

    const rarityAdjectives = {
      common: ['Simple', 'Basic', 'Ordinary'],
      uncommon: ['Fine', 'Quality', 'Improved'],
      rare: ['Masterwork', 'Exquisite', 'Superior'],
      legendary: ['Legendary', 'Fabled', 'Illustrious'],
      mythic: ['Mythic', 'Primordial', 'Divine'],
    };
    
    if (rarity === CraftRarity.MYTHIC || rarity === CraftRarity.LEGENDARY) {
      const adj = this.rng.pick(rarityAdjectives[rarity]);
      name = `${adj} ${name}`;
    }

    const descKey = key as keyof typeof descriptions;
    const baseDescription = descriptions[descKey] ? this.rng.pick(descriptions[descKey]) : 'An ancient item of unknown purpose';
    
    const description = `${baseDescription}. Created by ${population.culture} during the ${population.organization} era.`;

    const effects: string[] = [];
    if (rarity === CraftRarity.RARE) {
      effects.push('+2 to relevant checks');
    } else if (rarity === CraftRarity.LEGENDARY) {
      effects.push('+5 to relevant checks', 'Grants special ability');
    } else if (rarity === CraftRarity.MYTHIC) {
      effects.push('+10 to relevant checks', 'Grants legendary ability', 'Sentient artifact');
    }

    return {
      id: generateCraftId(),
      name,
      description,
      category,
      rarity,
      requiredTechLevel: Math.min(10, population.technologyLevel),
      requiredResources: {},
      creatorPopulationId: population.id,
      creationYear: year,
      location: world.locations.find(l => l.inhabitants.includes(population.id))?.id,
      effects: effects.length > 0 ? effects : undefined,
      isHidden: false,
      history: [`Created by ${population.name} in year ${year}`],
    };
  }

  discoverAncientCraft(world: WorldState, year: number): Craft | null {
    const categories = Object.values(CraftCategory);
    const category = this.rng.pick(categories);
    
    const rarities = [CraftRarity.RARE, CraftRarity.LEGENDARY, CraftRarity.MYTHIC];
    const rarity = this.rng.pick(rarities);
    
    const names = [
      'Sword of the First Age', 'Crown of Lost Kings', 'Tome of Forgotten Secrets',
      'Amulet of Ancient Powers', 'Shield of the Ancients', 'Staff of Primordial Magic',
      'Ring of Eternal Flame', 'Chalice of the Gods', 'Cloak of Shadows',
    ];
    
    const name = this.rng.pick(names);
    
    const descriptions = [
      'A relic from a civilization that predates recorded history',
      'An artifact of immense power, its origins unknown even to the oldest scholars',
      'A legendary item mentioned in the oldest myths and legends',
      'A creation of the ancient masters, thought to be lost forever',
    ];
    
    const description = `${this.rng.pick(descriptions)}. Recently discovered in ${world.geography.terrain} ruins.`;

    return {
      id: generateCraftId(),
      name,
      description,
      category,
      rarity,
      requiredTechLevel: 5,
      requiredResources: {},
      creatorPopulationId: 'unknown',
      creationYear: year,
      location: undefined,
      effects: rarity === CraftRarity.MYTHIC ? ['Ancient power beyond comprehension'] : ['Powerful ancient artifact'],
      isHidden: false,
      history: [`Discovered in year ${year}`],
    };
  }

  generateReligiousCraft(world: WorldState, population: Population, year: number): Craft | null {
    if (population.beliefs.length === 0) return null;
    
    const belief = world.beliefs.find(b => b.id === population.dominantBelief);
    if (!belief) return null;
    
    const domain = belief.domains[0];
    const categoryMap: Partial<Record<DeityDomain, CraftCategory>> = {
      [DeityDomain.WAR]: CraftCategory.WEAPON,
      [DeityDomain.HEALING]: CraftCategory.ARTIFACT,
      [DeityDomain.KNOWLEDGE]: CraftCategory.BOOK,
      [DeityDomain.NATURE]: CraftCategory.ARMOR,
      [DeityDomain.FIRE]: CraftCategory.TOOL,
      [DeityDomain.LIGHT]: CraftCategory.JEWELRY,
      [DeityDomain.DARKNESS]: CraftCategory.ARTIFACT,
      [DeityDomain.DEATH]: CraftCategory.RELIC,
    };
    
    const category = categoryMap[domain] || CraftCategory.RELIC;
    
    const rarities = [CraftRarity.UNCOMMON, CraftRarity.RARE, CraftRarity.LEGENDARY];
    const rarity = this.rng.pick(rarities);
    
    const names: Record<CraftCategory, string[]> = {
      [CraftCategory.WEAPON]: ['Blessed Blade', 'Holy Sword', 'Divine Spear', 'Consecrated Axe'],
      [CraftCategory.ARMOR]: ['Plate of Faith', 'Shield of Protection', 'Robes of Piety'],
      [CraftCategory.ARTIFACT]: ['Holy Orb', 'Sacred Chalice', 'Divine Prism'],
      [CraftCategory.BOOK]: ['Tome of Wisdom', 'Book of Saints', 'Scripture of Truth'],
      [CraftCategory.JEWELRY]: ['Ring of Blessings', 'Amulet of Faith', 'Crown of Devotion'],
      [CraftCategory.RELIC]: ['Relic of Saints', 'Sacred Bone', 'Holy Fragment'],
      [CraftCategory.TOOL]: ['Blessed Hammer', 'Consecrated Tools', 'Holy Anvil'],
      [CraftCategory.STRUCTURE]: ['Shrine of Faith', 'Chapel of Light'],
    };
    
    const name = this.rng.pick(names[category] || names[CraftCategory.RELIC]);
    
    const descriptions: Record<CraftCategory, string> = {
      [CraftCategory.WEAPON]: 'A weapon blessed by divine powers, effective against evil',
      [CraftCategory.ARMOR]: 'Armor imbued with protective magic from the gods',
      [CraftCategory.ARTIFACT]: 'A powerful artifact channeling divine energy',
      [CraftCategory.BOOK]: 'Sacred text containing ancient wisdom and prayers',
      [CraftCategory.JEWELRY]: 'A precious item blessed by holy priests',
      [CraftCategory.RELIC]: 'A sacred object of immense spiritual power',
      [CraftCategory.TOOL]: 'Tools blessed for sacred work',
      [CraftCategory.STRUCTURE]: 'A sacred structure dedicated to the divine',
    };
    
    const description = `${descriptions[category] || 'A holy item'}. Created in devotion to ${belief.name}.`;
    
    const effects: string[] = rarity === CraftRarity.LEGENDARY 
      ? ['Divine protection', 'Blessed against evil']
      : rarity === CraftRarity.RARE
      ? ['Minor divine blessing']
      : ['Blessed item'];
    
    return {
      id: generateCraftId(),
      name: String(name),
      description: String(description),
      category,
      rarity,
      requiredTechLevel: Math.max(3, population.technologyLevel),
      requiredResources: { [Resource.GEMS]: 10, [Resource.GOLD]: 5 },
      creatorPopulationId: population.id,
      creationYear: year,
      location: world.locations.find(l => l.inhabitants.includes(population.id))?.id,
      effects,
      isHidden: false,
      history: [`Created by ${population.name} in devotion to ${belief.name}`],
    };
  }
}
