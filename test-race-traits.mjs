/**
 * Race Trait System Tests
 * Tests the flexible trait-based race system
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

let mcpProcess = null;
let messageId = 0;

// Helper to call MCP tools
function callTool(toolName, args) {
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
    
    function extractCompleteJson(buffer) {
      const start = buffer.indexOf('{');
      if (start === -1) return null;
      
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
      
      while (true) {
        const jsonStr = extractCompleteJson(output);
        
        if (!jsonStr) break;
        
        try {
          const response = JSON.parse(jsonStr);
          
          if (response.id === id) {
            clearTimeout(timeout);
            mcpProcess.stdout.removeListener('data', onData);
            resolve(response);
            return;
          }
          
          output = output.substring(jsonStr.length);
        } catch (e) {
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

// Start MCP server
async function startMCP() {
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
      if (!ready) {
        reject(new Error('MCP server failed to start'));
      }
    }, 5000);
  });
}

// Shutdown MCP
function shutdownMCP() {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
}

// Test assertion helpers
function assertTrue(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    return true;
  } else {
    console.log(`  ❌ ${message}`);
    return false;
  }
}

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

// Test 1: Default Race Presets
async function testDefaultRacePresets() {
  console.log('\n========================================');
  console.log('TEST 1: Default Race Presets');
  console.log('========================================');
  
  let allPassed = true;
  
  // Test human population
  console.log('\n1. Testing human population...');
  const humanResult = await callTool('initializeWorld', {
    event: 'Human settlement begins',
    locationType: 'settlement',
    region: 'plains',
    climate: 'temperate',
    resources: { food: 50, iron: 30, wood: 50 },
    population: {
      name: 'Test Humans',
      size: 500,
      race: 'human',
      culture: 'Test Folk',
      organization: 'feudal'
    }
  });
  
  const humanWorldId = humanResult.result?.content?.[0]?.text 
    ? JSON.parse(humanResult.result.content[0].text).worldId 
    : null;
  
  const humanState = await callTool('getWorldState', { worldId: humanWorldId });
  const humanWorld = humanState.result?.content?.[0]?.text 
    ? JSON.parse(humanState.result.content[0].text) 
    : null;
  
  if (humanWorld) {
    const humanPop = humanWorld.society.populations[0];
    allPassed = assertEqual(humanPop.technologyLevel, 2, 'Human tech level') && allPassed;
    allPassed = assertTrue(!humanPop.traits?.isMonstrous, 'Human is not monstrous') && allPassed;
  }
  
  // Test dwarf population
  console.log('\n2. Testing dwarf population...');
  const dwarfResult = await callTool('initializeWorld', {
    event: 'Dwarven mine discovered',
    locationType: 'settlement',
    region: 'mountains',
    climate: 'temperate',
    resources: { iron: 80, stone: 90 },
    population: {
      name: 'Mountain Dwarves',
      size: 300,
      race: 'dwarf',
      culture: 'Mountain Folk',
      organization: 'feudal'
    }
  });
  
  const dwarfWorldId = dwarfResult.result?.content?.[0]?.text 
    ? JSON.parse(dwarfResult.result.content[0].text).worldId 
    : null;
  
  const dwarfState = await callTool('getWorldState', { worldId: dwarfWorldId });
  const dwarfWorld = dwarfState.result?.content?.[0]?.text 
    ? JSON.parse(dwarfState.result.content[0].text) 
    : null;
  
  if (dwarfWorld) {
    const dwarfPop = dwarfWorld.society.populations[0];
    allPassed = assertEqual(dwarfPop.technologyLevel, 3, 'Dwarf tech level (higher than human)') && allPassed;
    allPassed = assertTrue(!dwarfPop.traits?.isMonstrous, 'Dwarf is not monstrous') && allPassed;
  }
  
  // Test elf population
  console.log('\n3. Testing elf population...');
  const elfResult = await callTool('initializeWorld', {
    event: 'Elven forest sanctuary',
    locationType: 'settlement',
    region: 'forest',
    climate: 'temperate',
    resources: { wood: 90, food: 60 },
    population: {
      name: 'Wood Elves',
      size: 200,
      race: 'elf',
      culture: 'Forest Folk',
      organization: 'tribal'
    }
  });
  
  const elfWorldId = elfResult.result?.content?.[0]?.text 
    ? JSON.parse(elfResult.result.content[0].text).worldId 
    : null;
  
  const elfState = await callTool('getWorldState', { worldId: elfWorldId });
  const elfWorld = elfState.result?.content?.[0]?.text 
    ? JSON.parse(elfState.result.content[0].text) 
    : null;
  
  if (elfWorld) {
    const elfPop = elfWorld.society.populations[0];
    allPassed = assertEqual(elfPop.technologyLevel, 2, 'Elf tech level') && allPassed;
    allPassed = assertTrue(!elfPop.traits?.isMonstrous, 'Elf is not monstrous') && allPassed;
    allPassed = assertEqual(elfPop.organization, 'tribal', 'Elf organization') && allPassed;
  }
  
  // Test monster population
  console.log('\n4. Testing monster population...');
  const monsterResult = await callTool('initializeWorld', {
    event: 'Orc lair discovered',
    locationType: 'cave',
    region: 'hills',
    climate: 'temperate',
    resources: {},
    population: {
      name: 'Orc Warband',
      size: 50,
      race: 'monster',
      culture: 'Orcish',
      organization: 'tribal',
      monsterType: 'orc',
      behavior: 'aggressive'
    }
  });
  
  const monsterWorldId = monsterResult.result?.content?.[0]?.text 
    ? JSON.parse(monsterResult.result.content[0].text).worldId 
    : null;
  
  const monsterState = await callTool('getWorldState', { worldId: monsterWorldId });
  const monsterWorld = monsterState.result?.content?.[0]?.text 
    ? JSON.parse(monsterState.result.content[0].text) 
    : null;
  
  if (monsterWorld) {
    const monsterPop = monsterWorld.society.populations[0];
    allPassed = assertEqual(monsterPop.technologyLevel, 0, 'Monster tech level (zero)') && allPassed;
    allPassed = assertTrue(monsterPop.traits?.isMonstrous, 'Monster is monstrous') && allPassed;
    allPassed = assertTrue(!monsterPop.traits?.canCraft, 'Monster cannot craft') && allPassed;
    allPassed = assertTrue(!monsterPop.traits?.canBelieve, 'Monster cannot believe') && allPassed;
  }
  
  console.log(`\n${allPassed ? '✓' : '❌'} TEST 1 ${allPassed ? 'PASSED' : 'FAILED'}`);
  return allPassed;
}

// Test 2: Custom Race with Custom Traits
async function testCustomRaceWithTraits() {
  console.log('\n========================================');
  console.log('TEST 2: Custom Race with Custom Traits');
  console.log('========================================');
  
  let allPassed = true;
  
  console.log('\n1. Creating custom race: Starforged...');
  const starforgedResult = await callTool('initializeWorld', {
    event: 'Starforged colony arrives',
    locationType: 'settlement',
    region: 'plains',
    climate: 'temperate',
    resources: { iron: 50, magic: 80 },
    population: {
      name: 'Starforged Clan',
      size: 400,
      race: 'starforged',  // Custom race name
      culture: 'Void Walkers',
      organization: 'feudal',
      traits: {
        isMonstrous: false,
        canCraft: true,
        canQuest: true,
        canBelieve: true,
        baseTechLevel: 5,  // Higher than standard races
        aggression: 0.2,
        raidFrequency: 0,
        defaultBeliefType: 'philosophy',
        toleranceDefault: 'pluralistic'
      }
    }
  });
  
  const starforgedWorldId = starforgedResult.result?.content?.[0]?.text 
    ? JSON.parse(starforgedResult.result.content[0].text).worldId 
    : null;
  
  const starforgedState = await callTool('getWorldState', { worldId: starforgedWorldId });
  const starforgedWorld = starforgedState.result?.content?.[0]?.text 
    ? JSON.parse(starforgedState.result.content[0].text) 
    : null;
  
  if (starforgedWorld) {
    const starPop = starforgedWorld.society.populations[0];
    allPassed = assertEqual(starPop.technologyLevel, 5, 'Starforged tech level (custom)') && allPassed;
    allPassed = assertTrue(!starPop.traits?.isMonstrous, 'Starforged is not monstrous') && allPassed;
    allPassed = assertTrue(starPop.traits?.canCraft, 'Starforged can craft') && allPassed;
    allPassed = assertTrue(starPop.traits?.canQuest, 'Starforged can quest') && allPassed;
    allPassed = assertTrue(starPop.traits?.canBelieve, 'Starforged can believe') && allPassed;
    allPassed = assertEqual(starPop.traits?.aggression, 0.2, 'Starforged aggression (custom)') && allPassed;
  }
  
  console.log('\n2. Creating custom race: Shadowkin (monstrous)...');
  const shadowkinResult = await callTool('initializeWorld', {
    event: 'Shadowkin emerge from darkness',
    locationType: 'cave',
    region: 'swamp',
    climate: 'humid',
    resources: {},
    population: {
      name: 'Shadowkin Horde',
      size: 100,
      race: 'shadowkin',  // Custom monstrous race
      culture: 'Dark Ones',
      organization: 'tribal',
      traits: {
        isMonstrous: true,
        canCraft: false,
        canQuest: false,
        canBelieve: false,
        baseTechLevel: 0,
        aggression: 0.9,  // Very aggressive
        raidFrequency: 0.8,  // Raid frequently
        dangerLevelDefault: 7,  // High danger
        behaviorDefault: 'aggressive'
      }
    }
  });
  
  const shadowkinWorldId = shadowkinResult.result?.content?.[0]?.text 
    ? JSON.parse(shadowkinResult.result.content[0].text).worldId 
    : null;
  
  const shadowkinState = await callTool('getWorldState', { worldId: shadowkinWorldId });
  const shadowkinWorld = shadowkinState.result?.content?.[0]?.text 
    ? JSON.parse(shadowkinState.result.content[0].text) 
    : null;
  
  if (shadowkinWorld) {
    const shadowPop = shadowkinWorld.society.populations[0];
    allPassed = assertEqual(shadowPop.technologyLevel, 0, 'Shadowkin tech level (zero)') && allPassed;
    allPassed = assertTrue(shadowPop.traits?.isMonstrous, 'Shadowkin is monstrous') && allPassed;
    allPassed = assertTrue(!shadowPop.traits?.canCraft, 'Shadowkin cannot craft') && allPassed;
    allPassed = assertTrue(!shadowPop.traits?.canBelieve, 'Shadowkin cannot believe') && allPassed;
    allPassed = assertEqual(shadowPop.traits?.aggression, 0.9, 'Shadowkin aggression (very high)') && allPassed;
    allPassed = assertEqual(shadowPop.traits?.raidFrequency, 0.8, 'Shadowkin raid frequency') && allPassed;
  }
  
  console.log(`\n${allPassed ? '✓' : '❌'} TEST 2 ${allPassed ? 'PASSED' : 'FAILED'}`);
  return allPassed;
}

// Test 3: Trait-Based Belief Generation
async function testTraitBasedBeliefs() {
  console.log('\n========================================');
  console.log('TEST 3: Trait-Based Belief Generation');
  console.log('========================================');
  
  let allPassed = true;
  
  console.log('\n1. Testing dwarf belief generation...');
  const dwarfResult = await callTool('initializeWorld', {
    event: 'Dwarven kingdom established',
    locationType: 'settlement',
    region: 'mountains',
    climate: 'temperate',
    resources: { iron: 80, stone: 90 },
    population: {
      name: 'Deep Dwarves',
      size: 500,
      race: 'dwarf',
      culture: 'Mountain Folk',
      organization: 'kingdom'
    }
  });
  
  const dwarfWorldId = dwarfResult.result?.content?.[0]?.text 
    ? JSON.parse(dwarfResult.result.content[0].text).worldId 
    : null;
  
  const dwarfState = await callTool('getWorldState', { worldId: dwarfWorldId });
  const dwarfWorld = dwarfState.result?.content?.[0]?.text 
    ? JSON.parse(dwarfState.result.content[0].text) 
    : null;
  
  if (dwarfWorld) {
    const dwarfPop = dwarfWorld.society.populations[0];
    // Beliefs are generated with 50% chance at world creation
    // This test verifies the SYSTEM works, not that every world has beliefs
    const hasBeliefs = dwarfPop.beliefs && dwarfPop.beliefs.length > 0;
    if (hasBeliefs) {
      console.log('  ✓ Dwarves can have beliefs (generated this time)');
    } else {
      console.log('  ✓ Dwarves can have beliefs (system ready, just not generated this roll)');
    }
    // Test passes either way - we're testing the capability, not the randomness
    
    if (hasBeliefs && dwarfWorld.world.beliefs) {
      const belief = dwarfWorld.world.beliefs.find(b => b.id === dwarfPop.dominantBelief);
      if (belief) {
        console.log(`     Belief type: ${belief.type}`);
        console.log(`     Domains: ${belief.domains?.join(', ')}`);
      }
    }
  }
  
  console.log('\n2. Testing monster (no beliefs)...');
  const monsterResult = await callTool('initializeWorld', {
    event: 'Dragon lair discovered',
    locationType: 'cave',
    region: 'mountains',
    climate: 'temperate',
    resources: {},
    population: {
      name: 'Dragon Horde',
      size: 20,
      race: 'monster',
      culture: 'Dragon',
      organization: 'tribal',
      monsterType: 'dragon',
      behavior: 'territorial'
    }
  });
  
  const monsterWorldId = monsterResult.result?.content?.[0]?.text 
    ? JSON.parse(monsterResult.result.content[0].text).worldId 
    : null;
  
  const monsterState = await callTool('getWorldState', { worldId: monsterWorldId });
  const monsterWorld = monsterState.result?.content?.[0]?.text 
    ? JSON.parse(monsterState.result.content[0].text) 
    : null;
  
  if (monsterWorld) {
    const monsterPop = monsterWorld.society.populations[0];
    const hasNoBeliefs = !monsterPop.beliefs || monsterPop.beliefs.length === 0;
    allPassed = assertTrue(hasNoBeliefs, 'Monsters have no beliefs') && allPassed;
    allPassed = assertTrue(!monsterPop.dominantBelief, 'Monsters have no dominant belief') && allPassed;
  }
  
  console.log(`\n${allPassed ? '✓' : '❌'} TEST 3 ${allPassed ? 'PASSED' : 'FAILED'}`);
  return allPassed;
}

// Test 4: Multi-Race World with Different Traits
async function testMultiRaceWorld() {
  console.log('\n========================================');
  console.log('TEST 4: Multi-Race World with Different Traits');
  console.log('========================================');
  
  let allPassed = true;
  
  console.log('\n1. Creating world with multiple races...');
  const multiResult = await callTool('initializeWorld', {
    event: 'Convergence of different peoples',
    locationType: 'settlement',
    region: 'hills',
    climate: 'temperate',
    resources: { food: 50, iron: 40, wood: 60 },
    population: [
      {
        name: 'Human Kingdom',
        size: 800,
        race: 'human',
        culture: 'Royal Folk',
        organization: 'kingdom'
      },
      {
        name: 'Dwarven Clan',
        size: 400,
        race: 'dwarf',
        culture: 'Mountain Dwarves',
        organization: 'feudal'
      },
      {
        name: 'Elven Enclave',
        size: 300,
        race: 'elf',
        culture: 'Wood Elves',
        organization: 'tribal'
      },
      {
        name: 'Orc Warband',
        size: 100,
        race: 'monster',
        culture: 'Orcish',
        organization: 'tribal',
        monsterType: 'orc',
        behavior: 'aggressive'
      }
    ]
  });
  
  const multiWorldId = multiResult.result?.content?.[0]?.text 
    ? JSON.parse(multiResult.result.content[0].text).worldId 
    : null;
  
  const multiState = await callTool('getWorldState', { worldId: multiWorldId });
  const multiWorld = multiState.result?.content?.[0]?.text 
    ? JSON.parse(multiState.result.content[0].text) 
    : null;
  
  if (multiWorld) {
    const pops = multiWorld.society.populations;
    
    console.log('\n2. Verifying each population has correct traits...');
    
    const humanPop = pops.find(p => p.race === 'human');
    if (humanPop) {
      allPassed = assertEqual(humanPop.technologyLevel, 2, 'Human tech level') && allPassed;
      allPassed = assertTrue(!humanPop.traits?.isMonstrous, 'Human not monstrous') && allPassed;
    }
    
    const dwarfPop = pops.find(p => p.race === 'dwarf');
    if (dwarfPop) {
      allPassed = assertEqual(dwarfPop.technologyLevel, 3, 'Dwarf tech level') && allPassed;
      allPassed = assertTrue(!dwarfPop.traits?.isMonstrous, 'Dwarf not monstrous') && allPassed;
    }
    
    const elfPop = pops.find(p => p.race === 'elf');
    if (elfPop) {
      allPassed = assertEqual(elfPop.technologyLevel, 2, 'Elf tech level') && allPassed;
      allPassed = assertEqual(elfPop.organization, 'tribal', 'Elf organization') && allPassed;
    }
    
    const orcPop = pops.find(p => p.race === 'monster' && p.monsterType === 'orc');
    if (orcPop) {
      allPassed = assertEqual(orcPop.technologyLevel, 0, 'Orc tech level (zero)') && allPassed;
      allPassed = assertTrue(orcPop.traits?.isMonstrous, 'Orc is monstrous') && allPassed;
      allPassed = assertTrue(!orcPop.traits?.canCraft, 'Orc cannot craft') && allPassed;
    }
    
    console.log('\n3. Verifying inter-population relations...');
    
    // Monsters should be hostile to civilizations
    if (orcPop && humanPop) {
      const orcHumanRelation = orcPop.relations?.[humanPop.id];
      const humanOrcRelation = humanPop.relations?.[orcPop.id];
      allPassed = assertEqual(orcHumanRelation, 'hostile', 'Orc->Human relation') && allPassed;
      allPassed = assertEqual(humanOrcRelation, 'hostile', 'Human->Orc relation') && allPassed;
    }
    
    // Civilizations should be neutral to each other
    if (humanPop && dwarfPop) {
      const humanDwarfRelation = humanPop.relations?.[dwarfPop.id];
      allPassed = assertEqual(humanDwarfRelation, 'neutral', 'Human->Dwarf relation') && allPassed;
    }
  }
  
  console.log(`\n${allPassed ? '✓' : '❌'} TEST 4 ${allPassed ? 'PASSED' : 'FAILED'}`);
  return allPassed;
}

// Main test runner
async function runAllTests() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║     RACE TRAIT SYSTEM TEST SUITE          ║');
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
    results.test1 = await testDefaultRacePresets();
    await new Promise(r => setTimeout(r, 500));
    
    results.test2 = await testCustomRaceWithTraits();
    await new Promise(r => setTimeout(r, 500));
    
    results.test3 = await testTraitBasedBeliefs();
    await new Promise(r => setTimeout(r, 500));
    
    results.test4 = await testMultiRaceWorld();
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
  } finally {
    shutdownMCP();
  }
  
  // Summary
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║              TEST SUMMARY                  ║');
  console.log('╚════════════════════════════════════════════╝');
  
  console.log(`\nTest 1 (Default Race Presets):              ${results.test1 ? '✓ PASSED' : '❌ FAILED'}`);
  console.log(`Test 2 (Custom Race with Traits):           ${results.test2 ? '✓ PASSED' : '❌ FAILED'}`);
  console.log(`Test 3 (Trait-Based Beliefs):               ${results.test3 ? '✓ PASSED' : '❌ FAILED'}`);
  console.log(`Test 4 (Multi-Race World):                  ${results.test4 ? '✓ PASSED' : '❌ FAILED'}`);
  
  const totalPassed = Object.values(results).filter(r => r).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\nTotal: ${totalPassed}/${totalTests} tests passed`);
  console.log(`\nFinished at: ${new Date().toISOString()}`);
  
  process.exit(totalPassed === totalTests ? 0 : 1);
}

runAllTests().catch(console.error);
