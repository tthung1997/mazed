import * as THREE from 'three';
import type { MazeInstance } from '../maze/MazeTypes';
import type { MazeItemSpawn } from '../../types/items';
import { ITEM_DISPLAY_NAMES } from '../../types/items';

export interface ItemRenderData {
  root: THREE.Group;
  meshBySpawnId: Map<string, THREE.Object3D>;
  labelBySpawnId: Map<string, THREE.Sprite>;
  spawnById: Map<string, MazeItemSpawn>;
}

export class ItemMeshBuilder {
  build(spawns: MazeItemSpawn[]): ItemRenderData {
    const root = new THREE.Group();
    root.name = 'maze-items-root';

    const meshBySpawnId = new Map<string, THREE.Object3D>();
    const labelBySpawnId = new Map<string, THREE.Sprite>();
    const spawnById = new Map<string, MazeItemSpawn>();

    for (const spawn of spawns) {
      const mesh = this.createMesh(spawn);
      mesh.position.set(spawn.tileX + 0.5, 0.24, spawn.tileY + 0.5);
      const label = this.createLabel(ITEM_DISPLAY_NAMES[spawn.itemId]);
      label.position.set(spawn.tileX + 0.5, 0.62, spawn.tileY + 0.5);
      label.visible = false;
      root.add(mesh);
      root.add(label);
      meshBySpawnId.set(spawn.id, mesh);
      labelBySpawnId.set(spawn.id, label);
      spawnById.set(spawn.id, spawn);
    }

    return {
      root,
      meshBySpawnId,
      labelBySpawnId,
      spawnById,
    };
  }

  removeSpawn(renderData: ItemRenderData, spawnId: string): void {
    const mesh = renderData.meshBySpawnId.get(spawnId);
    if (!mesh) {
      return;
    }

    renderData.root.remove(mesh);
    renderData.meshBySpawnId.delete(spawnId);
    const label = renderData.labelBySpawnId.get(spawnId);
    if (label) {
      renderData.root.remove(label);
      renderData.labelBySpawnId.delete(spawnId);
    }
    renderData.spawnById.delete(spawnId);
  }

  applyFullVisibility(renderData: ItemRenderData, maze: MazeInstance): void {
    for (const [spawnId, mesh] of renderData.meshBySpawnId) {
      const spawn = renderData.spawnById.get(spawnId);
      if (!spawn) {
        continue;
      }

      mesh.visible = Boolean(maze.cells[spawn.tileY]?.[spawn.tileX]?.currentlyVisible);
      const label = renderData.labelBySpawnId.get(spawnId);
      if (label && !mesh.visible) {
        label.visible = false;
      }
    }
  }

  applyDirtyVisibility(renderData: ItemRenderData, maze: MazeInstance, changedTiles: Array<{ x: number; y: number }>): void {
    const changedKeys = new Set(changedTiles.map((tile) => `${tile.x},${tile.y}`));

    if (changedKeys.size === 0) {
      return;
    }

    for (const [spawnId, mesh] of renderData.meshBySpawnId) {
      const spawn = renderData.spawnById.get(spawnId);
      if (!spawn) {
        continue;
      }

      const key = `${spawn.tileX},${spawn.tileY}`;
      if (!changedKeys.has(key)) {
        continue;
      }

      mesh.visible = Boolean(maze.cells[spawn.tileY]?.[spawn.tileX]?.currentlyVisible);
      const label = renderData.labelBySpawnId.get(spawnId);
      if (label && !mesh.visible) {
        label.visible = false;
      }
    }
  }

  updateProximityLabels(renderData: ItemRenderData, playerPosition: THREE.Vector3, distanceThreshold: number): void {
    const thresholdSq = distanceThreshold * distanceThreshold;

    for (const [spawnId, mesh] of renderData.meshBySpawnId) {
      const label = renderData.labelBySpawnId.get(spawnId);

      if (!label) {
        continue;
      }

      if (!mesh.visible) {
        label.visible = false;
        continue;
      }

      const dx = mesh.position.x - playerPosition.x;
      const dz = mesh.position.z - playerPosition.z;
      const closeEnough = dx * dx + dz * dz <= thresholdSq;
      label.visible = closeEnough;
    }
  }

  private createLabel(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      const fallback = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffffff', transparent: true, opacity: 0 }));
      fallback.scale.set(1.6, 0.35, 1);
      return fallback;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    const radius = 10;
    const x = 4;
    const y = 6;
    const w = canvas.width - 8;
    const h = canvas.height - 12;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.8, 0.45, 1);
    return sprite;
  }

  private createMesh(spawn: MazeItemSpawn): THREE.Object3D {
    if (spawn.itemId === 'wayfinder_stone') {
      return new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.18, 0),
        new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#facc15', emissiveIntensity: 0.6, roughness: 0.3 }),
      );
    }

    if (spawn.itemId === 'maze_shard') {
      return new THREE.Mesh(
        new THREE.OctahedronGeometry(0.14, 0),
        new THREE.MeshStandardMaterial({ color: '#a5f3fc', emissive: '#22d3ee', emissiveIntensity: 0.35, roughness: 0.25 }),
      );
    }

    return new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshStandardMaterial({ color: '#d1d5db', emissive: '#9ca3af', emissiveIntensity: 0.2, roughness: 0.4 }),
    );
  }
}
