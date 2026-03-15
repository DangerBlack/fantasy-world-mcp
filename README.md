# World Evolution MCP Server

A Model Context Protocol (MCP) server for procedural fantasy world evolution simulation. Starting from a simple event (like "a small cave"), it simulates anthropological and geographical changes over centuries, generating rich history, dungeons, cities, and events for fantasy settings.

## Features

- **Procedural History Generation**: Simulate centuries of world evolution from simple starting conditions
- **Anthropological Simulation**: Population growth, technology progression, social organization evolution
- **Geographical Changes**: Resource dynamics, natural events, terrain modifications
- **Location Evolution**: Cave → Settlement → Village → City → Ruins progression
- **Causal Event Tracking**: Every event links back to its causes
- **Multiple Export Formats**: JSON, Markdown, narrative, GM notes with adventure hooks

## Installation

```bash
# Clone or navigate to the project
cd dnd_think

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

### Opencode Setup

**Step 1:** Build the project:
```bash
npm run build
```

**Step 2:** Add the MCP server to your opencode config (`~/.config/opencode/opencode.json`):

Add this to the `"mcp"` section of your config:
```json
"mcp": {
    "world-evolution": {
        "type": "local",
        "command": ["node", "/home/danger/Documents/progetti/dnd_think/dist/index.js"]
    }
}
```

**Step 3:** Verify it's working:
```bash
opencode mcp list
```

You should see:
```
✓ world-evolution connected
  node /home/danger/Documents/progetti/dnd_think/dist/index.js
```

**Important:** The `resources` parameter must be explicitly set (even to an empty object `{}`) when initializing a world, otherwise the API will fail.

**Step 4:** Start opencode and ask your AI to create a world!

### VS Code / Cursor Setup

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "world-evolution": {
      "command": "node",
      "args": ["/path/to/dnd_think/dist/index.js"],
      "cwd": "/path/to/dnd_think"
    }
  }
}
```

### Alternative: npx (no installation)

```json
{
  "mcpServers": {
    "world-evolution": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/dnd_think/src/index.ts"]
    }
  }
}
```

## Usage Guide for AI

### 1. Initialize a New World

Start by creating a world with initial conditions:

```
Tool: initializeWorld
Arguments:
{
  "event": "A small cave discovered by 20 refugees fleeing a great war",
  "locationType": "cave",
  "region": "mountains",
  "climate": "temperate",
  "resources": {
    "iron": 60,
    "stone": 80,
    "food": 40,
    "water": 70
  },
  "population": {
    "name": "The Exiles",
    "size": 20,
    "culture": "Mountain Folk",
    "organization": "tribal"
  }
}
```

**Parameter Guide:**
- `event`: Free-text description of the starting event
- `locationType`: cave, settlement, city, dungeon, fortress, temple, village, trade_post, ruins, landmark
- `region`: plains, mountains, forest, desert, swamp, hills, coastal, tundra, jungle
- `climate`: arctic, temperate, tropical, arid, continental
- `resources`: Object with resource names (iron, gold, silver, copper, wood, stone, food, water, magic, gems) and values 0-100
- `population.name`: Name of the starting group
- `population.size`: Initial population count
- `population.culture`: Cultural identity
- `population.organization`: nomadic, tribal, feudal, kingdom, empire

### 2. Run Simulation

Simulate history forward in time:

```
Tool: simulate
Arguments:
{
  "worldId": "<returned from initializeWorld>",
  "timespan": 500,
  "stepSize": 10,
  "complexity": "moderate",
  "enableConflict": true,
  "enableMigration": true,
  "enableTechProgress": true
}
```

**Parameter Guide:**
- `timespan`: Years to simulate (100-2000 recommended)
- `stepSize`: Years per simulation step (1-50, smaller = more detailed)
- `complexity`: 
  - `simple`: Basic population and resource changes
  - `moderate`: + technology, migration, location evolution
  - `complex`: + conflict generation between populations
- `enableConflict`: Allow wars and disputes
- `enableMigration`: Allow population movement and new settlements
- `enableTechProgress`: Allow technological discoveries

### 3. Get Timeline

Retrieve the historical events:

```
Tool: getTimeline
Arguments:
{
  "worldId": "<world ID>",
  "startYear": 0,
  "endYear": 500
}
```

### 4. Get Current State

View the world's current state:

```
Tool: getWorldState
Arguments:
{
  "worldId": "<world ID>"
}
```

### 5. Generate Locations

Create specific locations like dungeons or cities:

```
Tool: generateLocation
Arguments:
{
  "worldId": "<world ID>",
  "locationType": "dungeon",
  "name": "Dark Keep",
  "description": "An ancient fortress abandoned after the great war"
}
```

**Location Types:** dungeon, city, village, fortress, temple, landmark

### 6. Export World

Get the world in your preferred format:

```
Tool: exportWorld
Arguments:
{
  "worldId": "<world ID>",
  "format": "gm_notes",
  "includeTimeline": true,
  "includeLocations": true
}
```

**Export Formats:**
- `json`: Structured data for programmatic use
- `markdown`: Formatted documentation
- `narrative`: Story-style chronicle
- `gm_notes`: Game master reference with adventure hooks

## Example Workflow

Here's a complete example of generating a fantasy setting:

