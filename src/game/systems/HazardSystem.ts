import type { CardinalDirection, HazardInstance } from '../../types/hazards';

interface TilePoint {
  x: number;
  y: number;
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export interface HazardTraversalContext {
  hasSkeletonKey: boolean;
  consumeSkeletonKey: () => void;
}

export class HazardSystem {
  private readonly hazardByTile = new Map<string, HazardInstance>();

  loadMaze(hazards: HazardInstance[] | undefined): void {
    this.hazardByTile.clear();

    if (!hazards || hazards.length === 0) {
      return;
    }

    for (const hazard of hazards) {
      this.hazardByTile.set(tileKey(hazard.tileX, hazard.tileY), {
        ...hazard,
        meta: { ...hazard.meta },
      } as HazardInstance);
    }
  }

  checkPassThrough(fromTile: TilePoint, toTile: TilePoint, direction: CardinalDirection, context: HazardTraversalContext): boolean {
    if (fromTile.x === toTile.x && fromTile.y === toTile.y) {
      return true;
    }

    const targetHazard = this.hazardByTile.get(tileKey(toTile.x, toTile.y));

    if (!targetHazard) {
      return true;
    }

    if (targetHazard.type === 'one_way_door') {
      return targetHazard.meta.allowedDirection === direction;
    }

    if (targetHazard.type === 'locked_door') {
      if (targetHazard.meta.open || !targetHazard.meta.requiresKey) {
        return true;
      }

      if (!context.hasSkeletonKey) {
        return false;
      }

      targetHazard.meta.open = true;
      context.consumeSkeletonKey();
      return true;
    }

    return true;
  }
}
