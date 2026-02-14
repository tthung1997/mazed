import { describe, expect, it } from 'vitest';
import { MazeGenerator } from '../src/game/maze/MazeGenerator';
import { getMazeParams, getExitDifficultyProfile } from '../src/game/maze/Difficulty';
import type { MazeInstance } from '../src/game/maze/MazeTypes';

interface DistanceNode {
  x: number;
  y: number;
  distance: number;
}

const CARDINAL_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function computeDistances(maze: MazeInstance): DistanceNode[] {
  const queue: DistanceNode[] = [{ x: maze.entry.x, y: maze.entry.y, distance: 0 }];
  const visited = new Set<string>([`${maze.entry.x},${maze.entry.y}`]);
  const output: DistanceNode[] = [{ x: maze.entry.x, y: maze.entry.y, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const direction of CARDINAL_DIRECTIONS) {
      const nx = current.x + direction.x;
      const ny = current.y + direction.y;

      if (nx < 0 || ny < 0 || nx >= maze.width || ny >= maze.height) {
        continue;
      }

      if (maze.cells[ny][nx].type === 'wall') {
        continue;
      }

      const key = `${nx},${ny}`;

      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      const next = { x: nx, y: ny, distance: current.distance + 1 };
      queue.push(next);
      output.push(next);
    }
  }

  return output;
}

function countPassableNeighbors(maze: MazeInstance, x: number, y: number): number {
  let count = 0;

  for (const direction of CARDINAL_DIRECTIONS) {
    const nx = x + direction.x;
    const ny = y + direction.y;
    const neighbor = maze.cells[ny]?.[nx];

    if (neighbor && neighbor.type !== 'wall') {
      count += 1;
    }
  }

  return count;
}

describe('Exit difficulty profile', () => {
  it('selects expected tiers by maze number', () => {
    expect(getExitDifficultyProfile(1)).toEqual({
      minDistanceRatio: 0.55,
      preferDeadEnd: false,
      minAbsoluteDistance: 5,
    });

    expect(getExitDifficultyProfile(6)).toEqual({
      minDistanceRatio: 0.68,
      preferDeadEnd: false,
      minAbsoluteDistance: 7,
    });

    expect(getExitDifficultyProfile(20)).toEqual({
      minDistanceRatio: 0.75,
      preferDeadEnd: true,
      minAbsoluteDistance: 8,
    });
  });

  it('places exit in far band and honors dead-end preference when candidates exist', () => {
    const generator = new MazeGenerator();
    const cases = [
      { seed: 'difficulty-seed-a', mazeNumber: 2 },
      { seed: 'difficulty-seed-b', mazeNumber: 7 },
      { seed: 'difficulty-seed-c', mazeNumber: 14 },
    ];

    for (const testCase of cases) {
      const params = getMazeParams(testCase.seed, testCase.mazeNumber);
      const profile = getExitDifficultyProfile(testCase.mazeNumber);
      const maze = generator.generate(params);

      const distances = computeDistances(maze);
      const maxDistance = Math.max(...distances.map((item) => item.distance));
      const farEnoughDistance = Math.max(
        profile.minAbsoluteDistance,
        Math.floor(maxDistance * profile.minDistanceRatio),
      );

      const farCandidates = distances.filter(
        (item) => item.distance >= farEnoughDistance && (item.x !== maze.entry.x || item.y !== maze.entry.y),
      );

      const exitDistance =
        distances.find((item) => item.x === maze.exit.x && item.y === maze.exit.y)?.distance ?? -1;

      if (farCandidates.length > 0) {
        expect(exitDistance).toBeGreaterThanOrEqual(farEnoughDistance);
      }

      if (profile.preferDeadEnd) {
        const deadEndCandidates = farCandidates.filter((item) => countPassableNeighbors(maze, item.x, item.y) <= 1);

        if (deadEndCandidates.length > 0) {
          expect(countPassableNeighbors(maze, maze.exit.x, maze.exit.y)).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
