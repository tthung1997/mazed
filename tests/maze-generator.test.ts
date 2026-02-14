import { describe, expect, it } from 'vitest';
import { MazeGenerator } from '../src/game/maze/MazeGenerator';
import { getMazeParams } from '../src/game/maze/Difficulty';
import { hasPath } from '../src/game/maze/PathValidation';

function serializeMazeTypes(cells: Array<Array<{ type: string }>>): string {
  return cells
    .map((row) => row.map((cell) => cell.type[0]).join(''))
    .join('\n');
}

describe('MazeGenerator', () => {
  it('generates deterministic layouts for the same params', () => {
    const generator = new MazeGenerator();
    const params = getMazeParams('player-seed-a', 6);

    const mazeA = generator.generate(params);
    const mazeB = generator.generate(params);

    expect(mazeA.entry).toEqual(mazeB.entry);
    expect(mazeA.exit).toEqual(mazeB.exit);
    expect(serializeMazeTypes(mazeA.cells)).toEqual(serializeMazeTypes(mazeB.cells));
  });

  it('always generates a solvable maze with valid entry and exit', () => {
    const generator = new MazeGenerator();

    for (let mazeNumber = 1; mazeNumber <= 12; mazeNumber += 1) {
      const params = getMazeParams('player-seed-b', mazeNumber);
      const maze = generator.generate(params);

      expect(maze.cells[maze.entry.y][maze.entry.x].type).toBe('entry');
      expect(maze.cells[maze.exit.y][maze.exit.x].type).toBe('exit');
      expect(hasPath(maze)).toBe(true);
    }
  });
});
