import type { GameState } from '../../types/game';

export function createInitialState(): GameState {
  return {
    version: 1,
    playerSeed: '',
    currentMaze: 1,
    maze: null,
    completedMazes: [],
    unlockedToolsMask: 0,
    artifactsMask: 0,
    inventory: [],
    playtimeSeconds: 0,
    runStatus: 'menu',
  };
}