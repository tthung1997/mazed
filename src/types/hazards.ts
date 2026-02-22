export type HazardType = 'one_way_door' | 'locked_door';

export type CardinalDirection = 'north' | 'south' | 'east' | 'west';

export interface OneWayDoorHazard {
  id: string;
  type: 'one_way_door';
  tileX: number;
  tileY: number;
  meta: {
    allowedDirection: CardinalDirection;
  };
}

export interface LockedDoorHazard {
  id: string;
  type: 'locked_door';
  tileX: number;
  tileY: number;
  meta: {
    requiresKey: boolean;
    open: boolean;
  };
}

export type HazardInstance = OneWayDoorHazard | LockedDoorHazard;
