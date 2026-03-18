const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let worldDataCache = null;

async function callTool(toolName, args, skipLoadWorld = false) {
  return new Promise((resolve, reject) => {
    const mcp = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
    
    let output = '';
    let timedOut = false;
    
    const timeout = setTimeout(() => {
      timedOut = true;
      mcp.kill();
      reject(new Error('Timeout'));
    }, 5000);
    
    mcp.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    mcp.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) return;
      
      try {
        // Parse only the first JSON response (skip the auto-load response)
        const jsonMatch = output.match(/\{"result":\{.*"jsonrpc":"2.0","id":1\}\}/s);
        if (jsonMatch) {
          const response = JSON.parse(jsonMatch[0]);
          
          if (toolName === 'initializeWorld') {
            const text = response.result?.content?.[0]?.text;
            if (text) {
              try {
                const parsed = JSON.parse(text);
                if (parsed.worldId) {
                  const worldFile = path.join(__dirname, 'worlds', `${parsed.worldId}.json`);
                  if (fs.existsSync(worldFile)) {
                    worldDataCache = fs.readFileSync(worldFile, 'utf8');
                  }
                }
              } catch (e) {}
            }
          }
          
          resolve(response);
        } else {
          // Try to parse the last response if first fails
          const lines = output.trim().split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('"id":1')) {
              const response = JSON.parse(lines[i]);
              resolve(response);
              return;
            }
          }
          resolve({ raw: output });
        }
      } catch (e) {
        resolve({ raw: output, error: e.message });
      }
    });
    
    if (worldDataCache && !skipLoadWorld && toolName !== 'initializeWorld' && toolName !== 'loadWorld' && toolName !== 'simulate') {
      mcp.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        method: 'tools/call',
        params: {
          name: 'loadWorld',
          arguments: { worldData: worldDataCache }
        }
      }) + '\n');
    }
    
    mcp.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    }) + '\n');
    
    mcp.stdin.end();
  });
}

async function runTests() {
  console.log('=== Test 1: Initialize World ===');
  const initResult = await callTool('initializeWorld', {
    event: 'A small village founded by refugees',
    locationType: 'village',
    region: 'plains',
    climate: 'temperate',
    resources: { food: 50, iron: 40, wood: 50 },
    population: {
      name: 'Riverfolk',
      size: 500,
      race: 'human',
      culture: 'Riverfolk',
      organization: 'feudal'
    },
    enableMonsters: true,
    monsterCount: 2
  }, true);
  
  console.log('Init result:', JSON.stringify(initResult, null, 2));
  
  const initText = initResult.result?.content?.[0]?.text;
  const worldId = initText ? JSON.parse(initText).worldId : null;
  
  if (!worldId) {
    console.log('❌ Failed to get worldId');
    return;
  }
  
  console.log(`✓ World created: ${worldId}`);
  
  // Small delay to ensure file is written
  await new Promise(r => setTimeout(r, 100));
  
  // Verify file exists
  const worldFile = path.join(__dirname, 'worlds', `${worldId}.json`);
  if (fs.existsSync(worldFile)) {
    worldDataCache = fs.readFileSync(worldFile, 'utf8');
    console.log('✓ World file exists on disk');
  } else {
    console.log('❌ World file not found:', worldFile);
    return;
  }
  
  console.log('\n=== Test 1.5: Add Orc Monsters ===');
  const addOrcResult = await callTool('addPopulation', {
    worldId,
    name: 'Grom\'s Warband',
    size: 80,
    race: 'monster',
    culture: 'Orcish Raiders',
    organization: 'tribal',
    monsterType: 'orc',
    dangerLevel: 7,
    behavior: 'aggressive'
  });
  console.log('Add orc result:', JSON.stringify(addOrcResult, null, 2));
  
  console.log('\n=== Test 1.6: Add Dragon Threat ===');
  const addDragonResult = await callTool('addPopulation', {
    worldId,
    name: 'Ignis the Red Dragon',
    size: 1,
    race: 'monster',
    culture: 'Ancient Dragon',
    organization: 'nomadic',
    monsterType: 'dragon',
    dangerLevel: 10,
    behavior: 'territorial'
  });
  console.log('Add dragon result:', JSON.stringify(addDragonResult, null, 2));
  
  console.log('\n=== Test 2: Simulate 100 years ===');
  const simResult = await callTool('simulate', {
    worldId,
    timespan: 100,
    stepSize: 10,
    complexity: 'complex'
  });
  console.log('Simulate result:', JSON.stringify(simResult, null, 2));
  
  // Cache updated world after simulation
  const simText = simResult.result?.content?.[0]?.text;
  if (simText) {
    try {
      const simData = JSON.parse(simText);
      if (simData.world) {
        worldDataCache = JSON.stringify(simData.world);
        console.log('✓ Updated world data cached');
      }
    } catch (e) {}
  }
  
  console.log('\n=== Test 3: List Heroes ===');
  const heroesResult = await callTool('listHeroes', { worldId });
  console.log('Heroes result:', JSON.stringify(heroesResult, null, 2));
  
  const heroesText = heroesResult.result?.content?.[0]?.text;
  if (heroesText) {
    const heroesData = JSON.parse(heroesText);
    console.log(`\n✓ Found ${heroesData.count || 0} heroes`);
    
    if (heroesData.heroes && heroesData.heroes.length > 0) {
      console.log('\n=== First Hero Details ===');
      console.log(JSON.stringify(heroesData.heroes[0], null, 2));
      
      console.log('\n=== Test 4: Get Specific Hero ===');
      const heroId = heroesData.heroes[0].id;
      const heroDetailResult = await callTool('getHero', { worldId, heroId });
      console.log('Hero detail result:', JSON.stringify(heroDetailResult, null, 2));
    } else {
      console.log('\n⚠ No heroes spawned yet (may need more simulation or specific quest conditions)');
    }
  }
  
  console.log('\n=== Test 5: Simulate More Years (200) ===');
  const moreSimResult = await callTool('simulate', {
    worldId,
    timespan: 200,
    stepSize: 20,
    complexity: 'complex'
  });
  console.log('More simulate result:', JSON.stringify(moreSimResult, null, 2));
  
  // Cache again
  const moreSimText = moreSimResult.result?.content?.[0]?.text;
  if (moreSimText) {
    try {
      const moreSimData = JSON.parse(moreSimText);
      if (moreSimData.world) {
        worldDataCache = JSON.stringify(moreSimData.world);
      }
    } catch (e) {}
  }
  
  console.log('\n=== Test 6: List Heroes After More Simulation ===');
  const moreHeroesResult = await callTool('listHeroes', { worldId });
  console.log('More heroes result:', JSON.stringify(moreHeroesResult, null, 2));
  
  const moreHeroesText = moreHeroesResult.result?.content?.[0]?.text;
  if (moreHeroesText) {
    const moreHeroesData = JSON.parse(moreHeroesText);
    console.log(`\n✓ Found ${moreHeroesData.count || 0} heroes after 300 years total`);
    
    if (moreHeroesData.heroes && moreHeroesData.heroes.length > 0) {
      console.log('\n=== All Heroes ===');
      moreHeroesData.heroes.forEach((h, i) => {
        console.log(`${i + 1}. ${h.name} (${h.heroClass}) - ${h.status} - Quests: ${h.quests?.length || 0}`);
      });
    }
  }
  
  console.log('\n=== All Tests Complete ===');
}

runTests().catch(console.error);
