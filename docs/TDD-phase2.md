# Technical Design Document (TDD)
# Mazed — Phase 2: Core Features

**Version:** 1.0  
**Date:** February 19, 2026  
**Author:** Engineering  
**Status:** Draft

---

## 1. Scope

This document defines the technical implementation plan for **Phase 2 (Core Features)** from the PRD. It builds on the Phase 1 MVP foundation.

### 1.1 In-Scope (Phase 2)

1. **Portal Network (Hub Upgrade)** — Sequential N → N-1 backtracking is ✅ already implemented in Phase 1. Phase 2 adds an **earned upgrade**: finding the hidden *Wayfinder's Stone* item (or completing an associated lore quest) permanently transforms the back portal into a hub, allowing the player to jump directly to any previously completed maze.
2. **Collectible Items** — Maze Shards, Ancient Keys, Lore Pages, Artifact Pieces; in-maze spawning and pickup
3. **Tools & Equipment** — Basic Torch, Compass, Map Fragment, Running Boots, Skeleton Key; tool effects, duration timers, HUD slots
4. **Basic Hazards** — One-way doors, pressure plates, locked doors
5. **Sound & Music** — Ambient audio, interaction SFX, directional cues via Howler.js
6. **Particle & Visual Effects** — Portal shimmer, item pickup sparkles, torch glow
7. **UX Polish** — Smoother transitions, improved HUD, visual feedback for all Phase 2 mechanics

### 1.2 Dependencies (Phase 1 Deliverables Required)

- Stable `GameState`, `MazeInstance`, `CollisionSystem`, `PortalSystem`, `VisibilitySystem`
- Working save codec (`version: 1`) supporting `seed`, `inventory`, `unlockedTools`, `artifacts`, `completedMazes`, `playerCharacterId`, `mazeFirstEntryTimes`, `mazeFirstCompletionTimes`
- Portal network fully functional: `canBacktrackToPreviousMaze()`, `mazeNetwork` cache, bidirectional `TransitionSystem`, amber/blue portal visuals
- `ToolEffectProvider` extension point from Phase 1 future-ready hooks
- `EntitySpawner` stub from Phase 1 future-ready hooks

### 1.3 Out-of-Scope (Phase 2)

- Enemies and AI combat
- Advanced traps (moving walls, teleportation tiles)
- Themed biome variants (ice, forest, crystal)
- Meta progression / prestige system
- Achievements and leaderboards
- Mobile touch controls

---

## 2. Technical Goals & Constraints

### 2.1 Goals

- Tool effects cleanly stack with and override base visibility/speed without architecture changes
- Collectible spawning is deterministic from maze seed and does not block solution path
- Save codec handles all new payload fields with backward compatibility (version bump)
- Audio latency under 50 ms for key interaction SFX

### 2.2 Constraints

- Stack unchanged: Three.js + TypeScript + Vite
- No React; UI remains HTML/CSS overlays
- Sound library: Howler.js (already in PRD tech stack)
- Particle effects: Three.js `Points` / `Sprite` — no additional particle library
- Phase 1 unit tests must remain green; Phase 2 only adds tests

---

## 3. High-Level Architecture (Updated)

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          Application Layer                          │
│   Bootstrap -> GameApp -> SceneController -> Main Loop             │
└─────────────────────────────────────────────────────────────────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│   Simulation     │   │    Rendering     │   │    Persistence       │
│ GameState        │   │ SceneManager     │   │ SaveCodec (v2)       │
│ MazeRuntime      │   │ CameraController │   │ LocalStorage cache   │
│ PlayerController │   │ FogRenderer      │   └──────────────────────┘
│ CollisionSystem  │   │ PortalVisuals    │
│ VisibilitySystem │   │ ItemVisuals      │
│ PortalSystem ◄───┤   │ HazardVisuals    │
│ PortalHubMode    │   │ ParticleSystem   │
│ ItemSystem [NEW] │   │ TorchLightFX[NEW]│
│ ToolSystem [NEW] │   └──────────────────┘
│ HazardSystem[NEW]│
│ AudioManager[NEW]│
└──────────────────┘
```

---

## 4. Updated Project Structure

New files and folders added in Phase 2 (existing Phase 1 files omitted for brevity):

```text
src/
  game/
    maze/
      ItemSpawner.ts          [NEW] Deterministic item placement within MazeInstance
      HazardSpawner.ts        [NEW] One-way doors, pressure plates placement
    systems/
      ItemSystem.ts           [NEW] Item state, pickup detection, inventory mutations
      ToolSystem.ts           [NEW] Active tool management, duration timers, effect dispatch
      HazardSystem.ts         [NEW] One-way door enforcement, pressure plate triggers
      AudioManager.ts         [NEW] Howler.js wrapper; sound loading and playback
    rendering/
      ParticleSystem.ts       [NEW] Generic Three.js Points-based particle emitter
      TorchLightFX.ts         [NEW] Dynamic PointLight following player (Torch tool)
      ItemMeshBuilder.ts      [NEW] Builds meshes for collectibles in scene
      HazardMeshBuilder.ts    [NEW] Builds meshes for doors, pressure plates
    ui/
      ToolHud.ts              [NEW] Active tool slot, duration bar, compass overlay
      InventoryModal.ts       [NEW] Full inventory/collectible view (pause menu)
      MinimapOverlay.ts       [NEW] Map Fragment reveal overlay (canvas-based)
      PortalHubModal.ts       [NEW] Maze selection overlay shown when portal hub is unlocked
  types/
    items.ts                  [NEW] Item and tool type definitions
  utils/
    lzstring.ts               [NEW] LZ-string compression for save codec
