import * as THREE from 'three';

export class CameraController {
  private readonly desired = new THREE.Vector3();

  update(camera: THREE.PerspectiveCamera, target: THREE.Vector3, dt: number, visibilityRadius: number): void {
    const baseRadius = 3;
    const zoomScale = visibilityRadius / baseRadius;
    const distance = THREE.MathUtils.clamp(4.1 * zoomScale, 3.2, 9.5);

    this.desired.set(target.x, target.y + distance, target.z + distance);
    camera.position.lerp(this.desired, 1 - Math.exp(-8 * dt));
    camera.lookAt(target.x, 0, target.z);
  }
}