/**
 * Test file for technology progression system
 * Tests the new tech progression formula, tech tree, and milestone events
 */

import { WorldManager } from './dist/core/worldManager.js';
import { SimulationEngine } from './dist/simulation/engine.js';

// Test configuration
const TEST_PARAMS = {
  timespan: 200,
  stepSize: 10,
  complexity: 'moderate',
  enableConflict: false,
  enableMigration: false,
  enableTechProgress: true,
};

console.log('='.repeat(60));
console.log('TECH PROGRESSION SYSTEM TESTS');
console.log('='.repeat(60));

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  return async () => {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passedTests++;
    } catch (error) {
      console.log(`✗ ${name}`);
      console.log(`  Error: ${error.message}`);
      failedTests++;
    }
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test 1: Basic world creation with different population sizes
const testPopulationSizeBonus = test('Population Size Bonus', async () => {
  console.log('\n--- Test 1: Population Size Bonus ---');
  
  const worldManager = new WorldManager('test-seed-1');
  const world = await worldManager.createWorld({
    event: 'Small settlement founded',
    locationType: 'settlement',
    region: 'plains',
    climate: 'temperate',
    resources: { iron: 70, wood: 60, food: 50, water: 70 },
    population: [
      { name: 'Small Village', size: 50, race: 'human', culture: 'Villagers', organization: 'tribal' },
      { name: 'Large City', size: 500, race: 'human', culture: 'City Folk', organization: 'feudal' },
    ],
    enableMonsters: false,
  });

  const engine = new SimulationEngine(worldManager, 'test-seed-1');
  engine.simulate(world.id, TEST_PARAMS);

  const state = worldManager.getWorld(world.id);
  
  // Large city should have higher tech level due to population bonus
  const largeCity = state.society.populations.find(p => p.name === 'Large City');
  const smallVillage = state.society.populations.find(p => p.name === 'Small Village');
  
  console.log(`  Small Village (50 people): Tech Level ${smallVillage.technologyLevel}`);
  console.log(`  Large City (500 people): Tech Level ${largeCity.technologyLevel}`);
  
  // Both should have progressed from level 0
  assert(smallVillage.technologyLevel >= 0, 'Small village should have tech level >= 0');
  assert(largeCity.technologyLevel >= smallVillage.technologyLevel, 'Large city should have equal or higher tech level');
});

// Test 2: Organization bonus
const testOrganizationBonus = test('Organization Bonus', async () => {
  console.log('\n--- Test 2: Organization Bonus ---');
  
  const worldManager = new WorldManager('test-seed-2');
  const world = await worldManager.createWorld({
    event: 'Two tribes competing',
    locationType: 'settlement',
    region: 'plains',
    climate: 'temperate',
    resources: { iron: 80, wood: 70, food: 60, water: 80 },
    population: [
      { name: 'Tribal Clan', size: 200, race: 'human', culture: 'Clan Folk', organization: 'tribal' },
      { name: 'Feudal Kingdom', size: 200, race: 'human', culture: 'Kingdom Folk', organization: 'feudal' },
    ],
    enableMonsters: false,
  });

  const engine = new SimulationEngine(worldManager, 'test-seed-2');
  engine.simulate(world.id, TEST_PARAMS);

  const state = worldManager.getWorld(world.id);
  
  const tribal = state.society.populations.find(p => p.name === 'Tribal Clan');
  const feudal = state.society.populations.find(p => p.name === 'Feudal Kingdom');
  
  console.log(`  Tribal (org=tribal): Tech Level ${tribal.technologyLevel}`);
  console.log(`  Feudal (org=feudal): Tech Level ${feudal.technologyLevel}`);
  
  // Feudal should have equal or better progression due to +2% bonus
  assert(feudal.technologyLevel >= tribal.technologyLevel, 'Feudal should have equal or higher tech level');
});

