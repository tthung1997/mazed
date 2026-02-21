import type { GameState } from '../../types/game';
import { DEFAULT_PLAYER_CHARACTER_ID } from '../rendering/AssetRegistry';

export function createInitialState(): GameState {
  return {
    version: 2,
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
    activeToolId: null,
    activeToolEndTime: null,
    collectedShards: 0,
    mazeItemState: {},
    portalHubUnlocked: false,
    runStatus: 'menu',
  };
}