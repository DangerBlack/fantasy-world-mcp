#!/usr/bin/env node
/**
 * Tests for LLM-forced technological discovery
 * 
 * This module tests:
 * 1. LLM tech discovery works correctly
 * 2. Validation of tech tree prerequisites
 * 3. Validation of resource availability
 * 4. Fallback when no LLM decision provided (backward compatibility)
 */

import { WorldManager } from '../core/worldManager.js';
import { SimulationEngine } from '../simulation/engine.js';
import { WorldState, SimulationParams, Resource, TerrainType } from '../types';
import { LLMStepDecision } from '../types/llmDecision.js';
import { generateWorldStateSummary, createTechDiscoveryPrompt } from '../utils/llmPrompt.js';

// Helper to create a minimal world for testing
function createTestWorld(): WorldState {
  return {
    id: 'test-world',
    seed: 'test-seed',
    timestamp: 0,
    geography: {
      terrain: TerrainType.PLAINS,
      climate: 'temperate',
      resources: {
        [Resource.IRON]: 50,
        [Resource.GOLD]: 30,
        [Resource.SILVER]: 20,
        [Resource.COPPER]: 40,
        [Resource.WOOD]: 60,
        [Resource.STONE]: 50,
        [Resource.FOOD]: 70,
        [Resource.WATER]: 80,
        [Resource.MAGIC]: 10,
        [Resource.GEMS]: 15,
      },
      features: [],
      modifications: [],
    },
    society: {
      populations: [
        {
          id: 'pop-human-1',
          name: 'Human Kingdom',
          race: 'human',
          size: 1000,
          culture: 'Human Culture',
          technologyLevel: 3, // Can access level 3 techs
          organization: 'kingdom',
          beliefs: [],
          religiousTolerance: 'tolerant',
          relations: {},
          crafts: [],
        },
        {
          id: 'pop-dwarf-1',
          name: 'Dwarf Clan',
          race: 'dwarf',
          size: 500,
          culture: 'Dwarf Culture',
          technologyLevel: 2, // Can access level 2 techs
          organization: 'tribal',
          beliefs: [],
          religiousTolerance: 'tolerant',
          relations: {},
          crafts: [],
        },
      ],
      cultures: ['Human Culture', 'Dwarf Culture'],
      technologies: ['Stone Tools', 'Fire Mastery', 'Basic Shelter', 'Language Development', 'Social Cooperation', 'Agriculture'],
      crafts: [],
      quests: [],
      heroes: [],
      conflicts: [],
      tradeRoutes: [],
    },
    locations: [],
    events: [],
    crafts: [],
    quests: [],
    heroes: [],
    beliefs: [],
    timeline: {
      events: [],
      eras: [],
    },
    metadata: {
      createdAt: new Date().toISOString(),
      simulationSteps: 0,
      lastUpdate: new Date().toISOString(),
    },
  } as WorldState;
}

// Helper to create simulation params
function createTestParams(): SimulationParams {
  return {
    timespan: 10,
    stepSize: 10,
    complexity: 'simple',
    enableConflict: true,
    enableMigration: true,
    enableTechProgress: true,
  };
}

