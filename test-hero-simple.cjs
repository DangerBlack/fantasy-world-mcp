const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let mcpProcess = null;
let messageId = 0;

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
    
    setTimeout(() => {
      if (!ready) reject(new Error('MCP server failed to start'));
    }, 5000);
  });
}

// Call a tool
async function callTool(toolName, args) {
  return new Promise((resolve, reject) => {
    if (!mcpProcess) {
      reject(new Error('MCP process not started'));
      return;
    }
    
    const id = ++messageId;
    let output = '';
    
    const timeout = setTimeout(() => {
      mcpProcess.stdout.removeListener('data', onData);
      reject(new Error(`Timeout waiting for ${toolName}`));
    }, 10000);
    
    const onData = (data) => {
      output += data.toString();
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('"id":' + id) && line.includes('"result"')) {
          try {
            const jsonStart = line.indexOf('{');
            const jsonEnd = line.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
              const response = JSON.parse(line.substring(jsonStart, jsonEnd + 1));
              if (response.id === id) {
                clearTimeout(timeout);
                mcpProcess.stdout.removeListener('data', onData);
                resolve(response);
                return;
              }
            }
          } catch (e) {}
        }
      }
    };
    
    mcpProcess.stdout.on('data', onData);
    
    mcpProcess.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: id,
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    }) + '\n');
  });
}

async function getWorldState(worldId) {
  const result = await callTool('getWorldState', { worldId });
  const text = result.result?.content?.[0]?.text;
  return text ? JSON.parse(text) : null;
}

