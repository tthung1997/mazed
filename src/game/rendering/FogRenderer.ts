import type { MazeCell, MazeInstance } from '../maze/MazeTypes';
import type { MazeRenderData } from './MazeBuilder';

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function opacityForCell(cell: MazeCell): number {
  if (cell.currentlyVisible) {
    return 1;
  }

  if (cell.explored) {
    return 0.2;
  }

  return 0;
}

export class FogRenderer {
  applyFull(maze: { width: number; height: number; cells: MazeCell[][] }, renderData: MazeRenderData): void {
    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        this.applyTile(maze.cells[y][x], renderData);
      }
    }
  }

  applyDirty(changedTiles: Array<{ x: number; y: number }>, mazeCells: MazeCell[][], renderData: MazeRenderData): void {
    for (const tile of changedTiles) {
      this.applyTile(mazeCells[tile.y][tile.x], renderData);
    }
  }

  applyExitVisibility(maze: MazeInstance, renderData: MazeRenderData): void {
    const exitCell = maze.cells[maze.exit.y][maze.exit.x];
    if (renderData.exitVisual) {
      renderData.exitMarker.visible = false;
      renderData.exitVisual.visible = exitCell.currentlyVisible;
      return;
    }

    renderData.exitMarker.visible = exitCell.currentlyVisible;
  }

  private applyTile(cell: MazeCell, renderData: MazeRenderData): void {
    const visuals = renderData.tileVisuals.get(tileKey(cell.x, cell.y));

    if (!visuals) {
      return;
    }

    const opacity = opacityForCell(cell);
    const showFloor = cell.type !== 'wall' && opacity > 0;
    if (visuals.floor) {
      visuals.floor.visible = showFloor;
    }

    if (cell.type !== 'wall') {
      for (const material of visuals.floorMaterials ?? []) {
        material.opacity = opacity;
      }
    }

    if (visuals.wall) {
      visuals.wall.visible = opacity > 0;
      for (const material of visuals.wallMaterials ?? []) {
        material.opacity = opacity;
      }
    }
  }
}