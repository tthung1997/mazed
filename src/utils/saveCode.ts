import type { SaveError, SaveState } from '../types/save';
import type { ToolId } from '../types/items';
import { isImplementedToolId } from '../types/items';
import { makeChecksum } from './checksum';
import { DEFAULT_PLAYER_CHARACTER_ID, isPlayerCharacterId } from '../game/rendering/AssetRegistry';

const PREFIX = 'MAZED';
const VERSION = 2;
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

type LegacySaveStateV1 = Omit<SaveState, 'version' | 'activeToolId' | 'activeToolExpiry' | 'collectedShards' | 'pickedUpItems' | 'portalHubUnlocked'> & {
  version: 1;
};

interface SaveSuccess {
  ok: true;
  value: SaveState;
}

interface SaveFailure {
  ok: false;
  error: SaveError;
}

export type SaveDecodeResult = SaveSuccess | SaveFailure;

function sanitizeMazeTimingMap(value: unknown): Record<number, number> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const output: Record<number, number> = {};

  for (const [key, rawSeconds] of Object.entries(value)) {
    const mazeNumber = Number(key);

    if (!Number.isInteger(mazeNumber) || mazeNumber <= 0) {
      continue;
    }

    if (typeof rawSeconds !== 'number' || !Number.isFinite(rawSeconds) || rawSeconds < 0) {
      continue;
    }

    output[mazeNumber] = Math.floor(rawSeconds);
  }

  return output;
}

function bytesToBase62Pairs(bytes: Uint8Array): string {
  let output = '';

  for (const byte of bytes) {
    const high = Math.floor(byte / 62);
    const low = byte % 62;
    output += ALPHABET[high] + ALPHABET[low];
  }

  return output;
}

function base62PairsToBytes(encoded: string): Uint8Array | null {
  if (encoded.length % 2 !== 0) {
    return null;
  }

  const bytes = new Uint8Array(encoded.length / 2);

  for (let i = 0; i < encoded.length; i += 2) {
    const high = ALPHABET.indexOf(encoded[i]);
    const low = ALPHABET.indexOf(encoded[i + 1]);

    if (high < 0 || low < 0) {
      return null;
    }

    bytes[i / 2] = high * 62 + low;
  }

  return bytes;
}

function invalid(message: string, code: SaveError['code']): SaveFailure {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function sanitizePickedUpItems(value: unknown): Record<string, string[]> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const output: Record<string, string[]> = {};

  for (const [maze, ids] of Object.entries(value)) {
    if (!Array.isArray(ids)) {
      continue;
    }

    const sanitized = ids.filter((id): id is string => typeof id === 'string');
    if (sanitized.length > 0) {
      output[maze] = sanitized;
    }
  }

  return output;
}

function sanitizeToolId(value: unknown): ToolId | null {
  if (typeof value !== 'string') {
    return null;
  }

  return isImplementedToolId(value) ? value : null;
}

function migrateSaveState(value: Partial<SaveState> & { version?: number }): SaveState | null {
  if (typeof value.seed !== 'string' || typeof value.currentMaze !== 'number') {
    return null;
  }

  if (value.version !== 1 && value.version !== 2) {
    return null;
  }

  const base = {
    seed: value.seed,
    playerCharacterId:
      typeof value.playerCharacterId === 'string' && isPlayerCharacterId(value.playerCharacterId)
        ? value.playerCharacterId
        : DEFAULT_PLAYER_CHARACTER_ID,
    currentMaze: value.currentMaze,
    unlockedTools: value.unlockedTools ?? 0,
    inventory: value.inventory ?? [],
    completedMazes: value.completedMazes ?? [],
    artifacts: value.artifacts ?? 0,
    playtime: value.playtime ?? 0,
    mazeFirstEntryTimes: sanitizeMazeTimingMap(value.mazeFirstEntryTimes),
    mazeFirstCompletionTimes: sanitizeMazeTimingMap(value.mazeFirstCompletionTimes),
  };

  if (value.version === 1) {
    return {
      version: VERSION,
      ...base,
      activeToolId: null,
      activeToolExpiry: null,
      collectedShards: 0,
      pickedUpItems: {},
      portalHubUnlocked: false,
    };
  }

  return {
    version: VERSION,
    ...base,
    activeToolId: sanitizeToolId(value.activeToolId),
    activeToolExpiry: typeof value.activeToolExpiry === 'number' && Number.isFinite(value.activeToolExpiry) ? Math.floor(value.activeToolExpiry) : null,
    collectedShards: typeof value.collectedShards === 'number' && Number.isFinite(value.collectedShards) ? Math.max(0, Math.floor(value.collectedShards)) : 0,
    pickedUpItems: sanitizePickedUpItems(value.pickedUpItems),
    portalHubUnlocked: Boolean(value.portalHubUnlocked),
  };
}

export const SaveCodec = {
  encode(state: SaveState): string {
    const payload: SaveState = {
      ...state,
      version: VERSION,
    };

    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    const encodedPayload = bytesToBase62Pairs(bytes);
    const checksum = makeChecksum(encodedPayload);

    return `${PREFIX}-${encodedPayload}-${checksum}`;
  },

  decode(code: string): SaveDecodeResult {
    const trimmed = code.trim();
    const match = /^MAZED-([A-Za-z0-9]+)-([A-Za-z0-9]{6})$/.exec(trimmed);

    if (!match) {
      return invalid('Code format is invalid', 'invalid_format');
    }

    const [, payload, checksum] = match;
    const expected = makeChecksum(payload);

    if (checksum !== expected) {
      return invalid('Code failed validation', 'checksum_mismatch');
    }

    const bytes = base62PairsToBytes(payload);

    if (!bytes) {
      return invalid('Code format is invalid', 'invalid_format');
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return invalid('Code format is invalid', 'decode_failed');
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return invalid('Code format is invalid', 'decode_failed');
    }

    const value = parsed as Partial<SaveState> | LegacySaveStateV1;

    if (typeof value.version !== 'number' || value.version > VERSION || value.version < 1) {
      return invalid('Code version not supported', 'unsupported_version');
    }

    const migrated = migrateSaveState(value as Partial<SaveState> & { version?: number });

    if (!migrated) {
      return invalid('Code format is invalid', 'decode_failed');
    }

    return {
      ok: true,
      value: migrated,
    };
  },
};