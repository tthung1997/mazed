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

const OPPOSITE_DIRECTION: Record<CardinalDirection, CardinalDirection> = {
  east: 'west',
  west: 'east',
  north: 'south',
  south: 'north',
};

function directionBetween(from: TilePoint, to: TilePoint): CardinalDirection | null {
  if (to.x > from.x) {
    return 'east';
  }

  if (to.x < from.x) {
    return 'west';
  }

  if (to.y > from.y) {
    return 'south';
  }

  if (to.y < from.y) {
    return 'north';
  }

  return null;
}

// A move into `to` is blocked when `to` is treated as a wall (a closable door
// assumed shut) or when `to` is a one-way door whose allowed direction does not
// match the direction of travel.
function isMoveAllowed(
  maze: MazeInstance,
  from: TilePoint,
  to: TilePoint,
  oneWayByKey: Map<string, CardinalDirection>,
  blocked: Set<string>,
): boolean {
  if (blocked.has(tileKey(to))) {
    return false;
  }

  if (!isPassable(maze, to.x, to.y)) {
    return false;
  }

  const doorDirection = oneWayByKey.get(tileKey(to));
  if (!doorDirection) {
    return true;
  }

  return doorDirection === directionBetween(from, to);
}

// Directed reachability over the maze graph. When `reverse` is true it walks
// predecessors, yielding the set of tiles that can *reach* `start`. Tiles in
// `blocked` are treated as walls.
function reachableTiles(
  maze: MazeInstance,
  start: TilePoint,
  oneWayByKey: Map<string, CardinalDirection>,
  reverse: boolean,
  blocked: Set<string>,
): Set<string> {
  const visited = new Set<string>([tileKey(start)]);
  const queue: TilePoint[] = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const step of CARDINAL_STEPS) {
      const neighbor = { x: current.x + step.x, y: current.y + step.y };

      if (!isPassable(maze, neighbor.x, neighbor.y)) {
        continue;
      }

      const neighborKey = tileKey(neighbor);
      if (visited.has(neighborKey)) {
        continue;
      }

      // Never traverse a blocked (assumed-shut) door tile, in either
      // direction. `isMoveAllowed` only guards the tile being entered, which is
      // insufficient for the reverse (predecessor) walk.
      if (blocked.has(neighborKey)) {
        continue;
      }

      const allowed = reverse
        ? isMoveAllowed(maze, neighbor, current, oneWayByKey, blocked)
        : isMoveAllowed(maze, current, neighbor, oneWayByKey, blocked);

      if (!allowed) {
        continue;
      }

      visited.add(neighborKey);
      queue.push(neighbor);
    }
  }

  return visited;
}

const NO_BLOCKED_TILES: Set<string> = new Set();

// Guarantees the player can never be stranded, considering all hazards
// together. `closableDoorTiles` are the tiles of doors that can block passage
// when shut (pressure-plate + locked doors); one-way doors are modelled by
// direction. `oneWayByKey` maps one-way door tiles to their allowed direction.
//
// A player may stand on any tile reachable while every door is open (that is
// what `reachableFromEntry` captures, since closable doors can be open). From
// every such tile the player must still be able to reach both the entry (back
// portal) and the exit using only *reliable* routes — i.e. routes that do not
// depend on any closable door. This catches multi-door cut sets, where several
// doors only strand a region when shut together.
function layoutIsSafe(
  maze: MazeInstance,
  oneWayByKey: Map<string, CardinalDirection>,
  closableDoorTiles: Set<string>,
): boolean {
  const reachableFromEntry = reachableTiles(maze, maze.entry, oneWayByKey, false, NO_BLOCKED_TILES);
  const reliablyReachesEntry = reachableTiles(maze, maze.entry, oneWayByKey, true, closableDoorTiles);
  const reliablyReachesExit = reachableTiles(maze, maze.exit, oneWayByKey, true, closableDoorTiles);

  for (const key of reachableFromEntry) {
    // A door tile itself is safe: the occupant can always step off onto a
    // neighbouring corridor tile, which is validated in its own right.
    if (closableDoorTiles.has(key)) {
      continue;
    }

    if (!reliablyReachesEntry.has(key) || !reliablyReachesExit.has(key)) {
      return false;
    }
  }

  return true;
}

