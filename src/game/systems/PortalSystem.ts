import * as THREE from 'three';

export type PortalId = 'forward' | 'backward';

export class PortalSystem {
  private readonly triggeredByPortal: Record<PortalId, boolean> = {
    forward: false,
    backward: false,
  };

  reset(): void {
    this.triggeredByPortal.forward = false;
    this.triggeredByPortal.backward = false;
  }

  checkExitOverlap(playerPos: THREE.Vector3, exitPos: THREE.Vector3): boolean {
    return this.checkOverlap('forward', playerPos, exitPos);
  }

  checkBackOverlap(playerPos: THREE.Vector3, backPos: THREE.Vector3): boolean {
    return this.checkOverlap('backward', playerPos, backPos);
  }

  prime(portalId: PortalId): void {
    this.triggeredByPortal[portalId] = true;
  }

  private checkOverlap(portalId: PortalId, playerPos: THREE.Vector3, portalPos: THREE.Vector3): boolean {
    const distance = playerPos.distanceTo(portalPos);

    if (distance < 0.45 && !this.triggeredByPortal[portalId]) {
      this.triggeredByPortal[portalId] = true;
      return true;
    }

    if (distance > 0.8) {
      this.triggeredByPortal[portalId] = false;
    }

    return false;
  }
}