// Assertion helpers
function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✓ ${message}`);
    return true;
  }
  console.log(`  ❌ ${message}: expected ${expected}, got ${actual}`);
  return false;
}

function assertTrue(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    return true;
  }
  console.log(`  ❌ ${message}`);
  return false;
}

// TEST: Manual hero creation and quest completion
async function testManualHeroQuestCompletion() {
  console.log('\n========================================');
  console.log('TEST: Manual Hero Creation & Quest Completion');
  console.log('========================================\n');
  
  let allPassed = true;
  
  // 1. Create world
  console.log('1. Creating world...');
  const initResult = await callTool('initializeWorld', {
    event: 'A settlement with brave warriors',
    locationType: 'settlement',
    region: 'plains',
    climate: 'temperate',
    resources: { food: 60, iron: 70 },
    population: {
      name: 'Plains Warriors',
      size: 500,
      race: 'human',
      culture: 'Warriors',
      organization: 'feudal'
    }
  });
  
  const initText = initResult.result?.content?.[0]?.text;
  const worldId = initText ? JSON.parse(initText).worldId : null;
  
  if (!worldId) {
    console.log('  ❌ Failed to create world');
    return false;
  }
  console.log(`  ✓ World created: ${worldId}`);
  
  // 2. Get world state and manually add a hero
  console.log('\n2. Adding a hero manually...');
  let state = await getWorldState(worldId);
  
  // Get a population ID
  const popId = state.society.populations[0].id;
  
  // Create a hero manually
  const heroId = `hero_${Date.now()}`;
  const hero = {
    id: heroId,
    name: 'Valdar the Brave',
    heroClass: 'WARRIOR',
    status: 'alive',
    culture: 'Warriors',
    populationId: popId,
    stats: { strength: 18, dexterity: 14, constitution: 16, intelligence: 10, wisdom: 12, charisma: 14 },
    skills: ['Combat', 'Leadership'],
    quests: [],
    achievements: [],
    inventory: [],
    lineage: null,
    createdAt: state.timestamp || 0
  };
  
  // Add hero to world
  if (!state.heroes) state.heroes = [];
  state.heroes.push(hero);
  if (!state.society.heroes) state.society.heroes = [];
  state.society.heroes.push(heroId);
  
  // Save world
  await callTool('loadWorld', { worldData: JSON.stringify(state) });
  console.log(`  ✓ Hero added: ${hero.name}`);
  
  // 3. Create a quest manually
  console.log('\n3. Creating a quest manually...');
  const questId = `quest_${Date.now()}`;
  const quest = {
    id: questId,
    title: 'Defeat the Dragon',
    description: 'A dragon threatens the plains',
    type: 'monster_hunt',
    status: 'open',
    urgency: 'critical',
    originPopulationId: popId,
    reward: 'Gold and glory',
    requiredHeroes: 1,
    assignedHeroes: [],
    createdAt: state.timestamp || 0
  };
  
  // Add quest to world
  state = await getWorldState(worldId);
  if (!state.quests) state.quests = [];
  state.quests.push(quest);
  
  await callTool('loadWorld', { worldData: JSON.stringify(state) });
  console.log(`  ✓ Quest created: ${quest.title}`);
  
  // 4. Assign hero to quest
  console.log('\n4. Assigning hero to quest...');
  const assignResult = await callTool('assignHeroToQuest', {
    worldId,
    heroId,
    questId
  });
  
  assertTrue(assignResult.result?.success, 'Hero assigned to quest');
  
  // Verify assignment
  state = await getWorldState(worldId);
  const assignedQuest = state.quests.find(q => q.id === questId);
  assertTrue(assignedQuest?.assignedHeroes?.includes(heroId), 'Hero is in quest.assignedHeroes');
  console.log(`  ✓ Hero assigned to quest`);
  
  // 5. Complete quest as SUCCESS
  console.log('\n5. Completing quest as SUCCESS...');
  const completeResult = await callTool('completeQuest', {
    worldId,
    questId,
    success: true,
    completionNotes: 'Hero slew the dragon'
  });
  
  assertTrue(completeResult.result?.success, 'Quest completed');
  
  // 6. Verify hero gained achievement
  console.log('\n6. Verifying hero achievement...');
  state = await getWorldState(worldId);
  const updatedHero = state.heroes.find(h => h.id === heroId);
  
  assertTrue(updatedHero?.achievements?.length > 0, 'Hero has achievements');
  if (updatedHero?.achievements?.length > 0) {
    console.log(`     Achievements: ${updatedHero.achievements.join(', ')}`);
  }
  
  // 7. Verify commemoration was created
  console.log('\n7. Checking for commemoration...');
  const commemoration = state.crafts?.find(c => 
    c.name?.toLowerCase().includes('valdar') || 
    c.name?.toLowerCase().includes('dragon')
  );
  
  assertTrue(!!commemoration, 'Commemoration item created');
  if (commemoration) {
    console.log(`     Item: ${commemoration.name} (${commemoration.category})`);
  }
  
  // 8. Check timeline for events
  console.log('\n8. Checking timeline for events...');
  const timelineResult = await callTool('getTimeline', { worldId });
  const timelineText = timelineResult.result?.content?.[0]?.text;
  
  if (timelineText) {
    const timeline = JSON.parse(timelineText);
    const achievementEvent = timeline.events?.find(e => e.type === 'HERO_ACHIEVEMENT');
    const commemorationEvent = timeline.events?.find(e => e.type === 'COMMEMORATION_CREATED');
    
    assertTrue(!!achievementEvent, 'HERO_ACHIEVEMENT event exists');
    assertTrue(!!commemorationEvent, 'COMMEMORATION_CREATED event exists');
  }
  
  // 9. Complete quest as FAILED (for another hero)
  console.log('\n9. Testing quest failure with hero death...');
  
  // Add another hero
  const hero2Id = `hero2_${Date.now()}`;
  const hero2 = {
    id: hero2Id,
    name: 'Thora the Strong',
    heroClass: 'WARRIOR',
    status: 'alive',
    culture: 'Warriors',
    populationId: popId,
    stats: { strength: 19, dexterity: 12, constitution: 17, intelligence: 8, wisdom: 11, charisma: 13 },
    skills: ['Combat', ' intimidation'],
    quests: [],
    achievements: [],
    inventory: [],
    lineage: null,
    createdAt: state.timestamp || 0
  };
  
  state.heroes.push(hero2);
  state.society.heroes.push(hero2Id);
  
  // Create another quest
  const quest2Id = `quest2_${Date.now()}`;
  const quest2 = {
    id: quest2Id,
    title: 'Defend the Village',
    description: 'Orcs are attacking',
    type: 'defense',
    status: 'open',
    urgency: 'critical',
    originPopulationId: popId,
    reward: 'Protection reward',
    requiredHeroes: 1,
    assignedHeroes: [hero2Id],
    createdAt: state.timestamp || 0
  };
  
  state.quests.push(quest2);
  
  await callTool('loadWorld', { worldData: JSON.stringify(state) });
  
  // Complete as failure
  const failResult = await callTool('completeQuest', {
    worldId,
    questId: quest2Id,
    success: false,
    failureReason: 'Hero fell in battle'
  });
  
  assertTrue(failResult.result?.success, 'Quest failed');
  
  // Check hero status
  state = await getWorldState(worldId);
  const deadHero = state.heroes.find(h => h.id === hero2Id);
  assertEqual(deadHero?.status, 'dead', 'Hero status is DEAD');
  
  // Check for death event
  const timelineResult2 = await callTool('getTimeline', { worldId });
  const timelineText2 = timelineResult2.result?.content?.[0]?.text;
  
  if (timelineText2) {
    const timeline2 = JSON.parse(timelineText2);
    const deathEvent = timeline2.events?.find(e => e.type === 'HERO_DEATH');
    assertTrue(!!deathEvent, 'HERO_DEATH event exists');
    
    const commemorationEvent2 = timeline2.events?.find(e => e.type === 'COMMEMORATION_CREATED');
    assertTrue(!!commemorationEvent2, 'COMMEMORATION_CREATED event for dead hero');
  }
  
  console.log('\n' + (allPassed ? '✓ TEST PASSED' : '❌ TEST FAILED'));
  return allPassed;
}

// Main
async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║     HERO SYSTEM MANUAL TEST               ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  try {
    await startMCP();
    const passed = await testManualHeroQuestCompletion();
    shutdownMCP();
    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error('Error:', err.message);
    shutdownMCP();
    process.exit(1);
  }
}

function shutdownMCP() {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
}

main();
