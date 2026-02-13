import type { MazeInstance } from '../game/maze/MazeTypes';

export interface GameState {
  version: number;
  playerSeed: string;
  currentMaze: number;
  maze: MazeInstance | null;
  completedMazes: number[];
  unlockedToolsMask: number;
  artifactsMask: number;
  inventory: number[];
  playtimeSeconds: number;
  runStatus: 'menu' | 'playing' | 'transition' | 'paused';
}