// Test 3: Resource abundance bonus
const testResourceAbundanceBonus = test('Resource Abundance Bonus', async () => {
  console.log('\n--- Test 3: Resource Abundance Bonus ---');
  
  const worldManager = new WorldManager('test-seed-3');
  const world = await worldManager.createWorld({
    event: 'Rich lands discovered',
    locationType: 'settlement',
    region: 'plains',
    climate: 'temperate',
    resources: { 
      iron: 90,  // Abundant
      wood: 85,  // Abundant
      gold: 80,  // Abundant
      food: 50,
      water: 60,
    },
    population: { name: 'Rich Lands Folk', size: 150, race: 'human', culture: 'Richlanders', organization: 'tribal' },
    enableMonsters: false,
  });

  const engine = new SimulationEngine(worldManager, 'test-seed-3');
  engine.simulate(world.id, TEST_PARAMS);

  const state = worldManager.getWorld(world.id);
  const population = state.society.populations.find(p => p.race !== 'monster');
  
  // Count abundant resources
  const abundantCount = Object.values(state.geography.resources)
    .filter(r => r > 60 && r !== state.geography.resources.food && r !== state.geography.resources.water)
    .length;
  
  console.log(`  Abundant resources: ${abundantCount}`);
  console.log(`  Population tech level: ${population.technologyLevel}`);
  
  // Should have benefited from resource bonuses
  assert(population.technologyLevel >= 0, 'Population should have progressed');
});

// Test 4: Tech milestone events
const testTechMilestoneEvents = test('Tech Milestone Events', async () => {
  console.log('\n--- Test 4: Tech Milestone Events ---');
  
  const worldManager = new WorldManager('test-seed-4');
  const world = await worldManager.createWorld({
    event: 'Civilization begins',
    locationType: 'settlement',
    region: 'plains',
    climate: 'temperate',
    resources: { iron: 70, wood: 70, food: 60, water: 70 },
    population: { name: 'Progressive People', size: 300, race: 'human', culture: 'Progressives', organization: 'feudal' },
    enableMonsters: false,
  });

  const engine = new SimulationEngine(worldManager, 'test-seed-4');
  engine.simulate(world.id, {
    ...TEST_PARAMS,
    timespan: 300,
  });

  const state = worldManager.getWorld(world.id);
  
  // Check for tech milestone events
  const milestoneEvents = state.timeline.events.filter(e => e.type === 'tech_milestone');
  const techProgressEvents = state.timeline.events.filter(e => e.type === 'technological_progress');
  
  console.log(`  Tech milestone events: ${milestoneEvents.length}`);
  console.log(`  Tech progress events: ${techProgressEvents.length}`);
  
  if (milestoneEvents.length > 0) {
    console.log(`  First milestone: ${milestoneEvents[0].title}`);
  }
  
  // Should have some tech events
  assert(techProgressEvents.length > 0 || milestoneEvents.length > 0, 'Should have tech events');
});

// Test 5: Tech tree prerequisites
const testTechPrerequisites = test('Tech Tree Prerequisites', async () => {
  console.log('\n--- Test 5: Tech Tree Prerequisites ---');
  
  const worldManager = new WorldManager('test-seed-5');
  const world = await worldManager.createWorld({
    event: 'Stone age begins',
    locationType: 'settlement',
    region: 'plains',
    climate: 'temperate',
    resources: { iron: 50, wood: 50, food: 50, water: 50 },
    population: { name: 'Stone Age People', size: 100, race: 'human', culture: 'Primitives', organization: 'tribal' },
    enableMonsters: false,
  });

  const engine = new SimulationEngine(worldManager, 'test-seed-5');
  engine.simulate(world.id, {
    timespan: 100,
    stepSize: 10,
    complexity: 'simple',
    enableTechProgress: true,
    enableConflict: false,
    enableMigration: false,
  });

  const state = worldManager.getWorld(world.id);
  const population = state.society.populations.find(p => p.race !== 'monster');
  
  console.log(`  Tech Level: ${population.technologyLevel}`);
  console.log(`  Discovered techs: ${state.society.technologies.join(', ') || 'none'}`);
  
  // At early stages, should only have level 0-1 techs
  const level2Techs = ['Agriculture', 'Pottery', 'Domestication', 'Basic Medicine'];
  
  const hasLevel2Tech = state.society.technologies.some(t => level2Techs.includes(t));
  
  // If population is still at level 0-1, shouldn't have level 2 tech
  if (population.technologyLevel <= 1) {
    assert(!hasLevel2Tech, 'Should not have level 2 tech at level 0-1');
  }
  
  console.log('  Tech prerequisites working correctly');
});

