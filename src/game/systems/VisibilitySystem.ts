import type { MazeInstance } from '../maze/MazeTypes';

export interface DirtyVisibilityResult {
  changedTiles: Array<{ x: number; y: number }>;
}

function inRadius(dx: number, dy: number, radius: number): boolean {
  return dx * dx + dy * dy <= radius * radius;
}

function isWallOrOut(maze: MazeInstance, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= maze.width || y >= maze.height) {
    return true;
  }

  return maze.cells[y][x].type === 'wall';
}

function hasLineOfSight(maze: MazeInstance, fromX: number, fromY: number, toX: number, toY: number): boolean {
  if (fromX === toX && fromY === toY) {
    return true;
  }

  const startX = fromX + 0.5;
  const startY = fromY + 0.5;
  const endX = toX + 0.5;
  const endY = toY + 0.5;

  const dirX = endX - startX;
  const dirY = endY - startY;

  const stepX = dirX === 0 ? 0 : dirX > 0 ? 1 : -1;
  const stepY = dirY === 0 ? 0 : dirY > 0 ? 1 : -1;

  const invDirX = dirX === 0 ? Number.POSITIVE_INFINITY : 1 / Math.abs(dirX);
  const invDirY = dirY === 0 ? Number.POSITIVE_INFINITY : 1 / Math.abs(dirY);

  let currentX = fromX;
  let currentY = fromY;

  let nextBoundaryX = stepX > 0 ? currentX + 1 : currentX;
  let nextBoundaryY = stepY > 0 ? currentY + 1 : currentY;

  let tMaxX =
    stepX === 0
      ? Number.POSITIVE_INFINITY
      : Math.abs((nextBoundaryX - startX) / dirX);
  let tMaxY =
    stepY === 0
      ? Number.POSITIVE_INFINITY
      : Math.abs((nextBoundaryY - startY) / dirY);

  while (!(currentX === toX && currentY === toY)) {
    if (tMaxX < tMaxY) {
      currentX += stepX;
      tMaxX += invDirX;
    } else if (tMaxY < tMaxX) {
      currentY += stepY;
      tMaxY += invDirY;
    } else {
      const sideA = { x: currentX + stepX, y: currentY };
      const sideB = { x: currentX, y: currentY + stepY };

      if (
        (sideA.x !== toX || sideA.y !== toY) &&
        (sideB.x !== toX || sideB.y !== toY) &&
        (isWallOrOut(maze, sideA.x, sideA.y) || isWallOrOut(maze, sideB.x, sideB.y))
      ) {
        return false;
      }

      currentX += stepX;
      currentY += stepY;
      tMaxX += invDirX;
      tMaxY += invDirY;
    }

    if ((currentX !== toX || currentY !== toY) && isWallOrOut(maze, currentX, currentY)) {
      return false;
    }
  }

  return true;
}

export class VisibilitySystem {
  update(playerTile: { x: number; y: number }, maze: MazeInstance, radius: number): DirtyVisibilityResult {
    const changedTiles: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        const cell = maze.cells[y][x];
        const wasVisible = cell.currentlyVisible;
        const visible =
          inRadius(x - playerTile.x, y - playerTile.y, radius) &&
          hasLineOfSight(maze, playerTile.x, playerTile.y, x, y);

        if (visible) {
          cell.explored = true;
        }

        if (wasVisible !== visible) {
          cell.currentlyVisible = visible;
          changedTiles.push({ x, y });
        }
      }
    }

    return { changedTiles };
  }
}