```

> **Note:** `PortalGraph.ts` and `portals.ts` are **not needed** — portal connectivity is derived from the existing `completedMazes` array via `canBacktrackToPreviousMaze()` in `GameApp`, which is already implemented.

---

## 5. Data Models

### 5.1 Extended Game State

```ts
interface GameState {
  // --- Phase 1 fields (as-built, including additions beyond original TDD-phase1) ---
  version: number;
  playerSeed: string;
  playerCharacterId: PlayerCharacterId;       // character skin selection
  currentMaze: number;
  maze: MazeInstance | null;
  completedMazes: number[];                   // drives canBacktrackToPreviousMaze()
  unlockedToolsMask: number;
  artifactsMask: number;
  inventory: number[];
  playtimeSeconds: number;
  mazeFirstEntryTimes: Record<number, number>;       // playtime (s) on first entry
  mazeFirstCompletionTimes: Record<number, number>;  // seconds taken to complete
  runStatus: 'menu' | 'playing' | 'transition' | 'paused';

  // --- Phase 2 additions ---
  activeToolId: ToolId | null;       // currently equipped tool
  activeToolEndTime: number | null;  // epoch ms when tool expires
  collectedShards: number;           // Maze Shard currency
  mazeItemState: Record<number, MazeItemState>; // per-maze collectible pickup state
  portalHubUnlocked: boolean;        // true once Wayfinder's Stone found / lore complete
}
```

> **Note on portal connectivity:** No graph structure is needed. Sequential backtracking (`canBacktrackToPreviousMaze()`) is driven by `completedMazes`. The hub upgrade only adds an interaction mode on top — when `portalHubUnlocked` is true, stepping on the back portal opens `PortalHubModal` instead of triggering an immediate transition.

### 5.2 Portal System — Two Modes

The back portal has two behavioural modes depending on whether the Wayfinder's Stone has been found:

#### Mode 1: Sequential (default, as-built)

Connectivity is derived entirely from `completedMazes` and `currentMaze`:

```ts
// In GameApp — already implemented
canBacktrackToPreviousMaze(): boolean {
  return this.state.currentMaze > 1 &&
    this.state.completedMazes.includes(this.state.currentMaze - 1);
}
```

On overlap, triggers `startMazeTransition('backward')` → player arrives at `maze.exit` of maze N-1.

#### Mode 2: Hub (unlocked via Wayfinder's Stone)

When `portalHubUnlocked === true`, overlapping the back portal instead opens `PortalHubModal` — a maze selection overlay listing all entries in `completedMazes`. The player picks any maze; `startMazeTransition('backward')` is then called with the chosen target maze number rather than always `currentMaze - 1`.

```
Back portal overlap:
  if portalHubUnlocked:
    open PortalHubModal(completedMazes)
    on selection(targetMaze):
      transition to targetMaze, spawn at exit tile
  else:
    transition to currentMaze - 1, spawn at exit tile
```

**Shared properties (both modes):**
- **Forward portal** — placed at `maze.exit` tile; tinted blue-white (`emissive: '#4fc3f7'`)
- **Back portal** — placed at `maze.entry` tile; shown only when `canBacktrackToPreviousMaze()` is true; tinted amber (`emissive: '#f59e0b'`), brightened further once hub is unlocked
- `mazeNetwork: Map<number, MazeInstance>` caches generated mazes in-session; deterministic regeneration on cache miss
- Portals are primed to prevent immediate re-trigger on spawn

### 5.3 Item & Tool Definitions

```ts
type ItemId =
  | 'maze_shard'
  | 'ancient_key'
  | 'lore_page'
  | 'artifact_piece'
  | 'wayfinder_stone'; // unique one-time item; permanently unlocks portal hub

