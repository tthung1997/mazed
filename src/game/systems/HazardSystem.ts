import type { CardinalDirection, HazardInstance, PressurePlateDoorHazard, PressurePlateHazard } from '../../types/hazards';

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

export interface HazardDoorStateChange {
  hazardId: string;
  open: boolean;
}

export class HazardSystem {
  private readonly hazardByTile = new Map<string, HazardInstance>();
  private readonly hazardById = new Map<string, HazardInstance>();
  private readonly pressurePlateById = new Map<string, PressurePlateHazard>();
  private readonly pressureDoorById = new Map<string, PressurePlateDoorHazard>();
  private readonly pressureDoorByPlateId = new Map<string, PressurePlateDoorHazard>();
  private lastPlayerTileKey: string | null = null;

  getHazardAtTile(tileX: number, tileY: number): HazardInstance | undefined {
    return this.hazardByTile.get(tileKey(tileX, tileY));
  }

  loadMaze(hazards: HazardInstance[] | undefined): void {
    this.hazardByTile.clear();
    this.hazardById.clear();
    this.pressurePlateById.clear();
    this.pressureDoorById.clear();
    this.pressureDoorByPlateId.clear();
    this.lastPlayerTileKey = null;

    if (!hazards || hazards.length === 0) {
      return;
    }

    for (const hazard of hazards) {
      const copiedHazard = {
        ...hazard,
        meta: { ...hazard.meta },
      } as HazardInstance;

      this.hazardByTile.set(tileKey(hazard.tileX, hazard.tileY), copiedHazard);
      this.hazardById.set(copiedHazard.id, copiedHazard);

      if (copiedHazard.type === 'pressure_plate') {
        this.pressurePlateById.set(copiedHazard.id, copiedHazard);
      }

      if (copiedHazard.type === 'pressure_plate_door') {
        this.pressureDoorById.set(copiedHazard.id, copiedHazard);
      }
    }

    for (const plate of this.pressurePlateById.values()) {
      const linkedDoor = this.pressureDoorById.get(plate.meta.linkedDoorId);

      if (linkedDoor) {
        this.pressureDoorByPlateId.set(plate.id, linkedDoor);
      }
    }
  }

  update(dtSeconds: number, playerTile: TilePoint): HazardDoorStateChange[] {
    const changes: HazardDoorStateChange[] = [];
    const currentTileKey = tileKey(playerTile.x, playerTile.y);

    if (this.lastPlayerTileKey !== currentTileKey) {
      const previousHazard = this.lastPlayerTileKey ? this.hazardByTile.get(this.lastPlayerTileKey) : undefined;
      if (previousHazard?.type === 'pressure_plate') {
        previousHazard.meta.active = false;
        const linkedDoor = this.pressureDoorByPlateId.get(previousHazard.id);

        if (linkedDoor?.meta.open) {
          linkedDoor.meta.closeTimerSeconds = linkedDoor.meta.closeDelaySeconds;
        }
      }

      const currentHazard = this.hazardByTile.get(currentTileKey);
      if (currentHazard?.type === 'pressure_plate') {
        currentHazard.meta.active = true;
        const linkedDoor = this.pressureDoorByPlateId.get(currentHazard.id);

        if (linkedDoor && !linkedDoor.meta.open) {
          linkedDoor.meta.open = true;
          linkedDoor.meta.closeTimerSeconds = null;
          changes.push({ hazardId: linkedDoor.id, open: true });
        } else if (linkedDoor) {
          linkedDoor.meta.closeTimerSeconds = null;
        }
      }

      this.lastPlayerTileKey = currentTileKey;
    }

    if (dtSeconds <= 0) {
      return changes;
    }

    for (const door of this.pressureDoorById.values()) {
      if (!door.meta.open || door.meta.closeTimerSeconds === null) {
        continue;
      }

      door.meta.closeTimerSeconds = Math.max(0, door.meta.closeTimerSeconds - dtSeconds);

      if (door.meta.closeTimerSeconds > 0) {
        continue;
      }

      door.meta.open = false;
      door.meta.closeTimerSeconds = null;
      changes.push({ hazardId: door.id, open: false });
    }

    return changes;
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

    if (targetHazard.type === 'pressure_plate_door') {
      return targetHazard.meta.open;
    }

    return true;
  }
}
