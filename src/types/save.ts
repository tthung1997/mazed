import type { PlayerCharacterId } from '../game/rendering/AssetRegistry';

export interface SaveState {
  version: number;
  seed: string;
  playerCharacterId: PlayerCharacterId;
  currentMaze: number;
  unlockedTools: number;
  inventory: number[];
  completedMazes: number[];
  artifacts: number;
  playtime: number;
}

export type SaveErrorCode = 'invalid_format' | 'checksum_mismatch' | 'unsupported_version' | 'decode_failed';

export interface SaveError {
  code: SaveErrorCode;
  message: string;
}