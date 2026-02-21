import * as THREE from 'three';
import type { GameState } from '../../types/game';
import type { SaveState } from '../../types/save';
import type { MazeItemState } from '../../types/items';
import { isImplementedToolId, unlockTool } from '../../types/items';
import { SaveCodec } from '../../utils/saveCode';
import { getMazeParams } from '../maze/Difficulty';
import { MazeGenerator } from '../maze/MazeGenerator';
import { ItemSpawner } from '../maze/ItemSpawner';
import { PlayerInput } from '../player/PlayerInput';
import { PlayerController } from '../player/PlayerController';
import { CameraController } from '../rendering/CameraController';
import { FogRenderer } from '../rendering/FogRenderer';
import { ItemMeshBuilder, type ItemRenderData } from '../rendering/ItemMeshBuilder';
import { MazeBuilder, type MazeRenderData } from '../rendering/MazeBuilder';
import { SceneManager } from '../rendering/SceneManager';
import { AssetRegistry, type PlayerCharacterId } from '../rendering/AssetRegistry';
import type { MazeInstance } from '../maze/MazeTypes';
import { HudController } from '../ui/HudController';
import { MenuController } from '../ui/MenuController';
import { PortalHubModal } from '../ui/PortalHubModal';
import { SaveCodeModal } from '../ui/SaveCodeModal';
import { ItemSystem, type ItemPickupEvent } from '../systems/ItemSystem';
import { PortalSystem } from '../systems/PortalSystem';
import { ToolSystem } from '../systems/ToolSystem';
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
const PERF_UPDATE_INTERVAL_SECONDS = 0.5;
const PERF_SAMPLE_WINDOW = 180;
const PORTAL_HINT_DISTANCE = 1.05;
const ITEM_LABEL_DISTANCE = 1.2;

