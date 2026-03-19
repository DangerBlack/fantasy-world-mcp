/**
 * Test suite for LLM-forced technological discovery
 * 
 * Tests:
 * 1. LLM tech discovery with valid tech
 * 2. Validation fails for missing prerequisites
 * 3. Validation fails for missing resources
 * 4. Backward compatibility (no LLM decision = RNG)
 */

import { WorldManager } from './dist/core/worldManager.js';
import { SimulationEngine } from './dist/simulation/engine.js';
import { ResourceModule } from './dist/simulation/modules/resources.js';
import { generateLLMContext } from './dist/utils/llmPrompt.js';
import { SeededRandom } from './dist/utils/random.js';
import { EventType } from './dist/types/index.js';
import { isMonstrous } from './dist/utils/raceTraits.js';

// Test results tracking
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, message) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.log(`❌ FAIL: ${testName} - ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n=== LLM Technology Discovery Tests ===\n');

  // Setup: Create a world with initial conditions
  const worldManager = new WorldManager();
  const seed = 'test-seed-123';
  
  const initialWorld = {
    event: 'A small village established',
    locationType: 'village',
    region: 'plains',
    climate: 'temperate',
    resources: {
      iron: 50,
      copper: 30,
      tin: 20,
      wood: 60,
      stone: 40,
      food: 70,
      water: 80,
      gold: 10,
      silver: 15,
      magic: 5,
      gems: 8,
    },
    population: {
      name: 'Test Village',
      size: 500,
      race: 'human',
      culture: 'Plains Folk',
      organization: 'tribal',
      traits: {
        baseTechLevel: 3, // Start at Bronze Working level
      },
      beliefs: [],
      religiousTolerance: 'tolerant',
      relations: {},
      crafts: [],
    },
    enableMonsters: false,
  };

  const world = await worldManager.createWorld(initialWorld);
  const worldId = world.id;
  
  // Set up technologies to have all prerequisites for Bronze Working (level 3)
  world.society.technologies = [
    'Stone Tools', 'Fire Mastery', 'Basic Shelter',  // Level 0
    'Language Development', 'Social Cooperation',     // Level 1
    'Agriculture', 'Pottery', 'Domestication', 'Basic Medicine',  // Level 2
  ];
  world.timestamp = 100;
  worldManager.updateWorld(worldId, world);

  const simulationEngine = new SimulationEngine(worldManager, seed);
  const resourceModule = new ResourceModule(new SeededRandom(seed));

  // ============================================
  // Test 1: Valid LLM tech discovery
  // ============================================
  console.log('\n--- Test 1: Valid LLM Tech Discovery ---');
  
  const validDecision = {
    technologicalProgress: [
      {
        populationId: world.society.populations[0].id,
        technology: 'Bronze Working',
        narrative: 'After years of experimenting with copper and tin alloys, the villagers discovered bronze.',
      },
    ],
    events: [],
    populationChanges: [],
  };

  const params = {
    timespan: 10,
    stepSize: 10,
    complexity: 'simple',
    enableConflict: false,
    enableMigration: false,
    enableTechProgress: true,
  };

  const result = simulationEngine.simulate(worldId, params, validDecision);
  // Bronze Working should be added since population is at level 3
  const hasBronzeWorking = result.society.technologies.includes('Bronze Working');
  
  assert(
    hasBronzeWorking,
    'Test 1: Valid tech discovery applies',
    'Bronze Working should be in technologies'
  );

  // Check that event was created
  const techEvent = result.events.find(e => e.title.includes('Bronze Working'));
  assert(
    techEvent !== undefined,
    'Test 1: Tech discovery event created',
    'Should have created a technological event'
  );

  // ============================================
  // Test 2: Missing prerequisites validation
  // ============================================
  console.log('\n--- Test 2: Missing Prerequisites Validation ---');
  
  // Create a fresh world without Agriculture
  const world2 = await worldManager.createWorld({
    event: 'A stone age tribe established',
    locationType: 'village',
    region: 'plains',
    climate: 'temperate',
    resources: initialWorld.resources,
    population: {
      name: 'Stone Age Tribe',
      size: 500,
      race: 'human',
      culture: 'Plains Folk',
      organization: 'tribal',
      traits: {
        baseTechLevel: 0, // No tech
      },
      beliefs: [],
      religiousTolerance: 'tolerant',
      relations: {},
      crafts: [],
    },
    enableMonsters: false,
  });
  const worldId2 = world2.id;
  world2.society.technologies = []; // No technologies
  world2.timestamp = 50;
  worldManager.updateWorld(worldId2, world2);

  // Try to discover Iron Working (requires level 4, but population is level 0)
  const invalidTechDecision = {
    technologicalProgress: [
      {
        populationId: world2.society.populations[0].id,
        technology: 'Iron Working',
        narrative: 'They magically discovered iron working.',
      },
    ],
    events: [],
    populationChanges: [],
  };

  const result2 = simulationEngine.simulate(worldId2, params, invalidTechDecision);
  const hasIronWorking = result2.society.technologies.includes('Iron Working');
  
  assert(
    !hasIronWorking,
    'Test 2: Missing prerequisites blocked',
    'Iron Working should not be added without prerequisites'
  );

  // Test validation directly
  const population2 = world2.society.populations[0];
  const validation = resourceModule.validateTechDiscovery(world2, population2.id, 'Iron Working');
  
  assert(
    !validation.valid && validation.error?.includes('insufficient'),
    'Test 2: Validation detects insufficient tech level',
    `Should detect tech level issue, got: ${validation.error}`
  );

  // ============================================
  // Test 3: Missing resources validation
  // ============================================
  console.log('\n--- Test 3: Missing Resources Validation ---');
  
  // Create a world with low copper/tin
  const world3 = await worldManager.createWorld({
    event: 'A resource-poor village established',
    locationType: 'village',
    region: 'plains',
    climate: 'temperate',
    resources: {
      iron: 50,
      copper: 5,  // Too low
      tin: 3,     // Too low
      wood: 60,
      stone: 40,
      food: 70,
      water: 80,
      gold: 10,
      silver: 15,
      magic: 5,
      gems: 8,
    },
    population: {
      name: 'Resource Poor Village',
      size: 500,
      race: 'human',
      culture: 'Plains Folk',
      organization: 'tribal',
      traits: {
        baseTechLevel: 3, // Has Bronze Working level
      },
      beliefs: [],
      religiousTolerance: 'tolerant',
      relations: {},
      crafts: [],
    },
    enableMonsters: false,
  });
  const worldId3 = world3.id;
  
  // Set technologies to have all prerequisites for Bronze Working (level 3)
  world3.society.technologies = [
    'Stone Tools', 'Fire Mastery', 'Basic Shelter',  // Level 0
    'Language Development', 'Social Cooperation',     // Level 1
    'Agriculture', 'Pottery', 'Domestication', 'Basic Medicine',  // Level 2
  ];
  world3.timestamp = 75;
  worldManager.updateWorld(worldId3, world3);

  // Try to discover Bronze Working (requires copper: 20, tin: 10)
  const resourceDecision = {
    technologicalProgress: [
      {
        populationId: world3.society.populations[0].id,
        technology: 'Bronze Working',
        narrative: 'They found a way to make bronze.',
      },
    ],
    events: [],
    populationChanges: [],
  };

  const result3 = simulationEngine.simulate(worldId3, params, resourceDecision);
  const hasBronzeInResourcePoor = result3.society.technologies.includes('Bronze Working');
  
  assert(
    !hasBronzeInResourcePoor,
    'Test 3: Missing resources blocked',
    'Bronze Working should not be added without sufficient resources'
  );

  // Test validation directly
  const population3 = world3.society.populations[0];
  const resourceValidation = resourceModule.validateTechDiscovery(world3, population3.id, 'Bronze Working');
  
  assert(
    !resourceValidation.valid && resourceValidation.error?.includes('Insufficient'),
    'Test 3: Validation detects insufficient resources',
    `Should detect resource issue, got: ${resourceValidation.error}`
  );

  // ============================================
  // Test 4: Backward compatibility (no LLM decision = RNG)
  // ============================================
  console.log('\n--- Test 4: Backward Compatibility ---');
  
  // Create a fresh world
  const world4 = await worldManager.createWorld({
    ...initialWorld,
    population: {
      ...initialWorld.population,
      name: 'RNG Village',
    },
  });
  const worldId4 = world4.id;
  world4.society.technologies = ['Agriculture'];
  world4.timestamp = 200;
  worldManager.updateWorld(worldId4, world4);

  // Simulate WITHOUT LLM decision (should use RNG)
  const result4 = simulationEngine.simulate(worldId4, params, undefined);
  
  // The world should still simulate normally
  assert(
    result4.timestamp === 210,
    'Test 4: Time progression works without LLM',
    'World should advance 10 years'
  );

  assert(
    result4.events !== undefined,
    'Test 4: Events generated without LLM',
    'Should generate events using RNG'
  );

  // The world should be valid
  assert(
    result4.society.populations.length > 0,
    'Test 4: Populations preserved without LLM',
    'Populations should still exist'
  );

  // ============================================
  // Test 5: LLM Context Generation
  // ============================================
  console.log('\n--- Test 5: LLM Context Generation ---');
  
  const context = generateLLMContext(world, 3);
  
  assert(
    context.worldId === worldId,
    'Test 5: Context has correct world ID',
    'World ID should match'
  );
  
  console.log(`  Debug: world.timestamp = ${world.timestamp}, context.currentYear = ${context.currentYear}`);

  assert(
    context.currentYear === world.timestamp,
    'Test 5: Context has correct year',
    `Current year should match world timestamp (${world.timestamp})`
  );

  assert(
    context.populations.length === 1,
    'Test 5: Context has populations',
    'Should have 1 population'
  );

  assert(
    context.resources.iron !== undefined,
    'Test 5: Context has resources',
    'Should include iron resource'
  );

  assert(
    Array.isArray(context.recentEvents),
    'Test 5: Context has recent events',
    'Should have recent events array'
  );

  assert(
    Array.isArray(context.threats),
    'Test 5: Context has threats',
    'Should have threats array'
  );

  // ============================================
  // Test 6: Monster populations cannot discover tech
  // ============================================
  console.log('\n--- Test 6: Monster Tech Restriction ---');
  
  const world6 = await worldManager.createWorld({
    ...initialWorld,
    population: {
      name: 'Monster Horde',
      size: 200,
      race: 'monster',
      monsterType: 'orc',
      dangerLevel: 7,
      behavior: 'aggressive',
      culture: 'Warrior Tribes',
      organization: 'tribal',
      technologyLevel: 0,
      beliefs: [],
      religiousTolerance: 'intolerant',
      relations: {},
      crafts: [],
    },
    enableMonsters: false,
  });
  const worldId6 = world6.id;
  world6.timestamp = 150;
  worldManager.updateWorld(worldId6, world6);

  const monsterPopulation = world6.society.populations[0];
  const monsterValidation = resourceModule.validateTechDiscovery(world6, monsterPopulation.id, 'Agriculture');
  
  assert(
    !monsterValidation.valid && monsterValidation.error?.includes('Monstrous'),
    'Test 6: Monsters cannot discover tech',
    `Should block monsters, got: ${monsterValidation.error}`
  );

  // ============================================
  // Test 7: LLM adds a new population (migration)
  // ============================================
  console.log('\n--- Test 7: LLM New Population (Migration) ---');
  
  const world7 = await worldManager.createWorld({
    ...initialWorld,
    population: {
      ...initialWorld.population,
      name: 'Original Village',
    },
  });
  const worldId7 = world7.id;
  world7.timestamp = 100;
  worldManager.updateWorld(worldId7, world7);

  const migrationDecision = {
    technologicalProgress: [],
    events: [],
    populationChanges: [],
    newPopulations: [
      {
        name: 'Refugee Clan',
        race: 'human',
        size: 150,
        culture: 'Mountain Folk',
        organization: 'tribal',
      },
    ],
  };

  const result7 = simulationEngine.simulate(worldId7, params, migrationDecision);
  
  // Check that new population was added
  const refugeeClan = result7.society.populations.find(p => p.name === 'Refugee Clan');
  assert(
    refugeeClan !== undefined,
    'Test 7: New population added',
    'Refugee Clan should exist in populations'
  );

  assert(
    refugeeClan?.size === 150,
    'Test 7: New population has correct size',
    `Expected size 150, got ${refugeeClan?.size}`
  );

  // Check that arrival event was created
  const arrivalEvent = result7.events.find(e => e.title.includes('Refugee Clan') && e.type === EventType.MIGRATION);
  assert(
    arrivalEvent !== undefined,
    'Test 7: Migration event created',
    'Should have created a migration event'
  );

  // Check that relations were set up (neutral for civilizations)
  const originalPop = result7.society.populations.find(p => p.name === 'Original Village');
  assert(
    refugeeClan?.relations[originalPop?.id || ''] === 'neutral',
    'Test 7: Neutral relations established',
    'New civilization should have neutral relations with existing populations'
  );

  // ============================================
  // Test 8: LLM reduces population to 0 (extinction)
  // ============================================
  console.log('\n--- Test 8: LLM Population Extinction ---');
  
  const world8 = await worldManager.createWorld({
    ...initialWorld,
    population: {
      ...initialWorld.population,
      name: 'Fragile Village',
      size: 100, // Small population
    },
  });
  const worldId8 = world8.id;
  world8.timestamp = 100;
  worldManager.updateWorld(worldId8, world8);

  const extinctionDecision = {
    technologicalProgress: [],
    events: [],
    populationChanges: [
      {
        populationId: world8.society.populations[0].id,
        sizeDelta: -100, // Reduce to 0
      },
    ],
    newPopulations: [],
  };

  const result8 = simulationEngine.simulate(worldId8, params, extinctionDecision);
  const fragileVillage = result8.society.populations.find(p => p.name === 'Fragile Village');
  
  assert(
    fragileVillage?.size === 0,
    'Test 8: Population reduced to 0',
    `Expected size 0, got ${fragileVillage?.size}`
  );

  assert(
    fragileVillage?.isExtinct === true,
    'Test 8: Population marked as extinct',
    'Population should have isExtinct flag set to true'
  );

  // Check that extinction event was created
  const extinctionEvent = result8.events.find(e => e.title.includes('Fragile Village') && e.title.includes('Extinct'));
  assert(
    extinctionEvent !== undefined,
    'Test 8: Extinction event created',
    'Should have created an extinction event'
  );

  // ============================================
  // Test 9: Monster addition creates hostile relations
  // ============================================
  console.log('\n--- Test 9: Monster Addition Creates Hostile Relations ---');
  
  const world9 = await worldManager.createWorld({
    ...initialWorld,
    population: {
      ...initialWorld.population,
      name: 'Peaceful Town',
    },
  });
  const worldId9 = world9.id;
  world9.timestamp = 100;
  worldManager.updateWorld(worldId9, world9);

  const monsterInvasionDecision = {
    technologicalProgress: [],
    events: [],
    populationChanges: [],
    newPopulations: [
      {
        name: 'Orc Warband',
        race: 'monster',
        size: 50,
        culture: 'Warrior Tribes',
        organization: 'tribal',
        monsterType: 'orc',
        dangerLevel: 7,
        behavior: 'aggressive',
      },
    ],
  };

  const result9 = simulationEngine.simulate(worldId9, params, monsterInvasionDecision);
  
  const orcWarband = result9.society.populations.find(p => p.name === 'Orc Warband');
  const peacefulTown = result9.society.populations.find(p => p.name === 'Peaceful Town');
  
  assert(
    orcWarband !== undefined,
    'Test 9: Monster population added',
    'Orc Warband should exist'
  );

  assert(
    isMonstrous(orcWarband),
    'Test 9: Population is marked as monstrous',
    'Orc Warband should be identified as a monster'
  );

  // Check that hostile relations were established
  assert(
    orcWarband?.relations[peacefulTown?.id || ''] === 'hostile',
    'Test 9: Hostile relations with civilization',
    'Monsters should have hostile relations with civilizations'
  );

  assert(
    peacefulTown?.relations[orcWarband?.id || ''] === 'hostile',
    'Test 9: Civilization has hostile relations with monsters',
    'Civilizations should have hostile relations with monsters'
  );

  // Check that invasion event was created
  const invasionEvent = result9.events.find(e => e.title.includes('Orc Warband') && e.type === EventType.MONSTER_INVASION);
  assert(
    invasionEvent !== undefined,
    'Test 9: Monster invasion event created',
    'Should have created a monster invasion event'
  );

  // ============================================
  // Test 10: Civilization addition creates neutral relations
  // ============================================
  console.log('\n--- Test 10: Civilization Addition Creates Neutral Relations ---');
  
  const world10 = await worldManager.createWorld({
    ...initialWorld,
    population: {
      ...initialWorld.population,
      name: 'Original Settlement',
      race: 'human',
    },
  });
  const worldId10 = world10.id;
  world10.timestamp = 100;
  worldManager.updateWorld(worldId10, world10);

  const civilizationDecision = {
    technologicalProgress: [],
    events: [],
    populationChanges: [],
    newPopulations: [
      {
        name: 'Elven Enclave',
        race: 'elf',
        size: 200,
        culture: 'Forest Dwellers',
        organization: 'feudal',
      },
    ],
  };

  const result10 = simulationEngine.simulate(worldId10, params, civilizationDecision);
  
  const elvenEnclave = result10.society.populations.find(p => p.name === 'Elven Enclave');
  const originalSettlement = result10.society.populations.find(p => p.name === 'Original Settlement');
  
  assert(
    elvenEnclave !== undefined,
    'Test 10: New civilization added',
    'Elven Enclave should exist'
  );

  assert(
    !isMonstrous(elvenEnclave),
    'Test 10: Population is not monstrous',
    'Elven Enclave should not be a monster'
  );

  // Check that neutral relations were established
  assert(
    elvenEnclave?.relations[originalSettlement?.id || ''] === 'neutral',
    'Test 10: Neutral relations with existing civilization',
    'New civilization should have neutral relations'
  );

  assert(
    originalSettlement?.relations[elvenEnclave?.id || ''] === 'neutral',
    'Test 10: Existing civilization has neutral relations',
    'Existing civilization should have neutral relations with new arrivals'
  );

  // Check that migration event was created
  const migrationEvent = result10.events.find(e => e.title.includes('Elven Enclave') && e.type === EventType.MIGRATION);
  assert(
    migrationEvent !== undefined,
    'Test 10: Civilization migration event created',
    'Should have created a migration event'
  );

  // ============================================
  // Summary
  // ============================================
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Total: ${passedTests + failedTests}`);
  
  if (failedTests === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log(`\n⚠️  ${failedTests} test(s) failed`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
