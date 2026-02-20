import type { GameState } from '../../types/game';
import { DEFAULT_PLAYER_CHARACTER_ID } from '../rendering/AssetRegistry';

export function createInitialState(): GameState {
  return {
    version: 1,
    playerSeed: '',
    playerCharacterId: DEFAULT_PLAYER_CHARACTER_ID,
    currentMaze: 1,
    maze: null,
    completedMazes: [],
    unlockedToolsMask: 0,
    artifactsMask: 0,
    inventory: [],
    playtimeSeconds: 0,
    mazeFirstEntryTimes: {},
    mazeFirstCompletionTimes: {},
    runStatus: 'menu',
  };
}