type ToolId =
  | 'basic_torch'
  | 'compass'
  | 'map_fragment'
  | 'running_boots'
  | 'skeleton_key';

interface ToolDefinition {
  id: ToolId;
  unlockMaze: number;        // maze number that grants access
  durationMs: number | null; // null = permanent / until used
  visibilityBonus: number;   // added to base radius (0 if none)
  speedMultiplier: number;   // multiplicative (1.0 = no change)
  oneShot: boolean;          // consumed on use
}

const TOOL_DEFINITIONS: Record<ToolId, ToolDefinition> = {
  basic_torch:   { id: 'basic_torch',   unlockMaze: 1,  durationMs: 60_000, visibilityBonus: 2, speedMultiplier: 1.0,  oneShot: false },
  compass:       { id: 'compass',       unlockMaze: 5,  durationMs: null,   visibilityBonus: 0, speedMultiplier: 1.0,  oneShot: false },
  map_fragment:  { id: 'map_fragment',  unlockMaze: 10, durationMs: null,   visibilityBonus: 0, speedMultiplier: 1.0,  oneShot: true  },
  running_boots: { id: 'running_boots', unlockMaze: 15, durationMs: 30_000, visibilityBonus: 0, speedMultiplier: 1.3,  oneShot: false },
  skeleton_key:  { id: 'skeleton_key',  unlockMaze: 20, durationMs: null,   visibilityBonus: 0, speedMultiplier: 1.0,  oneShot: true  },
};
```

### 5.4 Maze Item State

```ts
interface MazeItemSpawn {
  id: string;          // unique within maze ('item_0', 'item_1', …)
  itemId: ItemId | ToolId;
  tileX: number;
  tileY: number;
}

interface MazeItemState {
  spawns: MazeItemSpawn[];
  pickedUp: Set<string>; // spawn ids already collected
}
```

### 5.5 Hazard Definitions

```ts
type HazardType = 'one_way_door' | 'pressure_plate' | 'locked_door';

interface HazardInstance {
  type: HazardType;
  tileX: number;
  tileY: number;
  meta: OneWayMeta | PressurePlateMeta | LockedDoorMeta;
}

interface OneWayMeta {
  allowedDirection: 'north' | 'south' | 'east' | 'west';
}

interface PressurePlateMeta {
  triggerId: string;      // links to a door or gate in same maze
  active: boolean;        // runtime: currently pressed?
}

interface LockedDoorMeta {
  requiresKey: boolean;   // consumed on open
  open: boolean;          // runtime state
}
```

### 5.6 Extended Save State Payload

```ts
interface SaveState {
  // v1 fields (as-built — includes fields beyond original TDD-phase1 spec)
  version: number;       // currently 1; bumped to 2 for Phase 2 tool/item additions
  seed: string;
  playerCharacterId: PlayerCharacterId;
  currentMaze: number;
  unlockedTools: number;
  inventory: number[];
  completedMazes: number[];
  artifacts: number;
  playtime: number;
  mazeFirstEntryTimes: Record<number, number>;
  mazeFirstCompletionTimes: Record<number, number>;

  // v2 additions
  activeToolId: string | null;
  activeToolExpiry: number | null;  // epoch ms
  collectedShards: number;
  pickedUpItems: Record<string, string[]>; // mazeNum -> [spawnId, …]
  portalHubUnlocked: boolean;              // Wayfinder's Stone found / lore complete
}
```

> **No `portalEdges` field is needed.** Portal backtracking state is fully encoded by `completedMazes`. The hub unlock is a single boolean, so the save code size impact is negligible.

---

## 6. Subsystem Design

### 6.1 Portal Network — ✅ Already Implemented

The portal network feature is **fully implemented** as part of Phase 1. The following describes the as-built design for reference.

#### How it works

- `PortalSystem` exposes `checkExitOverlap()` and `checkBackOverlap()`, both with enter/exit debounce via the `triggeredByPortal` flags and the `prime()` method to prevent immediate re-trigger on spawn.
- `GameApp.startMazeTransition(direction: 'forward' | 'backward')` handles both directions:
  - `forward`: records completion, increments `currentMaze`, spawns at entry
  - `backward`: decrements `currentMaze`, spawns at exit tile of the previous maze
- `canBacktrackToPreviousMaze()` checks `completedMazes.includes(currentMaze - 1)` — no separate graph structure.
- `mazeNetwork: Map<number, MazeInstance>` in `GameApp` caches generated mazes in-session.
- Re-entering a completed maze regenerates geometry from seed on cache miss; items already picked up will be excluded via `MazeItemState` (Phase 2 addition).

#### Portal placement (as-built)

| Portal | Tile | Condition |
|--------|------|-----------|
| Forward (exit) | `maze.exit` | Always shown once visible |
| Backward (return) | `maze.entry` | Shown only when `canBacktrackToPreviousMaze()` is true |

#### Visual distinction (as-built)

| Portal Type | Color accent | Implementation |
|-------------|--------------|----------------|
| Forward (exit) | Blue-white (`#4fc3f7`) | glTF model loaded via `AssetRegistry.loadExitPortalModel()`, tinted |
| Backward (return) | Amber (`#f59e0b`) | glTF model loaded via `AssetRegistry.loadBackPortalModel()`, tinted |

