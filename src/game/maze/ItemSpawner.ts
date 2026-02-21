import type { MazeInstance } from './MazeTypes';
import type { MazeItemSpawn, WayfinderConfig } from '../../types/items';
import { getToolUnlockedAtMaze, hasToolUnlocked, TOOL_ORDER } from '../../types/items';
import { SeededRandom } from '../../utils/random';
import { WAYFINDER_MAZE_RANGE_MAX, WAYFINDER_MAZE_RANGE_MIN } from '../core/constants';

interface ItemSpawnerOptions {
  playerSeed: string;
  wayfinderCollected: boolean;
  pickedUpSpawnIds?: readonly string[];
  unlockedToolsMask?: number;
}

interface TilePoint {
  x: number;
  y: number;
}

const CARDINAL_DIRECTIONS: TilePoint[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function sortRange(range: WayfinderConfig): WayfinderConfig {
  if (range.minMaze <= range.maxMaze) {
    return range;
  }

  return {
    minMaze: range.maxMaze,
    maxMaze: range.minMaze,
  };
}

function makeTileKey(tile: TilePoint): string {
  return `${tile.x},${tile.y}`;
}

function distanceSquared(a: TilePoint, b: TilePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function shuffleTiles(tiles: TilePoint[], random: SeededRandom): TilePoint[] {
  const copy = [...tiles];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = random.nextInt(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function getPassableNeighborCount(maze: MazeInstance, tile: TilePoint): number {
  let count = 0;

  for (const direction of CARDINAL_DIRECTIONS) {
    const nx = tile.x + direction.x;
    const ny = tile.y + direction.y;
    const neighbor = maze.cells[ny]?.[nx];

    if (!neighbor || neighbor.type === 'wall') {
      continue;
    }

    count += 1;
  }

  return count;
}

function collectDeadEnds(maze: MazeInstance): TilePoint[] {
  const deadEnds: TilePoint[] = [];

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      if ((x === maze.entry.x && y === maze.entry.y) || (x === maze.exit.x && y === maze.exit.y)) {
        continue;
      }

      const cell = maze.cells[y][x];
      if (!cell || cell.type === 'wall') {
        continue;
      }

      if (getPassableNeighborCount(maze, { x, y }) === 1) {
        deadEnds.push({ x, y });
      }
    }
  }

  return deadEnds;
}

function collectPassableTiles(maze: MazeInstance): TilePoint[] {
  const tiles: TilePoint[] = [];

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      if ((x === maze.entry.x && y === maze.entry.y) || (x === maze.exit.x && y === maze.exit.y)) {
        continue;
      }

      const cell = maze.cells[y][x];
      if (!cell || cell.type === 'wall') {
        continue;
      }

      tiles.push({ x, y });
    }
  }

  return tiles;
}

export class ItemSpawner {
  constructor(private readonly wayfinderConfig: WayfinderConfig = { minMaze: WAYFINDER_MAZE_RANGE_MIN, maxMaze: WAYFINDER_MAZE_RANGE_MAX }) {}

  getWayfinderTargetMaze(playerSeed: string): number {
    const range = sortRange(this.wayfinderConfig);
    const random = new SeededRandom(`${playerSeed}:wayfinder-maze`);
    return random.nextInt(range.minMaze, range.maxMaze);
  }

  spawnItems(maze: MazeInstance, options: ItemSpawnerOptions): MazeItemSpawn[] {
    const random = new SeededRandom(`${maze.seed}:items`);
    const deadEnds = collectDeadEnds(maze);
    const passableTiles = collectPassableTiles(maze);
    const availableTiles = shuffleTiles(deadEnds, random);
    const occupiedTiles = new Set<string>();
    const spawns: MazeItemSpawn[] = [];

    const addSpawn = (itemId: MazeItemSpawn['itemId'], tile: TilePoint): void => {
      const id = `item_${maze.mazeNumber}_${spawns.length}`;
      spawns.push({
        id,
        itemId,
        tileX: tile.x,
        tileY: tile.y,
      });
      occupiedTiles.add(makeTileKey(tile));
    };

    const takeTile = (): TilePoint | null => {
      while (availableTiles.length > 0) {
        const candidate = availableTiles.pop()!;
        const key = makeTileKey(candidate);

        if (!occupiedTiles.has(key)) {
          return candidate;
        }
      }

      return null;
    };

    const shardCount = maze.mazeNumber <= 5 ? 1 : maze.mazeNumber <= 15 ? 2 : 3;
    for (let i = 0; i < shardCount; i += 1) {
      const tile = takeTile();
      if (!tile) {
        break;
      }

      addSpawn('maze_shard', tile);
    }

    const unlockedMask = options.unlockedToolsMask ?? 0;
    const unlockToolId = getToolUnlockedAtMaze(maze.mazeNumber);
    const toolDropOrder = unlockToolId ? [unlockToolId] : [];

    if (deadEnds.length > 0) {
      const sortedCandidates = [...deadEnds].sort(
        (a, b) => distanceSquared(b, maze.entry) - distanceSquared(a, maze.entry),
      );

      for (const toolId of toolDropOrder) {
        if (hasToolUnlocked(unlockedMask, toolId)) {
          continue;
        }

        const candidate = sortedCandidates.find((tile) => !occupiedTiles.has(makeTileKey(tile)));

        if (!candidate) {
          break;
        }

        addSpawn(toolId, candidate);
      }
    }

    const shouldSpawnWayfinder =
      !options.wayfinderCollected && maze.mazeNumber === this.getWayfinderTargetMaze(options.playerSeed);

    if (shouldSpawnWayfinder) {
      const sortedCandidates = [...deadEnds].sort(
        (a, b) => distanceSquared(b, maze.entry) - distanceSquared(a, maze.entry),
      );

      const farthestDeadEnd = sortedCandidates.find((tile) => !occupiedTiles.has(makeTileKey(tile)));

      if (farthestDeadEnd) {
        addSpawn('wayfinder_stone', farthestDeadEnd);
      } else {
        const fallback = [...passableTiles]
          .sort((a, b) => distanceSquared(b, maze.entry) - distanceSquared(a, maze.entry))
          .find((tile) => !occupiedTiles.has(makeTileKey(tile)));

        if (fallback) {
          addSpawn('wayfinder_stone', fallback);
        }
      }
    }

    if (!options.pickedUpSpawnIds || options.pickedUpSpawnIds.length === 0) {
      return spawns;
    }

    const pickedSet = new Set(options.pickedUpSpawnIds);
    return spawns.filter((spawn) => !pickedSet.has(spawn.id));
  }
}
