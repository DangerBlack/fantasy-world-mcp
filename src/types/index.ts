/**
 * Core type definitions for the World Evolution Simulation
 */

export type EventId = string;
export type WorldId = string;
export type LocationId = string;

export enum EventType {
  NATURAL = 'natural',
  SOCIAL = 'social',
  CONFLICT = 'conflict',
  TECHNOLOGICAL = 'technological',
  MIGRATION = 'migration',
  CULTURAL = 'cultural',
  MONSTER_RAID = 'monster_raid',
  MONSTER_INFESTATION = 'monster_infestation',
  MONSTER_INVASION = 'monster_invasion',
  MONSTER_DORMANCY = 'monster_dormancy',
  CRAFT_CREATION = 'craft_creation',
  CRAFT_DISCOVERY = 'craft_discovery',
  CRAFT_LOST = 'craft_lost',
  QUEST_GENERATED = 'quest_generated',
  QUEST_COMPLETED = 'quest_completed',
  QUEST_FAILED = 'quest_failed',
  RELIGIOUS_EVENT = 'religious_event',
  TEMPLE_BUILT = 'temple_built',
  HERESY = 'heresy',
  PILGRIMAGE = 'pilgrimage',
  HERO_DEATH = 'hero_death',
  HERO_RETIREMENT = 'hero_retirement',
  COMMEMORATION_CREATED = 'commemoration_created',
  HERO_ACHIEVEMENT = 'hero_achievement',
  TECH_MILESTONE = 'tech_milestone',
}

export enum LocationType {
  CAVE = 'cave',
  SETTLEMENT = 'settlement',
  CITY = 'city',
  DUNGEON = 'dungeon',
  FORTRESS = 'fortress',
  TEMPLE = 'temple',
  VILLAGE = 'village',
  TRADE_POST = 'trade_post',
  RUINS = 'ruins',
  LANDMARK = 'landmark',
}

export enum TerrainType {
  PLAINS = 'plains',
  MOUNTAINS = 'mountains',
  FOREST = 'forest',
  DESERT = 'desert',
  SWAMP = 'swamp',
  HILLS = 'hills',
  COASTAL = 'coastal',
  TUNDRA = 'tundra',
  JUNGLE = 'jungle',
}

export enum Resource {
  IRON = 'iron',
  GOLD = 'gold',
  SILVER = 'silver',
  COPPER = 'copper',
  WOOD = 'wood',
  STONE = 'stone',
  FOOD = 'food',
  WATER = 'water',
  MAGIC = 'magic',
  GEMS = 'gems',
}

export enum CraftCategory {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  TOOL = 'tool',
  ARTIFACT = 'artifact',
  BOOK = 'book',
  JEWELRY = 'jewelry',
  STRUCTURE = 'structure',
  RELIC = 'relic',
}

export enum QuestStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ABANDONED = 'abandoned',
}

export enum HeroStatus {
  ALIVE = 'alive',
  DEAD = 'dead',
  MISSING = 'missing',
  RETIRED = 'retired',
}

export enum HeroClass {
  WARRIOR = 'warrior',
  MAGE = 'mage',
  ROGUE = 'rogue',
  CLERIC = 'cleric',
  RANGER = 'ranger',
  PALADIN = 'paladin',
  BARBARIAN = 'barbarian',
  BARD = 'bard',
}

export enum QuestType {
  MONSTER_HUNT = 'monster_hunt',
  DISEASE_CURE = 'disease_cure',
  RESOURCE_RECOVERY = 'resource_recovery',
  ARTIFACT_RETRIEVAL = 'artifact_retrieval',
  PROTECTION = 'protection',
  RECONCILIATION = 'reconciliation',
  SURVIVAL = 'survival',
  MYSTERY = 'mystery',
  PILGRIMAGE = 'pilgrimage',
  TEMPLE_RESTORE = 'temple_restore',
  HERESY_SUPPRESS = 'heresy_suppress',
}

export enum BeliefType {
  PANTHEON = 'pantheon',
  MONOTHEISM = 'monotheism',
  ANIMISM = 'animism',
  PHILOSOPHY = 'philosophy',
  CULT = 'cult',
  FOLK = 'folk',
}

export enum DeityDomain {
  WAR = 'war',
  LOVE = 'love',
  DEATH = 'death',
  NATURE = 'nature',
  TRICKERY = 'trickery',
  KNOWLEDGE = 'knowledge',
  HEALING = 'healing',
  FIRE = 'fire',
  SEA = 'sea',
  SKY = 'sky',
  DARKNESS = 'darkness',
  LIGHT = 'light',
  FORTRESS = 'fortress',
  TRADE = 'trade',
}