#### Phase 2 portal work

No structural changes required. The only Phase 2 addition is:
- Exclude already-picked-up items when re-entering a cached maze (handled by `ItemSystem` during maze load).

---

### 6.2 Item System (`ItemSystem`)

#### Responsibilities

- Deterministic spawn placement using maze seed
- Pickup detection (overlap with player tile)
- Inventory and shard mutations on pickup
- Item state persistence across maze re-visits

#### Spawn placement algorithm

```
function spawnItems(maze: MazeInstance, mazeNumber: number): MazeItemSpawn[] {
  1. Collect all dead-end floor tiles (cells with exactly 1 open neighbor)
  2. Shuffle using seeded PRNG(mazeSeed)
  3. Distribute items:
     a. Maze Shard — 1-3 per maze (frequency based on mazeNumber)
     b. Tool (if unlocked at this maze) — place in dead end farthest from entry
     c. Ancient Key / Lore Page / Artifact Piece — conditionally per maze range
     d. Wayfinder's Stone — placed exactly once, in maze 7, farthest dead end from entry; never re-placed if already collected
  4. Never place on entry, exit, or hazard tiles
}
```

#### Pickup detection

- Check each `MazeItemSpawn` against player tile each tick (cheap set lookup)
- On pickup: emit `ITEM_PICKED_UP` event → `ItemSystem` updates inventory/shards, marks spawn as collected, `ItemMeshBuilder` removes mesh from scene
- Special case for `wayfinder_stone`: also sets `GameState.portalHubUnlocked = true`, emits `PORTAL_HUB_UNLOCKED` event (consumed by `GameApp` to upgrade back portal visual and enable hub behaviour)

#### Tool unlock gating

- Tool spawns only appear if `mazeNumber >= toolDef.unlockMaze`
- `unlockedToolsMask` is updated in `GameState`; UI reflects newly unlocked tools with a brief notification

---

### 6.3 Tool System (`ToolSystem`)

#### Responsibilities

- Accept "equip tool" input from HUD
- Apply/remove effects via `ToolEffectProvider`
- Manage duration countdown for timed tools
- Handle one-shot consumption

#### Effect dispatch

```ts
interface ToolEffectProvider {
  getVisibilityBonus(): number;       // added to VisibilitySystem base radius
  getSpeedMultiplier(): number;       // applied in PlayerMotor
  getCompassActive(): boolean;        // UI overlay in ToolHud
  getMapRevealFraction(): number;     // 0–1, consumed by MinimapOverlay
}
```

`ToolSystem` implements `ToolEffectProvider` and is queried each tick by `VisibilitySystem` and `PlayerMotor`.

#### Duration management

```
On equip timed tool:
  activeToolEndTime = Date.now() + toolDef.durationMs
  Start HUD duration bar countdown

Each tick:
  if activeToolEndTime && Date.now() >= activeToolEndTime:
    unequip tool, clear effects, notify HUD
```

#### Compass behavior (permanent tool)

- When compass is active, `ToolHud` renders a directional arrow pointing to the exit tile
- World-space exit direction projected to screen-space for overlay positioning
- No tick cost — computed once per player move

#### Map Fragment behavior (one-shot)

- On use: compute a set of tiles covering 20% of maze (BFS from current position)
- Mark those tiles as `explored = true` in `MazeInstance`
- `FogRenderer` dirty-marks affected tiles for material update
- Tool is consumed immediately (removed from inventory, one-shot flag)

---

### 6.4 Hazard System (`HazardSystem`)

#### One-Way Doors

- Stored as `HazardInstance` with `allowedDirection`
- `CollisionSystem` is extended: before resolving a move step, `HazardSystem.checkPassThrough(from, to)` returns `false` if the player's movement vector opposes the allowed direction
- Visual: half-height door mesh with directional arrow decal

