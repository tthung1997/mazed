import * as THREE from 'three';
import type { HazardInstance } from '../../types/hazards';
import type { MazeInstance } from '../maze/MazeTypes';

export interface HazardRenderData {
  root: THREE.Group;
  meshByHazardId: Map<string, THREE.Object3D>;
  hazardById: Map<string, HazardInstance>;
}

const ONE_WAY_SLIDE_DURATION_SECONDS = 0.22;
const ONE_WAY_SLIDE_DISTANCE = 1.2;

interface OneWaySlideState {
  phase: 'opening' | 'open' | 'closing';
  progress: number;
  baseY: number;
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
  private readonly oneWaySlideStates = new Map<string, OneWaySlideState>();

  build(hazards: HazardInstance[] | undefined): HazardRenderData {
    this.oneWaySlideStates.clear();

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

  triggerOneWayDoorOpen(renderData: HazardRenderData, hazardId: string): void {
    const hazard = renderData.hazardById.get(hazardId);
    const mesh = renderData.meshByHazardId.get(hazardId);

    if (!hazard || hazard.type !== 'one_way_door' || !mesh) {
      return;
    }

    const existing = this.oneWaySlideStates.get(hazardId);

    if (!existing) {
      this.oneWaySlideStates.set(hazardId, {
        phase: 'opening',
        progress: 0,
        baseY: mesh.position.y,
      });
      return;
    }

    if (existing.phase === 'open' || existing.phase === 'opening') {
      return;
    }

    existing.phase = 'opening';
    existing.progress = 1 - existing.progress;
  }

  triggerOneWayDoorClose(renderData: HazardRenderData, hazardId: string): void {
    const hazard = renderData.hazardById.get(hazardId);

    if (!hazard || hazard.type !== 'one_way_door') {
      return;
    }

    const existing = this.oneWaySlideStates.get(hazardId);

    if (!existing) {
      return;
    }

    if (existing.phase === 'closing') {
      return;
    }

    existing.phase = 'closing';
  }

  updateDoorAnimations(renderData: HazardRenderData, dtSeconds: number): void {
    if (dtSeconds <= 0 || this.oneWaySlideStates.size === 0) {
      return;
    }

    const completed: string[] = [];
    const progressDelta = dtSeconds / ONE_WAY_SLIDE_DURATION_SECONDS;

    for (const [hazardId, slideState] of this.oneWaySlideStates) {
      const hazard = renderData.hazardById.get(hazardId);
      const mesh = renderData.meshByHazardId.get(hazardId);

      if (!hazard || hazard.type !== 'one_way_door' || !mesh) {
        completed.push(hazardId);
        continue;
      }

      const baseYaw = directionYaw(hazard.meta.allowedDirection);
      mesh.rotation.y = baseYaw;

      if (slideState.phase === 'opening') {
        slideState.progress = Math.min(1, slideState.progress + progressDelta);
        mesh.position.y = slideState.baseY - ONE_WAY_SLIDE_DISTANCE * slideState.progress;

        if (slideState.progress >= 1) {
          slideState.phase = 'open';
        }

        continue;
      }

      if (slideState.phase === 'open') {
        mesh.position.y = slideState.baseY - ONE_WAY_SLIDE_DISTANCE;
        continue;
      }

      slideState.progress = Math.max(0, slideState.progress - progressDelta);
      mesh.position.y = slideState.baseY - ONE_WAY_SLIDE_DISTANCE * slideState.progress;

      if (slideState.progress <= 0) {
        mesh.position.y = slideState.baseY;
        completed.push(hazardId);
      }
    }

    for (const hazardId of completed) {
      this.oneWaySlideStates.delete(hazardId);
    }
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
