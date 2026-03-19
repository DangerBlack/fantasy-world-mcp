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
