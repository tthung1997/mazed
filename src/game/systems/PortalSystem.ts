import * as THREE from 'three';

export class PortalSystem {
  private hasTriggered = false;

  reset(): void {
    this.hasTriggered = false;
  }

  checkExitOverlap(playerPos: THREE.Vector3, exitPos: THREE.Vector3): boolean {
    const distance = playerPos.distanceTo(exitPos);

    if (distance < 0.45 && !this.hasTriggered) {
      this.hasTriggered = true;
      return true;
    }

    if (distance > 0.8) {
      this.hasTriggered = false;
    }

    return false;
  }
}