import type { SaveError, SaveState } from '../types/save';
import { makeChecksum } from './checksum';
import { DEFAULT_PLAYER_CHARACTER_ID, isPlayerCharacterId } from '../game/rendering/AssetRegistry';

const PREFIX = 'MAZED';
const VERSION = 1;
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

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

    const value = parsed as Partial<SaveState>;

    if (value.version !== VERSION) {
      return invalid('Code version not supported', 'unsupported_version');
    }

    if (typeof value.seed !== 'string' || typeof value.currentMaze !== 'number') {
      return invalid('Code format is invalid', 'decode_failed');
    }

    return {
      ok: true,
      value: {
        version: VERSION,
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
      },
    };
  },
};