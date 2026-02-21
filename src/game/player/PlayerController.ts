import * as THREE from 'three';
import type { MazeInstance } from '../maze/MazeTypes';
import { PLAYER_RADIUS, PLAYER_SPEED } from '../core/constants';
import { PlayerMotor } from './PlayerMotor';

export class PlayerController {
  readonly position = new THREE.Vector3(0.5, 0.35, 0.5);
  readonly velocity = new THREE.Vector3();

  private readonly motor = new PlayerMotor();

  placeAtTile(tileX: number, tileY: number): void {
    this.position.set(tileX + 0.5, 0.35, tileY + 0.5);
    this.velocity.set(0, 0, 0);
  }

  update(inputDirection: THREE.Vector2, dt: number, maze: MazeInstance, speedMultiplier = 1): void {
    this.velocity.set(inputDirection.x * PLAYER_SPEED * speedMultiplier, 0, inputDirection.y * PLAYER_SPEED * speedMultiplier);
    this.motor.move(this.position, this.velocity, dt, maze, PLAYER_RADIUS);
  }
}