#### Pressure Plates

- On player tile enter: set `active = true`, emit `PLATE_TRIGGERED` event
- On player tile exit: set `active = false`, emit `PLATE_RELEASED` event
- Subscribed hazard (e.g., a linked door) toggles `open` state accordingly
- Visual: floor tile variant + slight depression animation via mesh Y-offset lerp

#### Locked Doors

- `CellType` extended with `locked_door`; treated as wall until opened
- `HazardSystem.tryOpen(tile, inventory)` checks for skeleton key; if present, removes key from inventory, sets door `open`, updates collision map
- On open: mesh swaps to open-door variant; `CollisionSystem` dirty-marks cell

---

### 6.5 Audio Manager (`AudioManager`)

#### Library

Howler.js loaded as a project dependency (`npm install howler`).

#### Sound categories

| Category | Trigger | Asset |
|----------|---------|-------|
| Footsteps | Player moves at least 0.5 tiles | `step_stone.mp3` |
| Pickup | Item collected | `pickup.mp3` |
| Portal enter | Overlap with any portal | `portal_enter.mp3` |
| Tool equip | Tool activated | `equip.mp3` |
| Tool expire | Duration ends | `expiry.mp3` |
| Hazard trigger | Pressure plate / door | `click.mp3` |
| Ambient loop | In-maze background | `ambient_loop.mp3` |

#### Implementation notes

- All sounds are lazy-loaded on first play; critical assets pre-loaded on game start
- Master volume controlled via settings (stored in `localStorage`; not in save code)
- Howler sprite sheet for short SFX to minimize network requests

---

### 6.6 Particle & Visual Effects

#### `ParticleSystem`

A lightweight wrapper around Three.js `Points`:

```ts
interface ParticleEmitter {
  position: THREE.Vector3;
  rate: number;           // particles per second
  lifetime: number;       // seconds
  spread: number;         // cone spread radius
  color: THREE.Color;
  size: number;
  onUpdate?: (particle: Particle, dt: number) => void;
}
```

- `ParticleSystem.createEmitter(opts)` — returns an emitter handle
- `ParticleSystem.destroyEmitter(handle)` — cleans up GPU buffers
- Updated in main loop `render()` phase (cosmetic only, no gameplay coupling)

#### Torch Light FX (`TorchLightFX`)

- Creates a `THREE.PointLight` at player world position
- Intensity and range modulated by a low-frequency sine for flicker effect
- Activated when Torch tool is equipped; deactivated and removed on expiry
- Does not replace the static ambient/directional lights — additive on top

#### Portal Shimmer

- Two emitters per portal: ascending particles (alpha fade) in portal-type color
- For back-portals: warm amber `THREE.Color(1.0, 0.6, 0.1)`
- For forward portals: cool blue `THREE.Color(0.3, 0.7, 1.0)`

---

## 7. Extended Maze Generation

### 7.1 Integrated Spawning Pipeline

Phase 2 extends the maze generation pipeline from Phase 1:

```
generate(params) → MazeInstance  [Phase 1]
       │
       ├── spawnItems(maze, mazeNumber) → MazeItemSpawn[]   [Phase 2, ItemSpawner]
       └── spawnHazards(maze, mazeNumber) → HazardInstance[] [Phase 2, HazardSpawner]
```

Both spawners use the same `mazeSeed` (derived from player seed + maze number) to remain deterministic. They are called once on maze load; results stored on `MazeInstance`.

### 7.2 Hazard Placement Rules

- One-way doors: placed midway along corridors of length ≥ 3; never on the critical path (verified post-placement with BFS, treating doors as passable in the allowed direction)
- Pressure plates: placed in open areas or adjacent to dead ends; linked door is placed within 5 tiles
- Locked doors: only appear after maze 10; max one per maze; never on the primary critical path (solution path still valid with key in hand)

### 7.3 Difficulty Scaling (Phase 2 additions)

| Maze Range | One-Way Doors | Pressure Plates | Locked Doors |
|------------|---------------|-----------------|--------------|
| 1-5 | 0 | 0 | 0 |
| 6-10 | 1 | 0 | 0 |
| 11-15 | 1-2 | 1 | 1 |
| 16-20 | 2-3 | 1-2 | 1 |
| 21+ | 3+ | 2+ | 1-2 |

---

## 8. Rendering & Asset Strategy (Phase 2)

### 8.1 New Asset Usage

