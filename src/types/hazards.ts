export type HazardType = 'one_way_door' | 'pressure_plate' | 'pressure_plate_door' | 'locked_door';

export type CardinalDirection = 'north' | 'south' | 'east' | 'west';
export type DoorPassageAxis = 'horizontal' | 'vertical';

export interface OneWayDoorHazard {
  id: string;
  type: 'one_way_door';
  tileX: number;
  tileY: number;
  meta: {
    allowedDirection: CardinalDirection;
  };
}

export interface PressurePlateHazard {
  id: string;
  type: 'pressure_plate';
  tileX: number;
  tileY: number;
  meta: {
    linkedDoorId: string;
    colorKey: string;
    active: boolean;
  };
}

export interface PressurePlateDoorHazard {
  id: string;
  type: 'pressure_plate_door';
  tileX: number;
  tileY: number;
  meta: {
    colorKey: string;
    passageAxis: DoorPassageAxis;
    closeDelaySeconds: number;
    open: boolean;
    closeTimerSeconds: number | null;
  };
}

export interface LockedDoorHazard {
  id: string;
  type: 'locked_door';
  tileX: number;
  tileY: number;
  meta: {
    requiresKey: boolean;
    passageAxis: DoorPassageAxis;
    open: boolean;
  };
}

export type HazardInstance = OneWayDoorHazard | PressurePlateHazard | PressurePlateDoorHazard | LockedDoorHazard;
