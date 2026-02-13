import * as THREE from 'three';
import type { MazeInstance } from '../maze/MazeTypes';
import { CollisionSystem } from '../systems/CollisionSystem';

export class PlayerMotor {
  move(position: THREE.Vector3, velocity: THREE.Vector3, dt: number, maze: MazeInstance, radius: number): void {
    const tryX = position.x + velocity.x * dt;

    if (!CollisionSystem.collidesWithWalls(maze, tryX, position.z, radius)) {
      position.x = tryX;
    }

    const tryZ = position.z + velocity.z * dt;

    if (!CollisionSystem.collidesWithWalls(maze, position.x, tryZ, radius)) {
      position.z = tryZ;
    }
  }
}