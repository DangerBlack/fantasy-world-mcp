#!/usr/bin/env node
/**
 * Test script for World Evolution MCP Server
 */

import { WorldManager } from './core/worldManager.js';
import { SimulationEngine } from './simulation/engine.js';
import { ExportFormatter } from './utils/export.js';
import { LocationType, TerrainType } from './types/index.js';

console.log('=== World Evolution System Test ===\n');

// Create a world with initial conditions
const worldManager = new WorldManager('test-seed-123');
const simulationEngine = new SimulationEngine(worldManager, 'test-seed-123');
const exportFormatter = new ExportFormatter();

console.log('1. Creating initial world...');
const world = worldManager.createWorld({
  event: 'A small cave discovered by 20 refugees fleeing a great war',
  locationType: LocationType.CAVE,
  region: TerrainType.MOUNTAINS,
  climate: 'temperate',
  resources: {
    iron: 60,
    stone: 80,
    food: 40,
    water: 70,
  },
  population: {
    name: 'The Exiles',
    size: 20,
    culture: 'Mountain Folk',
    organization: 'tribal',
  },
});

console.log(`   World ID: ${world.id.substring(0, 8)}...`);
console.log(`   Starting event: ${world.events[0].title}`);
console.log(`   Location: ${world.locations[0].name} (${world.locations[0].type})`);
console.log(`   Population: ${world.society.populations[0].size} ${world.society.populations[0].name}\n`);

console.log('2. Simulating 500 years of history...');
const params = {
  timespan: 500,
  stepSize: 10,
  complexity: 'moderate' as const,
  enableConflict: true,
  enableMigration: true,
  enableTechProgress: true,
};

const result = simulationEngine.simulate(world.id, params);

console.log(`   Years simulated: ${result.timestamp}`);
console.log(`   Events generated: ${result.events.length}`);
console.log(`   Eras created: ${result.timeline.eras.length}`);
console.log(`   Locations evolved: ${result.locations.length}\n`);

console.log('3. Timeline Summary:');
for (const era of result.timeline.eras) {
  console.log(`   ${era.name} (${era.startYear}-${era.endYear}): ${era.summary}`);
}

console.log('\n4. Major Events:');
const majorEvents = result.events.filter((e: any) => 
  e.title.includes('Settlement') || 
  e.title.includes('Village') || 
  e.title.includes('City') ||
  e.title.includes('Agriculture') ||
  e.title.includes('Iron')
);

for (const event of majorEvents.slice(0, 10)) {
  console.log(`   Year ${event.year}: ${event.title}`);
  console.log(`     ${event.description}`);
}

console.log('\n5. Current State:');
const population = result.society.populations[0];
console.log(`   Population: ${population.size} (${population.organization})`);
console.log(`   Technology Level: ${population.technologyLevel}/10`);
console.log(`   Technologies: ${result.society.technologies.join(', ') || 'None yet'}`);
console.log(`   Locations: ${result.locations.map((l: any) => `${l.name} (${l.type})`).join(', ')}`);

console.log('\n6. Resource Status:');
for (const [resource, value] of Object.entries(result.geography.resources)) {
  const val = value as number;
  const bar = '█'.repeat(Math.floor(val / 10)) + '░'.repeat(10 - Math.floor(val / 10));
  console.log(`   ${resource.padEnd(8)}: ${bar} (${Math.floor(val)})`);
}

console.log('\n7. Exporting as GM Notes:');
const gmNotes = exportFormatter.format(result, {
  format: 'gm_notes',
  includeTimeline: true,
  includeLocations: true,
});

console.log(gmNotes);

console.log('\n=== Test Complete ===');
