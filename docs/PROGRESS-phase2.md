# Mazed — Phase 2 Progress Tracker

**Last updated:** 2026-02-22  
**Purpose:** Shared status snapshot for future sessions (what is done, what is pending, and what should be built next).

---

## 1) Overall Status

Phase 2 is **partially complete**.

- ✅ Core portal backtracking (N → N-1) is implemented
- ✅ Portal hub unlock flow (Wayfinder + modal selection) is implemented
- ✅ Item spawning/pickup foundation is implemented
- ✅ Tool system baseline is implemented
- ✅ Hazard MVP (one-way + locked doors) is implemented
- ✅ Pressure plates + linked delayed doors are implemented
- ❌ Audio/particles/minimap/inventory polish systems are not implemented yet

---

## 2) Completed Work (Reference)

### 2.1 Portal Network + Hub Upgrade
- Sequential backtracking is functional
- Hub mode is gated by `portalHubUnlocked`
- Back portal can open a selection modal for completed mazes

### 2.2 Save System v2 + Migration
- Save codec version is `2`
- v1 → v2 migration defaults are in place
- New v2 fields include hub/tool/item-related state

### 2.3 Items + Tools Foundation
- Deterministic item spawning is wired
- Pickup/state persistence is wired
- Tool runtime state and duration handling are wired
- Current runtime-implemented tool subset is controlled via implemented-order constants

### 2.4 Hazards MVP
- Deterministic hazard spawning exists
- One-way door traversal rules are enforced
- Locked door + skeleton-key consumption path is enforced
- Hazard visuals were added and iteratively tuned

---

## 3) Incomplete vs Phase 2 TDD

### 3.1 Gameplay Gaps
- [ ] Pressure plate depression animation polish (active/inactive Y-lerp)

### 3.2 Tools/UX Gaps
- [ ] Full 5-tool runtime flow finalized (unlock/use path for all tools)
- [ ] Compass gameplay-facing overlay
- [ ] Map Fragment minimap reveal UX

### 3.3 Week 13–14 Systems (Not Landed)
- [ ] `AudioManager`
- [ ] `ParticleSystem`
- [ ] `TorchLightFX`
- [ ] `MinimapOverlay`
- [ ] `InventoryModal`
- [ ] Tool unlock toast notifications

---

## 4) Current Suggested Build Order

To finish Phase 2 with minimal risk, implement in this order:

1. **Pressure plate animation polish** (plate depression lerp + feedback tune)
2. **Tool completeness pass** (ensure all 5 tool flows are actually playable)
3. **Compass + minimap UX** (visible, testable player feedback)
4. **AudioManager integration**
5. **Particles + torch light FX + remaining polish**

---

## 5) Validation Snapshot

Latest baseline status at time of this document update:

- Test suite passing (`npm run test`)
- Build passing in recent Phase 2 slices (`npm run build`)

> Re-run both commands after each milestone and update this file.

---

## 6) Session Update Template

Use this block at the end of each future session:

```md
### Session Update — YYYY-MM-DD
- Scope:
- Files changed:
- Tests run:
- Build result:
- New completed items:
- Remaining blockers:
- Next single step:
```

### Session Update — 2026-02-22
- Scope: Added a dev-only debug flag to start a new game from any maze number.
- Files changed: `src/utils/debugFlags.ts`, `src/game/core/GameApp.ts`, `tests/debug-flags.test.ts`, `README.md`
- Tests run: `npm run test` (35/35 passing)
- Build result: `npm run build` (passing)
- New completed items: New-game flow now respects `?debugStartMaze=<N>` in development builds only; includes parser test coverage.
- Remaining blockers: Core Phase 2 blockers unchanged (pressure plates and remaining polish systems).
- Next single step: Implement pressure plate hazards (types, deterministic spawn integration, runtime behavior, and tests).

### Session Update — 2026-02-22
- Scope: Made one-way door direction explicitly visible in hazard rendering and added renderer-level test coverage.
- Files changed: `src/game/rendering/HazardMeshBuilder.ts`, `tests/hazard-mesh-builder.test.ts`
- Tests run: `npm run test` (36/36 passing)
- Build result: `npm run build` (passing)
- New completed items: One-way doors now render with a dedicated directional marker (including glTF template path), preventing orientation from appearing static.
- Remaining blockers: Core Phase 2 blockers unchanged (pressure plates and remaining polish systems).
- Next single step: Implement pressure plate hazards (types, deterministic spawn integration, runtime behavior, and tests).