function isStraightCorridor(maze: MazeInstance, tile: TilePoint): 'horizontal' | 'vertical' | null {
  const neighbors = getPassableNeighbors(maze, tile);

  if (neighbors.length !== 2) {
    return null;
  }

  const hasEast = neighbors.some((n) => n.direction === 'east');
  const hasWest = neighbors.some((n) => n.direction === 'west');
  const hasNorth = neighbors.some((n) => n.direction === 'north');
  const hasSouth = neighbors.some((n) => n.direction === 'south');

  if (hasEast && hasWest) {
    return 'horizontal';
  }

  if (hasNorth && hasSouth) {
    return 'vertical';
  }

  return null;
}

function isPortalTile(maze: MazeInstance, tile: TilePoint): boolean {
  return (
    (tile.x === maze.entry.x && tile.y === maze.entry.y) ||
    (tile.x === maze.exit.x && tile.y === maze.exit.y)
  );
}

// True when `to` is reachable from `from` over passable tiles without stepping
// on a portal tile (so a pressure-plate puzzle never routes through the
// entry/exit stone, which would trigger a maze transition mid-puzzle).
function tileReachesTileAvoidingPortals(maze: MazeInstance, from: TilePoint, to: TilePoint): boolean {
  const fromKey = tileKey(from);
  const toKey = tileKey(to);

  if (fromKey === toKey) {
    return true;
  }

  const visited = new Set<string>([fromKey]);
  const queue: TilePoint[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const step of CARDINAL_STEPS) {
      const neighbor = { x: current.x + step.x, y: current.y + step.y };
      const neighborKey = tileKey(neighbor);

      if (visited.has(neighborKey) || !isPassable(maze, neighbor.x, neighbor.y)) {
        continue;
      }

      if (neighborKey === toKey) {
        return true;
      }

      if (isPortalTile(maze, neighbor)) {
        continue;
      }

      visited.add(neighborKey);
      queue.push(neighbor);
    }
  }

  return false;
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

function getPressurePlatePairCount(mazeNumber: number, random: SeededRandom): number {
  if (mazeNumber <= 10) {
    return 0;
  }

  if (mazeNumber <= 15) {
    return 1;
  }

  if (mazeNumber <= 20) {
    return random.nextInt(1, 2);
  }

  return random.nextInt(2, 3);
}

const PRESSURE_PLATE_DELAY_SECONDS = 2.8;
const PRESSURE_PLATE_LINK_RADIUS = 5;
const PRESSURE_PLATE_COLOR_KEYS = ['amber', 'cyan', 'violet', 'emerald'];

