import type { MazeItemSpawn } from '../../types/items';
import type { HazardInstance } from '../../types/hazards';

export type CellType = 'wall' | 'floor' | 'entry' | 'exit';

export interface MazeCell {
  x: number;
  y: number;
  type: CellType;
  explored: boolean;
  currentlyVisible: boolean;
}

export interface MazeInstance {
  mazeNumber: number;
  width: number;
  height: number;
  seed: string;
  cells: MazeCell[][];
  entry: { x: number; y: number };
  exit: { x: number; y: number };
  itemSpawns?: MazeItemSpawn[];
  hazards?: HazardInstance[];
}

export interface MazeParams {
  mazeNumber: number;
  width: number;
  height: number;
  seed: string;
  complexity: number;
  deadEndRatio: number;
  loopChance: number;
  roomChance: number;
}