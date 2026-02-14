import { describe, expect, it } from 'vitest';
import { VisibilitySystem } from '../src/game/systems/VisibilitySystem';
import type { MazeCell, MazeInstance } from '../src/game/maze/MazeTypes';

function makeMaze(rows: string[]): MazeInstance {
  const height = rows.length;
  const width = rows[0].length;
  const cells: MazeCell[][] = [];
  let entry = { x: 0, y: 0 };
  let exit = { x: 0, y: 0 };

  for (let y = 0; y < height; y += 1) {
    const row: MazeCell[] = [];

    for (let x = 0; x < width; x += 1) {
      const tile = rows[y][x];
      const type =
        tile === '#'
          ? 'wall'
          : tile === 'E'
            ? 'entry'
            : tile === 'X'
              ? 'exit'
              : 'floor';

      if (type === 'entry') {
        entry = { x, y };
      }

      if (type === 'exit') {
        exit = { x, y };
      }

      row.push({
        x,
        y,
        type,
        explored: false,
        currentlyVisible: false,
      });
    }

    cells.push(row);
  }

  return {
    mazeNumber: 1,
    width,
    height,
    seed: 'visibility-test',
    cells,
    entry,
    exit,
  };
}

describe('VisibilitySystem', () => {
  it('does not reveal tiles blocked by walls in LOS', () => {
    const system = new VisibilitySystem();
    const maze = makeMaze([
      '#######',
      '#E.#.X#',
      '#.....#',
      '#######',
    ]);

    system.update({ x: 1, y: 1 }, maze, 6);

    expect(maze.cells[1][5].currentlyVisible).toBe(false);
    expect(maze.cells[1][5].explored).toBe(false);
    expect(maze.cells[1][2].currentlyVisible).toBe(true);
  });

  it('transitions visible tiles to explored memory when leaving range', () => {
    const system = new VisibilitySystem();
    const maze = makeMaze([
      '#####',
      '#E..#',
      '#...#',
      '#..X#',
      '#####',
    ]);

    system.update({ x: 1, y: 1 }, maze, 2);
    expect(maze.cells[1][2].currentlyVisible).toBe(true);
    expect(maze.cells[1][2].explored).toBe(true);

    const result = system.update({ x: 3, y: 3 }, maze, 1);

    expect(maze.cells[1][2].currentlyVisible).toBe(false);
    expect(maze.cells[1][2].explored).toBe(true);
    expect(result.changedTiles.length).toBeGreaterThan(0);
  });
});
