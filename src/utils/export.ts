/**
 * Export formatting utilities
 */

import { WorldState } from '../types';
import { promises as fs } from 'fs';
import path from 'path';

export interface ExportOptions {
  format: 'json' | 'markdown' | 'narrative' | 'gm_notes';
  includeTimeline: boolean;
  includeLocations: boolean;
}

export class ExportFormatter {
  format(world: WorldState, options: ExportOptions): string {
    switch (options.format) {
      case 'json':
        return this.formatJSON(world, options);
      case 'markdown':
        return this.formatMarkdown(world, options);
      case 'narrative':
        return this.formatNarrative(world, options);
      case 'gm_notes':
        return this.formatGMNotes(world, options);
      default:
        return this.formatMarkdown(world, options);
    }
  }

  private formatJSON(world: WorldState, options: ExportOptions): string {
    const output: any = {
      world: {
        id: world.id,
        seed: world.seed,
        currentYear: world.timestamp,
        geography: world.geography,
        society: world.society,
      },
    };

    if (options.includeTimeline) {
      output.timeline = world.timeline;
    }

    if (options.includeLocations) {
      output.locations = world.locations;
    }

    if (world.crafts && world.crafts.length > 0) {
      output.crafts = world.crafts;
    }

    if (world.quests && world.quests.length > 0) {
      output.quests = world.quests;
    }

    return JSON.stringify(output, null, 2);
  }

  private formatMarkdown(world: WorldState, options: ExportOptions): string {
    let output = `# ${world.geography.terrain} World: ${world.seed.substring(0, 8)}\n\n`;
    output += `**Current Year:** ${world.timestamp}\n\n`;

    output += `## Geography\n\n`;
    output += `- **Terrain:** ${world.geography.terrain}\n`;
    output += `- **Climate:** ${world.geography.climate}\n`;
    output += `- **Features:** ${world.geography.features.join(', ')}\n\n`;

    output += `## Resources\n\n`;
    for (const [resource, value] of Object.entries(world.geography.resources)) {
      const bar = '█'.repeat(Math.floor(value / 10)) + '░'.repeat(10 - Math.floor(value / 10));
      output += `- **${resource}:** ${bar} (${Math.floor(value)})\n`;
    }
    output += '\n';

    output += `## Populations\n\n`;
    for (const pop of world.society.populations) {
      output += `### ${pop.name}\n`;
      output += `- **Size:** ${pop.size}\n`;
      output += `- **Culture:** ${pop.culture}\n`;
      output += `- **Organization:** ${pop.organization}\n`;
      output += `- **Technology Level:** ${pop.technologyLevel}/10\n\n`;
    }

    if (options.includeTimeline) {
      output += `## Timeline\n\n`;
      
      for (const era of world.timeline.eras) {
        output += `### ${era.name} (${era.startYear} - ${era.endYear})\n`;
        output += `${era.summary}\n\n`;
      }

      output += `### Major Events\n\n`;
      for (const event of world.events.slice(-20)) {
        output += `- **Year ${event.year}:** ${event.title} - ${event.description}\n`;
      }
      output += '\n';
    }

    if (options.includeLocations) {
      output += `## Locations\n\n`;
      for (const loc of world.locations) {
        output += `### ${loc.name} (${loc.type})\n`;
        output += `${loc.description}\n`;
        output += `- **Features:** ${loc.features.join(', ')}\n`;
        if (loc.dangerLevel > 0) {
          output += `- **Danger Level:** ${loc.dangerLevel}/10\n`;
        }
        output += '\n';
      }
    }

    return output;
  }

