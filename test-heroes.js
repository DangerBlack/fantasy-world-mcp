const { spawn } = require('child_process');

// Test the hero system
async function test() {
  const mcp = spawn('node', ['dist/index.ts'], { stdio: ['pipe', 'pipe', 'pipe'] });
  
  const messages = [];
  
  mcp.stdout.on('data', (data) => {
    const msg = JSON.parse(data.toString());
    messages.push(msg);
    console.log('Response:', JSON.stringify(msg, null, 2));
  });
  
  // Initialize world
  mcp.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'initializeWorld',
      arguments: {
        event: 'A small village founded by refugees',
        locationType: 'village',
        region: 'plains',
        climate: 'temperate',
        resources: { food: 60, iron: 40, wood: 50 },
        population: {
          name: 'Riverfolk',
          size: 200,
          race: 'human',
          culture: 'Riverfolk',
          organization: 'tribal'
        }
      }
    }
  }) + '\n');
  
  // Wait for response
  await new Promise(r => setTimeout(r, 1000));
  
  // Simulate to generate quests and heroes
  mcp.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'simulate',
      arguments: {
        worldId: messages[0]?.result?.world?.id || 'test',
        timespan: 100,
        stepSize: 10,
        complexity: 'complex'
      }
    }
  }) + '\n');
  
  await new Promise(r => setTimeout(r, 2000));
  
  // List heroes
  const worldId = messages[0]?.result?.world?.id;
  if (worldId) {
    mcp.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'listHeroes',
        arguments: { worldId }
      }
    }) + '\n');
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  mcp.kill();
}

test().catch(console.error);
