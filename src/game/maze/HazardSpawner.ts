import type { CardinalDirection, HazardInstance } from '../../types/hazards';
import { SeededRandom } from '../../utils/random';
import type { MazeInstance } from './MazeTypes';

interface TilePoint {
  x: number;
  y: number;
}

const CARDINAL_STEPS: Array<{ direction: CardinalDirection; x: number; y: number }> = [
  { direction: 'east', x: 1, y: 0 },
  { direction: 'west', x: -1, y: 0 },
  { direction: 'south', x: 0, y: 1 },
  { direction: 'north', x: 0, y: -1 },
];

function tileKey(tile: TilePoint): string {
  return `${tile.x},${tile.y}`;
}

function isPassable(maze: MazeInstance, x: number, y: number): boolean {
  const cell = maze.cells[y]?.[x];
  return Boolean(cell && cell.type !== 'wall');
}

function getPassableNeighbors(maze: MazeInstance, tile: TilePoint): Array<{ direction: CardinalDirection; x: number; y: number }> {
  const neighbors: Array<{ direction: CardinalDirection; x: number; y: number }> = [];

  for (const step of CARDINAL_STEPS) {
    const nx = tile.x + step.x;
    const ny = tile.y + step.y;

    if (!isPassable(maze, nx, ny)) {
      continue;
    }

    neighbors.push({ direction: step.direction, x: nx, y: ny });
  }

  return neighbors;
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
      const nextKey = `${nx},${ny}`;

      if (visited.has(nextKey) || !isPassable(maze, nx, ny)) {
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

function shuffleTiles(tiles: TilePoint[], random: SeededRandom): TilePoint[] {
  const values = [...tiles];

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = random.nextInt(0, index);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  return values;
}

function getOneWayCount(mazeNumber: number, random: SeededRandom): number {
  if (mazeNumber <= 5) {
    return 0;
  }

  if (mazeNumber <= 10) {
    return 1;
  }

  if (mazeNumber <= 15) {
    return random.nextInt(1, 2);
  }

  if (mazeNumber <= 20) {
    return random.nextInt(2, 3);
  }

  return random.nextInt(3, 4);
}

function getLockedDoorCount(mazeNumber: number): number {
  if (mazeNumber <= 10) {
    return 0;
  }

  if (mazeNumber <= 20) {
    return 1;
  }

  return 2;
}

export class HazardSpawner {
  spawnHazards(maze: MazeInstance): HazardInstance[] {
    const random = new SeededRandom(`${maze.seed}:hazards`);
    const criticalPath = buildShortestPathSet(maze);
    const allCandidates: TilePoint[] = [];

    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        if ((x === maze.entry.x && y === maze.entry.y) || (x === maze.exit.x && y === maze.exit.y)) {
          continue;
        }

        if (!isPassable(maze, x, y)) {
          continue;
        }

        const key = `${x},${y}`;
        if (criticalPath.has(key)) {
          continue;
        }

        allCandidates.push({ x, y });
      }
    }

    const oneWayCandidates = allCandidates.filter((tile) => {
      const neighbors = getPassableNeighbors(maze, tile);

      if (neighbors.length !== 2) {
        return false;
      }

      const hasEast = neighbors.some((n) => n.direction === 'east');
      const hasWest = neighbors.some((n) => n.direction === 'west');
      const hasNorth = neighbors.some((n) => n.direction === 'north');
      const hasSouth = neighbors.some((n) => n.direction === 'south');

      return (hasEast && hasWest) || (hasNorth && hasSouth);
    });

    const lockedDoorCandidates = allCandidates.filter((tile) => getPassableNeighbors(maze, tile).length >= 2);
    const occupied = new Set<string>();
    const hazards: HazardInstance[] = [];

    const oneWayCount = getOneWayCount(maze.mazeNumber, random);
    const shuffledOneWay = shuffleTiles(oneWayCandidates, random);

    for (const tile of shuffledOneWay) {
      if (hazards.filter((hazard) => hazard.type === 'one_way_door').length >= oneWayCount) {
        break;
      }

      const neighbors = getPassableNeighbors(maze, tile);
      const horizontal = neighbors.some((n) => n.direction === 'east') && neighbors.some((n) => n.direction === 'west');
      const allowedDirection: CardinalDirection = horizontal
        ? random.pick<CardinalDirection>(['east', 'west'])
        : random.pick<CardinalDirection>(['north', 'south']);

      const key = tileKey(tile);
      if (occupied.has(key)) {
        continue;
      }

      occupied.add(key);
      hazards.push({
        id: `hazard_${maze.mazeNumber}_${hazards.length}`,
        type: 'one_way_door',
        tileX: tile.x,
        tileY: tile.y,
        meta: {
          allowedDirection,
        },
      });
    }

    const lockedDoorCount = getLockedDoorCount(maze.mazeNumber);
    const shuffledLocked = shuffleTiles(lockedDoorCandidates, random);

    for (const tile of shuffledLocked) {
      if (hazards.filter((hazard) => hazard.type === 'locked_door').length >= lockedDoorCount) {
        break;
      }

      const key = tileKey(tile);
      if (occupied.has(key)) {
        continue;
      }

      occupied.add(key);
      hazards.push({
        id: `hazard_${maze.mazeNumber}_${hazards.length}`,
        type: 'locked_door',
        tileX: tile.x,
        tileY: tile.y,
        meta: {
          requiresKey: true,
          open: false,
        },
      });
    }

    return hazards;
  }
}
