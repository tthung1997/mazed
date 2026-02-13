import * as THREE from 'three';
import type { MazeInstance, MazeCell } from '../maze/MazeTypes';

export interface MazeRenderData {
  root: THREE.Group;
  tileVisuals: Map<string, { floor: THREE.Mesh; wall?: THREE.Mesh }>;
  exitMarker: THREE.Mesh;
  exitVisual?: THREE.Object3D;
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export class MazeBuilder {
  build(maze: MazeInstance): MazeRenderData {
    const root = new THREE.Group();
    root.name = 'maze-root';

    const floorGeometry = new THREE.BoxGeometry(1, 0.12, 1);
    const wallGeometry = new THREE.BoxGeometry(1, 1, 1);

    const tileVisuals = new Map<string, { floor: THREE.Mesh; wall?: THREE.Mesh }>();

    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        const cell = maze.cells[y][x];
        const visuals = this.buildTile(cell, floorGeometry, wallGeometry);

        visuals.floor.position.set(x + 0.5, -0.06, y + 0.5);
        root.add(visuals.floor);

        if (visuals.wall) {
          visuals.wall.position.set(x + 0.5, 0.5, y + 0.5);
          root.add(visuals.wall);
        }

        tileVisuals.set(tileKey(x, y), visuals);
      }
    }

    const exitGeometry = new THREE.CylinderGeometry(0.22, 0.4, 0.5, 16);
    const exitMaterial = new THREE.MeshStandardMaterial({
      color: '#9be7ff',
      emissive: '#4fc3f7',
      emissiveIntensity: 0.85,
    });
    const exitMarker = new THREE.Mesh(exitGeometry, exitMaterial);
    exitMarker.position.set(maze.exit.x + 0.5, 0.25, maze.exit.y + 0.5);
    root.add(exitMarker);

    return {
      root,
      tileVisuals,
      exitMarker,
    };
  }

  private buildTile(cell: MazeCell, floorGeometry: THREE.BufferGeometry, wallGeometry: THREE.BufferGeometry): {
    floor: THREE.Mesh;
    wall?: THREE.Mesh;
  } {
    const floorColor = cell.type === 'entry' ? '#6ee7b7' : cell.type === 'exit' ? '#93c5fd' : '#4b5563';
    const floor = new THREE.Mesh(
      floorGeometry,
      new THREE.MeshStandardMaterial({
        color: floorColor,
        roughness: 1,
        transparent: true,
        opacity: 1,
      }),
    );

    if (cell.type !== 'wall') {
      return { floor };
    }

    const wall = new THREE.Mesh(
      wallGeometry,
      new THREE.MeshStandardMaterial({
        color: '#64748b',
        roughness: 0.95,
        transparent: true,
        opacity: 1,
      }),
    );

    return { floor, wall };
  }
}