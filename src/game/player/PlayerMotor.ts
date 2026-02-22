import * as THREE from 'three';
import type { MazeInstance } from '../maze/MazeTypes';
import { CollisionSystem } from '../systems/CollisionSystem';
import type { CardinalDirection } from '../../types/hazards';
import type { MoveGate } from './PlayerController';

function getDirection(fromTile: { x: number; y: number }, toTile: { x: number; y: number }): CardinalDirection | null {
  if (toTile.x > fromTile.x) {
    return 'east';
  }

  if (toTile.x < fromTile.x) {
    return 'west';
  }

  if (toTile.y > fromTile.y) {
    return 'south';
  }

  if (toTile.y < fromTile.y) {
    return 'north';
  }

  return null;
}

export class PlayerMotor {
  move(position: THREE.Vector3, velocity: THREE.Vector3, dt: number, maze: MazeInstance, radius: number, moveGate?: MoveGate): void {
    const fromXTile = { x: Math.floor(position.x), y: Math.floor(position.z) };
    const tryX = position.x + velocity.x * dt;
    const toXTile = { x: Math.floor(tryX), y: Math.floor(position.z) };
    const canMoveX = (() => {
      if (!moveGate) {
        return true;
      }

      const direction = getDirection(fromXTile, toXTile);
      if (!direction) {
        return true;
      }

      return moveGate(fromXTile, toXTile, direction);
    })();

    if (canMoveX && !CollisionSystem.collidesWithWalls(maze, tryX, position.z, radius)) {
      position.x = tryX;
    }

    const fromZTile = { x: Math.floor(position.x), y: Math.floor(position.z) };
    const tryZ = position.z + velocity.z * dt;
    const toZTile = { x: Math.floor(position.x), y: Math.floor(tryZ) };
    const canMoveZ = (() => {
      if (!moveGate) {
        return true;
      }

      const direction = getDirection(fromZTile, toZTile);
      if (!direction) {
        return true;
      }

      return moveGate(fromZTile, toZTile, direction);
    })();

    if (canMoveZ && !CollisionSystem.collidesWithWalls(maze, position.x, tryZ, radius)) {
      position.z = tryZ;
    }
  }
}