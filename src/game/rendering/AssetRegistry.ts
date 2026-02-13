import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const PLAYER_CHARACTER_URL = '/assets/cubeworld/Characters/glTF/Character_Male_1.gltf';
const EXIT_PORTAL_URL = '/assets/cubeworld/Environment/glTF/Crystal_Big.gltf';
const FLOOR_TILE_URL = '/assets/cubeworld/Pixel%20Blocks/glTF/Bricks_Grey.gltf';
const WALL_TILE_URL = '/assets/cubeworld/Pixel%20Blocks/glTF/Bricks_Grey.gltf';

export interface CharacterAsset {
  model: THREE.Group;
  animations: THREE.AnimationClip[];
}

export class AssetRegistry {
  private readonly gltfLoader = new GLTFLoader();
  private playerCharacterPromise: Promise<GLTF> | null = null;
  private exitPortalPromise: Promise<GLTF> | null = null;
  private floorTilePromise: Promise<GLTF> | null = null;
  private wallTilePromise: Promise<GLTF> | null = null;

  async loadPlayerCharacter(): Promise<CharacterAsset> {
    if (!this.playerCharacterPromise) {
      this.playerCharacterPromise = new Promise<GLTF>((resolve, reject) => {
        this.gltfLoader.load(
          PLAYER_CHARACTER_URL,
          (gltf) => {
            resolve(gltf);
          },
          undefined,
          (error) => {
            reject(error instanceof Error ? error : new Error('Failed to load player character model.'));
          },
        );
      });
    }

    const gltf = await this.playerCharacterPromise;
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
    if (!this.exitPortalPromise) {
      this.exitPortalPromise = new Promise<GLTF>((resolve, reject) => {
        this.gltfLoader.load(
          EXIT_PORTAL_URL,
          (gltf) => {
            resolve(gltf);
          },
          undefined,
          (error) => {
            reject(error instanceof Error ? error : new Error('Failed to load exit portal model.'));
          },
        );
      });
    }

    const gltf = await this.exitPortalPromise;
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
    if (!this.floorTilePromise) {
      this.floorTilePromise = new Promise<GLTF>((resolve, reject) => {
        this.gltfLoader.load(
          FLOOR_TILE_URL,
          (gltf) => {
            resolve(gltf);
          },
          undefined,
          (error) => {
            reject(error instanceof Error ? error : new Error('Failed to load floor tile model.'));
          },
        );
      });
    }

    const gltf = await this.floorTilePromise;
    const model = gltf.scene.clone(true);
    this.prepareStaticModel(model);
    return model;
  }

  async loadWallTileModel(): Promise<THREE.Group> {
    if (!this.wallTilePromise) {
      this.wallTilePromise = new Promise<GLTF>((resolve, reject) => {
        this.gltfLoader.load(
          WALL_TILE_URL,
          (gltf) => {
            resolve(gltf);
          },
          undefined,
          (error) => {
            reject(error instanceof Error ? error : new Error('Failed to load wall tile model.'));
          },
        );
      });
    }

    const gltf = await this.wallTilePromise;
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