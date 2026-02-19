import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const PLAYER_CHARACTER_URLS = {
  character_female_1: '/assets/cubeworld/Characters/glTF/Character_Female_1.gltf',
  character_female_2: '/assets/cubeworld/Characters/glTF/Character_Female_2.gltf',
  character_male_1: '/assets/cubeworld/Characters/glTF/Character_Male_1.gltf',
  character_male_2: '/assets/cubeworld/Characters/glTF/Character_Male_2.gltf',
} as const;

export type PlayerCharacterId = keyof typeof PLAYER_CHARACTER_URLS;

export interface PlayerCharacterOption {
  id: PlayerCharacterId;
  label: string;
}

export const DEFAULT_PLAYER_CHARACTER_ID: PlayerCharacterId = 'character_male_1';

export const PLAYER_CHARACTER_OPTIONS: PlayerCharacterOption[] = [
  { id: 'character_female_1', label: 'Female 1' },
  { id: 'character_female_2', label: 'Female 2' },
  { id: 'character_male_1', label: 'Male 1' },
  { id: 'character_male_2', label: 'Male 2' },
];

export function isPlayerCharacterId(value: string): value is PlayerCharacterId {
  return value in PLAYER_CHARACTER_URLS;
}

const EXIT_PORTAL_URL = '/assets/cubeworld/Environment/glTF/Crystal_Big.gltf';
const FLOOR_TILE_URL = '/assets/cubeworld/Pixel%20Blocks/glTF/Bricks_Grey.gltf';
const WALL_TILE_URL = '/assets/cubeworld/Pixel%20Blocks/glTF/Bricks_Grey.gltf';

export interface CharacterAsset {
  model: THREE.Group;
  animations: THREE.AnimationClip[];
}

export class AssetRegistry {
  private readonly gltfLoader = new GLTFLoader();
  private readonly gltfPromises = new Map<string, Promise<GLTF>>();

  private loadGltf(url: string, errorMessage: string): Promise<GLTF> {
    const existing = this.gltfPromises.get(url);

    if (existing) {
      return existing;
    }

    const promise = new Promise<GLTF>((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          resolve(gltf);
        },
        undefined,
        (error) => {
          reject(error instanceof Error ? error : new Error(errorMessage));
        },
      );
    });

    this.gltfPromises.set(url, promise);
    return promise;
  }

  async loadPlayerCharacter(characterId: PlayerCharacterId): Promise<CharacterAsset> {
    const characterUrl = PLAYER_CHARACTER_URLS[characterId] ?? PLAYER_CHARACTER_URLS[DEFAULT_PLAYER_CHARACTER_ID];
    const gltf = await this.loadGltf(characterUrl, 'Failed to load player character model.');
    const model = cloneSkeleton(gltf.scene) as THREE.Group;

    model.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    return {
      model,
      animations: gltf.animations,
    };
  }

  async loadExitPortalModel(): Promise<THREE.Group> {
    const gltf = await this.loadGltf(EXIT_PORTAL_URL, 'Failed to load exit portal model.');
    const model = gltf.scene.clone(true);

    model.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    return model;
  }

  async loadBackPortalModel(): Promise<THREE.Group> {
    const gltf = await this.loadGltf(EXIT_PORTAL_URL, 'Failed to load back portal model.');
    const model = gltf.scene.clone(true);

    model.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    return model;
  }

  async loadFloorTileModel(): Promise<THREE.Group> {
    const gltf = await this.loadGltf(FLOOR_TILE_URL, 'Failed to load floor tile model.');
    const model = gltf.scene.clone(true);
    this.prepareStaticModel(model);
    return model;
  }

  async loadWallTileModel(): Promise<THREE.Group> {
    const gltf = await this.loadGltf(WALL_TILE_URL, 'Failed to load wall tile model.');
    const model = gltf.scene.clone(true);
    this.prepareStaticModel(model);
    return model;
  }

  private prepareStaticModel(model: THREE.Object3D): void {
    model.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        if (Array.isArray(node.material)) {
          for (const material of node.material) {
            this.configureMaterialTexture(material);
          }
        } else {
          this.configureMaterialTexture(node.material);
        }
      }
    });
  }

  private configureMaterialTexture(material: THREE.Material): void {
    if (!(material instanceof THREE.MeshStandardMaterial) || !material.map) {
      return;
    }

    material.map.magFilter = THREE.NearestFilter;
    material.map.minFilter = THREE.NearestMipmapNearestFilter;
    material.map.needsUpdate = true;
  }
}