  private formatNarrative(world: WorldState, options: ExportOptions): string {
    let output = `# The Chronicles of ${world.seed.substring(0, 8)}\n\n`;

    output += `In the beginning, there was only the ${world.geography.terrain} land of ${world.geography.climate} climate.\n\n`;

    output += `## The Early Years\n\n`;
    const earlyEvents = world.events.filter(e => e.year < 100);
    for (const event of earlyEvents) {
      output += `In year ${event.year}, ${event.description.toLowerCase()}. ${event.title}.\n\n`;
    }

    output += `## The Rise of Civilization\n\n`;
    const middleEvents = world.events.filter(e => e.year >= 100 && e.year < 300);
    for (const event of middleEvents) {
      output += `By year ${event.year}, ${event.description.toLowerCase()}. ${event.title}.\n\n`;
    }

    output += `## The Current Era\n\n`;
    const recentEvents = world.events.filter(e => e.year >= 300);
    for (const event of recentEvents) {
      output += `In recent years, by ${event.year}, ${event.description.toLowerCase()}. ${event.title}.\n\n`;
    }

    output += `## Present Day (${world.timestamp})\n\n`;
    output += `The world now stands at year ${world.timestamp}. The ${world.society.populations[0]?.name || 'people'} have grown to ${world.society.populations[0]?.size || 0} souls.\n\n`;

    output += `### Notable Places\n\n`;
    for (const loc of world.locations) {
      output += `- **${loc.name}**: ${loc.description}\n`;
    }

    return output;
  }