| Feature | glTF Asset(s) |
|---------|---------------|
| Back portal | Same model as exit portal (separate `loadBackPortalModel()` asset), amber tint |
| One-way door | `door_closed` (rotated per direction) |
| Locked door | `door_closed` with tinted material |
| Open door | `chest_open` repurposed or custom open variant |
| Pressure plate | `button` asset, slightly recessed |
| Maze Shard | `block_crystal` scaled down |
| Ancient Key | `key` asset |
| Lore Page | `book` or `lore_page` if available, else billboard quad |
| Artifact Piece | `artifact_crystal` or substitute |
| Running Boots | `boot` asset (if present) or billboard |

### 8.2 Minimap Overlay (Map Fragment)

- Rendered on a separate `<canvas>` overlay element (not Three.js)
- On reveal: iterate `MazeInstance.cells`, draw visited + newly revealed tiles as pixels
- Transparent except for drawn tiles; positioned top-right of viewport
- Toggled visible/hidden via `MinimapOverlay.setVisible(bool)`

### 8.3 Compass Overlay

- SVG or Canvas element in the HUD layer
- Arrow element rotated to match world-space direction from player to exit projected onto screen
- Updated on every player tile change (cheap, not per-frame)

---

## 9. Save System — Version 2

### 9.1 Version Bump

Save code `version` is currently `1`. It is bumped to `2` for Phase 2 tool, item, and portal hub additions. The migration map handles v1 codes:

```ts
function migrateSaveState(raw: any): SaveState {
  if (raw.version === 1) {
    return {
      ...raw,
      version: 2,
      activeToolId: null,
      activeToolExpiry: null,
      collectedShards: 0,
      pickedUpItems: {},
      portalHubUnlocked: false, // not yet earned
    };
  }
  return raw as SaveState;
}
```

### 9.2 Payload Size Impact

New Phase 2 fields (`activeToolId`, `activeToolExpiry`, `collectedShards`, `pickedUpItems`) add approximately 30-100 bytes of raw JSON depending on progress depth. After LZ-string compression and Base62 encoding, target code length remains under 80 characters for typical early-game saves (< maze 20).

---

## 10. UI/UX Technical Design (Phase 2)

### 10.1 New / Updated Screens

| Component | Change | Notes |
|-----------|--------|-------|
| HUD | Add tool slot, duration bar, shard counter | Visible during play |
| Compass Overlay | New | Shown when compass tool active |
| Minimap Overlay | New | Revealed tiles canvas; shown after Map Fragment use |
| Inventory Modal | New | Pause menu → "Inventory" |
| Portal Hub Modal | New | Full-screen maze selector; shown on back portal overlap when hub unlocked |
| Portal labels | New | Small world-space label above each portal; hub label reads "Return Portal (Hub)" |
| Tool unlock toast | New | Brief slide-up notification on unlock |
| Portal hub unlock toast | New | Distinct discovery notification when Wayfinder's Stone picked up |
| Hazard visual hints | New | Arrow markers near one-way doors |

### 10.2 Tool HUD Slot

```
┌──────────────────────────────────┐
│  [Tool Icon]  Torch  [===========] 42s  │
└──────────────────────────────────┘
```

- Duration bar fills right-to-left as time expires
- Clicking slot opens quick-swap from inventory
- Pulsing glow for last 10 seconds of duration

### 10.3 Inventory Modal

Accessible from pause menu. Shows:

- Equipped tool (with swap options)
- Collected tools not yet equipped
- Collectible items (shards count, keys, lore pages)
- Artifact pieces with lore snippet tooltip

---

## 11. Module Contracts (Phase 2 Additions)

> **PortalSystem (existing — no changes needed):**
> ```ts
> class PortalSystem {
>   checkExitOverlap(playerPos: THREE.Vector3, exitPos: THREE.Vector3): boolean;
>   checkBackOverlap(playerPos: THREE.Vector3, backPos: THREE.Vector3): boolean;
>   prime(portalId: 'forward' | 'backward'): void;
>   reset(): void;
> }
> ```

### 11.1b `PortalHubModal` (new)

```ts
class PortalHubModal {
  show(completedMazes: number[], mazeFirstCompletionTimes: Record<number, number>,
       mazeItemState: Record<number, MazeItemState>): Promise<number | null>;
  // Resolves with chosen maze number, or null if dismissed
  hide(): void;
}
```

### 11.2 `ItemSystem`

```ts
class ItemSystem {
  loadMaze(maze: MazeInstance, mazeNumber: number, state: MazeItemState): void;
  update(playerTile: { x: number; y: number }): ItemPickupEvent[];
  getSpawns(): MazeItemSpawn[];
}
```

### 11.3 `ToolSystem`