export interface Belief {
  id: string;
  type: BeliefType;
  name: string;
  deityName?: string;
  domains: DeityDomain[];
  description: string;
  holySites: LocationId[];
  practices: string[];
  taboos: string[];
  alignment: 'good' | 'neutral' | 'evil' | 'chaotic' | 'lawful';
  followers: string[];
  foundedYear: number;
  isOrganized: boolean;
  holyText?: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  status: QuestStatus;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  originPopulationId: string;
  relatedLocationId?: LocationId;
  relatedMonsterId?: string; // If monster-related
  relatedCraftId?: string; // If artifact-related
  reward?: string;
  requiredHeroes?: number; // Number of heroes needed
  assignedHeroes: string[]; // Hero IDs (empty = open for players)
  deadline?: number; // Year by which it must be completed
  failureConsequences: string;
  successConsequences: string;
  createdAt: number;
  completedAt?: number;
  failureReason?: string;
  completionNotes?: string;
}

export interface Hero {
  id: string;
  name: string;
  race: string;
  culture: string;
  heroClass: HeroClass;
  status: HeroStatus;
  stats: {
    strength: number;
    dexterity: number;
    intelligence: number;
    charisma: number;
    constitution: number;
  };
  skills: string[];
  inventory: string[]; // Craft IDs
  quests: string[]; // Quest IDs
  achievements: string[]; // Notable accomplishments
  deathYear?: number;
  deathCause?: string;
  commemorationCraftId?: string; // ID of book/item created when hero dies/succeeds
  originPopulationId: string;
  spawnedYear: number;
  lineage?: string; // Famous ancestor's name
}

export enum CraftRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  LEGENDARY = 'legendary',
  MYTHIC = 'mythic',
}

export interface Craft {
  id: string;
  name: string;
  description: string;
  category: CraftCategory;
  rarity: CraftRarity;
  requiredTechLevel: number;
  requiredResources: Partial<Record<Resource, number>>;
  creatorPopulationId: string;
  creationYear: number;
  location?: LocationId; // Where it was created/current location
  isHidden?: boolean; // If true, location unknown (lost heritage)
  hiddenLocation?: LocationId; // Where it's hidden
  effects?: string[]; // Special properties/bonuses
  history: string[]; // Notable events in its history
}

export interface Change {
  type: 'increase' | 'decrease' | 'transform' | 'create' | 'destroy';
  target: string;
  value?: number;
  description: string;
}

export interface Event {
  id: EventId;
  year: number;
  type: EventType;
  title: string;
  description: string;
  causes: EventId[];
  effects: EventId[];
  impact: {
    geography?: Change[];
    society?: Change[];
    resources?: Change[];
  };
  location?: LocationId;
}

export enum MonsterType {
  DRAGON = 'dragon',
  GIANT = 'giant',
  ORC = 'orc',
  GOBLIN = 'goblin',
  UNDEAD = 'undead',
  BEAST = 'beast',
  DEMON = 'demon',
  ABERRATION = 'aberration',
  FAE = 'fae',
  CUSTOM = 'custom',
}

export enum MonsterBehavior {
  AGGRESSIVE = 'aggressive', // Actively raids settlements
  TERRITORIAL = 'territorial', // Defends territory, attacks intruders
  NOMADIC = 'nomadic', // Migrates, occasional raids
  DORMANT = 'dormant', // Sleeper threat, wakes up occasionally
  HIDING = 'hiding', // Lurks in dungeons/ruins, low profile
}

export interface MonsterPopulation extends Population {
  race: 'monster';
  monsterType: MonsterType;
  monsterSubtype?: string; // e.g., "red dragon", "stone giant"
  dangerLevel: number; // 1-10 threat level
  behavior: MonsterBehavior;
  lairLocation?: LocationId; // Where they nest
  raidFrequency: number; // How often they attack (0-1 scale)
  isDormant: boolean; // Dormant monsters don't act until awakened
}

/**
 * Population traits - defines behavioral and mechanical properties
 * Replaces hardcoded race logic with flexible trait system
 */
export interface PopulationTraits {
  // Core identity
  isMonstrous: boolean;        // Treated as monster (no crafting/quests/beliefs)
  canCraft: boolean;           // Can create crafts/items
  canQuest: boolean;           // Can generate and undertake quests
  canBelieve: boolean;         // Can have belief systems
  
