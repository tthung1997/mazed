import type { MazeInstance } from './MazeTypes';

interface Point {
  x: number;
  y: number;
}

const DIRECTIONS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function hasPath(maze: MazeInstance): boolean {
  const queue: Point[] = [maze.entry];
  const visited = new Set<string>([`${maze.entry.x},${maze.entry.y}`]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.x === maze.exit.x && current.y === maze.exit.y) {
      return true;
    }

    for (const direction of DIRECTIONS) {
      const nextX = current.x + direction.x;
      const nextY = current.y + direction.y;

      if (nextX < 0 || nextY < 0 || nextX >= maze.width || nextY >= maze.height) {
        continue;
      }

      const key = `${nextX},${nextY}`;

      if (visited.has(key)) {
        continue;
      }

      const nextCell = maze.cells[nextY][nextX];

      if (nextCell.type === 'wall') {
        continue;
      }

      visited.add(key);
      queue.push({ x: nextX, y: nextY });
    }
  }

  return false;
}