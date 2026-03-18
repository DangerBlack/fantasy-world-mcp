/**
 * Test file for event deduplication system
 * Tests exact duplicate detection, fuzzy matching, event merging,
 * and preservation of distinct events
 */

import { EventDeduplicator, createEventDeduplicator } from './dist/simulation/utils/eventDeduplicator.js';
import { EventType } from './dist/types/index.js';

// Test configuration
const SIMILARITY_THRESHOLD = 0.8;

console.log('='.repeat(60));
console.log('EVENT DEDUPLICATION SYSTEM TESTS');
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

// Helper to create test events
function createEvent(id, year, type, title, description, location, target) {
  return {
    id,
    year,
    type,
    title,
    description,
    causes: [],
    effects: [],
    impact: {
      society: target ? [{ type: 'create', target, description: `Impact on ${target}` }] : [],
    },
    location,
  };
}

// Test 1: Exact duplicate detection
const testExactDuplicateDetection = test('Exact Duplicate Detection', () => {
  console.log('\n--- Test 1: Exact Duplicate Detection ---');
  
  const deduplicator = new EventDeduplicator(SIMILARITY_THRESHOLD);
  
  const event1 = createEvent('event-1', 100, EventType.NATURAL, 'Earthquake', 'A major earthquake strikes the region', 'location-1', 'Village A');
  const event2 = createEvent('event-2', 100, EventType.NATURAL, 'Earthquake', 'A major earthquake strikes the region', 'location-1', 'Village A');
  
  // Should detect as exact duplicate
  const isDuplicate = deduplicator.isExactDuplicate(event1, event2);
  console.log(`  Event 1: ${event1.title} at year ${event1.year}`);
  console.log(`  Event 2: ${event2.title} at year ${event2.year}`);
  console.log(`  Is exact duplicate: ${isDuplicate}`);
  
  assert(isDuplicate === true, 'Should detect exact duplicates');
  
  // shouldAddEvent should return false for duplicate
  const existing = [event1];
  const shouldAdd = deduplicator.shouldAddEvent(existing, event2);
  console.log(`  Should add duplicate event: ${shouldAdd}`);
  assert(shouldAdd === false, 'Should not add exact duplicate');
});

// Test 2: Fuzzy matching with similar titles
const testFuzzyMatching = test('Fuzzy Matching (Similar Titles)', () => {
  console.log('\n--- Test 2: Fuzzy Matching (Similar Titles) ---');
  
  const deduplicator = new EventDeduplicator(SIMILARITY_THRESHOLD);
  
  const event1 = createEvent('event-1', 100, EventType.QUEST_GENERATED, 'Quest: Slay the Dragon', 'The villagers need help slaying the dragon terrorizing their lands', 'location-1', 'Village A');
  const event2 = createEvent('event-2', 100, EventType.QUEST_GENERATED, 'Quest: Kill the Dragon', 'The villagers need assistance killing the dragon that has been terrorizing their lands', 'location-1', 'Village A');
  
  const similarity = deduplicator.checkSimilarity(event1, event2);
  console.log(`  Event 1 title: "${event1.title}"`);
  console.log(`  Event 2 title: "${event2.title}"`);
  console.log(`  Similarity score: ${similarity.similarityScore.toFixed(2)}`);
  console.log(`  Matching fields: ${similarity.matchingFields.join(', ')}`);
  console.log(`  Is similar: ${similarity.isSimilar}`);
  
  // Should be similar due to high word overlap in titles
  assert(similarity.isSimilar === true, 'Should detect similar events');
  assert(similarity.similarityScore >= SIMILARITY_THRESHOLD, 'Similarity should meet threshold');
});

