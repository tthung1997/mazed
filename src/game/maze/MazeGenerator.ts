import { SeededRandom } from '../../utils/random';
import type { MazeCell, MazeInstance, MazeParams } from './MazeTypes';
import { hasPath } from './PathValidation';
import { getExitDifficultyProfile } from './Difficulty';

interface Point {
  x: number;
  y: number;
}

interface DistanceNode extends Point {
  distance: number;
}

const DIRECTIONS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function createWallGrid(width: number, height: number): MazeCell[][] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      x,
      y,
      type: 'wall' as const,
      explored: false,
      currentlyVisible: false,
    })),
  );
}

function ensureOdd(value: number): number {
  return value % 2 === 0 ? value + 1 : value;
}

function isInBounds(x: number, y: number, width: number, height: number): boolean {
  return x > 0 && y > 0 && x < width - 1 && y < height - 1;
}

function carveFloor(cell: MazeCell): void {
  if (cell.type === 'entry' || cell.type === 'exit') {
    return;
  }

  cell.type = 'floor';
}

function distanceSquared(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function countPassableNeighbors(cells: MazeCell[][], point: Point): number {
  let count = 0;

  for (const direction of DIRECTIONS) {
    const nx = point.x + direction.x;
    const ny = point.y + direction.y;
    const neighbor = cells[ny]?.[nx];

    if (neighbor && neighbor.type !== 'wall') {
      count += 1;
    }
  }

  return count;
}

function computeDistances(cells: MazeCell[][], width: number, height: number, start: Point): DistanceNode[] {
  const visited = new Set<string>([`${start.x},${start.y}`]);
  const queue: DistanceNode[] = [{ ...start, distance: 0 }];
  const results: DistanceNode[] = [{ ...start, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const direction of DIRECTIONS) {
      const nx = current.x + direction.x;
      const ny = current.y + direction.y;

      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }

      const cell = cells[ny][nx];
      const key = `${nx},${ny}`;

      if (cell.type === 'wall' || visited.has(key)) {
        continue;
      }

      visited.add(key);
      const next = { x: nx, y: ny, distance: current.distance + 1 };
      queue.push(next);
      results.push(next);
    }
  }

  return results;
}

export class MazeGenerator {
  generate(params: MazeParams): MazeInstance {
    const width = ensureOdd(params.width + 1);
    const height = ensureOdd(params.height + 1);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const random = new SeededRandom(`${params.seed}:${attempt}`);
      const cells = createWallGrid(width, height);

      const start: Point = { x: 1, y: 1 };
      const stack: Point[] = [start];
      carveFloor(cells[start.y][start.x]);

      while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const nextCandidates: Point[] = [];

        for (const direction of DIRECTIONS) {
          const nextX = current.x + direction.x * 2;
          const nextY = current.y + direction.y * 2;

          if (!isInBounds(nextX, nextY, width, height)) {
            continue;
          }

          if (cells[nextY][nextX].type === 'wall') {
            nextCandidates.push({ x: nextX, y: nextY });
          }
        }

        if (nextCandidates.length === 0) {
          stack.pop();
          continue;
        }

        const selected = random.pick(nextCandidates);
        const wallX = Math.floor((current.x + selected.x) / 2);
        const wallY = Math.floor((current.y + selected.y) / 2);

        carveFloor(cells[wallY][wallX]);
        carveFloor(cells[selected.y][selected.x]);
        stack.push(selected);
      }

      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          if (cells[y][x].type !== 'wall') {
            continue;
          }

          if (random.next() < params.loopChance) {
            carveFloor(cells[y][x]);
          }
        }
      }

      const floorTiles: Point[] = [];

      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          if (cells[y][x].type === 'wall') {
            continue;
          }

          floorTiles.push({ x, y });
        }
      }

      const entry = random.pick(floorTiles);
      const distances = computeDistances(cells, width, height, entry);
      const profile = getExitDifficultyProfile(params.mazeNumber);
      const maxDistance = Math.max(...distances.map((item) => item.distance));
      const farEnoughDistance = Math.max(
        profile.minAbsoluteDistance,
        Math.floor(maxDistance * profile.minDistanceRatio),
      );

      const farCandidates = distances.filter(
        (item) => item.distance >= farEnoughDistance && (item.x !== entry.x || item.y !== entry.y),
      );

      const deadEndCandidates = farCandidates.filter((item) => countPassableNeighbors(cells, item) <= 1);

      const sourcePool =
        profile.preferDeadEnd && deadEndCandidates.length > 0
          ? deadEndCandidates
          : farCandidates.length > 0
            ? farCandidates
            : distances.filter((item) => item.x !== entry.x || item.y !== entry.y);
      const fallback = distances.reduce((best, item) => {
        if (item.x === entry.x && item.y === entry.y) {
          return best;
        }

        return item.distance > best.distance ? item : best;
      }, { x: entry.x, y: entry.y, distance: -1 });

      const selectedExit = sourcePool.length > 0 ? random.pick(sourcePool) : fallback;
      const exit: Point = { x: selectedExit.x, y: selectedExit.y };

      cells[entry.y][entry.x].type = 'entry';
      cells[exit.y][exit.x].type = 'exit';

      const maze: MazeInstance = {
        mazeNumber: params.mazeNumber,
        width,
        height,
        seed: params.seed,
        cells,
        entry,
        exit,
      };

      if (hasPath(maze)) {
        return maze;
      }
    }

    throw new Error('Failed to generate solvable maze');
  }
}