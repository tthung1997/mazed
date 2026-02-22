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
- ❌ Pressure plates are not implemented yet
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
- [ ] Pressure plate hazards (spawn + runtime behavior + tests)
- [ ] Linked door toggle behavior from pressure plates

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

1. **Pressure plates** (types → spawner → `HazardSystem` behavior → tests)
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