  private formatGMNotes(world: WorldState, options: ExportOptions): string {
    let output = `# GM Notes - World ${world.seed.substring(0, 8)}\n\n`;

    output += `## Quick Reference\n\n`;
    output += `- **Current Year:** ${world.timestamp}\n`;
    output += `- **Terrain:** ${world.geography.terrain}\n`;
    const civilizedPops = world.society.populations.filter(p => p.race !== 'monster');
    const monsters = world.society.populations.filter(p => p.race === 'monster');
    output += `- **Populations:** ${civilizedPops.map(p => p.name).join(', ')}\n`;
    if (monsters.length > 0) {
      output += `- **Monster Threats:** ${monsters.map(m => `${m.monsterSubtype} (${m.dangerLevel}/10)`).join(', ')}\n`;
    }
    output += `- **Locations:** ${world.locations.map(l => l.name).join(', ')}\n\n`;

    output += `## Population Status\n\n`;
    for (const pop of world.society.populations) {
      output += `### ${pop.name}\n`;
      output += `- Size: ${pop.size}\n`;
      output += `- Org: ${pop.organization}\n`;
      output += `- Tech: ${pop.technologyLevel}\n`;
      if (pop.race === 'monster') {
        output += `- **Type:** ${pop.monsterSubtype}\n`;
        output += `- **Danger:** ${pop.dangerLevel}/10\n`;
        output += `- **Behavior:** ${pop.behavior}\n`;
        output += `- **Dormant:** ${pop.isDormant ? 'Yes' : 'No'}\n`;
      }
      output += `- Relations: ${Object.entries(pop.relations).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      output += `- Techs: ${world.society.technologies.join(', ')}\n`;
      if (pop.crafts && pop.crafts.length > 0) {
        const popCrafts = world.crafts?.filter(c => c.creatorPopulationId === pop.id) || [];
        output += `- Crafts: ${popCrafts.map(c => c.name).join(', ')}\n`;
      }
      output += '\n';
    }

    output += `## Heritage & Crafts\n\n`;
    if (world.crafts && world.crafts.length > 0) {
      const visibleCrafts = world.crafts.filter(c => !c.isHidden);
      const hiddenCrafts = world.crafts.filter(c => c.isHidden);
      
      if (visibleCrafts.length > 0) {
        output += `### Known Items\n\n`;
        for (const craft of visibleCrafts) {
          output += `- **${craft.name}** (${craft.rarity}, ${craft.category})\n`;
          output += `  - ${craft.description}\n`;
          if (craft.effects && craft.effects.length > 0) {
            output += `  - Effects: ${craft.effects.join(', ')}\n`;
          }
          output += `  - Created: Year ${craft.creationYear}\n\n`;
        }
      }
      
      if (hiddenCrafts.length > 0) {
        output += `### Lost/Hidden Heritage (DM Only)\n\n`;
        for (const craft of hiddenCrafts) {
          output += `- **${craft.name}** (${craft.rarity}, ${craft.category})\n`;
          output += `  - ${craft.description}\n`;
          if (craft.effects && craft.effects.length > 0) {
            output += `  - Effects: ${craft.effects.join(', ')}\n`;
          }
          output += `  - Status: HIDDEN - Location unknown\n\n`;
        }
      }
    } else {
      output += 'No notable crafts or heritage items yet.\n\n';
    }

    output += `## Conflict Tracker\n\n`;
    if (world.society.conflicts.length === 0) {
      output += 'No active conflicts.\n\n';
    } else {
      for (const conflict of world.society.conflicts) {
        output += `- **${conflict.status.toUpperCase()}**: ${conflict.parties.join(' vs ')} (${conflict.cause})\n`;
      }
      output += '\n';
    }

    output += `## Adventure Hooks\n\n`;
    const hooks = this.generateAdventureHooks(world);
    for (let i = 0; i < hooks.length; i++) {
      output += `${i + 1}. ${hooks[i]}\n`;
    }
    output += '\n';

    // Active quests section
    if (world.quests && world.quests.length > 0) {
      const openQuests = world.quests.filter(q => q.status === 'open' || q.status === 'in_progress');
      if (openQuests.length > 0) {
        output += `## Active Quests (For Players)\n\n`;
        for (const quest of openQuests) {
          output += `### ${quest.title}\n`;
          output += `- **Type:** ${quest.type}\n`;
          output += `- **Urgency:** ${quest.urgency.toUpperCase()}\n`;
          output += `- **Status:** ${quest.status}\n`;
          output += `- **Deadline:** Year ${quest.deadline}\n`;
          output += `- **Description:** ${quest.description}\n`;
          if (quest.requiredHeroes && quest.requiredHeroes > 0) {
            output += `- **Heroes Needed:** ${quest.requiredHeroes}\n`;
          }
          if (quest.reward) {
            output += `- **Reward:** ${quest.reward}\n`;
          }
          output += '\n';
        }
      }
    }

    if (options.includeLocations) {
      output += `## Location Details\n\n`;
      for (const loc of world.locations) {
        output += `### ${loc.name}\n`;
        output += `**Type:** ${loc.type}\n`;
        output += `**Danger:** ${loc.dangerLevel}/10\n`;
        output += `**Features:** ${loc.features.join(', ')}\n`;
        output += `**Connections:** ${loc.connections.length} routes\n`;
        output += `\n`;
      }
    }

    output += `## Recent Events (Last 10)\n\n`;
    const recent = world.events.slice(-10).reverse();
    for (const event of recent) {
      output += `- Year ${event.year}: ${event.title}\n`;
    }

    return output;
  }

  private generateAdventureHooks(world: WorldState): string[] {
    const hooks: string[] = [];

    // Quest-based hooks (highest priority)
    if (world.quests && world.quests.length > 0) {
      const openQuests = world.quests.filter(q => q.status === 'open' || q.status === 'in_progress');
      for (const quest of openQuests) {
        if (quest.urgency === 'critical') {
          hooks.push(`CRITICAL: ${quest.title} - ${quest.description}`);
        }
      }
    }

    // Monster-based hooks
    const monsters = world.society.populations.filter(p => p.race === 'monster') as any[];
    for (const monster of monsters) {
      if (monster.isDormant) {
        hooks.push(`The ${monster.monsterSubtype} sleeps beneath ${monster.lairLocation ? 'the ruins' : 'the mountains'} - but something might wake it.`);
      } else {
        hooks.push(`${monster.monsterSubtype} ${monster.name} (Danger: ${monster.dangerLevel}/10) is terrorizing the region. Their lair must be destroyed.`);
      }
    }

    // Craft/Heritage-based hooks
    if (world.crafts && world.crafts.length > 0) {
      const hiddenCrafts = world.crafts.filter(c => c.isHidden);
      const visibleCrafts = world.crafts.filter(c => !c.isHidden);
      
      // Hidden heritage hooks
      for (const craft of hiddenCrafts) {
        hooks.push(`The legendary ${craft.name} (${craft.rarity}) is lost. Ancient texts hint it may be hidden in ${craft.category === 'weapon' ? 'an ancient battlefield' : 'a forgotten tomb'}.`);
      }
      
      // Visible craft hooks
      for (const craft of visibleCrafts) {
        if (craft.rarity === 'legendary' || craft.rarity === 'mythic') {
          hooks.push(`The ${craft.name} has been discovered! Powerful factions will seek to claim or destroy it.`);
        }
      }
    }

    // Resource-based hooks
    if (world.geography.resources['iron'] < 30) {
      hooks.push('The iron mines are running dry. Adventurers must find new sources or the kingdom will fall.');
    }

    if (world.geography.resources['magic'] > 70) {
      hooks.push('Strange magical phenomena are appearing. The source must be investigated before it consumes the land.');
    }

    // Conflict-based hooks
    if (world.society.conflicts.length > 0) {
      const conflict = world.society.conflicts[0];
      hooks.push(`The war between ${conflict.parties.join(' and ')} is escalating. Someone must intervene.`);
    }

    // Location-based hooks
    const dungeons = world.locations.filter(l => l.type === 'dungeon' || l.type === 'ruins');
    if (dungeons.length > 0 && monsters.length === 0) {
      hooks.push(`Ancient ruins at ${dungeons[0].name} have been disturbed. Something ancient has awakened.`);
    }

    // Event-based hooks
    const recentEvents = world.events.slice(-5);
    const disasters = recentEvents.filter((e: any) => e.type === 'natural' || e.type === 'conflict' || e.type === 'monster_raid');
    if (disasters.length > 0) {
      hooks.push(`After the recent ${disasters[0].title.toLowerCase()}, strange things are happening in the affected areas.`);
    }

    // Fallback hooks
    if (hooks.length === 0) {
      hooks.push('A mysterious traveler arrives with news of a threat from beyond the known world.');
      hooks.push('Ancient artifacts have been discovered, hinting at a forgotten civilization.');
      hooks.push('The people speak of prophecies and omens. Something significant is about to happen.');
    }

    return hooks;
  }

  async exportWorldToFile(
    world: WorldState, 
    options: ExportOptions, 
    filePath: string
  ): Promise<string> {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    let content: string;
    
    switch (options.format) {
      case 'json':
        content = this.formatJSON(world, options);
        break;
      case 'markdown':
        content = this.formatMarkdown(world, options);
        break;
      case 'narrative':
        content = this.formatNarrative(world, options);
        break;
      case 'gm_notes':
        content = this.formatGMNotes(world, options);
        break;
      default:
        content = this.formatMarkdown(world, options);
    }

    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  async readExportFile(
    filePath: string,
    options?: { 
      startLine?: number; 
      endLine?: number;
      startByte?: number;
      endByte?: number;
    }
  ): Promise<{
    content: string;
    totalLines: number;
    totalBytes: number;
    lineRange: [number, number];
    byteRange: [number, number];
    hasMore: boolean;
  }> {
    const stats = await fs.stat(filePath);
    const totalBytes = stats.size;
    
    let content: string;
    let lineRange: [number, number] = [1, 0];
    let byteRange: [number, number] = [0, totalBytes];
    let hasMore = false;

    if (options?.startByte !== undefined || options?.endByte !== undefined) {
      // Byte range read
      const start = options.startByte ?? 0;
      const end = options.endByte ?? totalBytes;
      byteRange = [start, end];
      
      const buffer = Buffer.alloc(end - start);
      const fd = await fs.open(filePath, 'r');
      try {
        await fd.read(buffer, 0, end - start, start);
        content = buffer.toString('utf8');
      } finally {
        await fd.close();
      }
      
      hasMore = end < totalBytes;
    } else if (options?.startLine !== undefined || options?.endLine !== undefined) {
      // Line range read
      const fullContent = await fs.readFile(filePath, 'utf8');
      const lines = fullContent.split('\n');
      const totalLines = lines.length;
      
      const start = (options.startLine ?? 1) - 1; // Convert to 0-indexed
      const end = options.endLine ?? totalLines;
      lineRange = [options.startLine ?? 1, end];
      
      content = lines.slice(start, end).join('\n');
      hasMore = end < totalLines;
    } else {
      // Read entire file
      content = await fs.readFile(filePath, 'utf8');
      lineRange = [1, content.split('\n').length];
      byteRange = [0, totalBytes];
      hasMore = false;
    }

    return {
      content,
      totalLines: lineRange[1],
      totalBytes,
      lineRange,
      byteRange,
      hasMore,
    };
  }
}