### Session Update — 2026-02-22
- Scope: Replaced one-way door marker approach with actual swing animation triggered on successful one-way traversal.
- Files changed: `src/game/core/GameApp.ts`, `src/game/rendering/HazardMeshBuilder.ts`, `src/game/systems/HazardSystem.ts`, `tests/hazard-mesh-builder.test.ts`
- Tests run: `npm run test` (36/36 passing)
- Build result: `npm run build` (passing)
- New completed items: One-way doors now visibly rotate open and settle back when entered from allowed direction; no persistent marker overlay is used.
- Remaining blockers: Core Phase 2 blockers unchanged (pressure plates and remaining polish systems).
- Next single step: Implement pressure plate hazards (types, deterministic spawn integration, runtime behavior, and tests).

### Session Update — 2026-02-22
- Scope: Simplified one-way door visualization to slide into the floor, remain open while player is on the tile, and close after leaving the tile.
- Files changed: `src/game/core/GameApp.ts`, `src/game/rendering/HazardMeshBuilder.ts`, `tests/hazard-mesh-builder.test.ts`
- Tests run: `npm run test` (36/36 passing)
- Build result: `npm run build` (passing)
- New completed items: One-way doors no longer snap back immediately; open state is held until tile pass-through completes.
- Remaining blockers: Core Phase 2 blockers unchanged (pressure plates and remaining polish systems).
- Next single step: Implement pressure plate hazards (types, deterministic spawn integration, runtime behavior, and tests).

### Session Update — 2026-02-22
- Scope: Centralized door rendering alignment so one-way and locked doors share the same tile-centered placement path.
- Files changed: `src/game/rendering/HazardMeshBuilder.ts`, `tests/hazard-mesh-builder.test.ts`
- Tests run: `npm run test` (37/37 passing)
- Build result: `npm run build` (passing)
- New completed items: Removed one-way-only positional offset; all door hazards now use shared transform helpers for consistent alignment.
- Remaining blockers: Core Phase 2 blockers unchanged (pressure plates and remaining polish systems).
- Next single step: Implement pressure plate hazards (types, deterministic spawn integration, runtime behavior, and tests).

### Session Update — 2026-02-22
- Scope: Corrected door mesh placement so one-way visuals align with traversal gate while keeping shared transform flow.
- Files changed: `src/game/rendering/HazardMeshBuilder.ts`, `tests/hazard-mesh-builder.test.ts`
- Tests run: `npm run test` (37/37 passing)
- Build result: `npm run build` (passing)
- New completed items: One-way doors are rendered back on the doorway edge to match blocking behavior; locked doors remain centered.
- Remaining blockers: Core Phase 2 blockers unchanged (pressure plates and remaining polish systems).
- Next single step: Implement pressure plate hazards (types, deterministic spawn integration, runtime behavior, and tests).

### Session Update — 2026-02-22
- Scope: Simplified door alignment rule so both one-way and locked doors are centered on their hazard tile.
- Files changed: `src/game/rendering/HazardMeshBuilder.ts`, `tests/hazard-mesh-builder.test.ts`
- Tests run: `npm run test` (37/37 passing)
- Build result: `npm run build` (passing)
- New completed items: Door placement is now uniform and type-agnostic; door-type differences are limited to open/traversal behavior.
- Remaining blockers: Core Phase 2 blockers unchanged (pressure plates and remaining polish systems).
- Next single step: Implement pressure plate hazards (types, deterministic spawn integration, runtime behavior, and tests).

### Session Update — 2026-02-22
- Scope: Corrected door visual centering by aligning rendered model bounds to hazard tile center after template swap.
- Files changed: `src/game/rendering/HazardMeshBuilder.ts`, `tests/hazard-mesh-builder.test.ts`
- Tests run: `npm run test` (38/38 passing)
- Build result: `npm run build` (passing)
- New completed items: Door visuals now remain centered on hazard tiles even when source glTF template pivots are asymmetric.
- Remaining blockers: Core Phase 2 blockers unchanged (pressure plates and remaining polish systems).
- Next single step: Implement pressure plate hazards (types, deterministic spawn integration, runtime behavior, and tests).

