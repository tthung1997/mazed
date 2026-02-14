import { describe, expect, it } from 'vitest';
import { hasPath } from '../src/game/maze/PathValidation';
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
    seed: 'test',
    cells,
    entry,
    exit,
  };
}

describe('hasPath', () => {
  it('returns true when a route exists', () => {
    const maze = makeMaze([
      '#####',
      '#E..#',
      '#.#X#',
      '#...#',
      '#####',
    ]);

    expect(hasPath(maze)).toBe(true);
  });

  it('returns false when exit is fully blocked', () => {
    const maze = makeMaze([
      '#####',
      '#E#X#',
      '#####',
    ]);

    expect(hasPath(maze)).toBe(false);
  });
});