type PortalDirection = 'forward' | 'backward';
type MazeSpawnPoint = 'entry' | 'exit';

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
  private readonly itemSpawner = new ItemSpawner();
  private readonly mazeBuilder = new MazeBuilder();
  private readonly itemMeshBuilder = new ItemMeshBuilder();
  private readonly fogRenderer = new FogRenderer();
  private readonly assets = new AssetRegistry();
  private readonly itemSystem = new ItemSystem();
  private readonly toolSystem = new ToolSystem();

  private readonly playerVisual: THREE.Group;
  private readonly playerModelPivot: THREE.Group;
  private readonly hud: HudController;
  private readonly menus: MenuController;
  private readonly saveModal: SaveCodeModal;
  private readonly portalHubModal: PortalHubModal;
  private readonly perfHudEnabled = import.meta.env.DEV;
  private readonly perfHudEl: HTMLDivElement | null = null;

  private mazeRenderData: MazeRenderData | null = null;
  private itemRenderData: ItemRenderData | null = null;
  private previousPlayerTile = { x: -1, y: -1 };
  private visibilityRadius = BASE_VISIBILITY_RADIUS;
  private mazeBuildVersion = 0;
  private playerFacingYaw = 0;
  private playerAnimationMixer: THREE.AnimationMixer | null = null;
  private playerIdleAction: THREE.AnimationAction | null = null;
  private playerWalkAction: THREE.AnimationAction | null = null;
  private activePlayerAction: THREE.AnimationAction | null = null;
  private playerCharacterLoadToken = 0;
  private perfHudVisible = false;
  private perfSampleElapsed = 0;
  private perfSampleFrames = 0;
  private readonly frameTimeSamplesMs: number[] = [];
  private readonly mazeNetwork = new Map<number, MazeInstance>();
  private nextMazeSpawnPoint: MazeSpawnPoint = 'entry';
  private portalHubOpen = false;

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
    void this.loadPlayerCharacter(this.state.playerCharacterId);

    this.hud = new HudController(this.overlay);
    this.menus = new MenuController(this.overlay, {
      onNewGame: () => this.startNewGame(),
      onOpenLoad: () => this.openSaveModal(),
      onCharacterChange: (characterId) => this.applyPlayerCharacter(characterId),
      onResume: () => this.resumeGame(),
      onSave: () => this.openSaveModal(),
      onQuit: () => this.quitToMenu(),
    });
    this.menus.setSelectedCharacterId(this.state.playerCharacterId);

    this.saveModal = new SaveCodeModal(
      this.overlay,
      (code) => this.loadFromCode(code),
      () => this.closeSaveModal(),
    );

    this.portalHubModal = new PortalHubModal(this.overlay);

    if (this.perfHudEnabled) {
      this.perfHudEl = this.createPerfHud();
      this.overlay.appendChild(this.perfHudEl);
      this.setPerfHudVisible(false);
    }

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
    this.menus.destroy();
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
    if (this.state.runStatus === 'playing' || this.state.runStatus === 'transition') {
      this.state.playtimeSeconds += dt;
    }

    const fade = this.transition.update(dt);
    this.fadeEl.style.opacity = `${fade}`;

    if (this.state.runStatus !== 'playing' || !this.state.maze) {
      this.hud.setPortalHint(null);
      return;
    }

    const expiredTool = this.toolSystem.update(dt * 1000);
    if (expiredTool) {
      this.state.activeToolId = null;
      this.state.activeToolEndTime = null;
    }

    this.visibilityRadius = BASE_VISIBILITY_RADIUS + this.toolSystem.getVisibilityBonus();

    const moveInput = this.input.getMovementVector();
    this.player.update(moveInput, dt, this.state.maze, this.toolSystem.getSpeedMultiplier());
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
        this.fogRenderer.applyBackVisibility(this.state.maze, this.mazeRenderData, this.canBacktrackToPreviousMaze());
      }

      if (this.itemRenderData) {
        this.itemMeshBuilder.applyDirtyVisibility(this.itemRenderData, this.state.maze, dirty.changedTiles);
      }
    }

    const itemEvents = this.itemSystem.update(tile);
    if (itemEvents.length > 0) {
      for (const event of itemEvents) {
        this.handleItemPickup(event);
      }
    }

    if (this.itemRenderData) {
      this.itemMeshBuilder.updateProximityLabels(this.itemRenderData, this.player.position, ITEM_LABEL_DISTANCE);
    }

    if (this.mazeRenderData && this.portalSystem.checkExitOverlap(this.player.position, this.mazeRenderData.exitMarker.position)) {
      this.startMazeTransition('forward');
    }

    if (
      this.mazeRenderData &&
      this.canBacktrackToPreviousMaze() &&
      this.portalSystem.checkBackOverlap(this.player.position, this.mazeRenderData.backMarker.position)
    ) {
      if (this.state.portalHubUnlocked) {
        void this.openPortalHub();
      } else {
        this.startMazeTransition('backward');
      }
    }

    this.hud.setPortalHint(this.getPortalHintText());
    this.hud.update(this.state);
  };

  private renderUpdate = (_alpha: number, dt: number): void => {
    if (this.state.runStatus === 'playing' || this.state.runStatus === 'transition') {
      this.cameraController.update(this.sceneManager.camera, this.player.position, dt, this.visibilityRadius);
    }

    this.sceneManager.render();
    this.updatePerfHud(dt);
  };

  private startNewGame(): void {
    this.applyPlayerCharacter(this.menus.getSelectedCharacterId());
    this.state.playerSeed = randomSeed(8);
    this.state.currentMaze = 1;
    this.state.completedMazes = [];
    this.state.unlockedToolsMask = 0;
    this.state.artifactsMask = 0;
    this.state.inventory = [];
    this.state.playtimeSeconds = 0;
    this.state.mazeFirstEntryTimes = { 1: 0 };
    this.state.mazeFirstCompletionTimes = {};
    this.state.activeToolId = null;
    this.state.activeToolEndTime = null;
    this.state.collectedShards = 0;
    this.state.mazeItemState = {};
    this.state.portalHubUnlocked = false;
    this.toolSystem.syncFromState(this.state.activeToolId, this.state.activeToolEndTime);
    this.mazeNetwork.clear();
    this.nextMazeSpawnPoint = 'entry';
    this.buildMaze();
    this.state.runStatus = 'playing';
    this.hud.setVisible(true);
    this.menus.setStartVisible(false);
    this.menus.setPauseVisible(false);
  }

  private buildMaze(): void {
    const cachedMaze = this.mazeNetwork.get(this.state.currentMaze);
    const maze = cachedMaze ?? this.mazeGenerator.generate(getMazeParams(this.state.playerSeed, this.state.currentMaze));
    this.mazeNetwork.set(this.state.currentMaze, maze);

    const mazeState = this.getOrCreateMazeItemState(this.state.currentMaze, maze);
    const pickedUpSet = new Set(mazeState.pickedUp);
    maze.itemSpawns = mazeState.spawns.filter((spawn) => !pickedUpSet.has(spawn.id));

    this.state.maze = maze;
    this.mazeBuildVersion += 1;
    const buildVersion = this.mazeBuildVersion;

    this.portalSystem.reset();
    this.previousPlayerTile = { x: -1, y: -1 };

    if (this.mazeRenderData) {
      this.sceneManager.scene.remove(this.mazeRenderData.root);
    }

    this.mazeRenderData = this.mazeBuilder.build(maze);
    this.itemSystem.loadMaze(maze);
    this.itemRenderData = this.itemMeshBuilder.build(this.itemSystem.getSpawns());
    this.mazeRenderData.root.add(this.itemRenderData.root);
    this.sceneManager.scene.add(this.mazeRenderData.root);
    void this.applyTileModels(this.mazeRenderData, maze, buildVersion);
    void this.applyExitPortalVisual(this.mazeRenderData, maze, buildVersion);
    void this.applyBackPortalVisual(this.mazeRenderData, maze, buildVersion);

    const spawnPoint = this.nextMazeSpawnPoint;
    const spawnTile = spawnPoint === 'exit' ? maze.exit : maze.entry;

    this.recordMazeEntryIfFirstVisit(this.state.currentMaze);

    this.player.placeAtTile(spawnTile.x, spawnTile.y);
    this.playerFacingYaw = 0;
    this.playerModelPivot.rotation.y = this.playerFacingYaw;
    this.syncPlayerVisualPosition();

    this.visibilitySystem.update({ x: spawnTile.x, y: spawnTile.y }, maze, this.visibilityRadius);
    this.fogRenderer.applyFull(maze, this.mazeRenderData);
    this.fogRenderer.applyExitVisibility(maze, this.mazeRenderData);
    this.fogRenderer.applyBackVisibility(maze, this.mazeRenderData, this.canBacktrackToPreviousMaze());

    if (this.itemRenderData) {
      this.itemMeshBuilder.applyFullVisibility(this.itemRenderData, maze);
    }

    if (spawnPoint === 'exit') {
      this.portalSystem.prime('forward');
    }

    if (spawnPoint === 'entry' && this.canBacktrackToPreviousMaze()) {
      this.portalSystem.prime('backward');
    }

    this.nextMazeSpawnPoint = 'entry';
  }

  private startMazeTransition(direction: PortalDirection, targetMaze?: number): void {
    if (this.state.runStatus !== 'playing') {
      return;
    }

    this.state.runStatus = 'transition';
    const currentMaze = this.state.currentMaze;

    this.transition.start(
      () => {
        if (direction === 'forward') {
          this.recordMazeFirstCompletion(currentMaze);
          this.addCompletedMaze(currentMaze);
          this.state.currentMaze += 1;
          this.nextMazeSpawnPoint = 'entry';
        } else {
          const fallbackMaze = this.state.currentMaze - 1;
          const selectedMaze = typeof targetMaze === 'number' ? targetMaze : fallbackMaze;
          this.state.currentMaze = Math.max(1, selectedMaze);
          this.nextMazeSpawnPoint = 'exit';
        }

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
    const pickedUpItems = this.serializePickedUpItems();

    const payload: SaveState = {
      version: 2,
      seed: this.state.playerSeed,
      playerCharacterId: this.state.playerCharacterId,
      currentMaze: this.state.currentMaze,
      unlockedTools: this.state.unlockedToolsMask,
      inventory: this.state.inventory,
      completedMazes: [...this.state.completedMazes],
      artifacts: this.state.artifactsMask,
      playtime: Math.floor(this.state.playtimeSeconds),
      mazeFirstEntryTimes: { ...this.state.mazeFirstEntryTimes },
      mazeFirstCompletionTimes: { ...this.state.mazeFirstCompletionTimes },
      activeToolId: this.state.activeToolId,
      activeToolExpiry: this.state.activeToolEndTime,
      collectedShards: this.state.collectedShards,
      pickedUpItems,
      portalHubUnlocked: this.state.portalHubUnlocked,
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
    this.applyPlayerCharacter(payload.playerCharacterId);
    this.state.playerSeed = payload.seed;
    this.state.currentMaze = payload.currentMaze;
    this.state.unlockedToolsMask = payload.unlockedTools;
    this.state.inventory = payload.inventory;
    this.state.completedMazes = [...new Set(payload.completedMazes)].sort((a, b) => a - b);
    this.state.artifactsMask = payload.artifacts;
    this.state.playtimeSeconds = payload.playtime;
    this.state.mazeFirstEntryTimes = { ...payload.mazeFirstEntryTimes };
    this.state.mazeFirstCompletionTimes = { ...payload.mazeFirstCompletionTimes };
    this.state.activeToolId = payload.activeToolId;
    this.state.activeToolEndTime = payload.activeToolExpiry;
    this.state.collectedShards = payload.collectedShards;
    this.state.portalHubUnlocked = payload.portalHubUnlocked;
    this.toolSystem.syncFromState(this.state.activeToolId, this.state.activeToolEndTime);
    this.state.mazeItemState = {};

    for (const [mazeNumber, pickedUp] of Object.entries(payload.pickedUpItems)) {
      const parsedMazeNumber = Number(mazeNumber);
      if (!Number.isInteger(parsedMazeNumber) || parsedMazeNumber < 1) {
        continue;
      }

      this.state.mazeItemState[parsedMazeNumber] = {
        spawns: [],
        pickedUp: [...pickedUp],
      };
    }

    this.recordMazeEntryIfFirstVisit(this.state.currentMaze);
    this.mazeNetwork.clear();
    this.nextMazeSpawnPoint = 'entry';

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
    if (this.portalHubOpen) {
      return;
    }

    if (this.perfHudEnabled && event.code === 'F3') {
      event.preventDefault();
      this.setPerfHudVisible(!this.perfHudVisible);
      return;
    }

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

  private createPerfHud(): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'perf-hud hidden';
    el.textContent = 'Perf HUD (F3)';
    return el;
  }

  private setPerfHudVisible(visible: boolean): void {
    this.perfHudVisible = visible;

    if (!this.perfHudEl) {
      return;
    }

    this.perfHudEl.classList.toggle('hidden', !visible);
  }

  private updatePerfHud(dt: number): void {
    if (!this.perfHudEnabled || !this.perfHudEl) {
      return;
    }

    const dtMs = dt * 1000;
    this.frameTimeSamplesMs.push(dtMs);

    if (this.frameTimeSamplesMs.length > PERF_SAMPLE_WINDOW) {
      this.frameTimeSamplesMs.shift();
    }

    this.perfSampleElapsed += dt;
    this.perfSampleFrames += 1;

    if (this.perfSampleElapsed < PERF_UPDATE_INTERVAL_SECONDS) {
      return;
    }

    const fps = this.perfSampleFrames / this.perfSampleElapsed;
    const sorted = [...this.frameTimeSamplesMs].sort((a, b) => a - b);
    const p95Index = Math.floor((sorted.length - 1) * 0.95);
    const p95FrameMs = sorted.length > 0 ? sorted[p95Index] : 0;
    const averageFrameMs =
      this.frameTimeSamplesMs.length > 0
        ? this.frameTimeSamplesMs.reduce((sum, sample) => sum + sample, 0) / this.frameTimeSamplesMs.length
        : 0;

    const renderInfo = this.sceneManager.renderer.info.render;

    if (this.perfHudVisible) {
      this.perfHudEl.textContent = [
        'Perf HUD (F3)',
        `FPS: ${fps.toFixed(1)}`,
        `Frame ms avg: ${averageFrameMs.toFixed(2)}`,
        `Frame ms p95: ${p95FrameMs.toFixed(2)}`,
        `Draw calls: ${renderInfo.calls}`,
        `Triangles: ${renderInfo.triangles}`,
      ].join('\n');
    }

    this.perfSampleElapsed = 0;
    this.perfSampleFrames = 0;
  }

  private createFallbackPlayerVisual(): THREE.Object3D {
    const group = new THREE.Group();
    const playerGeometry = new THREE.CapsuleGeometry(0.22, 0.35, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.8 });
    const mesh = new THREE.Mesh(playerGeometry, playerMaterial);
    mesh.position.y = 0.35;
    group.add(mesh);

    return group;
  }

  private applyPlayerCharacter(characterId: PlayerCharacterId): void {
    if (this.state.playerCharacterId === characterId) {
      return;
    }

    this.state.playerCharacterId = characterId;
    this.menus.setSelectedCharacterId(characterId);
    void this.loadPlayerCharacter(characterId);
  }

  private async loadPlayerCharacter(characterId: PlayerCharacterId): Promise<void> {
    const loadToken = ++this.playerCharacterLoadToken;

    try {
      const { model, animations } = await this.assets.loadPlayerCharacter(characterId);

      if (loadToken !== this.playerCharacterLoadToken) {
        return;
      }

      this.fitPlayerCharacter(model);
      this.setupPlayerAnimation(model, animations);

      this.playerModelPivot.clear();
      this.playerModelPivot.add(model);
      this.syncPlayerVisualPosition();
    } catch (error) {
      if (loadToken !== this.playerCharacterLoadToken) {
        return;
      }

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
          const visuals = renderData.tileVisuals[y]?.[x];

          if (!visuals) {
            continue;
          }

          const cell = maze.cells[y][x];

          if (cell.type !== 'wall' && visuals.floor) {
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
      this.fogRenderer.applyBackVisibility(maze, renderData, this.canBacktrackToPreviousMaze());
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
      this.tintPortalModel(model, '#9be7ff', '#4fc3f7', 0.28);
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

  private canBacktrackToPreviousMaze(): boolean {
    if (this.state.currentMaze <= 1) {
      return false;
    }

    return this.state.completedMazes.includes(this.state.currentMaze - 1);
  }

  private addCompletedMaze(mazeNumber: number): void {
    if (!this.state.completedMazes.includes(mazeNumber)) {
      this.state.completedMazes.push(mazeNumber);
      this.state.completedMazes.sort((a, b) => a - b);
    }
  }

  private recordMazeEntryIfFirstVisit(mazeNumber: number): void {
    if (typeof this.state.mazeFirstEntryTimes[mazeNumber] === 'number') {
      return;
    }

    this.state.mazeFirstEntryTimes[mazeNumber] = Math.floor(this.state.playtimeSeconds);
  }

  private recordMazeFirstCompletion(mazeNumber: number): void {
    if (typeof this.state.mazeFirstCompletionTimes[mazeNumber] === 'number') {
      return;
    }

    const firstEntryTime = this.state.mazeFirstEntryTimes[mazeNumber];
    const completionTime = typeof firstEntryTime === 'number' ? this.state.playtimeSeconds - firstEntryTime : 0;
    this.state.mazeFirstCompletionTimes[mazeNumber] = Math.max(0, Math.floor(completionTime));
  }

  private async applyBackPortalVisual(
    renderData: MazeRenderData,
    maze: { entry: { x: number; y: number }; cells: Array<Array<{ currentlyVisible: boolean }> > },
    buildVersion: number,
  ): Promise<void> {
    try {
      const model = await this.assets.loadBackPortalModel();

      if (buildVersion !== this.mazeBuildVersion || this.mazeRenderData !== renderData) {
        return;
      }

      this.fitBackPortalModel(model);
      this.tintPortalModel(model, '#fcd34d', '#f59e0b', 0.34);
      model.position.set(renderData.backMarker.position.x, 0, renderData.backMarker.position.z);
      this.freezeStaticTransformRecursive(model);

      if (renderData.backVisual) {
        renderData.root.remove(renderData.backVisual);
      }

      renderData.root.add(model);
      renderData.backVisual = model;

      const showBackPortal = this.canBacktrackToPreviousMaze();
      const entryCell = maze.cells[maze.entry.y][maze.entry.x];
      renderData.backMarker.visible = false;
      renderData.backVisual.visible = showBackPortal && entryCell.currentlyVisible;
    } catch (error) {
      console.warn('Failed to load back portal model. Keeping fallback back marker.', error);
    }
  }

  private fitBackPortalModel(model: THREE.Object3D): void {
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

  private tintPortalModel(model: THREE.Object3D, _color: string, emissive: string, emissiveIntensity: number): void {
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) {
        return;
      }

      if (Array.isArray(node.material)) {
        node.material = node.material.map((material) => {
          if (!(material instanceof THREE.MeshStandardMaterial)) {
            return material;
          }

          const cloned = material.clone();
          cloned.color.copy(material.color);
          cloned.emissive.set(emissive);
          cloned.emissiveIntensity = emissiveIntensity;
          return cloned;
        });

        return;
      }

      if (!(node.material instanceof THREE.MeshStandardMaterial)) {
        return;
      }

      const cloned = node.material.clone();
      cloned.color.copy(node.material.color);
      cloned.emissive.set(emissive);
      cloned.emissiveIntensity = emissiveIntensity;
      node.material = cloned;
    });
  }

  private getPortalHintText(): string | null {
    if (!this.mazeRenderData) {
      return null;
    }

    const exitDistance = this.player.position.distanceTo(this.mazeRenderData.exitMarker.position);
    const canBacktrack = this.canBacktrackToPreviousMaze();
    const backDistance = canBacktrack ? this.player.position.distanceTo(this.mazeRenderData.backMarker.position) : Number.POSITIVE_INFINITY;

    if (exitDistance > PORTAL_HINT_DISTANCE && backDistance > PORTAL_HINT_DISTANCE) {
      return null;
    }

    if (backDistance < exitDistance) {
      if (this.state.portalHubUnlocked) {
        return 'Return Portal • Hub Access';
      }

      return `Return Portal • Back to Maze ${Math.max(1, this.state.currentMaze - 1)}`;
    }

    return `Exit Portal • Advance to Maze ${this.state.currentMaze + 1}`;
  }

  private getOrCreateMazeItemState(mazeNumber: number, maze: MazeInstance): MazeItemState {
    const existing = this.state.mazeItemState[mazeNumber];
    if (existing && existing.spawns.length > 0) {
      return existing;
    }

    const pickedUp = existing?.pickedUp ?? [];
    const spawns = this.itemSpawner.spawnItems(maze, {
      playerSeed: this.state.playerSeed,
      wayfinderCollected: this.state.portalHubUnlocked,
      unlockedToolsMask: this.state.unlockedToolsMask,
    });

    const created: MazeItemState = {
      spawns,
      pickedUp: [...pickedUp],
    };

    this.state.mazeItemState[mazeNumber] = created;
    return created;
  }

  private serializePickedUpItems(): Record<string, string[]> {
    const payload: Record<string, string[]> = {};

    for (const [mazeNumber, state] of Object.entries(this.state.mazeItemState)) {
      if (!state || state.pickedUp.length === 0) {
        continue;
      }

      payload[mazeNumber] = [...new Set(state.pickedUp)];
    }

    return payload;
  }

  private handleItemPickup(event: ItemPickupEvent): void {
    const mazeNumber = this.state.currentMaze;
    const mazeState = this.state.mazeItemState[mazeNumber];

    if (mazeState && !mazeState.pickedUp.includes(event.spawnId)) {
      mazeState.pickedUp.push(event.spawnId);
    }

    if (event.itemId === 'maze_shard') {
      this.state.collectedShards += 1;
    }

    if (event.itemId === 'wayfinder_stone') {
      this.state.portalHubUnlocked = true;
    }

    if (isImplementedToolId(event.itemId)) {
      this.state.unlockedToolsMask = unlockTool(this.state.unlockedToolsMask, event.itemId);
      this.toolSystem.equip(event.itemId);
      this.state.activeToolId = this.toolSystem.getActiveToolId();
      this.state.activeToolEndTime = this.toolSystem.getActiveToolEndTime();
    }

    if (this.state.maze?.itemSpawns) {
      this.state.maze.itemSpawns = this.state.maze.itemSpawns.filter((spawn) => spawn.id !== event.spawnId);
    }

    if (this.itemRenderData) {
      this.itemMeshBuilder.removeSpawn(this.itemRenderData, event.spawnId);
    }
  }

  private async openPortalHub(): Promise<void> {
    if (this.portalHubOpen || this.state.runStatus !== 'playing') {
      return;
    }

    this.portalHubOpen = true;
    this.state.runStatus = 'paused';

    try {
      const selectedMaze = await this.portalHubModal.show(
        this.state.completedMazes,
        this.state.mazeFirstCompletionTimes,
        this.state.mazeItemState,
      );

      this.portalSystem.prime('backward');

      if (selectedMaze === null) {
        this.state.runStatus = 'playing';
        return;
      }

      this.state.runStatus = 'playing';
      this.startMazeTransition('backward', selectedMaze);
    } finally {
      this.portalHubOpen = false;
    }
  }
}