```ts
class ToolSystem implements ToolEffectProvider {
  equip(toolId: ToolId): void;
  unequip(): void;
  update(deltaMs: number): ToolExpiredEvent | null;
  getVisibilityBonus(): number;
  getSpeedMultiplier(): number;
  getCompassActive(): boolean;
  getMapRevealFraction(): number;
}
```

### 11.4 `HazardSystem`

```ts
class HazardSystem {
  loadMaze(hazards: HazardInstance[]): void;
  checkPassThrough(fromTile: Tile, toTile: Tile, direction: Direction): boolean;
  update(playerTile: Tile, inventory: InventoryState): HazardEvent[];
}
```

### 11.5 `AudioManager`

```ts
class AudioManager {
  playOnce(sound: SoundId): void;
  playLoop(sound: SoundId): Howl;
  stopLoop(sound: SoundId): void;
  setMasterVolume(volume: number): void; // 0–1
}
```

---

## 12. Testing Strategy

### 12.1 Unit Tests

| Test | Coverage |
|------|----------|
| `PortalSystem.checkExitOverlap` — triggers once per overlap, resets on exit | PortalSystem |
| `PortalSystem.prime` — prevents trigger immediately after spawn | PortalSystem |
| `canBacktrackToPreviousMaze` — false on maze 1, false if prior maze not completed | GameApp |
| `portalHubUnlocked` defaults to false on new game and v1 save migration | GameApp / SaveCodec |
| `PortalHubModal` — picking maze N calls transition to N; Escape dismisses without navigating | PortalHubModal |
| `ItemSpawner` — spawns never on wall/entry/exit tiles | ItemSpawner |
| `ItemSpawner` — deterministic from same seed | ItemSpawner |
| `ToolSystem.update` — tool expires at correct time | ToolSystem |
| `ToolSystem` — one-shot tool consumed after use | ToolSystem |
| `HazardSystem.checkPassThrough` — blocks wrong direction | HazardSystem |
| Locked door opens with key; key consumed | HazardSystem |
| Save v1 code migrates to v2 cleanly (`portalHubUnlocked: false`) | SaveCodec |
| Save v2 full roundtrip including tool expiry and picked-up items | SaveCodec |

### 12.2 Integration Tests

- Equip torch → visibility radius increases by 2; expires → returns to base radius
- Pick up compass → HUD compass overlay appears, points toward exit
- Use Map Fragment → 20% of tiles revealed in minimap; item consumed from inventory
- Back portal visible in maze N+1 after first completing maze N; sequential traversal returns to maze N, player spawns at exit tile
- Pick up Wayfinder's Stone in maze 7 → `portalHubUnlocked` set, back portal visual brightens, hub modal opens on next overlap
- Portal hub modal lists all completed mazes; selecting maze 3 from maze 10 transitions directly to maze 3 (not N-1)
- Hub modal dismissed with Escape — no transition occurs; portal primed to prevent immediate re-open
- Re-enter completed maze — already-picked-up items do not respawn
- Walk against one-way door from forbidden side — movement blocked; correct side allowed
- Skeleton key in inventory + locked door — door opens, key removed

### 12.3 Manual QA Checklist (Phase 2 Gate)

- [ ] All five tools obtainable and functional before maze 20
- [ ] Backward portal present in maze 2 after completing maze 1
- [ ] Wayfinder's Stone discoverable in maze 7; picking it up shows hub unlock notification
- [ ] Portal hub modal opens on back portal overlap after Stone is found; lists all completed mazes
- [ ] Selecting a non-adjacent maze in the hub transitions directly to it
- [ ] Hub modal dismissible with Escape; portal does not immediately re-trigger
- [ ] Compass arrow tracks exit correctly across all 4 cardinal exit positions
- [ ] Minimap renders without flickering and persists across maze re-entry
- [ ] Torch light flicker visible and does not clip through walls
- [ ] Audio plays at appropriate volume; ambient loop transitions cleanly
- [ ] Save code restores active tool timer within ±1 second accuracy
- [ ] No progression soft-locks via hazard placement edge cases
- [ ] Phase 1 test suite fully green

---

## 13. Delivery Plan (6 weeks)

### Week 9–10: Items Foundation, Save Codec v2 & Portal Hub

