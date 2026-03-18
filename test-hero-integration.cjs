const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let worldDataCache = null;
let currentWorldId = null;
let mcpProcess = null;
let messageId = 0;

// Helper to ensure worlds directory exists
function ensureWorldsDir() {
  const worldsDir = path.join(__dirname, 'worlds');
  if (!fs.existsSync(worldsDir)) {
    fs.mkdirSync(worldsDir, { recursive: true });
  }
}

// Helper to save world to file
function saveWorld(worldId, worldData) {
  ensureWorldsDir();
  const worldFile = path.join(__dirname, 'worlds', `${worldId}.json`);
  fs.writeFileSync(worldFile, JSON.stringify(worldData, null, 2));
  console.log(`  ✓ World saved to: ${worldFile}`);
}

// Start a persistent MCP process
function startMCP() {
  return new Promise((resolve, reject) => {
    mcpProcess = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
    
    let ready = false;
    
    mcpProcess.stderr.on('data', (data) => {
      const str = data.toString();
      if (str.includes('running on stdio')) {
        ready = true;
        console.log('  ✓ MCP server started');
        resolve();
      }
    });
    
    mcpProcess.on('error', (err) => {
      reject(new Error(`MCP process error: ${err.message}`));
    });
    
    // Timeout if server doesn't start
    setTimeout(() => {
      if (!ready) {
        reject(new Error('MCP server failed to start'));
      }
    }, 5000);
  });
}

// Call a tool on the persistent MCP process
async function callTool(toolName, args) {
  return new Promise((resolve, reject) => {
    if (!mcpProcess) {
      reject(new Error('MCP process not started'));
      return;
    }
    
    const id = ++messageId;
    let output = '';
    let timedOut = false;
    
    const timeout = setTimeout(() => {
      timedOut = true;
      reject(new Error(`Timeout waiting for ${toolName}`));
    }, 15000);
    
    // Helper to extract complete JSON object from buffer by matching braces
    // Handles multi-line JSON and properly escapes quotes within strings
    function extractCompleteJson(buffer) {
      // Find the first opening brace
      const start = buffer.indexOf('{');
      if (start === -1) return null;
      
      // Count braces to find matching close, tracking string state
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;
      let end = -1;
      
      for (let i = start; i < buffer.length; i++) {
        const char = buffer[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\' && inString) {
          escapeNext = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              end = i;
              break;
            }
          }
        }
      }
      
      if (end === -1) return null;
      
      return buffer.substring(start, end + 1);
    }
    
    const onData = (data) => {
      output += data.toString();
      
      // Try to extract and process all complete JSON responses in buffer
      while (true) {
        const jsonStr = extractCompleteJson(output);
        
        if (!jsonStr) {
          // No complete JSON found, keep waiting for more data
          break;
        }
        
        try {
          const response = JSON.parse(jsonStr);
          
          // Validate response has matching id
          if (response.id === id) {
            clearTimeout(timeout);
            mcpProcess.stdout.removeListener('data', onData);
            resolve(response);
            return;
          }
          
          // If id doesn't match, remove this JSON from buffer and continue looking
          output = output.substring(jsonStr.length);
        } catch (e) {
          // JSON parsing failed, keep accumulating more data
          break;
        }
      }
    };
    
    mcpProcess.stdout.on('data', onData);
    
    mcpProcess.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: id,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    }) + '\n');
    
    mcpProcess.on('close', () => {
      clearTimeout(timeout);
      if (!timedOut) {
        reject(new Error('MCP process closed'));
      }
    });
  });
}

// Shutdown MCP process
function shutdownMCP() {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
}

async function getWorldState(worldId) {
  const result = await callTool('getWorldState', { worldId });
  const text = result.result?.content?.[0]?.text;
  if (text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.log('  ⚠ Failed to parse world state:', e.message);
      return null;
    }
  }
  return null;
}

