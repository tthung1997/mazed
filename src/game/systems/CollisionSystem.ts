import type { MazeInstance } from '../maze/MazeTypes';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class CollisionSystem {
  static isWall(maze: MazeInstance, tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= maze.width || tileY >= maze.height) {
      return true;
    }

    return maze.cells[tileY][tileX].type === 'wall';
  }

  static collidesWithWalls(maze: MazeInstance, worldX: number, worldZ: number, radius: number): boolean {
    const minX = Math.floor(worldX - radius);
    const maxX = Math.floor(worldX + radius);
    const minY = Math.floor(worldZ - radius);
    const maxY = Math.floor(worldZ + radius);

    for (let tileY = minY; tileY <= maxY; tileY += 1) {
      for (let tileX = minX; tileX <= maxX; tileX += 1) {
        if (!CollisionSystem.isWall(maze, tileX, tileY)) {
          continue;
        }

        const closestX = clamp(worldX, tileX, tileX + 1);
        const closestZ = clamp(worldZ, tileY, tileY + 1);
        const dx = worldX - closestX;
        const dz = worldZ - closestZ;

        if (dx * dx + dz * dz < radius * radius) {
          return true;
        }
      }
    }

    return false;
  }
}