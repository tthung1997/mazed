import type { PlayerCharacterId } from '../game/rendering/AssetRegistry';
import type { ToolId } from './items';

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
  mazeFirstEntryTimes: Record<number, number>;
  mazeFirstCompletionTimes: Record<number, number>;
  activeToolId: ToolId | null;
  activeToolExpiry: number | null;
  collectedShards: number;
  pickedUpItems: Record<string, string[]>;
  portalHubUnlocked: boolean;
}

export type SaveErrorCode = 'invalid_format' | 'checksum_mismatch' | 'unsupported_version' | 'decode_failed';

export interface SaveError {
  code: SaveErrorCode;
  message: string;
}