// Test 3: Event merging
const testEventMerging = test('Event Merging', () => {
  console.log('\n--- Test 3: Event Merging ---');
  
  const deduplicator = new EventDeduplicator(SIMILARITY_THRESHOLD);
  
  const event1 = createEvent('event-1', 100, EventType.NATURAL, 'Flood', 'Heavy rains cause the river to overflow', 'location-1', 'Village A');
  const event2 = createEvent('event-2', 100, EventType.NATURAL, 'Flood', 'The river bursts its banks due to heavy rainfall', 'location-1', 'Village A');
  
  const merged = deduplicator.mergeEvents(event1, event2);
  console.log(`  Original event 1: "${event1.description}"`);
  console.log(`  Original event 2: "${event2.description}"`);
  console.log(`  Merged description: "${merged.event.description}"`);
  console.log(`  Merged with IDs: ${merged.mergedWith.join(', ')}`);
  
  // Should keep first event's ID
  assert(merged.event.id === event1.id, 'Should keep first event\'s ID');
  
  // Should merge descriptions
  assert(merged.event.description.includes('Also:'), 'Should combine descriptions with "Also:" prefix');
  
  // Should have merged both descriptions
  assert(merged.event.description.includes('Heavy rains') || merged.event.description.includes('river'), 'Should contain content from both events');
});

// Test 4: Distinct events are preserved
const testDistinctEventsPreserved = test('Distinct Events Preserved', () => {
  console.log('\n--- Test 4: Distinct Events Preserved ---');
  
  const deduplicator = new EventDeduplicator(SIMILARITY_THRESHOLD);
  
  const event1 = createEvent('event-1', 100, EventType.NATURAL, 'Earthquake Strikes Mountains', 'A major earthquake strikes the mountain range causing landslides', 'location-1', 'Mountain Village');
  const event2 = createEvent('event-2', 200, EventType.NATURAL, 'Volcanic Eruption', 'A volcano erupts in the northern lands', 'location-5', 'Northern Settlement'); // Different type details, year, location, target
  const event3 = createEvent('event-3', 100, EventType.QUEST_GENERATED, 'Quest: Find the Lost Artifact', 'A quest to find a lost ancient artifact in the dungeon', 'location-2', 'Kingdom B'); // Different type, location, and target
  
  const events = [event1, event2, event3];
  const deduplicated = deduplicator.deduplicateEvents(events);
  
  console.log(`  Input events: ${events.length}`);
  console.log(`  Output events: ${deduplicated.length}`);
  console.log(`  Event years: ${deduplicated.map(e => e.year).join(', ')}`);
  console.log(`  Event types: ${deduplicated.map(e => e.type).join(', ')}`);
  console.log(`  Event titles: ${deduplicated.map(e => e.title).join(', ')}`);
  
  // All three events should be preserved (they are distinct)
  assert(deduplicated.length === 3, 'Should preserve all distinct events');
  
  // Check that different years are preserved
  const years = deduplicated.map(e => e.year);
  assert(years.includes(100) && years.includes(200), 'Should preserve events from different years');
});

// Test 5: Deduplication removes exact duplicates
const testDeduplicationRemovesDuplicates = test('Deduplication Removes Duplicates', () => {
  console.log('\n--- Test 5: Deduplication Removes Duplicates ---');
  
  const deduplicator = new EventDeduplicator(SIMILARITY_THRESHOLD);
  
  const event1 = createEvent('event-1', 100, EventType.NATURAL, 'Earthquake', 'A major earthquake strikes', 'location-1', 'Village A');
  const event2 = createEvent('event-2', 100, EventType.NATURAL, 'Earthquake', 'A major earthquake strikes', 'location-1', 'Village A'); // Exact duplicate
  const event3 = createEvent('event-3', 100, EventType.NATURAL, 'Earthquake', 'A major earthquake strikes', 'location-1', 'Village A'); // Another duplicate
  
  const events = [event1, event2, event3];
  const deduplicated = deduplicator.deduplicateEvents(events);
  
  console.log(`  Input events: ${events.length}`);
  console.log(`  Output events: ${deduplicated.length}`);
  
  // Should reduce to 1 event
  assert(deduplicated.length === 1, 'Should reduce duplicates to single event');
});

