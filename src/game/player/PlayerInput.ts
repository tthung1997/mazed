import * as THREE from 'three';

export class PlayerInput {
  private readonly keys = new Set<string>();
  private readonly vector = new THREE.Vector2();

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  getMovementVector(): THREE.Vector2 {
    let x = 0;
    let y = 0;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      x -= 1;
    }

    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      x += 1;
    }

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      y -= 1;
    }

    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      y += 1;
    }

    this.vector.set(x, y);

    if (this.vector.lengthSq() > 1) {
      this.vector.normalize();
    }

    return this.vector;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };
}