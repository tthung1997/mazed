# Technical Design Document (TDD)
# Mazed — Phase 1 MVP

**Version:** 1.0  
**Date:** February 12, 2026  
**Author:** Engineering  
**Status:** Draft

---

## 1. Scope

This document defines the technical implementation plan for **Phase 1 (MVP)** from the PRD.

### 1.1 In-Scope (Phase 1)

1. Maze navigation (2.5D isometric movement, collision, camera follow)
2. Limited visibility / fog of war
3. Procedural maze generation (deterministic, solvable)
4. Entry/exit portal loop and maze transitions
5. Code-based save/load system
6. Minimal HUD and menus required for play/save/load

### 1.2 Out-of-Scope (Phase 1)

- Portal backtracking network
- Tools/items gameplay effects beyond placeholders
- Enemies, hazards, traps
- Themed biome variants
- Meta progression and achievements

---

## 2. Technical Goals & Constraints

### 2.1 Goals

- Stable 60 FPS on modern desktop browsers
- Maze generation under 500 ms for early-maze sizes
- Save code roundtrip (`encode` -> `decode`) with validation
- Deterministic replay: same player seed + maze number => same maze layout

### 2.2 Constraints

- Stack: Three.js + TypeScript + Vite
- UI via HTML/CSS overlays (no React requirement)
- Asset source: Cubeworld glTF assets under public assets folder
- Browser-first runtime

---

## 3. High-Level Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                        Application Layer                     │
│  Bootstrap -> GameApp -> SceneController -> Main Loop       │
└──────────────────────────────────────────────────────────────┘
                 │                    │
                 │                    ├────────────┐
                 ▼                                 ▼
┌─────────────────────────┐            ┌─────────────────────────┐
│      Simulation         │            │        Rendering        │
│ GameState               │            │ Scene + Camera + Lights │
│ MazeRuntime             │            │ MazeMeshBuilder          │
│ PlayerController        │            │ FogOfWarRenderer         │
│ CollisionSystem         │            │ PortalVisuals            │
└─────────────────────────┘            └─────────────────────────┘
                 │                                 │
                 └──────────────┬──────────────────┘
                                ▼
                      ┌──────────────────┐
                      │    Persistence    │
                      │ SaveCodec         │
                      │ Local cache (opt) │
                      └──────────────────┘
```

---

## 4. Proposed Project Structure

```text
src/
  game/
    core/
      GameApp.ts
      GameLoop.ts
      GameState.ts
      StateMachine.ts
    maze/
      MazeTypes.ts
      MazeGenerator.ts
      MazeBuilder.ts
      PathValidation.ts
      Difficulty.ts
    player/
      PlayerController.ts
      PlayerInput.ts
      PlayerMotor.ts
    systems/
      CollisionSystem.ts
      VisibilitySystem.ts
      PortalSystem.ts
      TransitionSystem.ts
    rendering/
      SceneManager.ts
      CameraController.ts
      FogRenderer.ts
      Lighting.ts
      AssetRegistry.ts
    ui/
      HudController.ts
      MenuController.ts
      SaveCodeModal.ts
  utils/
    random.ts
    hash.ts
    saveCode.ts
    checksum.ts
  types/
    save.ts
    game.ts
```

---

## 5. Core Data Models

### 5.1 Game State

```ts
interface GameState {
  version: number;
  playerSeed: string;            // stable per profile
  currentMaze: number;
  maze: MazeInstance | null;
  completedMazes: number[];
  unlockedToolsMask: number;     // MVP: reserved bits only
  artifactsMask: number;         // MVP: reserved bits only
  inventory: number[];           // MVP: optional placeholder
  playtimeSeconds: number;
  runStatus: 'menu' | 'playing' | 'transition' | 'paused';
}
```

### 5.2 Maze Data

```ts
type CellType = 'wall' | 'floor' | 'entry' | 'exit';

interface MazeCell {
  x: number;
  y: number;
  type: CellType;
  explored: boolean;             // visited at least once
  currentlyVisible: boolean;     // computed each frame/tick
}

