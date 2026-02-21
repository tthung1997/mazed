export type ItemId = 'maze_shard' | 'ancient_key' | 'lore_page' | 'artifact_piece' | 'wayfinder_stone';

export type ToolId = 'basic_torch' | 'compass' | 'map_fragment' | 'running_boots' | 'skeleton_key';

export interface ToolDefinition {
  id: ToolId;
  unlockMaze: number;
  durationMs: number | null;
  visibilityBonus: number;
  speedMultiplier: number;
  oneShot: boolean;
}

export const IMPLEMENTED_TOOL_ORDER: ToolId[] = ['basic_torch', 'running_boots'];
export const IMPLEMENTED_ITEM_ORDER: ItemId[] = ['maze_shard', 'wayfinder_stone'];

export const TOOL_ORDER: ToolId[] = ['basic_torch', 'compass', 'map_fragment', 'running_boots', 'skeleton_key'];

export const TOOL_DEFINITIONS: Record<ToolId, ToolDefinition> = {
  basic_torch: {
    id: 'basic_torch',
    unlockMaze: 1,
    durationMs: 60_000,
    visibilityBonus: 2,
    speedMultiplier: 1,
    oneShot: false,
  },
  compass: {
    id: 'compass',
    unlockMaze: 5,
    durationMs: null,
    visibilityBonus: 0,
    speedMultiplier: 1,
    oneShot: false,
  },
  map_fragment: {
    id: 'map_fragment',
    unlockMaze: 10,
    durationMs: null,
    visibilityBonus: 0,
    speedMultiplier: 1,
    oneShot: true,
  },
  running_boots: {
    id: 'running_boots',
    unlockMaze: 15,
    durationMs: 30_000,
    visibilityBonus: 0,
    speedMultiplier: 1.3,
    oneShot: false,
  },
  skeleton_key: {
    id: 'skeleton_key',
    unlockMaze: 20,
    durationMs: null,
    visibilityBonus: 0,
    speedMultiplier: 1,
    oneShot: true,
  },
};

export function isToolId(value: string): value is ToolId {
  return TOOL_ORDER.includes(value as ToolId);
}

export function getToolBit(toolId: ToolId): number {
  return 1 << TOOL_ORDER.indexOf(toolId);
}

export function hasToolUnlocked(mask: number, toolId: ToolId): boolean {
  return (mask & getToolBit(toolId)) !== 0;
}

export function unlockTool(mask: number, toolId: ToolId): number {
  return mask | getToolBit(toolId);
}

export function getToolUnlockedAtMaze(mazeNumber: number): ToolId | null {
  for (const toolId of IMPLEMENTED_TOOL_ORDER) {
    if (TOOL_DEFINITIONS[toolId].unlockMaze === mazeNumber) {
      return toolId;
    }
  }

  return null;
}

export interface MazeItemSpawn {
  id: string;
  itemId: ItemId | ToolId;
  tileX: number;
  tileY: number;
}

export interface MazeItemState {
  spawns: MazeItemSpawn[];
  pickedUp: string[];
}

export interface WayfinderConfig {
  minMaze: number;
  maxMaze: number;
}

export const ITEM_ORDER: ItemId[] = ['maze_shard', 'ancient_key', 'lore_page', 'artifact_piece', 'wayfinder_stone'];

export const ITEM_DESCRIPTIONS: Record<ItemId, string> = {
  maze_shard: 'Currency collectible used for progression tracking.',
  ancient_key: 'Key-type collectible (reserved for locked interactions).',
  lore_page: 'Lore collectible that expands world narrative.',
  artifact_piece: 'Artifact progression collectible.',
  wayfinder_stone: 'Special unlock item. Enables Portal Hub direct travel to completed mazes.',
};

export const ITEM_DISPLAY_NAMES: Record<ItemId | ToolId, string> = {
  maze_shard: 'Maze Shard',
  ancient_key: 'Ancient Key',
  lore_page: 'Lore Page',
  artifact_piece: 'Artifact Piece',
  wayfinder_stone: 'Wayfinder Stone',
  basic_torch: 'Basic Torch',
  compass: 'Compass',
  map_fragment: 'Map Fragment',
  running_boots: 'Running Boots',
  skeleton_key: 'Skeleton Key',
};

export function isImplementedToolId(value: string): value is ToolId {
  return IMPLEMENTED_TOOL_ORDER.includes(value as ToolId);
}