### Session Update — 2026-02-22
- Scope: Implemented pressure plate hazards with linked doors, delayed relock timing, color-matched visuals, and shared slide door animation behavior.
- Files changed: `src/types/hazards.ts`, `src/game/maze/HazardSpawner.ts`, `src/game/systems/HazardSystem.ts`, `src/game/rendering/HazardMeshBuilder.ts`, `src/game/core/GameApp.ts`, `tests/hazard-system.test.ts`, `tests/hazard-spawner.test.ts`, `tests/hazard-mesh-builder.test.ts`
- Tests run: `npm run test` (41/41 passing)
- Build result: `npm run build` (passing)
- New completed items: Added deterministic pressure plate + pressure door pair spawning, linked runtime plate activation with delayed door relock, and reused shared door positioning/slide animation flow for pressure doors.
- Remaining blockers: Phase 2 polish systems remain (audio, particles, minimap/inventory UX, and full tool UX completeness pass).
- Next single step: Implement pressure plate depression animation (plate mesh Y-offset lerp) tied to active state.

### Session Update — 2026-02-22
- Scope: Fixed pressure plate door orientation so doors align wall-to-wall based on corridor axis instead of always rendering horizontal.
- Files changed: `src/types/hazards.ts`, `src/game/maze/HazardSpawner.ts`, `src/game/rendering/HazardMeshBuilder.ts`, `tests/hazard-system.test.ts`, `tests/hazard-spawner.test.ts`, `tests/hazard-mesh-builder.test.ts`
- Tests run: `npm run test` (41/41 passing)
- Build result: `npm run build` (passing)
- New completed items: Pressure-door metadata now stores deterministic passage axis from neighboring tiles; renderer applies axis-based yaw so vertical corridors render vertical doors.
- Remaining blockers: Phase 2 polish systems remain (audio, particles, minimap/inventory UX, and full tool UX completeness pass).
- Next single step: Implement pressure plate depression animation (plate mesh Y-offset lerp) tied to active state.

### Session Update — 2026-02-22
- Scope: Fixed locked-door orientation to use corridor axis metadata instead of fixed yaw, ensuring all door hazards span wall-to-wall.
- Files changed: `src/types/hazards.ts`, `src/game/maze/HazardSpawner.ts`, `src/game/rendering/HazardMeshBuilder.ts`, `tests/hazard-system.test.ts`, `tests/hazard-spawner.test.ts`, `tests/hazard-mesh-builder.test.ts`
- Tests run: `npm run test` (42/42 passing)
- Build result: `npm run build` (passing)
- New completed items: Locked doors now spawn with deterministic `passageAxis`; renderer applies axis-based yaw for horizontal/vertical corridor alignment.
- Remaining blockers: Phase 2 polish systems remain (audio, particles, minimap/inventory UX, and full tool UX completeness pass).
- Next single step: Implement pressure plate depression animation (plate mesh Y-offset lerp) tied to active state.

### Session Update — 2026-02-22
- Scope: Fixed axis-door placement ambiguity by restricting pressure-plate and locked-door tiles to straight-corridor candidates only.
- Files changed: `src/game/maze/HazardSpawner.ts`, `tests/hazard-spawner.test.ts`
- Tests run: `npm run test` (42/42 passing)
- Build result: `npm run build` (passing)
- New completed items: Axis-based doors no longer spawn on corner/intersection tiles that could force incorrect visual orientation.
- Remaining blockers: Phase 2 polish systems remain (audio, particles, minimap/inventory UX, and full tool UX completeness pass).
- Next single step: Implement pressure plate depression animation (plate mesh Y-offset lerp) tied to active state.

### Session Update — 2026-02-22
- Scope: Corrected an accidental axis-to-yaw inversion for axis-based doors; restored model-accurate yaw mapping while keeping straight-corridor spawn filtering.
- Files changed: `src/game/rendering/HazardMeshBuilder.ts`, `tests/hazard-mesh-builder.test.ts`
- Tests run: `npm run test` (42/42 passing)
- Build result: `npm run build` (passing)
- New completed items: Locked and pressure-plate doors share the same axis metadata but now use the model-correct yaw mapping again.
- Remaining blockers: Phase 2 polish systems remain (audio, particles, minimap/inventory UX, and full tool UX completeness pass).
- Next single step: Implement pressure plate depression animation (plate mesh Y-offset lerp) tied to active state.