interface MazeInstance {
  mazeNumber: number;
  width: number;
  height: number;
  seed: string;
  cells: MazeCell[][];
  entry: { x: number; y: number };
  exit: { x: number; y: number };
}
```

### 5.3 Save State Payload

```ts
interface SaveState {
  version: number;
  seed: string;
  currentMaze: number;
  unlockedTools: number;
  inventory: number[];
  completedMazes: number[];
  artifacts: number;
  playtime: number;
}
```

---

## 6. Subsystem Design

## 6.1 Bootstrap & Main Loop

### Responsibilities

- Initialize renderer, scene, camera, input, UI
- Maintain fixed-update simulation and render interpolation
- Route high-level states (`menu`, `playing`, `transition`)

### Loop policy

- Simulation tick: 60 Hz fixed timestep
- Render: `requestAnimationFrame`
- Clamp max frame delta to avoid spiral on tab resume

### Acceptance

- No gameplay logic in render-only code
- Deterministic simulation for same input stream and seed

---

## 6.2 Player Navigation

### Input

- Keyboard: WASD + Arrow keys
- 8-direction movement vector from key composition

### Movement

- World-space movement projected to maze plane
- Move speed configurable in constants
- Diagonal speed normalized (`v / sqrt(2)`)

### Collision

- Grid-based blocking from `CellType = wall`
- Circle-vs-AABB or tile occupancy checks
- Axis-separated resolution for smooth wall sliding

### Camera

- Isometric angle (~45° pitch)
- Follow target with smoothing (`lerp` damping)
- Fixed yaw for consistent orientation

---

## 6.3 Maze Generation (Deterministic)

### Inputs

- `playerSeed`
- `mazeNumber`
- Difficulty parameters from function `getMazeParams(mazeNumber)`

### Seed strategy

- `mazeSeed = hash(playerSeed + ':' + mazeNumber)`
- Use seeded PRNG from `random.ts`

### Algorithm

1. Generate perfect maze via recursive backtracking on odd-grid cells
2. Optionally carve additional loops based on `loopChance`
3. Mark entry at one edge and exit at farthest reachable cell
4. Validate path (BFS/A*) from entry to exit
5. If validation fails, retry with deterministic sub-seed increment

### Difficulty function (MVP)

- `width/height` starts at 10, scales by maze progression from PRD
- `complexity`, `deadEndRatio` increase gradually
- Enemy/hazard counts ignored in MVP

### Acceptance

- 100% solvable mazes
- Same seed pair reproduces exact layout
- Generation within target budget for maze 1-15

---

## 6.4 Fog of War / Visibility

### Model

Cell states:

1. **Unexplored**: never seen
2. **Visible**: within current radius and line policy
3. **Memory**: explored before, not currently visible

### Visibility radius

- Base radius: 3 tiles (MVP default)
- Compute each tick from player tile position

### Rendering approach

- Keep maze geometry always present for simplicity
- Apply overlay/material tinting by visibility state:
  - Visible: full brightness
  - Memory: dimmed multiplier
  - Unexplored: near-black + fog

### Optimization

- Update visibility only when player changes tile
- Maintain dirty-tile set for material updates

---

## 6.5 Portals & Maze Transition

### Behavior

- Entry marker at spawn tile
- Exit portal at target tile
- On player overlap with exit trigger:
  1. Lock input
  2. Play short transition (fade out/in)
  3. Increment `currentMaze`
  4. Generate/load next maze
  5. Place player at new entry

### State effects

- Add previous maze number to `completedMazes`
- Preserve run-level data in `GameState`

---

## 6.6 Save Code System

### Requirements

- Alphanumeric shareable code
- Integrity validation with checksum
- Backward compatibility via `version`

### Encoding pipeline

1. Build `SaveState` snapshot from `GameState`
2. Serialize JSON
3. Compress (e.g., LZ-based)
4. Base62 encode
5. Append checksum segment
6. Prefix format: `MAZED-...`

### Decoding pipeline

1. Validate prefix and charset
2. Split payload/checksum, verify checksum
3. Base62 decode
4. Decompress
5. Parse JSON and validate schema/version
6. Hydrate `GameState`

### Error handling

- Invalid format -> “Code format is invalid”
- Checksum mismatch -> “Code failed validation”
- Unsupported version -> “Code version not supported”

### Security note

- MVP checksum deters casual tampering; not cryptographically secure

---

## 7. Rendering & Asset Strategy

### 7.1 Three.js scene setup

- One `WebGLRenderer`
- One persistent scene and camera
- Ambient + directional lighting baseline
- Fog enabled for atmosphere and distant softness

### 7.2 Asset usage (MVP)

- Maze walls/floors: block assets (stone/brick/grass variants)
- Player: one character model default
- Exit portal: crystal/button asset combo

### 7.3 Performance

- Prefer instancing/merged geometry for repeated tiles
- Frustum culling enabled
- Rebuild mesh only on maze change, not per frame

---

## 8. UI/UX Technical Design

### Required screens/components

1. Start menu (New Game / Load Code)
2. In-game HUD (maze number, minimal status)
3. Pause menu (resume, save code, quit to menu)
4. Save/Load modal

### Interaction model

- DOM overlay elements layered above canvas
- `UIController` listens to state changes and updates view
- Modal focus trap for code input

---

## 9. File/Module Contracts

### 9.1 `MazeGenerator`

- `generate(params: MazeParams): MazeInstance`
- Must be pure for same params

### 9.2 `VisibilitySystem`

- `update(playerTile, maze, radius): DirtyVisibilityResult`
- No rendering dependencies

### 9.3 `SaveCodec`

- `encode(state: SaveState): string`
- `decode(code: string): Result<SaveState, SaveError>`

### 9.4 `PortalSystem`

- `checkExitOverlap(playerPos, exitPos): boolean`
- Emits transition event only once per overlap entry

---

## 10. Testing Strategy

### 10.1 Unit tests

- Seeded RNG reproducibility
- Maze generation determinism
- Path solvability validation
- Save encode/decode roundtrip
- Checksum rejection for tampered codes

### 10.2 Integration tests

- New game -> complete maze -> next maze loads
- Save code from maze N -> load -> restored at maze N
- Visibility transitions: unexplored -> visible -> memory

### 10.3 Manual QA checklist (MVP gate)

- Movement/collision feels responsive
- Camera maintains clear visibility and no clipping issues
- No soft-lock on transition or load
- Invalid code errors are user-friendly

---

## 11. Telemetry & Debug (MVP-light)

### Debug overlays (dev only)

- Current seed and maze number
- Player tile coordinates
- Visibility radius
- Generation time (ms)

### Optional metrics

- Maze completion time
- Save code generation count
- Load failure reasons (aggregated)

---

## 12. Delivery Plan (8 weeks)

### Week 1-2: Foundation

- Project bootstrap, Three.js scene, loop, input
- Basic player controller and camera follow

### Week 3-4: Maze core

- Deterministic generation + validation
- Tile mesh builder + collision
- Initial fog of war state model

### Week 5-6: Game loop

- Entry/exit placement and transition system
- HUD/menu shell and state machine wiring

### Week 7-8: Save system

- Save codec and validation
- Save/load UI flows
- Test pass and polish

---

## 13. Acceptance Criteria (Phase 1 Exit)

1. Player can start a new seeded run and navigate a generated maze.
2. Collision prevents wall traversal.
3. Fog of war limits live visibility and preserves explored memory.
4. Exit portal transitions to the next maze reliably.
5. Save code can serialize and restore run state.
6. Determinism: same code restores same current maze layout.
7. Performance within MVP targets on primary platform.

---

## 14. Risks & Mitigations (MVP)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Maze mesh too heavy | FPS drops | Use instancing/merge tiles, avoid per-frame rebuilds |
| Fog updates expensive | Stutter while moving | Update only on tile change, dirty-tile updates |
| Save code too long | Poor UX | Compression tuning, compact numeric fields |
| Edge-case unsolvable mazes | Progression blocker | Path validator + deterministic retry fallback |
| Camera occlusion confusion | Navigation frustration | Fixed camera tuning, wall height constraints |

---

## 15. Future-Ready Hooks (Non-MVP)

To avoid refactors in Phase 2+, MVP implementation should leave extension points:

- `ToolEffectProvider` for dynamic visibility/speed modifiers
- `EntitySpawner` for hazards/enemies
- `PortalGraph` abstraction for backtracking network
- Save payload versioning with migration map

---

## Appendix A: Constants (Initial Defaults)

- Base maze size: 10x10
- Base visibility radius: 3
- Player speed: 3.5 world units/sec
- Transition duration: 700 ms
- Target simulation tick: 60 Hz

---

*End of Phase 1 MVP TDD.*
