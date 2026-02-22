# Copilot Instructions — Mazed

## Project Overview
Browser-based 3D maze exploration game (TypeScript + Three.js + Vite). Procedurally generated fog-of-war mazes with progressive difficulty, code-based saves, and a portal network.

## Key References
- `docs/PRD.md` — product requirements, game mechanics, progression design
- `docs/TDD-phase1.md` / `docs/TDD-phase2.md` — technical design for each phase
- `.chats/` — previous AI session chat history; check here for context on past decisions

## Agent Workflow
- Work on **one thing at a time** — complete it, then ask the user for validation/confirmation before proceeding
- **Commit current changes** before moving on to the next task; avoid bundling unrelated changes in a single commit
- Keep commits small and focused — one logical change per commit
- Every commit must be **independently working** — never commit a half-implemented feature that requires future changes to compile or function correctly

## Developer Workflows
```
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build
npm run test         # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
```
Tests live in `tests/` (separate from `src/`). No test framework setup beyond Vitest — import directly from `src/`.

## Architecture

### Layer Hierarchy
| Layer | Path | Rule |
|---|---|---|
| Types | `src/types/` | Pure data shapes — no logic, no Three.js |
| Utils | `src/utils/` | Pure functions — no Three.js, no game state |
| Maze logic | `src/game/maze/` | Procedural generation + game rules — no rendering |
| Systems | `src/game/systems/` | Stateless game logic (collision, items, hazards…) |
| Rendering | `src/game/rendering/` | Three.js mesh builders + scene management |
| Player | `src/game/player/` | Input capture + physics movement |
| UI | `src/game/ui/` | DOM-only HUD/menu controllers (no Three.js) |
| Core | `src/game/core/` | Bootstrap, fixed game loop, constants, state factory |

### Central Orchestrator: `GameApp`
`src/game/core/GameApp.ts` is the single class that wires everything together. It owns all system instances as private fields and is the only place where systems communicate. Do not add cross-system coupling anywhere else.

### Game Loop
`GameLoop` runs a **fixed-timestep** physics tick (`FIXED_TICK_SECONDS = 1/60`) + a render callback that receives `alpha` (interpolation factor). Frame delta is capped at 0.1 s to avoid spiral of death.

### State Split: `GameState` vs `SaveState`
- **`GameState`** (`src/types/game.ts`) — full runtime state, includes live `MazeInstance`, timers, `runStatus`.
- **`SaveState`** (`src/types/save.ts`) — serializable snapshot used in save codes. `GameApp` converts between them on save/load.
- `createInitialState()` (`src/game/core/GameState.ts`) is the single source of truth for defaults.

## Key Patterns

### Deterministic Generation
Mazes are derived purely from `seed + mazeNumber`. The same pair always produces the same maze. `SeededRandom` (`src/utils/random.ts`) drives all randomness in `MazeGenerator`.

### Bitmask for Tool Unlocks
Tools use positional bit flags. Always use the helpers, never manipulate the mask directly:
```ts
getToolBit(toolId)            // bit position
hasToolUnlocked(mask, toolId) // test
unlockTool(mask, toolId)      // set
```
Only tools in `IMPLEMENTED_TOOL_ORDER` (`src/types/items.ts`) have working gameplay code; others are designed but stubbed.

### Save Code Format
`MAZED-{base62payload}-{checksum}` — payload is JSON UTF-8 bytes encoded as base62 digit pairs. Logic lives in `src/utils/saveCode.ts`. Version field (`VERSION = 2`) gates backwards-compat migration.

### Coordinate System
- Maze grid: `cells[y][x]` (row-major, y = row, x = column)
- 3D world: tile column → `worldX`, tile row → `worldZ`; `TILE_SIZE = 1` (1 tile = 1 Three.js unit)
- Player height is fixed; only XZ movement matters for gameplay

### 3D Assets
All glTF assets are in `public/assets/cubeworld/` and loaded via `AssetRegistry` which deduplicates concurrent loads. Player character models must be cloned via `SkeletonUtils.clone` to get independent animation state.

### Fog of War
Each `MazeCell` has two flags: `explored` (ever visible) and `currentlyVisible` (within radius this tick). `VisibilitySystem` updates them; `FogRenderer` drives the Three.js material opacity accordingly.

### Stateless Systems
Systems like `CollisionSystem` expose only static methods — no stored state:
```ts
CollisionSystem.collidesWithWalls(maze, worldX, worldZ, radius)
```
Follow this pattern when adding new systems.
