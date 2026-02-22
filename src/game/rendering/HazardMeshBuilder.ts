import * as THREE from 'three';
import type { HazardInstance } from '../../types/hazards';
import type { MazeInstance } from '../maze/MazeTypes';

export interface HazardRenderData {
  root: THREE.Group;
  meshByHazardId: Map<string, THREE.Object3D>;
  hazardById: Map<string, HazardInstance>;
}

function directionYaw(direction: 'north' | 'south' | 'east' | 'west'): number {
  switch (direction) {
    case 'north':
      return Math.PI;
    case 'south':
      return 0;
    case 'east':
      return Math.PI * 0.5;
    case 'west':
      return -Math.PI * 0.5;
    default:
      return 0;
  }
}

function oneWayDoorOffset(direction: 'north' | 'south' | 'east' | 'west'): { x: number; z: number } {
  switch (direction) {
    case 'east':
      return { x: -0.6, z: 0 };
    case 'west':
      return { x: 0.6, z: 0 };
    case 'north':
      return { x: 0, z: 0.6 };
    case 'south':
      return { x: 0, z: -0.6 };
    default:
      return { x: 0, z: 0 };
  }
}

export class HazardMeshBuilder {
  build(hazards: HazardInstance[] | undefined): HazardRenderData {
    const root = new THREE.Group();
    root.name = 'maze-hazards-root';

    const meshByHazardId = new Map<string, THREE.Object3D>();
    const hazardById = new Map<string, HazardInstance>();

    for (const hazard of hazards ?? []) {
      const mesh = this.createFallbackMesh(hazard);

      const offset = hazard.type === 'one_way_door' ? oneWayDoorOffset(hazard.meta.allowedDirection) : { x: 0, z: 0 };
      mesh.position.set(hazard.tileX + 0.5 + offset.x, 0, hazard.tileY + 0.5 + offset.z);
      root.add(mesh);
      meshByHazardId.set(hazard.id, mesh);
      hazardById.set(hazard.id, hazard);
    }

    return { root, meshByHazardId, hazardById };
  }

  applyFullVisibility(renderData: HazardRenderData, maze: MazeInstance): void {
    for (const [hazardId, mesh] of renderData.meshByHazardId) {
      const hazard = renderData.hazardById.get(hazardId);
      if (!hazard) {
        continue;
      }

      mesh.visible = Boolean(maze.cells[hazard.tileY]?.[hazard.tileX]?.currentlyVisible);
    }
  }

  applyDirtyVisibility(renderData: HazardRenderData, maze: MazeInstance, changedTiles: Array<{ x: number; y: number }>): void {
    const changed = new Set(changedTiles.map((tile) => `${tile.x},${tile.y}`));
    if (changed.size === 0) {
      return;
    }

    for (const [hazardId, mesh] of renderData.meshByHazardId) {
      const hazard = renderData.hazardById.get(hazardId);
      if (!hazard) {
        continue;
      }

      if (!changed.has(`${hazard.tileX},${hazard.tileY}`)) {
        continue;
      }

      mesh.visible = Boolean(maze.cells[hazard.tileY]?.[hazard.tileX]?.currentlyVisible);
    }
  }

  applyDoorModelTemplate(renderData: HazardRenderData, template: THREE.Object3D): void {
    for (const [hazardId, hazard] of renderData.hazardById) {
      const existing = renderData.meshByHazardId.get(hazardId);
      if (!existing) {
        continue;
      }

      const model = template.clone(true);
      model.position.copy(existing.position);
      model.rotation.copy(existing.rotation);
      model.visible = existing.visible;

      if (hazard.type === 'one_way_door') {
        model.rotation.y = directionYaw(hazard.meta.allowedDirection);
      }

      if (hazard.type === 'locked_door') {
        this.tintModel(model, '#fca5a5', '#ef4444', 0.2);
      }

      renderData.root.remove(existing);
      renderData.root.add(model);
      renderData.meshByHazardId.set(hazardId, model);
    }
  }

  private createFallbackMesh(hazard: HazardInstance): THREE.Object3D {
    if (hazard.type === 'one_way_door') {
      const group = new THREE.Group();
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.5, 0.1),
        new THREE.MeshStandardMaterial({ color: '#fde68a', emissive: '#f59e0b', emissiveIntensity: 0.2, roughness: 0.8 }),
      );

      door.position.y = 0.25;
      group.add(door);
      group.rotation.y = directionYaw(hazard.meta.allowedDirection);
      return group;
    }

    const group = new THREE.Group();
    const lockedDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.52, 0.11),
      new THREE.MeshStandardMaterial({ color: '#fca5a5', emissive: '#ef4444', emissiveIntensity: 0.2, roughness: 0.85 }),
    );
    lockedDoor.position.y = 0.26;
    group.add(lockedDoor);
    return group;
  }

  private tintModel(model: THREE.Object3D, color: string, emissive: string, emissiveIntensity: number): void {
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) {
        return;
      }

      const applyTint = (material: THREE.Material): void => {
        if (!(material instanceof THREE.MeshStandardMaterial)) {
          return;
        }

        const cloned = material.clone();
        cloned.color = new THREE.Color(color);
        cloned.emissive = new THREE.Color(emissive);
        cloned.emissiveIntensity = emissiveIntensity;
        node.material = cloned;
      };

      if (Array.isArray(node.material)) {
        node.material = node.material.map((material) => {
          if (!(material instanceof THREE.MeshStandardMaterial)) {
            return material;
          }

          const cloned = material.clone();
          cloned.color = new THREE.Color(color);
          cloned.emissive = new THREE.Color(emissive);
          cloned.emissiveIntensity = emissiveIntensity;
          return cloned;
        });
      } else {
        applyTint(node.material);
      }
    });
  }
}
