/**
 * World persistence - save/load worlds to filesystem
 */

import { promises as fs } from 'fs';
import path from 'path';
import { WorldState } from '../types';

const WORLDS_DIR = path.join(process.cwd(), 'worlds');

export class WorldPersistence {
  private worldsDir: string;

  constructor() {
    this.worldsDir = WORLDS_DIR;
  }

  async initialize(): Promise<void> {
    if (!await this.exists(this.worldsDir)) {
      await fs.mkdir(this.worldsDir, { recursive: true });
    }
  }

  private exists(path: string): Promise<boolean> {
    return fs.access(path).then(() => true).catch(() => false);
  }

  async saveWorld(world: WorldState): Promise<void> {
    await this.initialize();
    const filePath = path.join(this.worldsDir, `${world.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(world, null, 2));
  }

  async loadWorld(worldId: string): Promise<WorldState | null> {
    await this.initialize();
    const filePath = path.join(this.worldsDir, `${worldId}.json`);
    
    if (!await this.exists(filePath)) {
      return null;
    }
    
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data) as WorldState;
  }

  async deleteWorld(worldId: string): Promise<boolean> {
    await this.initialize();
    const filePath = path.join(this.worldsDir, `${worldId}.json`);
    
    if (!await this.exists(filePath)) {
      return false;
    }
    
    await fs.unlink(filePath);
    return true;
  }

  async listWorlds(): Promise<string[]> {
    await this.initialize();
    
    if (!await this.exists(this.worldsDir)) {
      return [];
    }
    
    const files = await fs.readdir(this.worldsDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  async loadAllWorlds(): Promise<Map<string, WorldState>> {
    const worldIds = await this.listWorlds();
    const worlds = new Map<string, WorldState>();
    
    for (const worldId of worldIds) {
      const world = await this.loadWorld(worldId);
      if (world) {
        worlds.set(worldId, world);
      }
    }
    
    return worlds;
  }
}