// Test runner
let passedTests = 0;
let failedTests = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passedTests++;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${e}`);
    failedTests++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertContains(array: string[], item: string, message: string) {
  if (!array.includes(item)) {
    throw new Error(`${message}: "${item}" not found in array`);
  }
}

function assertNotContains(array: string[], item: string, message: string) {
  if (array.includes(item)) {
    throw new Error(`${message}: "${item}" should not be in array`);
  }
}

console.log('=== LLM Tech Discovery Tests ===\n');

// Test Suite 1: Backward Compatibility
console.log('1. Backward Compatibility - No LLM Decision');

{
  const worldManager = new WorldManager('test-seed-1');
  const world = createTestWorld();
  worldManager.updateWorld('test-backward', world);
  const engine = new SimulationEngine(worldManager, 'test-seed-1');

  test('should work without LLM decision (backward compatible)', () => {
    const result = engine.simulate('test-backward', createTestParams());
    assert(result !== undefined, 'Result should be defined');
    assertEqual(result.timestamp, 10, 'Timestamp should be 10');
  });

  test('should use RNG-based tech progress when no LLM decision provided', () => {
    const result = engine.simulate('test-backward', createTestParams());
    assert(result.society.technologies !== undefined, 'Technologies should be defined');
    assert(result.events !== undefined, 'Events should be defined');
  });
}

// Test Suite 2: LLM Tech Discovery - Basic Functionality
console.log('\n2. LLM Tech Discovery - Basic Functionality');

{
  const worldManager = new WorldManager('test-seed-2');
  const world = createTestWorld();
  worldManager.updateWorld('test-basic', world);
  const engine = new SimulationEngine(worldManager, 'test-seed-2');

  test('should apply LLM technological discovery', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [
        {
          populationId: 'pop-human-1',
          technology: 'Bronze Working',
          narrative: 'After years of experimenting with copper and tin alloys, the human smiths finally discovered the secret of bronze.',
        },
      ],
      events: [],
      populationChanges: [],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-basic', params, llmDecision);

    assertContains(result.society.technologies, 'Bronze Working', 'Bronze Working should be discovered');
    
    const techEvent = result.events.find(e => e.title.includes('Bronze Working'));
    assert(techEvent !== undefined, 'Tech event should be created');
    assert(techEvent!.description.includes('human smiths'), 'Event description should include narrative');
  });

  test('should apply multiple LLM technological discoveries', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [
        {
          populationId: 'pop-human-1',
          technology: 'Bronze Working',
          narrative: 'Discovery of bronze alloy.',
        },
        {
          populationId: 'pop-human-1',
          technology: 'Wheel',
          narrative: 'Invention of the wheel revolutionizes transport.',
        },
      ],
      events: [],
      populationChanges: [],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-basic', params, llmDecision);

    assertContains(result.society.technologies, 'Bronze Working', 'Bronze Working should be discovered');
    assertContains(result.society.technologies, 'Wheel', 'Wheel should be discovered');
  });
}

// Test Suite 3: LLM Tech Discovery - Validation
console.log('\n3. LLM Tech Discovery - Validation');

{
  const worldManager = new WorldManager("test-seed-3");
  const world = createTestWorld();
  worldManager.updateWorld('test-validation', world);
  const engine = new SimulationEngine(worldManager, 'test-seed-3');

  test('should reject technology above population tech level', () => {
    // Dwarf clan is at level 2, Iron Working requires level 4
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [
        {
          populationId: 'pop-dwarf-1',
          technology: 'Iron Working',
          narrative: 'Dwarves discover iron working.',
        },
      ],
      events: [],
      populationChanges: [],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-validation', params, llmDecision);

    assertNotContains(result.society.technologies, 'Iron Working', 'Iron Working should NOT be discovered (validation failed)');
  });

  test('should reject unknown technology', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [
        {
          populationId: 'pop-human-1',
          technology: 'Fake Technology',
          narrative: 'Fake discovery.',
        },
      ],
      events: [],
      populationChanges: [],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-validation', params, llmDecision);

    assertNotContains(result.society.technologies, 'Fake Technology', 'Fake technology should NOT be discovered');
  });

  test('should reject already discovered technology', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [
        {
          populationId: 'pop-human-1',
          technology: 'Agriculture', // Already in initial technologies
          narrative: 'Re-discovering agriculture.',
        },
      ],
      events: [],
      populationChanges: [],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-validation', params, llmDecision);

    // Should not create duplicate (already exists)
    const agricultureCount = result.society.technologies.filter(t => t === 'Agriculture').length;
    assertEqual(agricultureCount, 1, 'Agriculture should appear only once');
  });

  test('should reject for non-existent population', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [
        {
          populationId: 'non-existent-pop',
          technology: 'Bronze Working',
          narrative: 'Fake population discovery.',
        },
      ],
      events: [],
      populationChanges: [],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-validation', params, llmDecision);

    assertNotContains(result.society.technologies, 'Bronze Working', 'Bronze Working should NOT be discovered');
  });

  test('should handle invalid LLM decisions gracefully', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [
        {
          populationId: 'pop-human-1',
          technology: 'Iron Working', // Requires level 4, human is level 3
          narrative: 'Too advanced.',
        },
        {
          populationId: 'pop-human-1',
          technology: 'Bronze Working', // Valid
          narrative: 'Valid discovery.',
        },
      ],
      events: [],
      populationChanges: [],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-validation', params, llmDecision);

    assertNotContains(result.society.technologies, 'Iron Working', 'Iron Working should NOT be discovered');
    assertContains(result.society.technologies, 'Bronze Working', 'Bronze Working SHOULD be discovered');
  });
}

// Test Suite 4: LLM Tech Discovery - Tech Tree Prerequisites
console.log('\n4. LLM Tech Discovery - Tech Tree Prerequisites');

{
  const worldManager = new WorldManager("test-seed-4");
  const world = createTestWorld();
  worldManager.updateWorld('test-prereqs', world);
  const engine = new SimulationEngine(worldManager, 'test-seed-4');

  test('should allow valid tech progression within same level', () => {
    // Human is level 3, has Agriculture (level 2). Bronze Working is level 3.
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [
        {
          populationId: 'pop-human-1',
          technology: 'Bronze Working',
          narrative: 'Valid progression.',
        },
      ],
      events: [],
      populationChanges: [],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-prereqs', params, llmDecision);

    assertContains(result.society.technologies, 'Bronze Working', 'Bronze Working should be discovered');
  });

  test('should skip tech level advancement when appropriate', () => {
    // Apply valid LLM decision
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [
        {
          populationId: 'pop-human-1',
          technology: 'Bronze Working',
          narrative: 'Advancing to bronze age.',
        },
      ],
      events: [],
      populationChanges: [],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-prereqs', params, llmDecision);

    // Population should be at least level 3 (Bronze Working is level 3)
    const humanPop = result.society.populations.find(p => p.id === 'pop-human-1');
    assert(humanPop!.technologyLevel >= 3, 'Population tech level should be at least 3');
  });
}

// Test Suite 5: World State Summary Generation
console.log('\n5. World State Summary Generation');

{
  test('should generate world state summary correctly', () => {
    const world = createTestWorld();
    const summary = generateWorldStateSummary(world, 5);

    assertEqual(summary.currentYear, 0, 'Current year should be 0');
    assertEqual(summary.populations.length, 2, 'Should have 2 populations');
    assertEqual(summary.populations[0].name, 'Human Kingdom', 'First population should be Human Kingdom');
    assertEqual(summary.populations[1].name, 'Dwarf Clan', 'Second population should be Dwarf Clan');
    assertContains(summary.technologies, 'Agriculture', 'Should include Agriculture');
  });

  test('should create tech discovery prompt', () => {
    const world = createTestWorld();
    const summary = generateWorldStateSummary(world, 5);
    const prompt = createTechDiscoveryPrompt(summary);

    assert(prompt.includes('WORLD SIMULATION STATE'), 'Prompt should include header');
    assert(prompt.includes('Human Kingdom'), 'Prompt should include population name');
    assert(prompt.includes('YOUR TASK'), 'Prompt should include task section');
    assert(prompt.includes('technologicalProgress'), 'Prompt should include JSON format');
  });
}

// Test Suite 6: LLM Custom Events
console.log('\n6. LLM Custom Events');

{
  const worldManager = new WorldManager("test-seed-5");
  const world = createTestWorld();
  worldManager.updateWorld('test-events', world);
  const engine = new SimulationEngine(worldManager, 'test-seed-5');

  test('should apply LLM custom events', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [],
      events: [
        {
          type: 'social',
          title: 'Great Festival',
          description: 'A grand festival celebrating the new technologies.',
          populations: ['pop-human-1'],
        },
      ],
      populationChanges: [],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-events', params, llmDecision);

    const festivalEvent = result.events.find(e => e.title === 'Great Festival');
    assert(festivalEvent !== undefined, 'Festival event should be created');
    assert(festivalEvent!.description.includes('grand festival'), 'Event description should match');
  });

  test('should reject events with non-existent populations', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [],
      events: [
        {
          type: 'social',
          title: 'Fake Event',
          description: 'Event with fake population.',
          populations: ['non-existent-pop'],
        },
      ],
      populationChanges: [],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-events', params, llmDecision);

    const fakeEvent = result.events.find(e => e.title === 'Fake Event');
    assert(fakeEvent === undefined, 'Fake event should NOT be created');
  });
}

// Test Suite 7: LLM Population Changes
console.log('\n7. LLM Population Changes');

{
  const worldManager = new WorldManager("test-seed-6");
  const world = createTestWorld();
  worldManager.updateWorld('test-pop', world);
  const engine = new SimulationEngine(worldManager, 'test-seed-6');

  test('should apply population size changes', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [],
      events: [],
      populationChanges: [
        {
          populationId: 'pop-human-1',
          sizeDelta: 100,
        },
      ],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-pop', params, llmDecision);

    const humanPop = result.society.populations.find(p => p.id === 'pop-human-1');
    assertEqual(humanPop!.size, 1100, 'Population should be 1100 (1000 + 100)');
  });

  test('should apply technology level changes', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [],
      events: [],
      populationChanges: [
        {
          populationId: 'pop-human-1',
          technologyLevel: 5,
        },
      ],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-pop', params, llmDecision);

    const humanPop = result.society.populations.find(p => p.id === 'pop-human-1');
    assertEqual(humanPop!.technologyLevel, 5, 'Tech level should be 5');
  });

  test('should handle negative population changes', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [],
      events: [],
      populationChanges: [
        {
          populationId: 'pop-human-1',
          sizeDelta: -200,
        },
      ],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-pop', params, llmDecision);

    const humanPop = result.society.populations.find(p => p.id === 'pop-human-1');
    assertEqual(humanPop!.size, 800, 'Population should be 800 (1000 - 200)');
  });

  test('should not allow negative population size', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [],
      events: [],
      populationChanges: [
        {
          populationId: 'pop-human-1',
          sizeDelta: -2000, // Would make population negative
        },
      ],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-pop', params, llmDecision);

    const humanPop = result.society.populations.find(p => p.id === 'pop-human-1');
    assert(humanPop!.size >= 0, 'Population should not be negative');
  });
}

// Test Suite 8: Combined LLM Decisions
console.log('\n8. Combined LLM Decisions');

{
  const worldManager = new WorldManager("test-seed-7");
  const world = createTestWorld();
  worldManager.updateWorld('test-combined', world);
  const engine = new SimulationEngine(worldManager, 'test-seed-7');

  test('should handle combined tech, events, and population changes', () => {
    const llmDecision: LLMStepDecision = {
      technologicalProgress: [
        {
          populationId: 'pop-human-1',
          technology: 'Bronze Working',
          narrative: 'Discovery of bronze.',
        },
      ],
      events: [
        {
          type: 'social',
          title: 'Bronze Celebration',
          description: 'Celebrating the new technology.',
          populations: ['pop-human-1'],
        },
      ],
      populationChanges: [
        {
          populationId: 'pop-human-1',
          sizeDelta: 50,
        },
      ],
    };

    const params = { ...createTestParams(), timespan: 10, stepSize: 10 };
    const result = engine.simulate('test-combined', params, llmDecision);

    // Check all changes applied
    assertContains(result.society.technologies, 'Bronze Working', 'Bronze Working should be discovered');
    
    const celebrationEvent = result.events.find(e => e.title === 'Bronze Celebration');
    assert(celebrationEvent !== undefined, 'Celebration event should be created');
    
    const humanPop = result.society.populations.find(p => p.id === 'pop-human-1');
    assertEqual(humanPop!.size, 1050, 'Population should be 1050');
  });
}

// Summary
console.log('\n=== Test Summary ===');
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log(`Total: ${passedTests + failedTests}`);

if (failedTests > 0) {
  process.exit(1);
}