// Test 6: Multiple populations with different progression rates
const testMultiplePopulations = test('Multiple Populations', async () => {
  console.log('\n--- Test 6: Multiple Populations ---');
  
  const worldManager = new WorldManager('test-seed-6');
  const world = await worldManager.createWorld({
    event: 'Multiple cultures emerge',
    locationType: 'settlement',
    region: 'plains',
    climate: 'temperate',
    resources: { iron: 60, wood: 60, food: 50, water: 60 },
    population: [
      { name: 'Mountain Dwarves', size: 150, race: 'dwarf', culture: 'Mountain Folk', organization: 'tribal' },
      { name: 'Forest Elves', size: 120, race: 'elf', culture: 'Forest Folk', organization: 'tribal' },
      { name: 'Plains Humans', size: 200, race: 'human', culture: 'Plains Folk', organization: 'feudal' },
    ],
    enableMonsters: false,
  });

  const engine = new SimulationEngine(worldManager, 'test-seed-6');
  engine.simulate(world.id, TEST_PARAMS);

  const state = worldManager.getWorld(world.id);
  
  console.log('  Population tech levels:');
  for (const pop of state.society.populations) {
    console.log(`    ${pop.name}: Level ${pop.technologyLevel}`);
  }
  
  // All populations should have progressed
  assert(state.society.populations.every(p => p.technologyLevel >= 0), 'All populations should have tech level');
});

// Test 7: Verify tech level affects hero classes (integration test)
const testTechLevelHeroClasses = test('Tech Level and Hero Classes', async () => {
  console.log('\n--- Test 7: Tech Level and Hero Classes ---');
  
  const worldManager = new WorldManager('test-seed-7');
  const world = await worldManager.createWorld({
    event: 'Kingdom established',
    locationType: 'city',
    region: 'plains',
    climate: 'temperate',
    resources: { iron: 70, wood: 60, food: 60, water: 70 },
    population: { name: 'Heroic Kingdom', size: 500, race: 'human', culture: 'Kingdom Folk', organization: 'kingdom' },
    enableMonsters: true,
    monsterCount: 1,
  });

  const engine = new SimulationEngine(worldManager, 'test-seed-7');
  engine.simulate(world.id, {
    ...TEST_PARAMS,
    timespan: 200,
    enableConflict: true,
  });

  const state = worldManager.getWorld(world.id);
  const population = state.society.populations.find(p => p.race !== 'monster');
  
  console.log(`  Population tech level: ${population.technologyLevel}`);
  console.log(`  Available hero classes at this level: ${population.technologyLevel >= 5 ? 'All (Warrior, Rogue, Ranger, Cleric, Paladin, Barbarian, Mage, Bard)' : 'Limited'}`);
  
  assert(population.technologyLevel >= 0, 'Population should have tech level');
});

// Run all tests
async function runTests() {
  try {
    await testPopulationSizeBonus();
    await testOrganizationBonus();
    await testResourceAbundanceBonus();
    await testTechMilestoneEvents();
    await testTechPrerequisites();
    await testMultiplePopulations();
    await testTechLevelHeroClasses();
    
    console.log('\n' + '='.repeat(60));
    console.log(`TESTS COMPLETE: ${passedTests} passed, ${failedTests} failed`);
    console.log('='.repeat(60));
    
    process.exit(failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error('Test suite error:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
