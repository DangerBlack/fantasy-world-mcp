const { spawn } = require('child_process');

async function runTest() {
  const mcp = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
  
  let stdout = '';
  
  mcp.stdout.on('data', (d) => { stdout += d.toString(); });
  mcp.stderr.on('data', (d) => process.stderr.write(d));
  
  // Wait for server to start
  await new Promise(r => setTimeout(r, 500));
  
  // Step 1: Create world
  console.log('Creating world...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'initializeWorld', arguments: {
      event: 'A thriving settlement in fertile hills',
      locationType: 'settlement', region: 'hills', climate: 'temperate',
      resources: { food: 70, iron: 80, wood: 70, stone: 60 },
      population: { name: 'Hill Folk', size: 600, race: 'human', culture: 'Hill Dwellers', organization: 'kingdom' },
      enableMonsters: true, monsterCount: 1
    }}
  }) + '\n');
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Parse world creation
  const lines = stdout.split('\n').filter(l => l.trim().startsWith('{'));
  const initResp = JSON.parse(lines.find(l => l.includes('"id":1')));
  const initText = initResp.result?.content?.[0]?.text;
  const initData = JSON.parse(initText);
  const worldId = initData.worldId;
  
  console.log('✓ World created:', worldId);
  
  // Step 2: Simulate 300 years
  console.log('Simulating 300 years...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'simulate', arguments: {
      worldId, timespan: 300, stepSize: 30, complexity: 'complex',
      enableConflict: true, enableTechProgress: true
    }}
  }) + '\n');
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Step 3: Get world state
  console.log('Getting world state...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'getWorldState', arguments: { worldId }}
  }) + '\n');
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Step 4: List heroes
  console.log('Listing heroes...');
  mcp.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'listHeroes', arguments: { worldId }}
  }) + '\n');
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Parse results - find JSON objects by id
  const responses = [];
  const allLines = stdout.split('\n').filter(l => l.trim().startsWith('{'));
  
  for (const line of allLines) {
    try {
      const resp = JSON.parse(line);
      if (resp.id) responses[resp.id] = resp;
    } catch (e) {
      // Try to extract JSON from line
      const start = line.indexOf('{');
      const end = line.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        try {
          const resp = JSON.parse(line.substring(start, end + 1));
          if (resp.id) responses[resp.id] = resp;
        } catch (e2) {}
      }
    }
  }
  
  const worldResp = responses[3];
  const heroResp = responses[4];
  
  if (!worldResp || !heroResp) {
    console.log('Failed to parse responses');
    console.log('Available responses:', Object.keys(responses));
    mcp.kill();
    process.exit(1);
  }
  
  const world = worldResp.result;
  const heroes = heroResp.result;
  
  console.log('\\n=== SIMULATION RESULTS ===');
  console.log('Year:', world.timestamp);
  console.log('Populations:', world.society?.populations?.length);
  
  if (world.society?.populations) {
    console.log('\\nPopulations:');
    world.society.populations.forEach(p => {
      console.log('  -', p.name);
      console.log('    Size:', p.size, '| Tech:', p.technologyLevel, '| Org:', p.organization);
    });
  }
  
  console.log('\\nHeroes:', heroes.count);
  if (heroes.heroes && heroes.heroes.length > 0) {
    console.log('\\nHero Details:');
    heroes.heroes.forEach(h => {
      console.log('  -', h.name, '(' + h.heroClass + ') - ' + h.status);
      if (h.achievements?.length) {
        console.log('    Achievements:', h.achievements.join(', '));
      }
    });
  } else {
    console.log('  (No heroes spawned yet)');
  }
  
  console.log('\\nQuests:', world.quests?.length || 0);
  console.log('Crafts:', world.crafts?.length || 0);
  console.log('Events:', world.events?.length || 0);
  
  if (world.quests && world.quests.length > 0) {
    console.log('\\nRecent Quests:');
    world.quests.slice(-3).forEach(q => {
      console.log('  [' + q.status + ']', q.title);
    });
  }
  
  mcp.kill();
  console.log('\\n✓ Test complete');
}

runTest().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
