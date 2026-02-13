import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const PLAYER_CHARACTER_URL = '/assets/cubeworld/Characters/glTF/Character_Male_1.gltf';
const EXIT_PORTAL_URL = '/assets/cubeworld/Environment/glTF/Crystal_Big.gltf';

export interface CharacterAsset {
  model: THREE.Group;
  animations: THREE.AnimationClip[];
}

export class AssetRegistry {
  private readonly gltfLoader = new GLTFLoader();
  private playerCharacterPromise: Promise<GLTF> | null = null;
  private exitPortalPromise: Promise<GLTF> | null = null;

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
}