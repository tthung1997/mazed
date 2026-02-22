import { describe, expect, it } from 'vitest';
import { HazardSystem } from '../src/game/systems/HazardSystem';
import type { HazardInstance } from '../src/types/hazards';

function createSystemWithHazards(hazards: HazardInstance[]): HazardSystem {
  const system = new HazardSystem();
  system.loadMaze(hazards);
  return system;
}

describe('HazardSystem', () => {
  it('blocks one-way door movement from forbidden direction and allows the configured direction', () => {
    const system = createSystemWithHazards([
      {
        id: 'h1',
        type: 'one_way_door',
        tileX: 2,
        tileY: 2,
        meta: { allowedDirection: 'east' },
      },
    ]);

    const blocked = system.checkPassThrough(
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      'south',
      {
        hasSkeletonKey: false,
        consumeSkeletonKey: () => {
          throw new Error('unexpected key consumption');
        },
      },
    );

    const allowed = system.checkPassThrough(
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      'east',
      {
        hasSkeletonKey: false,
        consumeSkeletonKey: () => {
          throw new Error('unexpected key consumption');
        },
      },
    );

    expect(blocked).toBe(false);
    expect(allowed).toBe(true);
  });

  it('opens locked door with skeleton key, consumes key once, and then remains passable', () => {
    const system = createSystemWithHazards([
      {
        id: 'h2',
        type: 'locked_door',
        tileX: 3,
        tileY: 3,
        meta: { requiresKey: true, open: false },
      },
    ]);

    let consumedCount = 0;

    const firstPass = system.checkPassThrough(
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      'east',
      {
        hasSkeletonKey: true,
        consumeSkeletonKey: () => {
          consumedCount += 1;
        },
      },
    );

    const secondPass = system.checkPassThrough(
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      'east',
      {
        hasSkeletonKey: false,
        consumeSkeletonKey: () => {
          consumedCount += 1;
        },
      },
    );

    expect(firstPass).toBe(true);
    expect(secondPass).toBe(true);
    expect(consumedCount).toBe(1);
  });

  it('blocks locked door when no skeleton key is available', () => {
    const system = createSystemWithHazards([
      {
        id: 'h3',
        type: 'locked_door',
        tileX: 4,
        tileY: 4,
        meta: { requiresKey: true, open: false },
      },
    ]);

    const canPass = system.checkPassThrough(
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      'east',
      {
        hasSkeletonKey: false,
        consumeSkeletonKey: () => {
          throw new Error('unexpected key consumption');
        },
      },
    );

    expect(canPass).toBe(false);
  });
});
