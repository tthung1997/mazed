# Product Requirements Document (PRD)
# Mazed

**Version:** 1.0  
**Date:** February 3, 2026  
**Author:** Product Team  
**Status:** Draft

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Personas](#4-user-personas)
5. [Core Features](#5-core-features)
6. [Game Mechanics](#6-game-mechanics)
7. [Technical Architecture](#7-technical-architecture)
8. [Visual Design & Assets](#8-visual-design--assets)
9. [Progression System](#9-progression-system)
10. [Save System](#10-save-system)
11. [Procedural Generation](#11-procedural-generation)
12. [Roadmap & Milestones](#12-roadmap--milestones)
13. [Open Questions & Risks](#13-open-questions--risks)

---

## 1. Executive Summary

**Mazed** is a single-player procedural puzzle game where players navigate through an infinite series of fog-shrouded mazes. The game features limited visibility mechanics, progressive unlocks, portal-based travel between mazes, and a unique code-based save system. Every player's journey is different, with procedurally generated mazes that increase in difficulty over time.

**Tagline:** *Escape the maze. Enter the next one. Repeat forever.*

---

## 2. Product Overview

### 2.1 Vision Statement
Create an endlessly engaging maze exploration game that combines the tension of limited visibility with the satisfaction of puzzle-solving and progression. Players should feel both the anxiety of being lost and the triumph of finding their way.

### 2.2 Target Platform
- **Primary:** Web (Browser-based)
- **Secondary:** Desktop (Windows, macOS, Linux)
- **Future:** Mobile (iOS, Android)

### 2.3 Genre & Style
- **Genre:** Puzzle / Exploration / Roguelike-lite
- **Visual Style:** 3D Low-poly / Voxel (Cubeworld aesthetic)
- **Perspective:** 2.5D Isometric with fixed camera angle, following the player
- **Tone:** Mysterious, atmospheric, with moments of discovery

### 2.4 Unique Selling Points
1. **Infinite Gameplay:** Procedurally generated mazes ensure unlimited content
2. **Fog of War:** Limited visibility creates tension and memorization challenges
3. **Code-Based Saves:** No accounts needed; shareable progress codes
4. **Portal Network:** Non-linear progression through interconnected mazes
5. **Progressive Unlocks:** New mechanics keep gameplay fresh

---

## 3. Goals & Success Metrics

### 3.1 Product Goals
| Priority | Goal | Description |
|----------|------|-------------|
| P0 | Core Loop | Players can navigate and complete procedural mazes |
| P0 | Save System | Code-based save/load functionality works reliably |
| P1 | Progression | Unlock system keeps players engaged |
| P1 | Difficulty Scaling | Mazes become progressively harder |
| P2 | Portal System | Players can travel between completed mazes |
| P2 | Collectibles | Hidden items encourage exploration and backtracking |

### 3.2 Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Session Length | > 15 minutes | Average playtime per session |
| Return Rate | > 40% | Players who return within 7 days |
| Maze Completion | > 70% | Players who complete first 5 mazes |
| Code Usage | > 50% | Players who use save codes |
| Viral Coefficient | > 0.3 | Code sharing leading to new players |

---

## 4. User Personas

### 4.1 Primary: "The Casual Puzzler"
- **Demographics:** 18-35, plays games 30-60 min/day
- **Motivation:** Quick puzzle sessions, sense of accomplishment
- **Behavior:** Plays during breaks, enjoys pick-up-and-play games
- **Needs:** Simple controls, clear objectives, easy save/resume

### 4.2 Secondary: "The Completionist"
- **Demographics:** 20-40, dedicated gamer
- **Motivation:** Unlock everything, reach highest maze count
- **Behavior:** Long sessions, returns frequently, shares progress
- **Needs:** Deep progression, hidden secrets, achievement tracking

### 4.3 Tertiary: "The Speedrunner"
- **Demographics:** 16-30, competitive mindset
- **Motivation:** Master mazes, optimize routes, beat records
- **Behavior:** Replays mazes, studies patterns, shares strategies
- **Needs:** Consistent generation (seeded), timer, leaderboards

---

## 5. Core Features

### 5.1 MVP Features (Phase 1)

#### 5.1.1 Maze Navigation
- 2.5D isometric movement on a flat plane with 3D assets
- WASD/Arrow key controls (8-directional movement)
- Fixed camera angle (~45°) that smoothly follows the player
- Collision detection with walls
- Optional: Click-to-move as alternative control scheme

#### 5.1.2 Limited Visibility (Fog of War)
- Player can only see ~3-5 tiles around them
- Fog/darkness obscures distant areas
- Visited areas remain slightly visible (memory mechanic)
- Dynamic lighting from player's position

#### 5.1.3 Procedural Maze Generation
- Deterministic generation from seed
- Guaranteed solvable path
- Difficulty parameters (size, complexity, dead ends)
- Unique maze per player per round (seeded by player code)

#### 5.1.4 Entry & Exit Portals
- Clear visual indication of start point
- Exit portal/gate to next maze
- Transition animation between mazes

#### 5.1.5 Code-Based Save System
- Generate alphanumeric code representing game state
- Input code to restore progress
- Encode: current maze, unlocks, collected items, seed

### 5.2 Phase 2 Features

#### 5.2.1 Portal Network
- Return portals to previous mazes
- Portal hub or direct connections
- Visual distinction between forward/back portals

#### 5.2.2 Collectible Items
- Hidden keys for locked paths
- Artifacts for progression
- Lore items for worldbuilding

#### 5.2.3 Tools & Equipment
- **Torch:** Increases visibility radius temporarily
- **Map Fragment:** Reveals portion of current maze
- **Compass:** Points toward exit
- **Boots:** Increases movement speed

#### 5.2.4 Basic Hazards
- Dead ends with visual cues
- One-way doors
- Pressure plates that trigger events

### 5.3 Phase 3 Features

#### 5.3.1 Monsters/Enemies
- Patrol patterns in mazes
- Sound cues for nearby threats
- Hiding mechanics
- Different enemy types with behaviors

#### 5.3.2 Advanced Traps
- Moving walls
- Teleportation tiles
- Timed challenges
- Puzzle-locked doors

#### 5.3.3 Environmental Themes
- Forest mazes (trees, bushes)
- Dungeon mazes (stone, torches)
- Ice mazes (slippery floors)
- Crystal caves (reflective surfaces)

#### 5.3.4 Meta Progression
- Permanent upgrades (starting visibility, move speed)
- Unlockable character skins
- Achievement system

---

## 6. Game Mechanics

### 6.1 Core Loop
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │  Enter   │───▶│ Navigate │───▶│  Find    │         │
│  │  Maze    │    │  & Explore│    │  Exit    │         │
│  └──────────┘    └──────────┘    └──────────┘         │
│       ▲               │               │                │
│       │               ▼               ▼                │
│       │         ┌──────────┐    ┌──────────┐         │
│       │         │ Collect  │    │  Enter   │         │
│       │         │  Items   │    │Next Maze │─────────┤
│       │         └──────────┘    └──────────┘         │
│       │               │                               │
│       │               ▼                               │
│       │         ┌──────────┐                         │
│       └─────────│Backtrack │                         │
│                 │(Portal)  │                         │
│                 └──────────┘                         │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### 6.2 Visibility System

| Visibility Level | Radius | Trigger |
|-----------------|--------|---------|
| Base | 3 tiles | Default |
| Torch | 5 tiles | Tool equipped |
| Enhanced Torch | 7 tiles | Upgraded tool |
| Maximum | 9 tiles | Rare item (temporary) |

**Fog States:**
- **Unexplored:** Completely black
- **Explored (Current):** Fully visible within radius
- **Explored (Memory):** Dimmed, shows layout but not details
- **Unexplored (Edge):** Gradient fade at visibility boundary

### 6.3 Difficulty Scaling

Difficulty is calculated based on **Maze Number (N)** and **Player Seed**:

```
Base Size = 10 + floor(N / 5) * 2
Complexity = min(0.3 + N * 0.02, 0.8)
Dead End Ratio = min(0.1 + N * 0.01, 0.4)
Hazard Count = floor(N / 10)
Enemy Count = max(0, floor((N - 20) / 10))
```

| Maze Range | Size | Complexity | Features |
|------------|------|------------|----------|
| 1-5 | 10x10 | Low | Basic paths only |
| 6-15 | 12x12 | Medium | Dead ends, first tools |
| 16-30 | 14x14 | Medium-High | Hazards, locked doors |
| 31-50 | 16x16 | High | Enemies, complex puzzles |
| 51+ | 18x18+ | Very High | All mechanics combined |

### 6.4 Item & Tool System

#### Tools (Equippable)
| Tool | Effect | Duration | Unlock Maze |
|------|--------|----------|-------------|
| Basic Torch | +2 visibility | 60 sec | 1 |
| Compass | Arrow to exit | Permanent | 5 |
| Map Fragment | Reveals 20% of maze | One-time | 10 |
| Running Boots | +30% speed | 30 sec | 15 |
| Skeleton Key | Opens one locked door | One-time | 20 |

#### Collectibles
| Item | Purpose | Location |
|------|---------|----------|
| Maze Shards | Currency for upgrades | Hidden in mazes |
| Ancient Keys | Unlock special areas | Specific mazes |
| Lore Pages | Worldbuilding | Random spawns |
| Artifact Pieces | Enable new mechanics | Boss mazes |

---

## 7. Technical Architecture

### 7.1 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Game Engine | Three.js | Web-native 3D, good performance |
| Language | TypeScript | Type safety, better tooling |
| Build Tool | Vite | Fast development, modern bundling |
| State Management | Custom Game State | Simple class-based state, no framework overhead |
| UI | HTML/CSS Overlays | Lightweight, positioned over canvas |
| 3D Assets | glTF | Industry standard, small files |
| Audio | Howler.js | Cross-browser audio support |

> **Note:** React was considered but deemed unnecessary. The game's UI is minimal (menus, HUD, save code modal) and can be efficiently handled with vanilla HTML/CSS overlays. This reduces bundle size and eliminates framework overhead.

### 7.2 Project Structure
```
mazed/
├── public/
│   ├── assets/
│   │   └── cubeworld/          # 3D models (glTF)
│   └── audio/                  # Sound effects, music
├── src/
│   ├── components/             # React UI components
│   ├── game/
│   │   ├── core/              # Game loop, state machine
│   │   ├── maze/              # Maze generation, pathfinding
│   │   ├── player/            # Player controller, inventory
│   │   ├── entities/          # Enemies, items, hazards
│   │   ├── rendering/         # Three.js scene, fog system
│   │   └── systems/           # Visibility, collision, portals
│   ├── utils/
│   │   ├── saveCode.ts        # Encode/decode save states
│   │   └── random.ts          # Seeded random generator
│   └── types/                 # TypeScript definitions
├── docs/
│   └── PRD.md                 # This document
└── package.json
```

### 7.3 Performance Targets

| Metric | Target | Priority |
|--------|--------|----------|
| Initial Load | < 3 seconds | P0 |
| Frame Rate | 60 FPS | P0 |
| Memory Usage | < 200 MB | P1 |
| Save Code Size | < 50 characters | P1 |
| Maze Generation | < 500 ms | P0 |

---

## 8. Visual Design & Assets

### 8.1 Art Style
- **Aesthetic:** Low-poly / Voxel / Cubeworld
- **Color Palette:** Earthy tones with magical highlights
- **Lighting:** Dynamic point lights, ambient fog
- **Reference:** Concept mockup in `/public/dungeon/concept.png`

### 8.2 Available Asset Categories

Based on the Cubeworld asset pack (107 total assets):

| Category | Count | Usage |
|----------|-------|-------|
| Animals | 9 | Ambient creatures, companions |
| Blocks | 15 | Maze walls, floors |
| Characters | 4 | Player avatars |
| Enemies | 9 | Hostile entities |
| Environment | 36 | Decorations, interactables |
| Pixel Blocks | 18 | Alternative wall styles |
| Tools | 16 | Player equipment |

### 8.3 Key Assets Mapping

#### Maze Construction
- **Walls:** `block_stone`, `block_brick`, `block_greybricks`
- **Floor:** `block_dirt`, `block_grass`, `block_woodplanks`
- **Special:** `block_crystal`, `block_ice` (themed mazes)

#### Environment Props
- **Entry:** `door_closed` → `chest_open` (metaphor for escape)
- **Exit Portal:** `crystal_big`, `button` (activation)
- **Decorations:** `tree_1/2/3`, `bush`, `flowers_1/2`, `mushroom`
- **Hazards:** `rock1`, `rock2`, `deadtree_1/2/3`
- **Interactables:** `chest_closed/open`, `lever_left/right`, `key`

#### Characters & Enemies
- **Player:** `character_male_1/2`, `character_female_1/2`
- **Enemies:** `skeleton`, `goblin`, `zombie`, `wizard`, `demon`
- **Friendly:** `cat`, `dog` (potential companions)

#### Tools & Items
- **Weapons (Visual):** `sword_wood/stone/gold/diamond`
- **Tools:** `pickaxe_*`, `axe_*`, `shovel_*` (mining-themed unlocks)

### 8.4 UI Elements
- **HUD:** Minimal - visibility indicator, tool slot, maze number
- **Menus:** Start screen, pause menu, save code input/output
- **Feedback:** Subtle screen effects for fog boundary, item pickup

---

## 9. Progression System

### 9.1 Unlock Timeline

```
Maze 1-5:    Tutorial, basic navigation
             └─ Unlock: Basic Torch

Maze 6-10:   Introduction to dead ends
             └─ Unlock: Compass

Maze 11-15:  First locked doors
             └─ Unlock: Map Fragment

Maze 16-20:  One-way doors, pressure plates
             └─ Unlock: Running Boots

Maze 21-30:  First enemies (Skeleton)
             └─ Unlock: Hiding mechanic

Maze 31-40:  Multiple enemy types
             └─ Unlock: Distraction items

Maze 41-50:  Complex puzzle combinations
             └─ Unlock: Skeleton Key

Maze 51+:    All mechanics randomized
             └─ Prestige system (optional)
```

### 9.2 Backtracking Incentives

Players may need to return to earlier mazes for:
1. **Missed Keys:** Required for later locked areas
2. **Hidden Artifacts:** Enable advanced abilities
3. **Lore Completion:** Story/achievement hunting
4. **Resource Farming:** Maze Shards for upgrades

### 9.3 Prestige System (Post-Launch)

After reaching Maze 100, players can:
- Reset to Maze 1 with permanent bonuses
- Unlock cosmetic rewards
- Access "Nightmare Mode" variants
- Earn legacy badges

---

## 10. Save System

### 10.1 Save Code Architecture

The save code encodes all player progress into a shareable string.

**Encoded Data:**
```typescript
interface SaveState {
  version: number;          // Save format version
  seed: string;             // Player's unique seed (8 chars)
  currentMaze: number;      // Current maze number
  unlockedTools: number;    // Bitmask of unlocked tools
  inventory: number[];      // Item IDs in inventory
  completedMazes: number[]; // List of completed maze numbers
  artifacts: number;        // Bitmask of collected artifacts
  playtime: number;         // Total seconds played
}
```

**Encoding Method:**
1. Serialize state to JSON
2. Compress using LZ-string or similar
3. Encode to Base62 (alphanumeric only)
4. Add checksum for validation

**Example Code:** `MAZED-7Kx9P2mQ4nR8` (16-20 characters)

### 10.2 Code Validation
- Checksum prevents manual tampering
- Version number ensures backward compatibility
- Invalid codes show friendly error message
- Optional: QR code generation for easy sharing

---

## 11. Procedural Generation

### 11.1 Maze Generation Algorithm

**Primary:** Recursive Backtracking with modifications
- Guarantees solvable maze
- Controllable complexity via parameters
- Deterministic from seed

**Parameters:**
```typescript
interface MazeParams {
  width: number;
  height: number;
  seed: string;
  complexity: number;       // 0-1, affects branching
  deadEndRatio: number;     // 0-1, how many dead ends
  loopChance: number;       // 0-1, cycles in the maze
  roomChance: number;       // 0-1, open areas
}
```

### 11.2 Seed System

Each player gets a unique seed derived from:
- Random generation on first play
- Timestamp component for uniqueness
- Optional: Player-chosen seed for shared experiences

**Maze Seed Calculation:**
```
mazeSeed = hash(playerSeed + mazeNumber)
```

This ensures:
- Same player sees same maze each time
- Different players see different mazes
- Mazes are reproducible for debugging

### 11.3 Content Placement

After maze generation:
1. **Entry Point:** Placed at maze edge
2. **Exit Point:** Placed at optimal distance from entry
3. **Items:** Distributed in dead ends and branches
4. **Hazards:** Placed along solution path (not blocking)
5. **Enemies:** Patrol routes generated separately

---

## 12. Roadmap & Milestones

### Phase 1: MVP (8 weeks)

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| 1-2 | Foundation | Project setup, basic 3D scene, player movement |
| 3-4 | Maze Core | Procedural generation, collision, basic fog |
| 5-6 | Game Loop | Entry/exit, maze transitions, basic UI |
| 7-8 | Save System | Code generation, validation, persistence |

**MVP Success Criteria:**
- [ ] Player can navigate procedural 3D mazes
- [ ] Fog of war limits visibility
- [ ] Completing maze loads next maze
- [ ] Save code preserves progress

### Phase 2: Core Features (6 weeks)

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| 9-10 | Portal Network | Backtracking, portal UI |
| 11-12 | Items & Tools | Torch, compass, collectibles |
| 13-14 | Polish | Sound, particles, UX improvements |

### Phase 3: Content Expansion (8 weeks)

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| 15-17 | Enemies | AI, patrol patterns, hiding |
| 18-20 | Hazards | Traps, puzzles, themed mazes |
| 21-22 | Meta Progression | Upgrades, achievements |

### Phase 4: Launch Preparation (4 weeks)

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| 23-24 | Testing | Bug fixes, balance tuning |
| 25-26 | Release | Marketing, launch, monitoring |

---

## 13. Open Questions & Risks

### 13.1 Open Questions

| ID | Question | Impact | Decision Deadline |
|----|----------|--------|-------------------|
| Q1 | ~~First-person or third-person camera?~~ | ~~Core experience~~ | ✅ Resolved: 2.5D isometric |
| Q2 | How to handle mobile controls? | Platform reach | Phase 2 |
| Q3 | Should mazes have time limits? | Difficulty, tension | Phase 2 |
| Q4 | Multiplayer/co-op potential? | Scope, architecture | Post-launch |
| Q5 | Monetization model (if commercial)? | Business viability | Pre-launch |

### 13.2 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance issues with large mazes | Medium | High | LOD system, culling optimization |
| Save code tampering/exploits | Medium | Medium | Checksum validation, server verification (optional) |
| Maze generation edge cases | Low | High | Extensive testing, fallback seeds |
| Browser compatibility | Medium | Medium | Polyfills, feature detection |

### 13.3 Design Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Repetitive gameplay | High | High | Varied mechanics, themed mazes |
| Frustrating difficulty spikes | Medium | High | Smooth scaling, playtesting |
| Limited visibility too frustrating | Medium | Medium | Adjustable settings, tutorials |
| Backtracking feels like grind | Medium | Medium | Fast travel, meaningful rewards |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| Fog of War | Game mechanic where unexplored areas are hidden |
| Procedural Generation | Algorithm-based content creation |
| Seed | Initial value for deterministic random generation |
| Prestige | Resetting progress for permanent bonuses |
| Save Code | Encoded string representing player state |

---

## Appendix B: Competitive Analysis

| Game | Similarity | Differentiation |
|------|------------|-----------------|
| **Into the Breach** | Code-based saves | Different genre (tactics vs puzzle) |
| **Hades** | Roguelike progression | Different core loop |
| **Monument Valley** | Puzzle exploration | Limited vs infinite content |
| **The Witness** | Puzzle solving | Linear vs procedural |
| **Spelunky** | Procedural, roguelike | Platform vs maze navigation |

---

## Appendix C: References

- Concept Art: `/public/dungeon/concept.png`
- Asset Index: `/public/assets/cubeworld/assets.json`
- Discussion Notes: `/.chats/name_generation.md`

---

*This document is a living specification and will be updated as the project evolves.*
