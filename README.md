# mazed

Escape the maze. Enter the next one. Repeat forever.

Phase 1 MVP implementation now includes:

- Deterministic procedural maze generation (seed + maze number)
- 2.5D movement with wall collision and camera follow
- Fog of war (visible / memory / unexplored)
- Entry/exit flow with fade transition to next maze
- Code-based save/load with checksum validation (`MAZED-...`)
- Minimal menu/HUD/pause/save UI overlay

## Run locally

1. Install Node.js 20+
2. Install dependencies:
	- `npm install`
3. Start dev server:
	- `npm run dev`
4. Build for production:
	- `npm run build`

## Controls

- Move: `WASD` or arrow keys
- Pause/Resume: `Esc`
- Use menu actions for New Game, Save/Load, Resume, Quit

## Debug (dev only)

- Start a new run at a specific maze by opening the game with `?debugStartMaze=<mazeNumber>`
- Example: `http://localhost:5173/?debugStartMaze=25`