```javascript
// 1. Create the world
const world = await initializeWorld({
  event: "A mysterious cave appears in the mountains, emitting strange lights",
  locationType: "cave",
  region: "mountains",
  climate: "temperate",
  resources: { iron: 50, magic: 90, stone: 70 },
  population: {
    name: "Mountain Clan",
    size: 30,
    culture: "Highlanders",
    organization: "tribal"
  }
});

// 2. Simulate 800 years of history
const history = await simulate({
  worldId: world.worldId,
  timespan: 800,
  stepSize: 20,
  complexity: "complex"
});

// 3. Generate a dungeon based on the cave
const dungeon = await generateLocation({
  worldId: world.worldId,
  locationType: "dungeon",
  name: "The Luminary Depths"
});

// 4. Export for your campaign
const campaignNotes = await exportWorld({
  worldId: world.worldId,
  format: "gm_notes"
});
```

## Simulation Rules

The engine simulates these anthropological and geographical processes:

### Population Dynamics
- Growth based on food and water availability
- Decline during shortages or conflicts
- Organization evolution: nomadic → tribal → feudal → kingdom → empire

### Technology Progression
- Agriculture → Pottery → Bronze Working → Masonry → Iron Working
- Writing → Mathematics → Architecture → Philosophy
- Discovery chance increases with population size

### Location Evolution
- Cave → Settlement (50 years, 30+ population, tech level 3)
- Settlement → Village (100 years, 100+ population, tech level 5)
- Village → City (200 years, 300+ population, kingdom organization)
- City → Ruins (conflict + 300 years, 20% chance per step)

### Resource Dynamics
- Consumption based on population size
- Regeneration for non-renewable resources
- Critical shortages trigger events

### Natural Events
- Earthquakes (mountains)
- Forest fires (forest)
- Droughts (plains)
- Floods (swamp)

## Output Examples

### Timeline Output
```
Age of Discovery (0-50): Key developments: Beginning
Age of Settlement (50-100): Key developments: Earthquake, Agriculture
Age of Expansion (100-200): Key developments: Pottery, Migration
Age of Kingdoms (200-300): Key developments: Iron Working, Village Founded
Age of Empires (300-500): Key developments: City Founded, Writing
```

### Adventure Hooks (from GM Notes)
```
1. The iron mines are running dry. Adventurers must find new sources.
2. Strange magical phenomena are appearing near the Luminary Depths.
3. The war between Mountain Clan and River Tribes is escalating.
4. Ancient ruins have been disturbed. Something ancient has awakened.
```

## Tips for AI Users

### Using with Opencode

**Important:** The MCP server maintains state during a single opencode session. Keep track of the `worldId` returned from `initializeWorld` and use it in subsequent calls.

1. **Start opencode** with the configured MCP server

2. **Create a world** - The AI will automatically include `resources: {}`:
   ```
   "Create a fantasy world starting with a cave"
   ```
   
   The AI should call:
   ```
   initializeWorld({
     event: "a mysterious cave in the mountains",
     locationType: "cave",
     region: "mountains",
     climate: "temperate",
     population: {name: "Mountain Exiles", size: 25, culture: "Highlanders", organization: "tribal"},
     resources: {}  // Required - can be empty
   })
   ```

3. **Note the worldId** - The response will include a world ID like `12bff51b-...`

4. **Simulate** - Ask the AI to use that specific worldId:
   ```
   "Simulate world 12bff51b-... for 500 years"
   ```

5. **Export** - Get the final output:
   ```
   "Export world 12bff51b-... as GM notes"
   ```

**Pro tip:** Ask the AI to "remember the world ID" or "keep track of the world" to maintain context across multiple tool calls.

### Using with OpenAI-Compatible API

If your opencode setup uses an external API:

1. Edit `.env.local` with your API settings:
   ```bash
   API_BASE_URL=https://your-api-endpoint.com/v1
   API_KEY=your-api-key
   API_MODEL=your-model-name
   ```

2. Configure opencode to use these env vars (check your opencode docs)

3. The MCP tools will still work - they run locally regardless of where the AI model comes from

1. **Start Small**: Begin with 200-300 years to see the system's behavior
2. **Use Seeds**: Pass a `seed` parameter for reproducible results
3. **Check Resources**: Low food/water creates dramatic conflict scenarios
4. **High Magic**: Set magic > 70 for supernatural events
5. **Multiple Populations**: Create separate worlds and merge concepts
6. **Export Early**: Save interesting worlds before continuing simulation
7. **Iterate**: Generate, review, adjust parameters, regenerate

## Troubleshooting

### No Events Generated
- Increase `timespan` or decrease `stepSize`
- Set `complexity` to "moderate" or "complex"
- Ensure population size is reasonable (10+)

### Simulation Too Simple
- Use `complexity: "complex"`
- Enable all options: conflict, migration, techProgress
- Start with larger population (50+)

### Export Format Issues
- Try different formats: `json` for data, `markdown` for reading
- Set `includeTimeline: false` for shorter output

## Quick Start

```bash
# 1. Build the project
npm run build

# 2. Add to opencode config (see Configuration section above)

# 3. Verify:
opencode mcp list

# 4. Start opencode and ask your AI:
# "Create a fantasy world starting with a cave"
```

## Development

```bash
# Build
npm run build

# Run tests
npm run test

# Start server directly
npm start
```

## License

ISC
