/**
 * Export formatting utilities
 */

import { WorldState } from '../types';

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
    output += `- **Populations:** ${world.society.populations.map(p => p.name).join(', ')}\n`;
    output += `- **Locations:** ${world.locations.map(l => l.name).join(', ')}\n\n`;

    output += `## Population Status\n\n`;
    for (const pop of world.society.populations) {
      output += `### ${pop.name}\n`;
      output += `- Size: ${pop.size}\n`;
      output += `- Org: ${pop.organization}\n`;
      output += `- Tech: ${pop.technologyLevel}\n`;
      output += `- Relations: ${Object.entries(pop.relations).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      output += `- Techs: ${world.society.technologies.join(', ')}\n\n`;
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
    if (dungeons.length > 0) {
      hooks.push(`Ancient ruins at ${dungeons[0].name} have been disturbed. Something ancient has awakened.`);
    }

    // Event-based hooks
    const recentEvents = world.events.slice(-5);
    const disasters = recentEvents.filter(e => e.type === 'natural' || e.type === 'conflict');
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
}
