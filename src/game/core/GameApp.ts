import * as THREE from 'three';
import type { GameState } from '../../types/game';
import type { SaveState } from '../../types/save';
import { SaveCodec } from '../../utils/saveCode';
import { getMazeParams } from '../maze/Difficulty';
import { MazeGenerator } from '../maze/MazeGenerator';
import { PlayerInput } from '../player/PlayerInput';
import { PlayerController } from '../player/PlayerController';
import { CameraController } from '../rendering/CameraController';
import { FogRenderer } from '../rendering/FogRenderer';
import { MazeBuilder, type MazeRenderData } from '../rendering/MazeBuilder';
import { SceneManager } from '../rendering/SceneManager';
import { AssetRegistry } from '../rendering/AssetRegistry';
import type { MazeInstance } from '../maze/MazeTypes';
import { HudController } from '../ui/HudController';
import { MenuController } from '../ui/MenuController';
import { SaveCodeModal } from '../ui/SaveCodeModal';
import { PortalSystem } from '../systems/PortalSystem';
import { VisibilitySystem } from '../systems/VisibilitySystem';
import { createInitialState } from './GameState';
import { BASE_VISIBILITY_RADIUS, PLAYER_SPEED, TRANSITION_DURATION_MS } from './constants';
import { GameLoop } from './GameLoop';
import { TransitionSystem } from '../systems/TransitionSystem';

const PLAYER_TURN_SPEED = 14;
const PLAYER_MODEL_YAW_OFFSET = 0;
const PLAYER_ANIMATION_BLEND_SECONDS = 0.14;
const FLOOR_TILE_HEIGHT = 0.04;
const WALL_TILE_HEIGHT = 1.2;

