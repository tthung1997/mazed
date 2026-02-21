import { describe, expect, it } from 'vitest';
import { SaveCodec } from '../src/utils/saveCode';
import { makeChecksum } from '../src/utils/checksum';
import type { SaveState } from '../src/types/save';
import { DEFAULT_PLAYER_CHARACTER_ID } from '../src/game/rendering/AssetRegistry';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function bytesToBase62Pairs(bytes: Uint8Array): string {
  let output = '';

  for (const byte of bytes) {
    const high = Math.floor(byte / 62);
    const low = byte % 62;
    output += ALPHABET[high] + ALPHABET[low];
  }

  return output;
}

function encodeCustomPayload(raw: unknown): string {
  const json = JSON.stringify(raw);
  const bytes = new TextEncoder().encode(json);
  const payload = bytesToBase62Pairs(bytes);
  const checksum = makeChecksum(payload);
  return `MAZED-${payload}-${checksum}`;
}

describe('SaveCodec', () => {
  it('roundtrips a valid save state', () => {
    const state: SaveState = {
      version: 2,
      seed: 'abc123',
      playerCharacterId: 'character_female_1',
      currentMaze: 7,
      unlockedTools: 3,
      inventory: [1, 2],
      completedMazes: [1, 2, 3, 4, 5, 6],
      artifacts: 2,
      playtime: 128,
      mazeFirstEntryTimes: { 1: 0, 2: 30, 7: 115 },
      mazeFirstCompletionTimes: { 1: 12, 2: 25, 3: 48 },
      activeToolId: 'basic_torch',
      activeToolExpiry: 123456,
      collectedShards: 9,
      pickedUpItems: { '7': ['item_7_0'] },
      portalHubUnlocked: true,
    };

    const code = SaveCodec.encode(state);
    const decoded = SaveCodec.decode(code);

    expect(decoded.ok).toBe(true);

    if (decoded.ok) {
      expect(decoded.value).toEqual({ ...state, version: 2 });
    }
  });

  it('rejects invalid format and checksum mismatch', () => {
    const state: SaveState = {
      version: 2,
      seed: 'seed-z',
      playerCharacterId: 'character_male_2',
      currentMaze: 2,
      unlockedTools: 0,
      inventory: [],
      completedMazes: [1],
      artifacts: 0,
      playtime: 5,
      mazeFirstEntryTimes: { 1: 0, 2: 5 },
      mazeFirstCompletionTimes: { 1: 4 },
      activeToolId: null,
      activeToolExpiry: null,
      collectedShards: 0,
      pickedUpItems: {},
      portalHubUnlocked: false,
    };

    const validCode = SaveCodec.encode(state);
    const tampered = `${validCode.slice(0, -1)}${validCode.endsWith('A') ? 'B' : 'A'}`;

    const invalidFormat = SaveCodec.decode('NOT-A-SAVE-CODE');
    const invalidChecksum = SaveCodec.decode(tampered);

    expect(invalidFormat.ok).toBe(false);
    if (!invalidFormat.ok) {
      expect(invalidFormat.error.code).toBe('invalid_format');
    }

    expect(invalidChecksum.ok).toBe(false);
    if (!invalidChecksum.ok) {
      expect(invalidChecksum.error.code).toBe('checksum_mismatch');
    }
  });

  it('rejects unsupported versions with valid payload checksum', () => {
    const code = encodeCustomPayload({
      version: 3,
      seed: 'future-seed',
      playerCharacterId: 'character_male_1',
      currentMaze: 11,
      unlockedTools: 0,
      inventory: [],
      completedMazes: [],
      artifacts: 0,
      playtime: 0,
      mazeFirstEntryTimes: {},
      mazeFirstCompletionTimes: {},
      activeToolId: null,
      activeToolExpiry: null,
      collectedShards: 0,
      pickedUpItems: {},
      portalHubUnlocked: false,
    });

    const decoded = SaveCodec.decode(code);

    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.error.code).toBe('unsupported_version');
    }
  });

  it('defaults character when loading old payload without playerCharacterId', () => {
    const code = encodeCustomPayload({
      version: 1,
      seed: 'legacy-seed',
      currentMaze: 3,
      unlockedTools: 0,
      inventory: [],
      completedMazes: [1, 2],
      artifacts: 0,
      playtime: 42,
    });

    const decoded = SaveCodec.decode(code);

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.playerCharacterId).toBe(DEFAULT_PLAYER_CHARACTER_ID);
      expect(decoded.value.version).toBe(2);
      expect(decoded.value.mazeFirstEntryTimes).toEqual({});
      expect(decoded.value.mazeFirstCompletionTimes).toEqual({});
      expect(decoded.value.portalHubUnlocked).toBe(false);
      expect(decoded.value.pickedUpItems).toEqual({});
    }
  });
});