function getDoorPassageAxis(maze: MazeInstance, tile: TilePoint, random: SeededRandom): 'horizontal' | 'vertical' {
  return isStraightCorridor(maze, tile) ?? random.pick(['horizontal', 'vertical']);
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

    const oneWayCandidates = allCandidates.filter((tile) => isStraightCorridor(maze, tile) !== null);

    const lockedDoorCandidates = allCandidates.filter((tile) => isStraightCorridor(maze, tile) !== null);
    const pressurePlateCandidates = allCandidates.filter((tile) => getPassableNeighbors(maze, tile).length >= 2);
    const pressureDoorCandidates = allCandidates.filter((tile) => isStraightCorridor(maze, tile) !== null);
    const occupied = new Set<string>();
    // Tiles of doors that can block passage when shut (pressure + locked). Used
    // to prove no *combination* of closed doors can strand the player.
    const closableDoorTiles = new Set<string>();
    const hazards: HazardInstance[] = [];

    const oneWayCount = getOneWayCount(maze.mazeNumber, random);
    const shuffledOneWay = shuffleTiles(oneWayCandidates, random);
    const oneWayByKey = new Map<string, CardinalDirection>();

    for (const tile of shuffledOneWay) {
      if (hazards.filter((hazard) => hazard.type === 'one_way_door').length >= oneWayCount) {
        break;
      }

      const key = tileKey(tile);
      if (occupied.has(key)) {
        continue;
      }

      const neighbors = getPassableNeighbors(maze, tile);
      const horizontal = neighbors.some((n) => n.direction === 'east') && neighbors.some((n) => n.direction === 'west');
      const primaryDirection: CardinalDirection = horizontal
        ? random.pick<CardinalDirection>(['east', 'west'])
        : random.pick<CardinalDirection>(['north', 'south']);

      // Try the randomly chosen orientation first, then its opposite, keeping
      // only a direction that leaves the maze fully escapable.
      let allowedDirection: CardinalDirection | null = null;
      for (const candidateDirection of [primaryDirection, OPPOSITE_DIRECTION[primaryDirection]]) {
        oneWayByKey.set(key, candidateDirection);

        if (layoutIsSafe(maze, oneWayByKey, closableDoorTiles)) {
          allowedDirection = candidateDirection;
          break;
        }

        oneWayByKey.delete(key);
      }

      if (!allowedDirection) {
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

    const pressurePlateCount = getPressurePlatePairCount(maze.mazeNumber, random);
    const shuffledPressurePlates = shuffleTiles(pressurePlateCandidates, random);

    for (const plateTile of shuffledPressurePlates) {
      if (hazards.filter((hazard) => hazard.type === 'pressure_plate').length >= pressurePlateCount) {
        break;
      }

      const plateKey = tileKey(plateTile);
      if (occupied.has(plateKey)) {
        continue;
      }

      const availableDoors = pressureDoorCandidates.filter((doorTile) => {
        const doorKey = tileKey(doorTile);

        if (occupied.has(doorKey)) {
          return false;
        }

        if (doorTile.x === plateTile.x && doorTile.y === plateTile.y) {
          return false;
        }

        const manhattanDistance = Math.abs(doorTile.x - plateTile.x) + Math.abs(doorTile.y - plateTile.y);
        if (manhattanDistance > PRESSURE_PLATE_LINK_RADIUS) {
          return false;
        }

        // #1: no combination of closed doors may strand the player. Validate
        // this door together with every door already placed.
        const candidateBlocked = new Set(closableDoorTiles);
        candidateBlocked.add(doorKey);
        if (!layoutIsSafe(maze, oneWayByKey, candidateBlocked)) {
          return false;
        }

        // #2: the plate must reach its door without crossing a portal tile.
        if (!tileReachesTileAvoidingPortals(maze, plateTile, doorTile)) {
          return false;
        }

        return true;
      });

      if (availableDoors.length === 0) {
        continue;
      }

      const selectedDoorTile = random.pick(availableDoors);
      const colorKey = random.pick(PRESSURE_PLATE_COLOR_KEYS);
      const passageAxis = getDoorPassageAxis(maze, selectedDoorTile, random);
      const pressureDoorId = `hazard_${maze.mazeNumber}_${hazards.length}`;

      occupied.add(tileKey(selectedDoorTile));
      closableDoorTiles.add(tileKey(selectedDoorTile));
      hazards.push({
        id: pressureDoorId,
        type: 'pressure_plate_door',
        tileX: selectedDoorTile.x,
        tileY: selectedDoorTile.y,
        meta: {
          colorKey,
          passageAxis,
          closeDelaySeconds: PRESSURE_PLATE_DELAY_SECONDS,
          open: false,
          closeTimerSeconds: null,
        },
      });

      const pressurePlateId = `hazard_${maze.mazeNumber}_${hazards.length}`;
      occupied.add(plateKey);
      hazards.push({
        id: pressurePlateId,
        type: 'pressure_plate',
        tileX: plateTile.x,
        tileY: plateTile.y,
        meta: {
          linkedDoorId: pressureDoorId,
          colorKey,
          active: false,
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

      // A locked door blocks passage until keyed; validate it together with
      // every other closable door so no combination can strand the player.
      const candidateBlocked = new Set(closableDoorTiles);
      candidateBlocked.add(key);
      if (!layoutIsSafe(maze, oneWayByKey, candidateBlocked)) {
        continue;
      }

      occupied.add(key);
      closableDoorTiles.add(key);
      const passageAxis = getDoorPassageAxis(maze, tile, random);
      hazards.push({
        id: `hazard_${maze.mazeNumber}_${hazards.length}`,
        type: 'locked_door',
        tileX: tile.x,
        tileY: tile.y,
        meta: {
          requiresKey: true,
          passageAxis,
          open: false,
        },
      });
    }

    return hazards;
  }
}
