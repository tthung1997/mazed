import * as THREE from 'three';
import {
  AssetRegistry,
  DEFAULT_PLAYER_CHARACTER_ID,
  PLAYER_CHARACTER_OPTIONS,
  isPlayerCharacterId,
  type PlayerCharacterId,
} from '../rendering/AssetRegistry';

export class MenuController {
  private readonly startMenu: HTMLDivElement;
  private readonly pauseMenu: HTMLDivElement;
  private readonly characterSelect: HTMLSelectElement;
  private readonly previewCanvas: HTMLCanvasElement;
  private readonly previewScene: THREE.Scene;
  private readonly previewCamera: THREE.PerspectiveCamera;
  private readonly previewRenderer: THREE.WebGLRenderer;
  private readonly previewRoot = new THREE.Group();
  private readonly assetRegistry = new AssetRegistry();
  private previewMixer: THREE.AnimationMixer | null = null;
  private previewAnimationFrame = 0;
  private previewCharacterToken = 0;
  private previewLoopRunning = false;
  private previewLastTimeMs = 0;
  private startVisible = true;
  private previewWidth = 0;
  private previewHeight = 0;
  private previewYaw = 0;
  private draggingPreview = false;
  private previewLastPointerX = 0;

  constructor(
    parent: HTMLElement,
    callbacks: {
      onNewGame: () => void;
      onOpenLoad: () => void;
      onCharacterChange: (characterId: PlayerCharacterId) => void;
      onResume: () => void;
      onSave: () => void;
      onQuit: () => void;
    },
  ) {
    this.startMenu = document.createElement('div');
    this.startMenu.className = 'panel';
    this.startMenu.innerHTML = `
      <h2>Mazed</h2>
      <p>Escape the maze. Enter the next one. Repeat forever.</p>
      <div class="character-preview-wrap">
        <canvas class="character-preview" data-action="character-preview"></canvas>
      </div>
      <div class="row">
        <select data-action="character"></select>
      </div>
      <div class="row"><button data-action="new">New Game</button></div>
      <div class="row"><button data-action="load">Load Code</button></div>
    `;

    this.pauseMenu = document.createElement('div');
    this.pauseMenu.className = 'panel hidden';
    this.pauseMenu.innerHTML = `
      <h2>Paused</h2>
      <div class="row"><button data-action="resume">Resume</button></div>
      <div class="row"><button data-action="save">Save / Load</button></div>
      <div class="row"><button data-action="quit">Quit To Menu</button></div>
    `;

    this.characterSelect = this.startMenu.querySelector('[data-action="character"]') as HTMLSelectElement;
    this.previewCanvas = this.startMenu.querySelector('[data-action="character-preview"]') as HTMLCanvasElement;

    this.previewScene = new THREE.Scene();
    this.previewCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    this.previewCamera.position.set(0, 0.95, 2.2);
    this.previewCamera.lookAt(0, 0.7, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(1.8, 3, 2.4);
    this.previewScene.add(ambient);
    this.previewScene.add(keyLight);
    this.previewScene.add(this.previewRoot);

    this.previewRenderer = new THREE.WebGLRenderer({
      canvas: this.previewCanvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    this.previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.resizePreview();

    for (const option of PLAYER_CHARACTER_OPTIONS) {
      const element = document.createElement('option');
      element.value = option.id;
      element.textContent = option.label;
      this.characterSelect.appendChild(element);
    }
    this.characterSelect.value = DEFAULT_PLAYER_CHARACTER_ID;

    this.startMenu.querySelector('[data-action="new"]')?.addEventListener('click', callbacks.onNewGame);
    this.startMenu.querySelector('[data-action="load"]')?.addEventListener('click', callbacks.onOpenLoad);
    this.characterSelect.addEventListener('change', () => {
      const value = this.characterSelect.value;

      if (isPlayerCharacterId(value)) {
        callbacks.onCharacterChange(value);
        void this.loadPreviewCharacter(value);
      }
    });
    this.previewCanvas.addEventListener('pointerdown', (event) => {
      this.draggingPreview = true;
      this.previewLastPointerX = event.clientX;
      this.previewCanvas.setPointerCapture(event.pointerId);
    });
    this.previewCanvas.addEventListener('pointermove', (event) => {
      if (!this.draggingPreview) {
        return;
      }

      const deltaX = event.clientX - this.previewLastPointerX;
      this.previewLastPointerX = event.clientX;
      this.rotatePreview(deltaX * 0.01);
    });
    this.previewCanvas.addEventListener('pointerup', (event) => {
      this.draggingPreview = false;
      this.previewCanvas.releasePointerCapture(event.pointerId);
    });
    this.previewCanvas.addEventListener('pointercancel', (event) => {
      this.draggingPreview = false;
      this.previewCanvas.releasePointerCapture(event.pointerId);
    });
    this.pauseMenu.querySelector('[data-action="resume"]')?.addEventListener('click', callbacks.onResume);
    this.pauseMenu.querySelector('[data-action="save"]')?.addEventListener('click', callbacks.onSave);
    this.pauseMenu.querySelector('[data-action="quit"]')?.addEventListener('click', callbacks.onQuit);

    parent.appendChild(this.startMenu);
    parent.appendChild(this.pauseMenu);

    window.requestAnimationFrame(() => {
      if (this.startVisible) {
        this.resizePreview();
      }
    });

    void this.loadPreviewCharacter(DEFAULT_PLAYER_CHARACTER_ID);
    this.startPreviewLoop();
  }

  setStartVisible(visible: boolean): void {
    this.startVisible = visible;
    this.startMenu.classList.toggle('hidden', !visible);

    if (visible) {
      this.resizePreview();
      this.startPreviewLoop();
      return;
    }

    this.stopPreviewLoop();
  }

  setPauseVisible(visible: boolean): void {
    this.pauseMenu.classList.toggle('hidden', !visible);
  }

  getSelectedCharacterId(): PlayerCharacterId {
    const value = this.characterSelect.value;
    return isPlayerCharacterId(value) ? value : DEFAULT_PLAYER_CHARACTER_ID;
  }

  setSelectedCharacterId(characterId: PlayerCharacterId): void {
    this.characterSelect.value = characterId;
    void this.loadPreviewCharacter(characterId);
  }

  destroy(): void {
    this.stopPreviewLoop();
    this.previewRoot.clear();
    this.previewRenderer.dispose();
  }

  private resizePreview(): void {
    const width = Math.max(1, Math.floor(this.previewCanvas.clientWidth));
    const height = Math.max(1, Math.floor(this.previewCanvas.clientHeight));

    if (width === this.previewWidth && height === this.previewHeight) {
      return;
    }

    this.previewWidth = width;
    this.previewHeight = height;

    this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.previewRenderer.setSize(width, height, false);
    this.previewCamera.aspect = width / height;
    this.previewCamera.updateProjectionMatrix();
  }

  private startPreviewLoop(): void {
    if (this.previewLoopRunning || !this.startVisible) {
      return;
    }

    this.previewLoopRunning = true;
    this.previewLastTimeMs = 0;

    const tick = (timeMs: number): void => {
      if (!this.previewLoopRunning) {
        return;
      }

      if (this.previewLastTimeMs === 0) {
        this.previewLastTimeMs = timeMs;
      }

      const dt = Math.min(0.1, (timeMs - this.previewLastTimeMs) / 1000);
      this.previewLastTimeMs = timeMs;

      this.resizePreview();
      this.previewMixer?.update(dt);
      this.previewRenderer.render(this.previewScene, this.previewCamera);
      this.previewAnimationFrame = window.requestAnimationFrame(tick);
    };

    this.previewAnimationFrame = window.requestAnimationFrame(tick);
  }

  private stopPreviewLoop(): void {
    this.previewLoopRunning = false;

    if (this.previewAnimationFrame !== 0) {
      window.cancelAnimationFrame(this.previewAnimationFrame);
      this.previewAnimationFrame = 0;
    }
  }

  private async loadPreviewCharacter(characterId: PlayerCharacterId): Promise<void> {
    const token = ++this.previewCharacterToken;

    try {
      const { model, animations } = await this.assetRegistry.loadPlayerCharacter(characterId);

      if (token !== this.previewCharacterToken) {
        return;
      }

      this.fitPreviewModel(model);
      this.previewRoot.clear();
      this.previewRoot.add(model);

      const animationRoot = model.getObjectByName('CharacterArmature') ?? model;
      this.previewMixer = new THREE.AnimationMixer(animationRoot);
      const idleClip = THREE.AnimationClip.findByName(animations, 'Idle');
      const idleAction = idleClip ? this.previewMixer.clipAction(idleClip, animationRoot) : null;
      idleAction?.reset().play();

      this.previewRenderer.render(this.previewScene, this.previewCamera);
    } catch (error) {
      if (token !== this.previewCharacterToken) {
        return;
      }

      console.warn('Failed to load preview character in start menu.', error);
    }
  }

  private fitPreviewModel(model: THREE.Object3D): void {
    model.position.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateWorldMatrix(true, true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());

    if (size.y > 0) {
      const scale = 1.2 / size.y;
      model.scale.setScalar(scale);
    }

    model.updateWorldMatrix(true, true);
    const fittedBounds = new THREE.Box3().setFromObject(model);
    const center = fittedBounds.getCenter(new THREE.Vector3());
    const minY = fittedBounds.min.y;

    model.position.set(-center.x, -minY, -center.z);
  }

  private rotatePreview(deltaYaw: number): void {
    this.previewYaw += deltaYaw;
    this.previewRoot.rotation.y = this.previewYaw;
    this.previewRenderer.render(this.previewScene, this.previewCamera);
  }
}