import type { MazeInstance } from '../game/maze/MazeTypes';
import type { PlayerCharacterId } from '../game/rendering/AssetRegistry';

export interface GameState {
  version: number;
  playerSeed: string;
  playerCharacterId: PlayerCharacterId;
  currentMaze: number;
  maze: MazeInstance | null;
  completedMazes: number[];
  unlockedToolsMask: number;
  artifactsMask: number;
  inventory: number[];
  playtimeSeconds: number;
  runStatus: 'menu' | 'playing' | 'transition' | 'paused';
}