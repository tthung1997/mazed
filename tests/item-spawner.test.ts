import { describe, expect, it } from 'vitest';
import { MazeGenerator } from '../src/game/maze/MazeGenerator';
import { ItemSpawner } from '../src/game/maze/ItemSpawner';
import { getMazeParams } from '../src/game/maze/Difficulty';
import { getToolBit } from '../src/types/items';

describe('ItemSpawner', () => {
  it('generates deterministic item spawns for the same maze and player seed', () => {
    const generator = new MazeGenerator();
    const maze = generator.generate(getMazeParams('seed-a', 8));
    const spawner = new ItemSpawner({ minMaze: 6, maxMaze: 10 });

    const first = spawner.spawnItems(maze, {
      playerSeed: 'player-seed-1',
      wayfinderCollected: false,
    });
    const second = spawner.spawnItems(maze, {
      playerSeed: 'player-seed-1',
      wayfinderCollected: false,
    });

    expect(first).toEqual(second);
  });

  it('never places items on walls, entry, or exit', () => {
    const generator = new MazeGenerator();
    const maze = generator.generate(getMazeParams('seed-b', 9));
    const spawner = new ItemSpawner({ minMaze: 6, maxMaze: 10 });

    const spawns = spawner.spawnItems(maze, {
      playerSeed: 'player-seed-2',
      wayfinderCollected: false,
    });

    for (const spawn of spawns) {
      const isEntry = spawn.tileX === maze.entry.x && spawn.tileY === maze.entry.y;
      const isExit = spawn.tileX === maze.exit.x && spawn.tileY === maze.exit.y;
      const cell = maze.cells[spawn.tileY][spawn.tileX];

      expect(cell.type).not.toBe('wall');
      expect(isEntry).toBe(false);
      expect(isExit).toBe(false);
    }
  });

  it('selects a deterministic wayfinder target maze inside configurable range', () => {
    const spawner = new ItemSpawner({ minMaze: 5, maxMaze: 9 });
    const first = spawner.getWayfinderTargetMaze('seed-z');
    const second = spawner.getWayfinderTargetMaze('seed-z');

    expect(first).toBeGreaterThanOrEqual(5);
    expect(first).toBeLessThanOrEqual(9);
    expect(first).toBe(second);
  });

  it('spawns unlock tool at its maze when not yet unlocked', () => {
    const generator = new MazeGenerator();
    const maze = generator.generate(getMazeParams('seed-tool-a', 5));
    const spawner = new ItemSpawner({ minMaze: 6, maxMaze: 10 });

    const spawns = spawner.spawnItems(maze, {
      playerSeed: 'player-seed-3',
      wayfinderCollected: false,
      unlockedToolsMask: 0,
    });

    expect(spawns.some((spawn) => spawn.itemId === 'compass')).toBe(true);
  });

  it('does not spawn unlock tool when already unlocked', () => {
    const generator = new MazeGenerator();
    const maze = generator.generate(getMazeParams('seed-tool-b', 5));
    const spawner = new ItemSpawner({ minMaze: 6, maxMaze: 10 });

    const spawns = spawner.spawnItems(maze, {
      playerSeed: 'player-seed-4',
      wayfinderCollected: false,
      unlockedToolsMask: getToolBit('compass'),
    });

    expect(spawns.some((spawn) => spawn.itemId === 'compass')).toBe(false);
  });
});
