import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const PLAYER_CHARACTER_URL = '/assets/cubeworld/Characters/glTF/Character_Male_1.gltf';

export interface CharacterAsset {
  model: THREE.Group;
  animations: THREE.AnimationClip[];
}

export class AssetRegistry {
  private readonly gltfLoader = new GLTFLoader();
  private playerCharacterPromise: Promise<GLTF> | null = null;

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
}