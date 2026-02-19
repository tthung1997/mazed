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

  it('tracks forward and backward portals independently', () => {
    const portal = new PortalSystem();
    const forwardPos = new THREE.Vector3(0, 0, 0);
    const backwardPos = new THREE.Vector3(1, 0, 0);

    expect(portal.checkExitOverlap(new THREE.Vector3(0.2, 0, 0), forwardPos)).toBe(true);
    expect(portal.checkExitOverlap(new THREE.Vector3(0.2, 0, 0), forwardPos)).toBe(false);

    expect(portal.checkBackOverlap(new THREE.Vector3(1.2, 0, 0), backwardPos)).toBe(true);
    expect(portal.checkBackOverlap(new THREE.Vector3(1.2, 0, 0), backwardPos)).toBe(false);
  });

  it('prime blocks trigger until leaving reset distance', () => {
    const portal = new PortalSystem();
    const backPos = new THREE.Vector3(0, 0, 0);
    const inside = new THREE.Vector3(0.1, 0, 0);
    const outside = new THREE.Vector3(1.0, 0, 0);

    portal.prime('backward');

    expect(portal.checkBackOverlap(inside, backPos)).toBe(false);
    expect(portal.checkBackOverlap(outside, backPos)).toBe(false);
    expect(portal.checkBackOverlap(inside, backPos)).toBe(true);
  });
});