function randomSeed(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let output = '';

  for (let i = 0; i < length; i += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return output;
}

export class GameApp {
  private readonly state: GameState = createInitialState();
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlay: HTMLDivElement;
  private readonly fadeEl: HTMLDivElement;

  private readonly sceneManager: SceneManager;
  private readonly gameLoop: GameLoop;
  private readonly input = new PlayerInput();
  private readonly player = new PlayerController();
  private readonly cameraController = new CameraController();
  private readonly visibilitySystem = new VisibilitySystem();
  private readonly portalSystem = new PortalSystem();
  private readonly transition = new TransitionSystem(TRANSITION_DURATION_MS);
  private readonly mazeGenerator = new MazeGenerator();
  private readonly mazeBuilder = new MazeBuilder();
  private readonly fogRenderer = new FogRenderer();
  private readonly assets = new AssetRegistry();

  private readonly playerVisual: THREE.Group;
  private readonly playerModelPivot: THREE.Group;
  private readonly hud: HudController;
  private readonly menus: MenuController;
  private readonly saveModal: SaveCodeModal;

  private mazeRenderData: MazeRenderData | null = null;
  private previousPlayerTile = { x: -1, y: -1 };
  private visibilityRadius = BASE_VISIBILITY_RADIUS;
  private mazeBuildVersion = 0;
  private playerFacingYaw = 0;
  private playerAnimationMixer: THREE.AnimationMixer | null = null;
  private playerIdleAction: THREE.AnimationAction | null = null;
  private playerWalkAction: THREE.AnimationAction | null = null;
  private activePlayerAction: THREE.AnimationAction | null = null;

  constructor(private readonly mountPoint: HTMLDivElement) {
    this.root = document.createElement('div');
    this.root.className = 'game-root';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';

    this.fadeEl = document.createElement('div');
    this.fadeEl.className = 'fade';
    this.overlay.appendChild(this.fadeEl);

    this.root.appendChild(this.canvas);
    this.root.appendChild(this.overlay);
    this.mountPoint.appendChild(this.root);

    this.sceneManager = new SceneManager(this.canvas);

    this.playerVisual = new THREE.Group();
    this.playerModelPivot = new THREE.Group();
    this.playerVisual.add(this.playerModelPivot);
    this.playerModelPivot.add(this.createFallbackPlayerVisual());
    this.sceneManager.scene.add(this.playerVisual);
    void this.loadPlayerCharacter();

    this.hud = new HudController(this.overlay);
    this.menus = new MenuController(this.overlay, {
      onNewGame: () => this.startNewGame(),
      onOpenLoad: () => this.openSaveModal(),
      onResume: () => this.resumeGame(),
      onSave: () => this.openSaveModal(),
      onQuit: () => this.quitToMenu(),
    });

    this.saveModal = new SaveCodeModal(
      this.overlay,
      (code) => this.loadFromCode(code),
      () => this.closeSaveModal(),
    );

    window.addEventListener('keydown', this.handleGlobalKeyDown);
    window.addEventListener('resize', this.handleResize);

    this.gameLoop = new GameLoop(this.fixedUpdate, this.renderUpdate);
    this.handleResize();
  }

  start(): void {
    this.gameLoop.start();
  }

  destroy(): void {
    this.gameLoop.stop();
    this.input.dispose();
    window.removeEventListener('keydown', this.handleGlobalKeyDown);
    window.removeEventListener('resize', this.handleResize);

    if (this.mazeRenderData) {
      this.sceneManager.scene.remove(this.mazeRenderData.root);
      this.mazeRenderData = null;
    }

    this.sceneManager.scene.remove(this.playerVisual);
    this.sceneManager.renderer.dispose();

    if (this.root.parentElement === this.mountPoint) {
      this.mountPoint.removeChild(this.root);
    }
  }

  private fixedUpdate = (dt: number): void => {
    this.state.playtimeSeconds += dt;
    const fade = this.transition.update(dt);
    this.fadeEl.style.opacity = `${fade}`;

    if (this.state.runStatus !== 'playing' || !this.state.maze) {
      return;
    }

    const moveInput = this.input.getMovementVector();
    this.player.update(moveInput, dt, this.state.maze);
    this.updatePlayerAnimation(dt);
    this.updatePlayerFacing(dt);
    this.syncPlayerVisualPosition();

    const tile = {
      x: Math.floor(this.player.position.x),
      y: Math.floor(this.player.position.z),
    };

    if (tile.x !== this.previousPlayerTile.x || tile.y !== this.previousPlayerTile.y) {
      this.previousPlayerTile = tile;
      const dirty = this.visibilitySystem.update(tile, this.state.maze, this.visibilityRadius);

      if (this.mazeRenderData) {
        this.fogRenderer.applyDirty(dirty.changedTiles, this.state.maze.cells, this.mazeRenderData);
        this.fogRenderer.applyExitVisibility(this.state.maze, this.mazeRenderData);
      }
    }

    if (this.mazeRenderData && this.portalSystem.checkExitOverlap(this.player.position, this.mazeRenderData.exitMarker.position)) {
      this.startMazeTransition();
    }

    this.hud.update(this.state);
  };

  private renderUpdate = (_alpha: number, dt: number): void => {
    if (this.state.runStatus === 'playing' || this.state.runStatus === 'transition') {
      this.cameraController.update(this.sceneManager.camera, this.player.position, dt, this.visibilityRadius);
    }

    this.sceneManager.render();
  };

  private startNewGame(): void {
    this.state.playerSeed = randomSeed(8);
    this.state.currentMaze = 1;
    this.state.completedMazes = [];
    this.state.unlockedToolsMask = 0;
    this.state.artifactsMask = 0;
    this.state.inventory = [];
    this.state.playtimeSeconds = 0;
    this.buildMaze();
    this.state.runStatus = 'playing';
    this.hud.setVisible(true);
    this.menus.setStartVisible(false);
    this.menus.setPauseVisible(false);
  }

  private buildMaze(): void {
    const params = getMazeParams(this.state.playerSeed, this.state.currentMaze);
    const maze = this.mazeGenerator.generate(params);
    this.state.maze = maze;
    this.mazeBuildVersion += 1;
    const buildVersion = this.mazeBuildVersion;

    this.portalSystem.reset();
    this.previousPlayerTile = { x: -1, y: -1 };

    if (this.mazeRenderData) {
      this.sceneManager.scene.remove(this.mazeRenderData.root);
    }

    this.mazeRenderData = this.mazeBuilder.build(maze);
    this.sceneManager.scene.add(this.mazeRenderData.root);
    void this.applyTileModels(this.mazeRenderData, maze, buildVersion);
    void this.applyExitPortalVisual(this.mazeRenderData, maze, buildVersion);

    this.player.placeAtTile(maze.entry.x, maze.entry.y);
    this.playerFacingYaw = 0;
    this.playerModelPivot.rotation.y = this.playerFacingYaw;
    this.syncPlayerVisualPosition();

    this.visibilitySystem.update({ x: maze.entry.x, y: maze.entry.y }, maze, this.visibilityRadius);
    this.fogRenderer.applyFull(maze, this.mazeRenderData);
    this.fogRenderer.applyExitVisibility(maze, this.mazeRenderData);
  }

  private startMazeTransition(): void {
    if (this.state.runStatus !== 'playing') {
      return;
    }

    this.state.runStatus = 'transition';
    const completedMaze = this.state.currentMaze;

    this.transition.start(
      () => {
        this.state.completedMazes.push(completedMaze);
        this.state.currentMaze += 1;
        this.buildMaze();
      },
      () => {
        this.state.runStatus = 'playing';
      },
    );
  }

  private openSaveModal(): void {
    if (this.state.runStatus === 'menu') {
      this.saveModal.setOutput('');
    } else {
      this.saveModal.setOutput(this.createSaveCode());
    }

    this.saveModal.setVisible(true);

    if (this.state.runStatus === 'playing') {
      this.state.runStatus = 'paused';
      this.menus.setPauseVisible(true);
    }
  }

  private closeSaveModal(): void {
    this.saveModal.setVisible(false);

    if (this.state.runStatus === 'paused') {
      this.resumeGame();
    }
  }

  private resumeGame(): void {
    if (this.state.maze) {
      this.state.runStatus = 'playing';
      this.menus.setPauseVisible(false);
    }
  }

  private quitToMenu(): void {
    this.state.runStatus = 'menu';
    this.hud.setVisible(false);
    this.menus.setPauseVisible(false);
    this.menus.setStartVisible(true);
    this.saveModal.setVisible(false);
  }

  private createSaveCode(): string {
    const payload: SaveState = {
      version: 1,
      seed: this.state.playerSeed,
      currentMaze: this.state.currentMaze,
      unlockedTools: this.state.unlockedToolsMask,
      inventory: this.state.inventory,
      completedMazes: this.state.completedMazes,
      artifacts: this.state.artifactsMask,
      playtime: Math.floor(this.state.playtimeSeconds),
    };

    return SaveCodec.encode(payload);
  }

  private loadFromCode(code: string): void {
    const result = SaveCodec.decode(code);

    if (!result.ok) {
      this.saveModal.setError(result.error.message);
      return;
    }

    const payload = result.value;
    this.state.playerSeed = payload.seed;
    this.state.currentMaze = payload.currentMaze;
    this.state.unlockedToolsMask = payload.unlockedTools;
    this.state.inventory = payload.inventory;
    this.state.completedMazes = payload.completedMazes;
    this.state.artifactsMask = payload.artifacts;
    this.state.playtimeSeconds = payload.playtime;

    this.buildMaze();
    this.state.runStatus = 'playing';
    this.menus.setStartVisible(false);
    this.menus.setPauseVisible(false);
    this.hud.setVisible(true);
    this.saveModal.setVisible(false);
  }

  private handleResize = (): void => {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    this.sceneManager.resize(width, height);
  };

  private handleGlobalKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape') {
      return;
    }

    if (this.state.runStatus === 'playing') {
      this.state.runStatus = 'paused';
      this.menus.setPauseVisible(true);
      return;
    }

    if (this.state.runStatus === 'paused') {
      this.resumeGame();
    }
  };

  private createFallbackPlayerVisual(): THREE.Object3D {
    const group = new THREE.Group();
    const playerGeometry = new THREE.CapsuleGeometry(0.22, 0.35, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.8 });
    const mesh = new THREE.Mesh(playerGeometry, playerMaterial);
    mesh.position.y = 0.35;
    group.add(mesh);

    return group;
  }

  private async loadPlayerCharacter(): Promise<void> {
    try {
      const { model, animations } = await this.assets.loadPlayerCharacter();
      this.fitPlayerCharacter(model);
      this.setupPlayerAnimation(model, animations);

      this.playerModelPivot.clear();
      this.playerModelPivot.add(model);
      this.syncPlayerVisualPosition();
    } catch (error) {
      console.warn('Failed to load Cubeworld player character. Keeping fallback mesh.', error);
    }
  }

  private fitPlayerCharacter(model: THREE.Object3D): void {
    model.position.set(0, 0, 0);
    model.updateWorldMatrix(true, true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());

    if (size.y > 0) {
      const targetHeight = 0.9;
      const scale = targetHeight / size.y;
      model.scale.setScalar(scale);
    }

    model.updateWorldMatrix(true, true);
    const scaledBounds = new THREE.Box3().setFromObject(model);
    const min = scaledBounds.min.y;

    model.position.set(0, -min, 0);
  }

  private syncPlayerVisualPosition(): void {
    this.playerVisual.position.set(this.player.position.x, 0, this.player.position.z);
  }

  private setupPlayerAnimation(model: THREE.Object3D, clips: THREE.AnimationClip[]): void {
    if (clips.length === 0) {
      this.playerAnimationMixer = null;
      this.playerIdleAction = null;
      this.playerWalkAction = null;
      this.activePlayerAction = null;
      return;
    }

    const animationRoot = model.getObjectByName('CharacterArmature') ?? model;
    const mixer = new THREE.AnimationMixer(animationRoot);
    this.playerAnimationMixer = mixer;

    const idleClip = THREE.AnimationClip.findByName(clips, 'Idle');
    const walkClip = THREE.AnimationClip.findByName(clips, 'Run') ?? THREE.AnimationClip.findByName(clips, 'Walk');

    this.playerIdleAction = idleClip ? mixer.clipAction(idleClip, animationRoot) : null;
    this.playerWalkAction = walkClip ? mixer.clipAction(walkClip, animationRoot) : null;
    this.activePlayerAction = null;

    if (this.playerIdleAction) {
      this.playerIdleAction.reset().fadeIn(0.05).play();
      this.activePlayerAction = this.playerIdleAction;
    } else if (this.playerWalkAction) {
      this.playerWalkAction.reset().fadeIn(0.05).play();
      this.activePlayerAction = this.playerWalkAction;
    }
  }

  private updatePlayerAnimation(dt: number): void {
    if (!this.playerAnimationMixer) {
      return;
    }

    const speed = Math.sqrt(this.player.velocity.x * this.player.velocity.x + this.player.velocity.z * this.player.velocity.z);
    const isMoving = speed > 0.05;
    const targetAction = isMoving ? (this.playerWalkAction ?? this.playerIdleAction) : (this.playerIdleAction ?? this.playerWalkAction);

    if (targetAction && targetAction !== this.activePlayerAction) {
      this.activePlayerAction?.fadeOut(PLAYER_ANIMATION_BLEND_SECONDS);
      targetAction.reset().fadeIn(PLAYER_ANIMATION_BLEND_SECONDS).play();
      this.activePlayerAction = targetAction;
    }

    if (this.playerWalkAction) {
      const walkScale = Math.max(0.85, Math.min(1.05, speed / PLAYER_SPEED));
      this.playerWalkAction.setEffectiveTimeScale(walkScale);
    }

    this.playerAnimationMixer.update(dt);
  }

  private updatePlayerFacing(dt: number): void {
    const velocity = this.player.velocity;
    const planarSpeedSq = velocity.x * velocity.x + velocity.z * velocity.z;

    if (planarSpeedSq < 0.0001) {
      return;
    }

    const targetYaw = Math.atan2(velocity.x, velocity.z) + PLAYER_MODEL_YAW_OFFSET;
    const turnFactor = Math.min(1, PLAYER_TURN_SPEED * dt);
    this.playerFacingYaw = this.lerpAngle(this.playerFacingYaw, targetYaw, turnFactor);
    this.playerModelPivot.rotation.y = this.playerFacingYaw;
  }

  private lerpAngle(current: number, target: number, t: number): number {
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    return current + delta * t;
  }

  private async applyTileModels(renderData: MazeRenderData, maze: MazeInstance, buildVersion: number): Promise<void> {
    try {
      const floorTemplate = await this.assets.loadFloorTileModel();
      const wallTemplate = await this.assets.loadWallTileModel();

      this.fitTileModel(floorTemplate, FLOOR_TILE_HEIGHT);
      this.fitTileModel(wallTemplate, WALL_TILE_HEIGHT);

      if (buildVersion !== this.mazeBuildVersion || this.mazeRenderData !== renderData) {
        return;
      }

      for (let y = 0; y < maze.height; y += 1) {
        for (let x = 0; x < maze.width; x += 1) {
          const visuals = renderData.tileVisuals.get(`${x},${y}`);

          if (!visuals) {
            continue;
          }

          const cell = maze.cells[y][x];

          if (cell.type !== 'wall') {
            const floorModel = floorTemplate.clone(true);
            floorModel.position.set(x + 0.5, -FLOOR_TILE_HEIGHT * 0.5, y + 0.5);
            this.freezeStaticTransformRecursive(floorModel);

            renderData.root.remove(visuals.floor);
            renderData.root.add(floorModel);
            visuals.floor = floorModel;
            visuals.floorMaterials = this.collectTileMaterials(floorModel);
          }

          if (cell.type === 'wall' && visuals.wall) {
            const wallModel = wallTemplate.clone(true);
            wallModel.position.set(x + 0.5, WALL_TILE_HEIGHT * 0.5, y + 0.5);
            this.freezeStaticTransformRecursive(wallModel);

            renderData.root.remove(visuals.wall);
            renderData.root.add(wallModel);
            visuals.wall = wallModel;
            visuals.wallMaterials = this.collectTileMaterials(wallModel);
          }
        }
      }

      this.fogRenderer.applyFull(maze, renderData);
      this.fogRenderer.applyExitVisibility(maze, renderData);
    } catch (error) {
      console.warn('Failed to load tile models. Keeping fallback tile meshes.', error);
    }
  }

  private async applyExitPortalVisual(renderData: MazeRenderData, maze: { exit: { x: number; y: number }; cells: Array<Array<{ currentlyVisible: boolean }> > }, buildVersion: number): Promise<void> {
    try {
      const model = await this.assets.loadExitPortalModel();

      if (buildVersion !== this.mazeBuildVersion || this.mazeRenderData !== renderData) {
        return;
      }

      this.fitExitPortalModel(model);
      model.position.set(renderData.exitMarker.position.x, 0, renderData.exitMarker.position.z);
      this.freezeStaticTransformRecursive(model);

      if (renderData.exitVisual) {
        renderData.root.remove(renderData.exitVisual);
      }

      renderData.root.add(model);
      renderData.exitVisual = model;

      const exitCell = maze.cells[maze.exit.y][maze.exit.x];
      renderData.exitMarker.visible = false;
      renderData.exitVisual.visible = exitCell.currentlyVisible;
    } catch (error) {
      console.warn('Failed to load exit portal model. Keeping fallback exit marker.', error);
    }
  }

  private fitExitPortalModel(model: THREE.Object3D): void {
    model.position.set(0, 0, 0);
    model.updateWorldMatrix(true, true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());

    if (size.y > 0) {
      const targetHeight = 0.85;
      const scale = targetHeight / size.y;
      model.scale.setScalar(scale);
    }

    model.updateWorldMatrix(true, true);
    const scaledBounds = new THREE.Box3().setFromObject(model);
    const center = scaledBounds.getCenter(new THREE.Vector3());
    const minY = scaledBounds.min.y;

    model.position.set(-center.x, -minY, -center.z);
  }

  private fitTileModel(model: THREE.Object3D, targetHeight: number): void {
    model.position.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateWorldMatrix(true, true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());

    if (size.x > 0 && size.y > 0 && size.z > 0) {
      model.scale.set(1 / size.x, targetHeight / size.y, 1 / size.z);
    }

    model.updateWorldMatrix(true, true);
    const scaledBounds = new THREE.Box3().setFromObject(model);
    const center = scaledBounds.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -center.y, -center.z);
  }

  private collectTileMaterials(object: THREE.Object3D): THREE.MeshStandardMaterial[] {
    const materials: THREE.MeshStandardMaterial[] = [];

    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) {
        return;
      }

      if (Array.isArray(node.material)) {
        const clonedMaterials = node.material.map((material) => {
          if (material instanceof THREE.MeshStandardMaterial) {
            const cloned = material.clone();
            cloned.transparent = true;
            materials.push(cloned);
            return cloned;
          }

          return material;
        });

        node.material = clonedMaterials;
        return;
      }

      if (node.material instanceof THREE.MeshStandardMaterial) {
        const cloned = node.material.clone();
        cloned.transparent = true;
        node.material = cloned;
        materials.push(cloned);
      }
    });

    return materials;
  }

  private freezeStaticTransformRecursive(object: THREE.Object3D): void {
    object.traverse((node) => {
      node.updateMatrix();
      node.matrixAutoUpdate = false;
    });

    object.updateMatrixWorld(true);
  }
}