// Test 6: Similar events are merged
const testSimilarEventsMerged = test('Similar Events Merged', () => {
  console.log('\n--- Test 6: Similar Events Merged ---');
  
  const deduplicator = new EventDeduplicator(SIMILARITY_THRESHOLD);
  
  const event1 = createEvent('event-1', 100, EventType.QUEST_GENERATED, 'Quest: Hunt the Beast', 'The people need a hero to hunt the beast', 'location-1', 'Village A');
  const event2 = createEvent('event-2', 100, EventType.QUEST_GENERATED, 'Quest: Hunt the Monster', 'The villagers need a hero to hunt the monster', 'location-1', 'Village A'); // Similar
  
  const events = [event1, event2];
  const deduplicated = deduplicator.deduplicateEvents(events);
  
  console.log(`  Input events: ${events.length}`);
  console.log(`  Output events: ${deduplicated.length}`);
  console.log(`  Merged description contains "Also:": ${deduplicated[0].description.includes('Also:')}`);
  
  // Should merge similar events
  assert(deduplicated.length === 1, 'Should merge similar events');
  assert(deduplicated[0].description.includes('Also:'), 'Should combine descriptions');
});

// Test 7: Empty events array
const testEmptyEventsArray = test('Empty Events Array', () => {
  console.log('\n--- Test 7: Empty Events Array ---');
  
  const deduplicator = new EventDeduplicator(SIMILARITY_THRESHOLD);
  
  const events = [];
  const deduplicated = deduplicator.deduplicateEvents(events);
  
  console.log(`  Input events: ${events.length}`);
  console.log(`  Output events: ${deduplicated.length}`);
  
  assert(deduplicated.length === 0, 'Should handle empty array');
});

// Test 8: Single event passes through
const testSingleEvent = test('Single Event Passes Through', () => {
  console.log('\n--- Test 8: Single Event Passes Through ---');
  
  const deduplicator = new EventDeduplicator(SIMILARITY_THRESHOLD);
  
  const event = createEvent('event-1', 100, EventType.NATURAL, 'Earthquake', 'A major earthquake strikes', 'location-1', 'Village A');
  const events = [event];
  const deduplicated = deduplicator.deduplicateEvents(events);
  
  console.log(`  Input events: ${events.length}`);
  console.log(`  Output events: ${deduplicated.length}`);
  
  assert(deduplicated.length === 1, 'Should preserve single event');
  assert(deduplicated[0].id === event.id, 'Should preserve event ID');
});

// Test 9: Signature creation
const testSignatureCreation = test('Signature Creation', () => {
  console.log('\n--- Test 9: Signature Creation ---');
  
  const deduplicator = new EventDeduplicator(SIMILARITY_THRESHOLD);
  
  const event = createEvent('event-1', 100, EventType.NATURAL, 'Earthquake', 'A major earthquake strikes', 'location-1', 'Village A');
  const signature = deduplicator.createEventSignature(event);
  
  console.log(`  Event: "${event.title}"`);
  console.log(`  Signature: year=${signature.year}, type=${signature.type}, location=${signature.location}, target=${signature.targetPopulation}, title=${signature.title}`);
  
  assert(signature.year === 100, 'Signature should include year');
  assert(signature.type === EventType.NATURAL, 'Signature should include type');
  assert(signature.location === 'location-1', 'Signature should include location');
  assert(signature.targetPopulation === 'Village A', 'Signature should include target population');
  assert(signature.title === 'Earthquake', 'Signature should include title');
});

// Test 10: Levenshtein distance calculation
const testLevenshteinDistance = test('Levenshtein Distance Calculation', () => {
  console.log('\n--- Test 10: Levenshtein Distance Calculation ---');
  
  const deduplicator = new EventDeduplicator(SIMILARITY_THRESHOLD);
  
  // Access private method via reflection for testing
  const levenshteinMethod = deduplicator.levenshteinDistance.bind(deduplicator);
  
  const distance1 = levenshteinMethod('kitten', 'sitting');
  const distance2 = levenshteinMethod('hello', 'hello');
  const distance3 = levenshteinMethod('', 'test');
  
  console.log(`  Distance("kitten", "sitting"): ${distance1}`);
  console.log(`  Distance("hello", "hello"): ${distance2}`);
  console.log(`  Distance("", "test"): ${distance3}`);
  
  assert(distance1 === 3, 'kitten->sitting should have distance 3');
  assert(distance2 === 0, 'Identical strings should have distance 0');
  assert(distance3 === 4, 'Empty to "test" should have distance 4');
});

