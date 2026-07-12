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

  it('links each pressure plate to a matching pressure door with shared color and nearby placement', () => {
    const generator = new MazeGenerator();
    const maze = generator.generate(getMazeParams('haz-seed-pressure', 19));
    const spawner = new HazardSpawner();

    const hazards = spawner.spawnHazards(maze);
    const doorsById = new Map(
      hazards
        .filter((hazard) => hazard.type === 'pressure_plate_door')
        .map((hazard) => [hazard.id, hazard]),
    );
    const plates = hazards.filter((hazard) => hazard.type === 'pressure_plate');

    expect(plates.length).toBeGreaterThan(0);

    for (const plate of plates) {
      const linkedDoor = doorsById.get(plate.meta.linkedDoorId);
      expect(linkedDoor).toBeTruthy();

      const manhattanDistance = Math.abs(linkedDoor!.tileX - plate.tileX) + Math.abs(linkedDoor!.tileY - plate.tileY);
      expect(manhattanDistance).toBeLessThanOrEqual(5);
      expect(linkedDoor!.meta.colorKey).toBe(plate.meta.colorKey);

      const hasEast = maze.cells[linkedDoor!.tileY]?.[linkedDoor!.tileX + 1]?.type !== 'wall';
      const hasWest = maze.cells[linkedDoor!.tileY]?.[linkedDoor!.tileX - 1]?.type !== 'wall';
      const hasNorth = maze.cells[linkedDoor!.tileY - 1]?.[linkedDoor!.tileX]?.type !== 'wall';
      const hasSouth = maze.cells[linkedDoor!.tileY + 1]?.[linkedDoor!.tileX]?.type !== 'wall';
      const hasHorizontal = hasEast && hasWest;
      const hasVertical = hasNorth && hasSouth;

      expect(hasHorizontal || hasVertical).toBe(true);
      expect(hasHorizontal && hasVertical).toBe(false);

      if (hasHorizontal) {
        expect(linkedDoor!.meta.passageAxis).toBe('horizontal');
      }

      if (hasVertical) {
        expect(linkedDoor!.meta.passageAxis).toBe('vertical');
      }
    }
  });

  it('assigns locked-door passage axis to match corridor orientation when unambiguous', () => {
    const generator = new MazeGenerator();
    const maze = generator.generate(getMazeParams('haz-seed-locked-axis', 22));
    const spawner = new HazardSpawner();

    const hazards = spawner.spawnHazards(maze);
    const lockedDoors = hazards.filter((hazard) => hazard.type === 'locked_door');

    expect(lockedDoors.length).toBeGreaterThan(0);

    for (const door of lockedDoors) {
      const hasEast = maze.cells[door.tileY]?.[door.tileX + 1]?.type !== 'wall';
      const hasWest = maze.cells[door.tileY]?.[door.tileX - 1]?.type !== 'wall';
      const hasNorth = maze.cells[door.tileY - 1]?.[door.tileX]?.type !== 'wall';
      const hasSouth = maze.cells[door.tileY + 1]?.[door.tileX]?.type !== 'wall';
      const hasHorizontal = hasEast && hasWest;
      const hasVertical = hasNorth && hasSouth;

      expect(hasHorizontal || hasVertical).toBe(true);
      expect(hasHorizontal && hasVertical).toBe(false);

      if (hasHorizontal) {
        expect(door.meta.passageAxis).toBe('horizontal');
      }

      if (hasVertical) {
        expect(door.meta.passageAxis).toBe('vertical');
      }
    }
  });

  it('never places a one-way door that can strand the player from the entry or exit', () => {
    const generator = new MazeGenerator();
    const spawner = new HazardSpawner();

    const directionBetween = (from: TilePoint, to: TilePoint): string | null => {
      if (to.x > from.x) return 'east';
      if (to.x < from.x) return 'west';
      if (to.y > from.y) return 'south';
      if (to.y < from.y) return 'north';
      return null;
    };

    for (const [seed, mazeNumber] of [
      ['softlock-a', 12],
      ['softlock-b', 17],
      ['softlock-c', 21],
      ['softlock-d', 25],
      ['softlock-e', 30],
    ] as const) {
      const maze = generator.generate(getMazeParams(seed, mazeNumber));
      const hazards = spawner.spawnHazards(maze);
      const oneWayByKey = new Map<string, string>();

      for (const hazard of hazards) {
        if (hazard.type === 'one_way_door') {
          oneWayByKey.set(tileKey({ x: hazard.tileX, y: hazard.tileY }), hazard.meta.allowedDirection);
        }
      }

      const isPassable = (x: number, y: number): boolean =>
        x >= 0 && y >= 0 && x < maze.width && y < maze.height && maze.cells[y][x].type !== 'wall';

      const moveAllowed = (from: TilePoint, to: TilePoint): boolean => {
        if (!isPassable(to.x, to.y)) return false;
        const doorDir = oneWayByKey.get(tileKey(to));
        return !doorDir || doorDir === directionBetween(from, to);
      };

      const reach = (start: TilePoint, reverse: boolean): Set<string> => {
        const visited = new Set<string>([tileKey(start)]);
        const queue: TilePoint[] = [start];
        while (queue.length > 0) {
          const current = queue.shift()!;
          for (const step of CARDINAL_STEPS) {
            const neighbor = { x: current.x + step.x, y: current.y + step.y };
            if (!isPassable(neighbor.x, neighbor.y)) continue;
            const key = tileKey(neighbor);
            if (visited.has(key)) continue;
            const allowed = reverse ? moveAllowed(neighbor, current) : moveAllowed(current, neighbor);
            if (!allowed) continue;
            visited.add(key);
            queue.push(neighbor);
          }
        }
        return visited;
      };

      const reachableFromEntry = reach(maze.entry, false);
      const canReachEntry = reach(maze.entry, true);
      const canReachExit = reach(maze.exit, true);

      for (const key of reachableFromEntry) {
        expect(canReachEntry.has(key)).toBe(true);
        expect(canReachExit.has(key)).toBe(true);
      }
    }
  });

  it('only places doors on strict straight corridors (never intersections or corners)', () => {
    const generator = new MazeGenerator();
    const spawner = new HazardSpawner();

    for (const [seed, mazeNumber] of [
      ['door-shape-a', 12],
      ['door-shape-b', 18],
      ['door-shape-c', 24],
      ['door-shape-d', 30],
    ] as const) {
      const maze = generator.generate(getMazeParams(seed, mazeNumber));
      const hazards = spawner.spawnHazards(maze);
      const doors = hazards.filter(
        (h) => h.type === 'one_way_door' || h.type === 'locked_door' || h.type === 'pressure_plate_door',
      );

      for (const door of doors) {
        const hasEast = maze.cells[door.tileY]?.[door.tileX + 1]?.type !== 'wall';
        const hasWest = maze.cells[door.tileY]?.[door.tileX - 1]?.type !== 'wall';
        const hasNorth = maze.cells[door.tileY - 1]?.[door.tileX]?.type !== 'wall';
        const hasSouth = maze.cells[door.tileY + 1]?.[door.tileX]?.type !== 'wall';
        const passableCount = [hasEast, hasWest, hasNorth, hasSouth].filter(Boolean).length;

        // Exactly two passable neighbors forming an opposite pair.
        expect(passableCount).toBe(2);
        expect((hasEast && hasWest) || (hasNorth && hasSouth)).toBe(true);
      }
    }
  });

  it('never lets any combination of closable doors strand the player', () => {
    const generator = new MazeGenerator();
    const spawner = new HazardSpawner();

    for (const [seed, mazeNumber] of [
      ['pressure-safe-a', 12],
      ['pressure-safe-b', 16],
      ['pressure-safe-c', 21],
      ['pressure-safe-d', 27],
      ['multi-door-a', 22],
      ['multi-door-b', 25],
      ['multi-door-c', 30],
    ] as const) {
      const maze = generator.generate(getMazeParams(seed, mazeNumber));
      const hazards = spawner.spawnHazards(maze);
      const doorsById = new Map(
        hazards.filter((h) => h.type === 'pressure_plate_door').map((h) => [h.id, h]),
      );
      const plates = hazards.filter((h) => h.type === 'pressure_plate');

      const isPassable = (x: number, y: number): boolean =>
        x >= 0 && y >= 0 && x < maze.width && y < maze.height && maze.cells[y][x].type !== 'wall';
      const isPortal = (x: number, y: number): boolean =>
        (x === maze.entry.x && y === maze.entry.y) || (x === maze.exit.x && y === maze.exit.y);

      // One-way doors modelled by their allowed travel direction.
      const oneWayByKey = new Map<string, string>();
      for (const h of hazards.filter((hz) => hz.type === 'one_way_door')) {
        oneWayByKey.set(tileKey({ x: h.tileX, y: h.tileY }), h.meta.allowedDirection as string);
      }
      const directionBetween = (from: TilePoint, to: TilePoint): string | null => {
        if (to.x > from.x) return 'east';
        if (to.x < from.x) return 'west';
        if (to.y > from.y) return 'south';
        if (to.y < from.y) return 'north';
        return null;
      };

      // Every door that blocks passage when shut (pressure + locked).
      const closable = new Set<string>();
      for (const h of hazards.filter((hz) => hz.type === 'pressure_plate_door' || hz.type === 'locked_door')) {
        closable.add(tileKey({ x: h.tileX, y: h.tileY }));
      }

      const reach = (start: TilePoint, reverse: boolean, blocked: Set<string>): Set<string> => {
        const visited = new Set<string>([tileKey(start)]);
        const queue: TilePoint[] = [start];
        while (queue.length > 0) {
          const cur = queue.shift()!;
          for (const step of CARDINAL_STEPS) {
            const n = { x: cur.x + step.x, y: cur.y + step.y };
            const k = tileKey(n);
            if (visited.has(k) || blocked.has(k) || !isPassable(n.x, n.y)) continue;
            // The forward edge is f -> t; a one-way door constrains the tile
            // being entered (t) by the direction of travel.
            const f = reverse ? n : cur;
            const t = reverse ? cur : n;
            const dir = oneWayByKey.get(tileKey(t));
            const allowed = dir ? dir === directionBetween(f, t) : true;
            if (!allowed) continue;
            visited.add(k);
            queue.push(n);
          }
        }
        return visited;
      };

      // Union invariant: from every tile reachable while all doors are open, the
      // player can still reach both entry and exit using routes that avoid ALL
      // closable doors at once (worst case: every door shut together).
      const reachableFromEntry = reach(maze.entry, false, new Set());
      const reliablyReachesEntry = reach(maze.entry, true, closable);
      const reliablyReachesExit = reach(maze.exit, true, closable);
      for (const key of reachableFromEntry) {
        if (closable.has(key)) continue;
        expect(reliablyReachesEntry.has(key)).toBe(true);
        expect(reliablyReachesExit.has(key)).toBe(true);
      }

      for (const plate of plates) {
        const door = doorsById.get(plate.meta.linkedDoorId)!;

        // #2: plate reaches its door without stepping on a portal tile.
        const target = tileKey({ x: door.tileX, y: door.tileY });
        const seen = new Set<string>([tileKey({ x: plate.tileX, y: plate.tileY })]);
        const q: TilePoint[] = [{ x: plate.tileX, y: plate.tileY }];
        let reached = false;
        while (q.length > 0) {
          const cur = q.shift()!;
          for (const step of CARDINAL_STEPS) {
            const n = { x: cur.x + step.x, y: cur.y + step.y };
            const k = tileKey(n);
            if (seen.has(k) || !isPassable(n.x, n.y)) continue;
            if (k === target) { reached = true; break; }
            if (isPortal(n.x, n.y)) continue;
            seen.add(k);
            q.push(n);
          }
          if (reached) break;
        }
        expect(reached).toBe(true);
      }
    }
  });
});
