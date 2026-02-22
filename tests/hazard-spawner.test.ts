import { describe, expect, it } from 'vitest';
import { getMazeParams } from '../src/game/maze/Difficulty';
import { HazardSpawner } from '../src/game/maze/HazardSpawner';
import { MazeGenerator } from '../src/game/maze/MazeGenerator';
import type { MazeInstance } from '../src/game/maze/MazeTypes';

interface TilePoint {
  x: number;
  y: number;
}

const CARDINAL_STEPS: TilePoint[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function tileKey(tile: TilePoint): string {
  return `${tile.x},${tile.y}`;
}

function buildShortestPathSet(maze: MazeInstance): Set<string> {
  const start = maze.entry;
  const target = maze.exit;
  const startKey = tileKey(start);
  const targetKey = tileKey(target);
  const queue: TilePoint[] = [start];
  const visited = new Set<string>([startKey]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = tileKey(current);

    if (currentKey === targetKey) {
      break;
    }

    for (const step of CARDINAL_STEPS) {
      const nx = current.x + step.x;
      const ny = current.y + step.y;

      if (nx < 0 || ny < 0 || nx >= maze.width || ny >= maze.height) {
        continue;
      }

      if (maze.cells[ny][nx].type === 'wall') {
        continue;
      }

      const nextKey = `${nx},${ny}`;
      if (visited.has(nextKey)) {
        continue;
      }

      visited.add(nextKey);
      parent.set(nextKey, currentKey);
      queue.push({ x: nx, y: ny });
    }
  }

  const path = new Set<string>();

  if (!visited.has(targetKey)) {
    return path;
  }

  let current = targetKey;
  path.add(current);

  while (current !== startKey) {
    const previous = parent.get(current);
    if (!previous) {
      break;
    }

    current = previous;
    path.add(current);
  }

  return path;
}

describe('HazardSpawner', () => {
  it('generates deterministic hazards for the same maze seed', () => {
    const generator = new MazeGenerator();
    const maze = generator.generate(getMazeParams('haz-seed-a', 16));
    const spawner = new HazardSpawner();

    const first = spawner.spawnHazards(maze);
    const second = spawner.spawnHazards(maze);

    expect(first).toEqual(second);
  });

  it('never places hazards on walls, entry, or exit', () => {
    const generator = new MazeGenerator();
    const maze = generator.generate(getMazeParams('haz-seed-b', 18));
    const spawner = new HazardSpawner();

    const hazards = spawner.spawnHazards(maze);

    for (const hazard of hazards) {
      const cell = maze.cells[hazard.tileY][hazard.tileX];
      const isEntry = hazard.tileX === maze.entry.x && hazard.tileY === maze.entry.y;
      const isExit = hazard.tileX === maze.exit.x && hazard.tileY === maze.exit.y;

      expect(cell.type).not.toBe('wall');
      expect(isEntry).toBe(false);
      expect(isExit).toBe(false);
    }
  });

  it('avoids placing hazards on the shortest critical path from entry to exit', () => {
    const generator = new MazeGenerator();
    const maze = generator.generate(getMazeParams('haz-seed-c', 21));
    const spawner = new HazardSpawner();

    const hazards = spawner.spawnHazards(maze);
    const pathSet = buildShortestPathSet(maze);

    for (const hazard of hazards) {
      expect(pathSet.has(`${hazard.tileX},${hazard.tileY}`)).toBe(false);
    }
  });
});