// Test 11: Word overlap calculation
const testWordOverlap = test('Word Overlap Calculation', () => {
  console.log('\n--- Test 11: Word Overlap Calculation ---');
  
  const deduplicator = new EventDeduplicator(SIMILARITY_THRESHOLD);
  
  const title1 = 'Quest to slay the dragon';
  const title2 = 'Quest to kill the dragon';
  const title3 = 'Completely different title';
  
  // Access private method via reflection for testing
  const titleSimilarityMethod = deduplicator.calculateTitleSimilarity.bind(deduplicator);
  
  const similarity1 = titleSimilarityMethod(title1, title2);
  const similarity2 = titleSimilarityMethod(title1, title3);
  
  console.log(`  Similarity("${title1}", "${title2}"): ${similarity1.toFixed(2)}`);
  console.log(`  Similarity("${title1}", "${title3}"): ${similarity2.toFixed(2)}`);
  
  assert(similarity1 > similarity2, 'Similar titles should have higher overlap');
  assert(similarity1 >= 0.5, 'Similar titles should have reasonable overlap');
});

// Test 12: Event merging preserves effects and causes
const testMergePreservesEffects = test('Merge Preserves Effects and Causes', () => {
  console.log('\n--- Test 12: Merge Preserves Effects and Causes ---');
  
  const deduplicator = new EventDeduplicator(SIMILARITY_THRESHOLD);
  
  const event1 = {
    id: 'event-1',
    year: 100,
    type: EventType.NATURAL,
    title: 'Flood',
    description: 'Heavy rains cause flooding',
    causes: ['cause-1', 'cause-2'],
    effects: ['effect-1'],
    impact: { society: [] },
  };
  
  const event2 = {
    id: 'event-2',
    year: 100,
    type: EventType.NATURAL,
    title: 'Flood',
    description: 'River overflows its banks',
    causes: ['cause-2', 'cause-3'],
    effects: ['effect-1', 'effect-2'],
    impact: { society: [] },
  };
  
  const merged = deduplicator.mergeEvents(event1, event2);
  
  console.log(`  Event 1 causes: ${event1.causes.join(', ')}`);
  console.log(`  Event 2 causes: ${event2.causes.join(', ')}`);
  console.log(`  Merged causes: ${merged.event.causes.join(', ')}`);
  console.log(`  Event 1 effects: ${event1.effects.join(', ')}`);
  console.log(`  Event 2 effects: ${event2.effects.join(', ')}`);
  console.log(`  Merged effects: ${merged.event.effects.join(', ')}`);
  
  // Should merge causes and effects, removing duplicates
  assert(merged.event.causes.includes('cause-1'), 'Should include cause-1');
  assert(merged.event.causes.includes('cause-2'), 'Should include cause-2');
  assert(merged.event.causes.includes('cause-3'), 'Should include cause-3');
  assert(merged.event.effects.includes('effect-1'), 'Should include effect-1');
  assert(merged.event.effects.includes('effect-2'), 'Should include effect-2');
  assert(merged.event.causes.length === 3, 'Should have 3 unique causes');
  assert(merged.event.effects.length === 2, 'Should have 2 unique effects');
});

// Run all tests
async function runTests() {
  try {
    await testExactDuplicateDetection();
    await testFuzzyMatching();
    await testEventMerging();
    await testDistinctEventsPreserved();
    await testDeduplicationRemovesDuplicates();
    await testSimilarEventsMerged();
    await testEmptyEventsArray();
    await testSingleEvent();
    await testSignatureCreation();
    await testLevenshteinDistance();
    await testWordOverlap();
    await testMergePreservesEffects();
    
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
