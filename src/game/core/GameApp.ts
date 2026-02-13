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
import { HudController } from '../ui/HudController';
import { MenuController } from '../ui/MenuController';
import { SaveCodeModal } from '../ui/SaveCodeModal';
import { PortalSystem } from '../systems/PortalSystem';
import { VisibilitySystem } from '../systems/VisibilitySystem';
import { createInitialState } from './GameState';
import { BASE_VISIBILITY_RADIUS, TRANSITION_DURATION_MS } from './constants';
import { GameLoop } from './GameLoop';
import { TransitionSystem } from '../systems/TransitionSystem';

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

  private readonly playerMesh: THREE.Mesh;
  private readonly hud: HudController;
  private readonly menus: MenuController;
  private readonly saveModal: SaveCodeModal;

  private mazeRenderData: MazeRenderData | null = null;
  private previousPlayerTile = { x: -1, y: -1 };
  private visibilityRadius = BASE_VISIBILITY_RADIUS;

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

    const playerGeometry = new THREE.CapsuleGeometry(0.22, 0.35, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.8 });
    this.playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    this.sceneManager.scene.add(this.playerMesh);

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

  private fixedUpdate = (dt: number): void => {
    this.state.playtimeSeconds += dt;
    const fade = this.transition.update(dt);
    this.fadeEl.style.opacity = `${fade}`;

    if (this.state.runStatus !== 'playing' || !this.state.maze) {
      return;
    }

    const moveInput = this.input.getMovementVector();
    this.player.update(moveInput, dt, this.state.maze);
    this.playerMesh.position.copy(this.player.position);

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

    this.portalSystem.reset();
    this.previousPlayerTile = { x: -1, y: -1 };

    if (this.mazeRenderData) {
      this.sceneManager.scene.remove(this.mazeRenderData.root);
    }

    this.mazeRenderData = this.mazeBuilder.build(maze);
    this.sceneManager.scene.add(this.mazeRenderData.root);

    this.player.placeAtTile(maze.entry.x, maze.entry.y);
    this.playerMesh.position.copy(this.player.position);

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
}