  // Mechanics
  baseTechLevel: number;       // Starting tech level (0-10)
  aggression: number;          // 0-1 aggression level (affects conflict)
  raidFrequency: number;       // 0-1 raid chance (monsters only)
  populationGrowth: number;    // 0-1 growth rate modifier
  
  // Belief system
  defaultBeliefType: 'pantheon' | 'monotheism' | 'animism' | 'philosophy' | 'cult' | 'folk';
  preferredDomains: DeityDomain[]; // Preferred deity domains
  
  // Social
  toleranceDefault: 'intolerant' | 'tolerant' | 'pluralistic';
  organizationDefault: 'nomadic' | 'tribal' | 'feudal' | 'kingdom' | 'empire';
  
  // Combat
  dangerLevelDefault: number;  // Default danger level (1-10, monsters only)
  behaviorDefault: 'aggressive' | 'territorial' | 'nomadic' | 'dormant' | 'hiding';
}

export interface Population {
  id: string;
  name: string;
  race: string; // Race name/label (e.g., 'human', 'dwarf', 'starforged', 'void-kin')
  size: number;
  culture: string;
  
  // ✅ NEW: Explicit trait system (optional - will use defaults if not provided)
  traits?: Partial<PopulationTraits>;
  
  technologyLevel: number; // 0-10 scale (deprecated, use traits.baseTechLevel)
  organization: 'nomadic' | 'tribal' | 'feudal' | 'kingdom' | 'empire';
  beliefs: string[]; // Belief IDs
  dominantBelief?: string; // Primary belief system
  religiousTolerance: 'intolerant' | 'tolerant' | 'pluralistic';
  relations: Record<string, 'hostile' | 'neutral' | 'friendly' | 'allied'>;
  crafts: string[]; // IDs of crafts created/owned by this population
  
  // Extinction tracking
  isExtinct?: boolean; // If true, population has gone extinct
  
  // Monster-specific fields (optional - deprecated, use traits)
  monsterType?: MonsterType;
  monsterSubtype?: string;
  dangerLevel?: number;
  behavior?: MonsterBehavior;
  lairLocation?: LocationId;
  raidFrequency?: number;
  isDormant?: boolean;
}

export interface GeographyLayer {
  terrain: TerrainType;
  climate: 'arctic' | 'temperate' | 'tropical' | 'arid' | 'continental';
  resources: Record<Resource, number>; // 0-100 abundance
  features: string[];
  modifications: Change[];
}

export interface SocietyLayer {
  populations: Population[];
  cultures: string[];
  technologies: string[];
  crafts: string[]; // IDs of all crafts in the world
  quests: string[]; // IDs of all quests
  heroes: string[]; // IDs of all heroes in the world
  conflicts: {
    parties: string[];
    status: 'ongoing' | 'resolved' | 'potential';
    cause: string;
  }[];
  tradeRoutes: {
    from: LocationId;
    to: LocationId;
    goods: Resource[];
  }[];
}

export interface Location {
  id: LocationId;
  type: LocationType;
  name: string;
  description: string;
  geography: Partial<GeographyLayer>;
  inhabitants: string[]; // population IDs
  history: EventId[];
  features: string[];
  connections: LocationId[];
  dangerLevel: number; // 0-10 for dungeons
  complexity: number; // 1-10 for dungeon rooms/city districts
}

export interface Timeline {
  events: Event[];
  eras: {
    name: string;
    startYear: number;
    endYear: number;
    summary: string;
  }[];
}

export interface WorldState {
  id: WorldId;
  seed: string;
  timestamp: number;
  geography: GeographyLayer;
  society: SocietyLayer;
  locations: Location[];
  events: Event[];
  crafts: Craft[]; // All crafts in the world
  quests: Quest[]; // All quests in the world
  heroes: Hero[]; // All heroes in the world
  beliefs: Belief[]; // All beliefs in the world
  timeline: Timeline;
  metadata: {
    createdAt: string;
    simulationSteps: number;
    lastUpdate: string;
  };
}

export interface SimulationParams {
  timespan: number; // years to simulate
  stepSize: number; // years per step
  complexity: 'simple' | 'moderate' | 'complex';
  enableConflict: boolean;
  enableMigration: boolean;
  enableTechProgress: boolean;
}

export interface InitialConditions {
  event: string;
  locationType: LocationType;
  region: TerrainType;
  climate: GeographyLayer['climate'];
  resources: Partial<Record<Resource, number>>;
  population: Population | Population[]; // Support single or multiple populations (including monsters)
  enableMonsters?: boolean; // Enable monster spawning
  monsterCount?: number; // Number of monster populations to spawn (0-3)
}

// Re-export LLM decision types
export * from './llmDecision';