- ~~Portal sequential backtracking — already complete~~ ✅
- `ItemSpawner` — dead-end placement, determinism, per-maze item definitions
- Wayfinder's Stone spawn (maze 7, unique), pickup handler, `PORTAL_HUB_UNLOCKED` event
- `startMazeTransition` extended to accept optional `targetMaze` override
- `PortalHubModal` — maze list UI, selection callback, Escape dismissal
- Back portal visual upgrade on hub unlock (`emissiveIntensity` bump + particle ring)
- `ItemSystem` — pickup detection, inventory mutations, `MazeItemState` on `GameState`
- Save codec bump to v2 (`portalHubUnlocked`, tool expiry, shard count, picked-up items)

### Week 11–12: Tools & Hazards

- `ToolSystem` — all five tools, effect dispatch, HUD slot
- `HazardSpawner` + `HazardSystem` — one-way doors, pressure plates, locked doors
- Hazard mesh builders integrated with maze load

### Week 13–14: Sound, Particles & UX Polish

- `AudioManager` integration (Howler.js)
- `ParticleSystem` and `TorchLightFX`
- Minimap overlay (`MinimapOverlay`)
- Compass HUD overlay
- Inventory modal
- Tool unlock toast notifications
- Full Phase 2 test pass and bug fixes

---

## 14. Acceptance Criteria (Phase 2 Exit)

1. ✅ Player can travel back to the immediately preceding completed maze via backward portal (implemented in Phase 1).
2. After finding the Wayfinder's Stone (or completing the lore arc), the back portal becomes a hub; player can jump directly to any previously completed maze.
3. Maze item state persists; already-collected items are absent on re-entry.
4. All five tools are obtainable, equippable, and produce correct gameplay effects.
5. Duration timers expire accurately and are restored from save code.
6. One-way doors block movement in the forbidden direction.
7. Pressure plates toggle linked doors; locked doors open with skeleton key.
8. Audio plays for all listed interaction events without latency issues.
9. Particle effects render without measurable FPS regression from Phase 1 baseline.
10. Save v1 codes load without error under the migration path.
11. Phase 1 acceptance criteria all still satisfied.

---

## 15. Risks & Mitigations (Phase 2)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Player misses Wayfinder's Stone in maze 7 and never unlocks hub | Diminished backtracking UX | Lore arc provides alternative unlock; Stone can be collected on a return visit |
| Portal hub modal breaks game loop / input focus | Soft lock | Follow established pause-menu focus-trap pattern; resume input on modal close |
| Deterministic hazard placement creates unsolvable edge cases | Progression blocker | Post-placement BFS validation; retry with incremented sub-seed |
| Timed tool desync after save/load | Wrong expiry restored | Persist `activeToolExpiry` as absolute epoch ms; cap remaining time on load |
| Howler.js adds bundle weight | Slower initial load | Tree-shake unused codecs; defer audio load until first interaction |
| Particle system overdraw on low-end hardware | FPS drop | Cap active particles per emitter; disable particles at low-quality setting |
| Map Fragment canvas conflicts with main Three.js canvas | Z-index / event issues | Isolate minimap canvas as `pointer-events: none` sibling in HUD layer |

---

## 16. Future-Ready Hooks (Phase 3 readiness)

- `EntitySpawner` stub accepts enemy count from `getMazeParams` once enemies are introduced
- `HazardSystem` event bus can be extended for timed traps and teleportation tiles without API changes
- `AudioManager` supports 3D positional audio via Howler `pannerAttr` for enemy sound cues
- `ParticleSystem` is generic; themed maze effects (snow, fire) add emitter configs only
- Tool definitions table is data-driven; Phase 3 tools add entries without structural changes

---

## Appendix A: Updated Constants

| Constant | Value | Notes |
|----------|-------|-------|
| Base visibility radius | 3 tiles | Phase 1 default |
| Torch visibility bonus | +2 tiles | 5 tiles total |
| Torch duration | 60 seconds | Configurable |
| Running boots speed multiplier | 1.3× | Configurable |
| Running boots duration | 30 seconds | Configurable |
| Map Fragment reveal fraction | 0.20 | 20% of maze cells |
| Max particles per emitter | 150 | Performance cap |
| Tool HUD warning pulse threshold | 10 seconds | Last 10s flashes |
| Save code version | 2 | Bumped from Phase 1 (bumped for tools, items, and portal hub unlock) |
| Target save code length | < 80 chars | Typical early-game |

---

## Appendix B: Tool Unlock Sequence Reference

```
Maze  1 → Basic Torch unlocked   (+2 vis, 60s)
Maze  5 → Compass unlocked       (exit arrow, permanent)
Maze 10 → Map Fragment unlocked  (20% reveal, one-shot)
Maze 15 → Running Boots unlocked (+30% speed, 30s)
Maze 20 → Skeleton Key unlocked  (opens locked door, one-shot)
```

---

*End of Phase 2 TDD.*