// Assertion helpers
function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✓ ${message}: ${actual}`);
    return true;
  } else {
    console.log(`  ❌ ${message}`);
    console.log(`     Expected: ${expected}`);
    console.log(`     Actual: ${actual}`);
    return false;
  }
}

function assertNotEqual(actual, unexpected, message) {
  if (actual !== unexpected) {
    console.log(`  ✓ ${message}: ${actual}`);
    return true;
  } else {
    console.log(`  ❌ ${message}`);
    console.log(`     Should not be: ${unexpected}`);
    console.log(`     Actual: ${actual}`);
    return false;
  }
}

function assertTrue(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    return true;
  } else {
    console.log(`  ❌ ${message}`);
    return false;
  }
}

function assertFalse(condition, message) {
  if (!condition) {
    console.log(`  ✓ ${message}`);
    return true;
  } else {
    console.log(`  ❌ ${message}`);
    return false;
  }
}

function assertArrayContains(arr, value, message) {
  if (Array.isArray(arr) && arr.includes(value)) {
    console.log(`  ✓ ${message}`);
    return true;
  } else {
    console.log(`  ❌ ${message}`);
    console.log(`     Array:`, arr);
    console.log(`     Expected to contain: ${value}`);
    return false;
  }
}

function assertObjectHasKey(obj, key, message) {
  if (obj && obj.hasOwnProperty(key)) {
    console.log(`  ✓ ${message}`);
    return true;
  } else {
    console.log(`  ❌ ${message}`);
    console.log(`     Object keys:`, Object.keys(obj));
    return false;
  }
}

// Test 1: Quest Completion with Hero Death
async function testQuestCompletionWithHeroDeath() {
  console.log('\n========================================');
  console.log('TEST 1: Quest Completion with Hero Death');
  console.log('========================================');
  
  let allPassed = true;
  
  // Create a world with populations (start with higher tech level so heroes can spawn)
  console.log('\n1. Creating world with populations...');
  const initResult = await callTool('initializeWorld', {
    event: 'A settlement facing severe food shortage',
    locationType: 'settlement',
    region: 'hills',
    climate: 'temperate',
    resources: { food: 10, iron: 80, wood: 80, gold: 70, silver: 50 },  // Very low food triggers quest
    population: {
      name: 'Mountain Defenders',
      size: 800,
      race: 'human',
      culture: 'Mountain Folk',
      organization: 'feudal'
    },
    enableMonsters: true,
    monsterCount: 1
  });
  
  const initText = initResult.result?.content?.[0]?.text;
  const worldId = initText ? JSON.parse(initText).worldId : null;
  
  if (!worldId) {
    console.log('  ❌ Failed to create world');
    return false;
  }
  
  currentWorldId = worldId;
  console.log(`  ✓ World created: ${worldId}`);
  
  // Simulate a shorter time to avoid quest expiration
  console.log('\n2. Running short simulation (50 years)...');
  const simResult = await callTool('simulate', {
    worldId,
    timespan: 50,
    stepSize: 10,
    complexity: 'moderate',
    enableConflict: true,
    enableMigration: true,
    enableTechProgress: true
  });
  
  // Get full world state after simulation
  let state = await getWorldState(worldId);
  if (state) {
    worldDataCache = JSON.stringify(state);
    currentWorldId = worldId;
    
    // Manually boost tech level for testing (ensures heroes can spawn)
    if (state.society?.populations) {
      for (const pop of state.society.populations) {
        if (pop.race !== 'monster' && pop.technologyLevel < 3) {
          pop.technologyLevel = 3;  // Set to level where heroes can spawn
        }
      }
    }
    
    // Save the modified world back
    await callTool('loadWorld', { worldData: JSON.stringify(state) });
    saveWorld(worldId, state);
    console.log(`  ✓ Simulation complete. Year: ${state.timestamp || state.currentYear || 'N/A'}`);
    console.log(`  ✓ Boosted population tech levels to 3 for hero spawning test`);
    
    // Run another simulation step to actually spawn heroes with the new tech level
    console.log('\n2b. Running simulation step to spawn heroes...');
    const spawnResult = await callTool('simulate', {
      worldId,
      timespan: 20,
      stepSize: 20,
      complexity: 'moderate',
      enableConflict: true
    });
    
    // Get updated world state with heroes
    state = await getWorldState(worldId);
    if (state) {
      saveWorld(worldId, state);
    }
  } else {
    console.log('  ⚠ Could not get world state after simulation');
  }
  
  // List heroes to find one for the quest
  console.log('\n4. Listing heroes...');
  const heroesResult = await callTool('listHeroes', { worldId });
  const heroesText = heroesResult.result?.content?.[0]?.text;
  let heroId = null;
  
  if (heroesText) {
    const heroesData = JSON.parse(heroesText);
    console.log(`  Found ${heroesData.count || 0} heroes`);
    
    if (heroesData.heroes && heroesData.heroes.length > 0) {
      heroId = heroesData.heroes[0].id;
      console.log(`  ✓ Selected hero: ${heroesData.heroes[0].name} (${heroId})`);
    }
  }
  
  if (!heroId) {
    console.log('  ⚠ No heroes found, skipping death test (hero may not have spawned)');
    // Still save the world for inspection
    const stateAfterNoHero = await getWorldState(worldId);
    if (stateAfterNoHero) {
      saveWorld(worldId, stateAfterNoHero);
    }
    return false;
  }
  
  // Create a dangerous quest
  console.log('\n5. Creating dangerous quest...');
  // We'll use generateLocation to create a dungeon, then we need to check if quests are created
  // For now, let's simulate more to see if quests appear
  const moreSimResult = await callTool('simulate', {
    worldId,
    timespan: 50,
    stepSize: 50,
    complexity: 'complex',
    enableConflict: true
  });
  
  // Get world state to check for quests
  const stateAfterSim2 = await getWorldState(worldId);
  if (!stateAfterSim2) {
    console.log('  ❌ Failed to get world state');
    return false;
  }
  
  saveWorld(worldId, stateAfterSim2);
  
  // Check for existing quests
  let questId = null;
  if (stateAfterSim2.quests && stateAfterSim2.quests.length > 0) {
    questId = stateAfterSim2.quests[0].id;
    console.log(`  ✓ Found existing quest: ${stateAfterSim2.quests[0].title || stateAfterSim2.quests[0].id}`);
  }
  
  if (!questId) {
    console.log('  ⚠ No quests found in world, cannot test quest completion');
    console.log('  World state keys:', Object.keys(stateAfterSim2));
    return false;
  }
  
  // Complete the quest as FAILED (hero dies)
  console.log('\n6. Completing quest as FAILED (hero dies)...');
  const completeResult = await callTool('completeQuest', {
    worldId,
    questId,
    success: false,
    failureReason: 'Hero fell in battle against the cave terrorants'
  });
  
  assertTrue(completeResult.result, 'Quest completion call succeeded');
  
  // Save world after quest completion
  const stateAfterFailure = await getWorldState(worldId);
  if (stateAfterFailure) {
    saveWorld(worldId, stateAfterFailure);
  }
  
  // Verify hero status changed to DEAD
  console.log('\n7. Verifying hero status...');
  const heroResult = await callTool('getHero', { worldId, heroId });
  const heroText = heroResult.result?.content?.[0]?.text;
  
  if (heroText) {
    const heroData = JSON.parse(heroText);
    allPassed = assertEqual(heroData.status, 'dead', 'Hero status is DEAD') && allPassed;
  } else {
    console.log('  ❌ Could not get hero details');
    allPassed = false;
  }
  
  // Verify HERO_DEATH event was created
  console.log('\n8. Checking for HERO_DEATH event...');
  const timelineResult = await callTool('getTimeline', { worldId });
  const timelineText = timelineResult.result?.content?.[0]?.text;
  
  if (timelineText) {
    const timelineData = JSON.parse(timelineText);
    const heroDeathEvent = timelineData.events?.find(e => e.type === 'hero_death');
    allPassed = assertTrue(!!heroDeathEvent, 'hero_death event exists') && allPassed;
    if (heroDeathEvent) {
      console.log(`     Event details:`, JSON.stringify(heroDeathEvent, null, 2).substring(0, 200));
    }
  } else {
    console.log('  ⚠ Could not get timeline');
  }
  
  // Verify commemoration book was created
  console.log('\n9. Checking for commemoration book...');
  if (stateAfterFailure && stateAfterFailure.crafts) {
    const commemorationBook = stateAfterFailure.crafts.find(c => 
      c.category === 'book' && 
      (c.name.toLowerCase().includes('commemoration') || c.name.toLowerCase().includes('hero'))
    );
    allPassed = assertTrue(!!commemorationBook, 'Commemoration book created') && allPassed;
    if (commemorationBook) {
      console.log(`     Book: ${commemorationBook.name}`);
    }
  } else {
    console.log('  ⚠ Could not check crafts');
  }
  
  // Verify COMMEMORATION_CREATED event
  console.log('\n10. Checking for COMMEMORATION_CREATED event...');
  if (timelineText) {
    const timelineData = JSON.parse(timelineText);
    const commemorationEvent = timelineData.events?.find(e => e.type === 'commemoration_created');
    allPassed = assertTrue(!!commemorationEvent, 'commemoration_created event exists') && allPassed;
  }
  
  console.log(`\n${allPassed ? '✓' : '❌'} TEST 1 ${allPassed ? 'PASSED' : 'FAILED'}`);
  return allPassed;
}

// Test 2: Quest Completion with Hero Success
async function testQuestCompletionWithHeroSuccess() {
  console.log('\n========================================');
  console.log('TEST 2: Quest Completion with Hero Success');
  console.log('========================================');
  
  let allPassed = true;
  
  // Create a new world
  console.log('\n1. Creating new world...');
  const initResult = await callTool('initializeWorld', {
    event: 'A peaceful settlement with ancient ruins',
    locationType: 'settlement',
    region: 'plains',
    climate: 'temperate',
    resources: { food: 60, iron: 50, wood: 70 },
    population: {
      name: 'Plains Dwellers',
      size: 400,
      race: 'human',
      culture: 'Plains Folk',
      organization: 'feudal'
    },
    enableMonsters: true,
    monsterCount: 1
  }, true);
  
  const initText = initResult.result?.content?.[0]?.text;
  const worldId = initText ? JSON.parse(initText).worldId : null;
  
  if (!worldId) {
    console.log('  ❌ Failed to create world');
    return false;
  }
  
  currentWorldId = worldId;
  console.log(`  ✓ World created: ${worldId}`);
  
  // Simulate to spawn heroes and quests
  console.log('\n2. Simulating to spawn heroes and quests...');
  const simResult = await callTool('simulate', {
    worldId,
    timespan: 500,
    stepSize: 50,
    complexity: 'complex',
    enableConflict: true
  });
  
  const simText = simResult.result?.content?.[0]?.text;
  if (simText) {
    try {
      const simData = JSON.parse(simText);
      if (simData.world) {
        worldDataCache = JSON.stringify(simData.world);
        saveWorld(worldId, simData.world);
      }
    } catch (e) {}
  }
  
  // Get world state
  const state = await getWorldState(worldId);
  if (!state) {
    console.log('  ❌ Failed to get world state');
    return false;
  }
  
  saveWorld(worldId, state);
  
  // Find a hero and quest
  console.log('\n3. Finding hero and quest...');
  let heroId = null;
  let questId = null;
  
  if (state.heroes && state.heroes.length > 0) {
    heroId = state.heroes[0].id;
    console.log(`  ✓ Found hero: ${state.heroes[0].name}`);
  }
  
  if (state.quests && state.quests.length > 0) {
    questId = state.quests[0].id;
    console.log(`  ✓ Found quest: ${state.quests[0].title || state.quests[0].id}`);
  }
  
  if (!heroId || !questId) {
    console.log('  ⚠ Could not find hero or quest, skipping test');
    return false;
  }
  
  // Assign hero to quest (if not already assigned)
  console.log('\n4. Assigning hero to quest...');
  const assignResult = await callTool('assignHeroToQuest', {
    worldId,
    heroId,
    questId
  });
  
  // Complete the quest as SUCCESS
  console.log('\n5. Completing quest as SUCCESS...');
  const completeResult = await callTool('completeQuest', {
    worldId,
    questId,
    success: true,
    completionNotes: 'Hero successfully completed the quest and returned victorious'
  });
  
  assertTrue(completeResult.result, 'Quest completion call succeeded');
  
  // Save world after completion
  const stateAfterSuccess = await getWorldState(worldId);
  if (stateAfterSuccess) {
    saveWorld(worldId, stateAfterSuccess);
  }
  
  // Verify hero gained achievement
  console.log('\n6. Verifying hero achievement...');
  const heroResult = await callTool('getHero', { worldId, heroId });
  const heroText = heroResult.result?.content?.[0]?.text;
  
  if (heroText) {
    const heroData = JSON.parse(heroText);
    const hasAchievement = heroData.achievements && heroData.achievements.length > 0;
    allPassed = assertTrue(hasAchievement, 'Hero has achievements') && allPassed;
    if (heroData.achievements) {
      console.log(`     Achievements: ${heroData.achievements.join(', ')}`);
    }
  } else {
    console.log('  ❌ Could not get hero details');
    allPassed = false;
  }
  
  // Verify HERO_ACHIEVEMENT event
  console.log('\n7. Checking for HERO_ACHIEVEMENT event...');
  const timelineResult = await callTool('getTimeline', { worldId });
  const timelineText = timelineResult.result?.content?.[0]?.text;
  
  if (timelineText) {
    const timelineData = JSON.parse(timelineText);
    const achievementEvent = timelineData.events?.find(e => e.type === 'hero_achievement');
    allPassed = assertTrue(!!achievementEvent, 'hero_achievement event exists') && allPassed;
  }
  
  // Verify commemoration item was created
  console.log('\n8. Checking for commemoration item...');
  if (stateAfterSuccess && stateAfterSuccess.crafts) {
    const commemorationItem = stateAfterSuccess.crafts.find(c => 
      (c.category === 'book' || c.category === 'structure') && 
      (c.name.toLowerCase().includes('commemoration') || c.name.toLowerCase().includes('hero') || c.name.toLowerCase().includes('statue'))
    );
    allPassed = assertTrue(!!commemorationItem, 'Commemoration item created') && allPassed;
    if (commemorationItem) {
      console.log(`     Item: ${commemorationItem.name} (${commemorationItem.category})`);
    }
  } else {
    console.log('  ⚠ Could not check crafts');
  }
  
  console.log(`\n${allPassed ? '✓' : '❌'} TEST 2 ${allPassed ? 'PASSED' : 'FAILED'}`);
  return allPassed;
}

// Test 3: Quest Deadline Failure
async function testQuestDeadlineFailure() {
  console.log('\n========================================');
  console.log('TEST 3: Quest Deadline Failure');
  console.log('========================================');
  
  let allPassed = true;
  
  // Create a new world
  console.log('\n1. Creating new world...');
  const initResult = await callTool('initializeWorld', {
    event: 'A settlement facing imminent threat',
    locationType: 'village',
    region: 'forest',
    climate: 'temperate',
    resources: { food: 30, iron: 40, wood: 60 },
    population: {
      name: 'Forest Wardens',
      size: 200,
      race: 'human',
      culture: 'Forest Folk',
      organization: 'tribal'
    },
    enableMonsters: true,
    monsterCount: 2
  }, true);
  
  const initText = initResult.result?.content?.[0]?.text;
  const worldId = initText ? JSON.parse(initText).worldId : null;
  
  if (!worldId) {
    console.log('  ❌ Failed to create world');
    return false;
  }
  
  currentWorldId = worldId;
  console.log(`  ✓ World created: ${worldId}`);
  
  // Simulate to spawn heroes and quests
  console.log('\n2. Simulating to spawn heroes and quests...');
  const simResult = await callTool('simulate', {
    worldId,
    timespan: 500,
    stepSize: 50,
    complexity: 'complex',
    enableConflict: true
  });
  
  const simText = simResult.result?.content?.[0]?.text;
  if (simText) {
    try {
      const simData = JSON.parse(simText);
      if (simData.world) {
        worldDataCache = JSON.stringify(simData.world);
        saveWorld(worldId, simData.world);
      }
    } catch (e) {}
  }
  
  // Get world state
  const state = await getWorldState(worldId);
  if (!state) {
    console.log('  ❌ Failed to get world state');
    return false;
  }
  
  saveWorld(worldId, state);
  
  // Find a quest
  console.log('\n3. Finding quest...');
  let questId = null;
  
  if (state.quests && state.quests.length > 0) {
    questId = state.quests[0].id;
    console.log(`  ✓ Found quest: ${state.quests[0].title || state.quests[0].id}`);
    console.log(`     Current year: ${state.currentYear}`);
    console.log(`     Quest deadline: ${state.quests[0].deadline || 'none'}`);
  }
  
  if (!questId) {
    console.log('  ⚠ No quests found, cannot test deadline failure');
    return false;
  }
  
  // Run simulation step to process deadline
  console.log('\n4. Running simulation to process deadline...');
  const stepResult = await callTool('simulate', {
    worldId,
    timespan: 10,
    stepSize: 50,
    complexity: 'complex',
    enableConflict: true
  });
  
  // Get updated world state
  const stateAfterSim = await getWorldState(worldId);
  if (stateAfterSim) {
    saveWorld(worldId, stateAfterSim);
  }
  
  // Check if quest was marked as failed
  console.log('\n5. Checking quest status...');
  let questFailed = false;
  if (stateAfterSim && stateAfterSim.quests) {
    const quest = stateAfterSim.quests.find(q => q.id === questId);
    if (quest) {
      questFailed = quest.status === 'failed';
      allPassed = assertTrue(questFailed, 'Quest marked as FAILED') && allPassed;
      console.log(`     Quest status: ${quest.status}`);
    }
  }
  
  // Check for quest_failed event
  console.log('\n6. Checking for quest_failed event...');
  const timelineResult = await callTool('getTimeline', { worldId });
  const timelineText = timelineResult.result?.content?.[0]?.text;
  
  if (timelineText) {
    const timelineData = JSON.parse(timelineText);
    const questFailedEvent = timelineData.events?.find(e => e.type === 'quest_failed');
    allPassed = assertTrue(!!questFailedEvent, 'quest_failed event exists') && allPassed;
  } else {
    console.log('  ⚠ Could not get timeline');
  }
  
  // Check hero consequences (death or commemoration)
  console.log('\n7. Checking hero consequences...');
  const heroesResult = await callTool('listHeroes', { worldId });
  const heroesText = heroesResult.result?.content?.[0]?.text;
  
  if (heroesText) {
    const heroesData = JSON.parse(heroesText);
    if (heroesData.heroes && heroesData.heroes.length > 0) {
      const deadHeroes = heroesData.heroes.filter(h => h.status === 'dead');
      console.log(`     Dead heroes: ${deadHeroes.length}`);
      // This is informational - hero death may or may not happen depending on quest assignment
    }
  }
  
  console.log(`\n${allPassed ? '✓' : '❌'} TEST 3 ${allPassed ? 'PASSED' : 'FAILED'}`);
  return allPassed;
}

// Test 4: Assign Hero Tool
async function testAssignHeroTool() {
  console.log('\n========================================');
  console.log('TEST 4: Assign Hero Tool');
  console.log('========================================');
  
  let allPassed = true;
  
  // Create a new world
  console.log('\n1. Creating new world...');
  const initResult = await callTool('initializeWorld', {
    event: 'A thriving settlement with brave defenders',
    locationType: 'settlement',
    region: 'hills',
    climate: 'temperate',
    resources: { food: 10, iron: 60, wood: 50, silver: 50 },  // Very low food triggers quest
    population: {
      name: 'Hill Defenders',
      size: 600,
      race: 'human',
      culture: 'Hill Folk',
      organization: 'feudal'
    },
    enableMonsters: true,
    monsterCount: 1
  }, true);
  
  const initText = initResult.result?.content?.[0]?.text;
  const worldId = initText ? JSON.parse(initText).worldId : null;
  
  if (!worldId) {
    console.log('  ❌ Failed to create world');
    return false;
  }
  
  currentWorldId = worldId;
  console.log(`  ✓ World created: ${worldId}`);
  
  // Simulate a shorter time to avoid quest expiration
  console.log('\n2. Simulating to spawn heroes and quests (100 years)...');
  const simResult = await callTool('simulate', {
    worldId,
    timespan: 100,
    stepSize: 20,
    complexity: 'moderate',
    enableConflict: true
  });
  
  const simText = simResult.result?.content?.[0]?.text;
  if (simText) {
    try {
      const simData = JSON.parse(simText);
      if (simData.world) {
        worldDataCache = JSON.stringify(simData.world);
        saveWorld(worldId, simData.world);
      }
    } catch (e) {}
  }
  
  // Get world state and boost tech level
  const state = await getWorldState(worldId);
  if (!state) {
    console.log('  ❌ Failed to get world state');
    return false;
  }
  
  // Boost tech level to ensure heroes can spawn
  if (state.society?.populations) {
    for (const pop of state.society.populations) {
      if (pop.race !== 'monster' && pop.technologyLevel < 3) {
        pop.technologyLevel = 3;
      }
    }
  }
  
  // Save modified world
  await callTool('loadWorld', { worldData: JSON.stringify(state) });
  saveWorld(worldId, state);
  
  // Run another simulation step to actually spawn heroes with the new tech level
  console.log('\n2b. Running simulation steps to spawn heroes (40 years)...');
  const spawnResult = await callTool('simulate', {
    worldId,
    timespan: 40,
    stepSize: 20,
    complexity: 'moderate',
    enableConflict: true
  });
  
  // Get updated world state with heroes
  const stateWithHeroes = await getWorldState(worldId);
  if (stateWithHeroes) {
    saveWorld(worldId, stateWithHeroes);
  }
  
  // If no heroes spawned, manually inject one for testing
  if (!stateWithHeroes || !stateWithHeroes.heroes || stateWithHeroes.heroes.length === 0) {
    console.log('  ⚠ No heroes spawned, manually injecting one for test...');
    
    // Create a hero manually
    const testHero = {
      id: `hero_manual_${Date.now()}`,
      name: 'Test Hero',
      heroClass: 'Warrior',
      culture: stateWithHeroes.society?.populations[0]?.culture || 'Test Folk',
      originPopulationId: stateWithHeroes.society?.populations?.[0]?.id,
      status: 'alive',
      achievements: [],
      quests: [],  // Initialize quests array
      techLevel: 3
    };
    
    // Add hero to world state
    if (!stateWithHeroes.heroes) stateWithHeroes.heroes = [];
    if (!stateWithHeroes.society.heroes) stateWithHeroes.society.heroes = [];
    
    stateWithHeroes.heroes.push(testHero);
    stateWithHeroes.society.heroes.push(testHero.id);
    
    // Save the modified world
    await callTool('loadWorld', { worldData: JSON.stringify(stateWithHeroes) });
    console.log(`  ✓ Manually injected hero: ${testHero.name}`);
  }
  
  // Find a hero and quest
  console.log('\n3. Finding hero and quest...');
  let heroId = null;
  let questId = null;
  
  if (stateWithHeroes.heroes && stateWithHeroes.heroes.length > 0) {
    heroId = stateWithHeroes.heroes[0].id;
    console.log(`  ✓ Found hero: ${stateWithHeroes.heroes[0].name} (${heroId})`);
  }
  
  if (stateWithHeroes.quests && stateWithHeroes.quests.length > 0) {
    questId = stateWithHeroes.quests[0].id;
    console.log(`  ✓ Found quest: ${stateWithHeroes.quests[0].title || stateWithHeroes.quests[0].id} (${questId})`);
  }
  
  if (!heroId || !questId) {
    console.log('  ⚠ Could not find hero or quest');
    return false;
  }
  
  // Check if hero is already assigned
  console.log('\n4. Checking current hero assignment...');
  const heroBeforeResult = await callTool('getHero', { worldId, heroId });
  const heroBeforeText = heroBeforeResult.result?.content?.[0]?.text;
  let isAlreadyAssigned = false;
  
  if (heroBeforeText) {
    const heroBeforeData = JSON.parse(heroBeforeText);
    const assignedQuests = heroBeforeData.quests || [];
    isAlreadyAssigned = assignedQuests.includes(questId);
    console.log(`     Hero quests before: ${assignedQuests.length}`);
  }
  
  // Call assign_hero_to_quest tool
  console.log('\n5. Calling assignHeroToQuest tool...');
  const assignResult = await callTool('assignHeroToQuest', {
    worldId,
    heroId,
    questId
  });
  
  const assignSuccess = assignResult.result !== undefined && !assignResult.error;
  assertTrue(assignSuccess, 'assignHeroToQuest call succeeded');
  
  // Verify hero is in quest.assignedHeroes array
  console.log('\n6. Verifying hero assignment...');
  const stateAfterAssign = await getWorldState(worldId);
  if (stateAfterAssign) {
    saveWorld(worldId, stateAfterAssign);
    
    if (stateAfterAssign.quests) {
      const quest = stateAfterAssign.quests.find(q => q.id === questId);
      if (quest) {
        const assignedHeroes = quest.assignedHeroes || [];
        const isAssigned = assignedHeroes.includes(heroId);
        allPassed = assertTrue(isAssigned, 'Hero is in quest.assignedHeroes array') && allPassed;
        console.log(`     Assigned heroes: ${assignedHeroes.join(', ')}`);
      }
    }
  }
  
  // Also verify from hero side
  console.log('\n7. Verifying from hero perspective...');
  const heroAfterResult = await callTool('getHero', { worldId, heroId });
  const heroAfterText = heroAfterResult.result?.content?.[0]?.text;
  
  if (heroAfterText) {
    const heroAfterData = JSON.parse(heroAfterText);
    const assignedQuests = heroAfterData.quests || [];
    const isQuestAssigned = assignedQuests.includes(questId);
    allPassed = assertTrue(isQuestAssigned, 'Quest is in hero.quests array') && allPassed;
    console.log(`     Hero quests: ${assignedQuests.join(', ')}`);
  }
  
  console.log(`\n${allPassed ? '✓' : '❌'} TEST 4 ${allPassed ? 'PASSED' : 'FAILED'}`);
  return allPassed;
}

// Main test runner
async function runAllTests() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   HERO SYSTEM INTEGRATION TEST SUITE      ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`\nStarted at: ${new Date().toISOString()}`);
  
  // Start MCP server once for all tests
  console.log('\nStarting MCP server...');
  try {
    await startMCP();
  } catch (err) {
    console.error('  ❌ Failed to start MCP server:', err.message);
    process.exit(1);
  }
  
  const results = {
    test1: false,
    test2: false,
    test3: false,
    test4: false
  };
  
  try {
    results.test1 = await testQuestCompletionWithHeroDeath();
    await new Promise(r => setTimeout(r, 500)); // Small delay between tests
    
    results.test2 = await testQuestCompletionWithHeroSuccess();
    await new Promise(r => setTimeout(r, 500));
    
    results.test3 = await testQuestDeadlineFailure();
    await new Promise(r => setTimeout(r, 500));
    
    results.test4 = await testAssignHeroTool();
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
  } finally {
    // Shutdown MCP server
    shutdownMCP();
  }
  
  // Summary
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║              TEST SUMMARY                  ║');
  console.log('╚════════════════════════════════════════════╝');
  
  console.log(`\nTest 1 (Quest Completion with Hero Death):    ${results.test1 ? '✓ PASSED' : '❌ FAILED'}`);
  console.log(`Test 2 (Quest Completion with Hero Success):  ${results.test2 ? '✓ PASSED' : '❌ FAILED'}`);
  console.log(`Test 3 (Quest Deadline Failure):              ${results.test3 ? '✓ PASSED' : '❌ FAILED'}`);
  console.log(`Test 4 (Assign Hero Tool):                    ${results.test4 ? '✓ PASSED' : '❌ FAILED'}`);
  
  const totalPassed = Object.values(results).filter(r => r).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\nTotal: ${totalPassed}/${totalTests} tests passed`);
  console.log(`\nFinished at: ${new Date().toISOString()}`);
  
  if (currentWorldId) {
    console.log(`\nLast world ID: ${currentWorldId}`);
    console.log(`Check worlds/${currentWorldId}.json for inspection`);
  }
  
  process.exit(totalPassed === totalTests ? 0 : 1);
}

runAllTests().catch(console.error);
