import { describe, expect, it } from 'vitest';
import type { MazeInstance } from '../src/game/maze/MazeTypes';
import { ItemSystem } from '../src/game/systems/ItemSystem';

function createMaze(): MazeInstance {
  return {
    mazeNumber: 1,
    width: 3,
    height: 3,
    seed: 'seed',
    entry: { x: 0, y: 0 },
    exit: { x: 2, y: 2 },
    cells: Array.from({ length: 3 }, (_, y) =>
      Array.from({ length: 3 }, (_, x) => ({
        x,
        y,
        type: 'floor' as const,
        explored: false,
        currentlyVisible: true,
      })),
    ),
    itemSpawns: [
      { id: 'item_a', itemId: 'maze_shard', tileX: 1, tileY: 1 },
      { id: 'item_b', itemId: 'wayfinder_stone', tileX: 2, tileY: 1 },
    ],
  };
}

describe('ItemSystem', () => {
  it('picks an item once and does not re-trigger while staying on tile', () => {
    const maze = createMaze();
    const system = new ItemSystem();
    system.loadMaze(maze);

    const first = system.update({ x: 1, y: 1 });
    const second = system.update({ x: 1, y: 1 });

    expect(first).toEqual([{ spawnId: 'item_a', itemId: 'maze_shard' }]);
    expect(second).toEqual([]);
  });

  it('picks all items on the same tile in one update', () => {
    const maze = createMaze();
    maze.itemSpawns = [
      { id: 'item_a', itemId: 'maze_shard', tileX: 1, tileY: 1 },
      { id: 'item_c', itemId: 'maze_shard', tileX: 1, tileY: 1 },
    ];

    const system = new ItemSystem();
    system.loadMaze(maze);
    const events = system.update({ x: 1, y: 1 });

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.spawnId).sort()).toEqual(['item_a', 'item_c']);
  });
});
