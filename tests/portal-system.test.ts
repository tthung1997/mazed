import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PortalSystem } from '../src/game/systems/PortalSystem';

describe('PortalSystem', () => {
  it('triggers once while overlapping, then re-arms after leaving range', () => {
    const portal = new PortalSystem();
    const exitPos = new THREE.Vector3(0, 0, 0);

    const inside = new THREE.Vector3(0.2, 0, 0);
    const stillInside = new THREE.Vector3(0.3, 0, 0);
    const outside = new THREE.Vector3(1.0, 0, 0);

    expect(portal.checkExitOverlap(inside, exitPos)).toBe(true);
    expect(portal.checkExitOverlap(stillInside, exitPos)).toBe(false);

    expect(portal.checkExitOverlap(outside, exitPos)).toBe(false);
    expect(portal.checkExitOverlap(inside, exitPos)).toBe(true);
  });

  it('reset clears trigger lock immediately', () => {
    const portal = new PortalSystem();
    const exitPos = new THREE.Vector3(0, 0, 0);
    const inside = new THREE.Vector3(0.2, 0, 0);

    expect(portal.checkExitOverlap(inside, exitPos)).toBe(true);
    expect(portal.checkExitOverlap(inside, exitPos)).toBe(false);

    portal.reset();

    expect(portal.checkExitOverlap(inside, exitPos)).toBe(true);
  });
});
