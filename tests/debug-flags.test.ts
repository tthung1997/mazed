import { describe, expect, it } from 'vitest';
import { parseDebugStartMaze } from '../src/utils/debugFlags';

describe('parseDebugStartMaze', () => {
  it('parses a positive maze number in development mode', () => {
    expect(parseDebugStartMaze('?debugStartMaze=7', true)).toBe(7);
  });

  it('returns null when parameter is missing', () => {
    expect(parseDebugStartMaze('?foo=bar', true)).toBeNull();
  });

  it('returns null for invalid values', () => {
    expect(parseDebugStartMaze('?debugStartMaze=0', true)).toBeNull();
    expect(parseDebugStartMaze('?debugStartMaze=-1', true)).toBeNull();
    expect(parseDebugStartMaze('?debugStartMaze=2.5', true)).toBeNull();
    expect(parseDebugStartMaze('?debugStartMaze=abc', true)).toBeNull();
  });

  it('returns null outside development mode', () => {
    expect(parseDebugStartMaze('?debugStartMaze=12', false)).toBeNull();
  });
});
