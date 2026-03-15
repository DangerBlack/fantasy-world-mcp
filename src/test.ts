#!/usr/bin/env node
import { WorldManager } from './core/worldManager.js';
import { SimulationEngine } from './simulation/engine.js';
import { ExportFormatter } from './utils/export.js';

console.log('=== World Evolution System Test - MULTI-SPECIES ===\n');

const worldManager = new WorldManager('test-seed-123');
const simulationEngine = new SimulationEngine(worldManager, 'test-seed-123');
const exportFormatter = new ExportFormatter();

console.log('1. Creating world with MULTIPLE SPECIES...');
const world: any = worldManager.createWorld({
  event: 'A mysterious cave discovered by refugees of different races',
  locationType: 'cave',
  region: 'mountains',
  climate: 'temperate',
  resources: { iron: 60, stone: 80, food: 40, water: 70 },
  population: [
    { name: 'Exiled Dwarves', size: 15, race: 'dwarf', culture: 'Mountain Dwarves', organization: 'tribal' },
    { name: 'Forest Elves', size: 10, race: 'elf', culture: 'Wood Elves', organization: 'tribal' },
    { name: 'Human Refugees', size: 20, race: 'human', culture: 'Kingdom Survivors', organization: 'tribal' },
  ],
} as any);

console.log(`   World ID: ${world.id.substring(0, 8)}...`);
console.log(`   Populations created: ${world.society.populations.length}`);
world.society.populations.forEach((p: any) => {
  console.log(`     - ${p.size} ${p.race} ${p.name}`);
});

console.log('\n2. Simulating 500 years...');
const result: any = simulationEngine.simulate(world.id, {
  timespan: 500,
  stepSize: 10,
  complexity: 'complex',
  enableConflict: true,
  enableMigration: true,
  enableTechProgress: true,
});

console.log(`   Years simulated: ${result.timestamp}`);
console.log(`   Events generated: ${result.events.length}`);
console.log(`   Conflicts: ${result.society.conflicts.length}`);

console.log('\n3. Final Population Status:');
result.society.populations.forEach((p: any) => {
  console.log(`   ${p.race} ${p.name}: ${p.size} (org: ${p.organization}, tech: ${p.technologyLevel})`);
});

console.log('\n4. Conflicts/Relations:');
if (result.society.conflicts.length === 0) {
  console.log('   No active conflicts');
}
result.society.conflicts.forEach((c: any) => {
  console.log(`   ${c.status}: ${c.cause}`);
});

console.log('\n5. Adventure Hooks:');
const hooks = [
  'The dwarves and elves have formed an uneasy alliance against the humans.',
  'Ancient dragonborn ruins discovered beneath the mountain cave.',
  'A plague threatens all three races - only cooperation can save them.',
  'Resource wars erupt as iron mines run dry.',
];
hooks.forEach((h, i) => console.log(`   ${i+1}. ${h}`));

console.log('\n=== Multi-Species Test Complete ===');
