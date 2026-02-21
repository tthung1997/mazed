import type { MazeInstance } from '../maze/MazeTypes';
import type { MazeItemSpawn } from '../../types/items';

export interface ItemPickupEvent {
  spawnId: string;
  itemId: MazeItemSpawn['itemId'];
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export class ItemSystem {
  private readonly spawnById = new Map<string, MazeItemSpawn>();
  private readonly spawnIdsByTile = new Map<string, string[]>();

  loadMaze(maze: MazeInstance): void {
    this.spawnById.clear();
    this.spawnIdsByTile.clear();

    const spawns = maze.itemSpawns ?? [];

    for (const spawn of spawns) {
      this.spawnById.set(spawn.id, spawn);

      const key = tileKey(spawn.tileX, spawn.tileY);
      const idsAtTile = this.spawnIdsByTile.get(key) ?? [];
      idsAtTile.push(spawn.id);
      this.spawnIdsByTile.set(key, idsAtTile);
    }
  }

  update(playerTile: { x: number; y: number }): ItemPickupEvent[] {
    const key = tileKey(playerTile.x, playerTile.y);
    const idsAtTile = this.spawnIdsByTile.get(key);

    if (!idsAtTile || idsAtTile.length === 0) {
      return [];
    }

    this.spawnIdsByTile.delete(key);

    const events: ItemPickupEvent[] = [];

    for (const id of idsAtTile) {
      const spawn = this.spawnById.get(id);

      if (!spawn) {
        continue;
      }

      this.spawnById.delete(id);
      events.push({
        spawnId: id,
        itemId: spawn.itemId,
      });
    }

    return events;
  }

  getSpawns(): MazeItemSpawn[] {
    return Array.from(this.spawnById.values());
  }
}
