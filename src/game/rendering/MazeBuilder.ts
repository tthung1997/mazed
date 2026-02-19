import * as THREE from 'three';
import type { MazeInstance, MazeCell } from '../maze/MazeTypes';

export interface MazeRenderData {
  root: THREE.Group;
  tileVisuals: Array<Array<{
    floor?: THREE.Object3D;
    floorMaterials?: THREE.MeshStandardMaterial[];
    wall?: THREE.Object3D;
    wallMaterials?: THREE.MeshStandardMaterial[];
  }>>;
  exitMarker: THREE.Mesh;
  backMarker: THREE.Mesh;
  exitVisual?: THREE.Object3D;
  backVisual?: THREE.Object3D;
}

function freezeStaticTransform(object: THREE.Object3D): void {
  object.updateMatrix();
  object.matrixAutoUpdate = false;
}

export class MazeBuilder {
  build(maze: MazeInstance): MazeRenderData {
    const root = new THREE.Group();
    root.name = 'maze-root';

    const floorGeometry = new THREE.BoxGeometry(1, 0.12, 1);
    const wallGeometry = new THREE.BoxGeometry(1, 1, 1);

    const tileVisuals: MazeRenderData['tileVisuals'] = Array.from({ length: maze.height }, () =>
      Array.from({ length: maze.width }, () => ({
        floor: undefined,
        floorMaterials: undefined,
        wall: undefined,
        wallMaterials: undefined,
      })),
    );

    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        const cell = maze.cells[y][x];
        const visuals = this.buildTile(cell, floorGeometry, wallGeometry);

        if (visuals.floor) {
          visuals.floor.position.set(x + 0.5, -0.06, y + 0.5);
          freezeStaticTransform(visuals.floor);
          root.add(visuals.floor);
        }

        if (visuals.wall) {
          visuals.wall.position.set(x + 0.5, 0.5, y + 0.5);
          freezeStaticTransform(visuals.wall);
          root.add(visuals.wall);
        }

        tileVisuals[y][x] = visuals;
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
    freezeStaticTransform(exitMarker);
    root.add(exitMarker);

    const backGeometry = new THREE.CylinderGeometry(0.18, 0.34, 0.35, 12);
    const backMaterial = new THREE.MeshStandardMaterial({
      color: '#fef3c7',
      emissive: '#f59e0b',
      emissiveIntensity: 0.65,
    });
    const backMarker = new THREE.Mesh(backGeometry, backMaterial);
    backMarker.position.set(maze.entry.x + 0.5, 0.18, maze.entry.y + 0.5);
    freezeStaticTransform(backMarker);
    root.add(backMarker);

    root.updateMatrix();
    root.matrixAutoUpdate = false;

    return {
      root,
      tileVisuals,
      exitMarker,
      backMarker,
    };
  }

  private buildTile(cell: MazeCell, floorGeometry: THREE.BufferGeometry, wallGeometry: THREE.BufferGeometry): {
    floor?: THREE.Object3D;
    floorMaterials?: THREE.MeshStandardMaterial[];
    wall?: THREE.Object3D;
    wallMaterials?: THREE.MeshStandardMaterial[];
  } {
    if (cell.type !== 'wall') {
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

      return {
        floor,
        floorMaterials: [floor.material as THREE.MeshStandardMaterial],
      };
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

    return {
      wall,
      wallMaterials: [wall.material as THREE.MeshStandardMaterial],
    };
  }
}