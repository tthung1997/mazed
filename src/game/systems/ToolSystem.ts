import type { ToolId } from '../../types/items';
import { TOOL_DEFINITIONS } from '../../types/items';

export interface ToolExpiredEvent {
  toolId: ToolId;
}

export interface ToolEffectProvider {
  getVisibilityBonus(): number;
  getSpeedMultiplier(): number;
  getCompassActive(): boolean;
  getMapRevealFraction(): number;
}

export class ToolSystem implements ToolEffectProvider {
  private activeToolId: ToolId | null = null;
  private activeToolEndTime: number | null = null;

  constructor(private readonly nowProvider: () => number = () => Date.now()) {}

  syncFromState(activeToolId: ToolId | null, activeToolEndTime: number | null): void {
    this.activeToolId = activeToolId;
    this.activeToolEndTime = activeToolEndTime;
  }

  equip(toolId: ToolId): void {
    const definition = TOOL_DEFINITIONS[toolId];
    this.activeToolId = toolId;

    if (definition.durationMs === null) {
      this.activeToolEndTime = null;
      return;
    }

    this.activeToolEndTime = this.nowProvider() + definition.durationMs;
  }

  unequip(): void {
    this.activeToolId = null;
    this.activeToolEndTime = null;
  }

  consumeActiveOneShot(): ToolId | null {
    if (!this.activeToolId) {
      return null;
    }

    const definition = TOOL_DEFINITIONS[this.activeToolId];
    if (!definition.oneShot) {
      return null;
    }

    const consumed = this.activeToolId;
    this.unequip();
    return consumed;
  }

  update(_deltaMs: number): ToolExpiredEvent | null {
    if (!this.activeToolId || this.activeToolEndTime === null) {
      return null;
    }

    if (this.nowProvider() < this.activeToolEndTime) {
      return null;
    }

    const expiredTool = this.activeToolId;
    this.unequip();
    return { toolId: expiredTool };
  }

  getActiveToolId(): ToolId | null {
    return this.activeToolId;
  }

  getActiveToolEndTime(): number | null {
    return this.activeToolEndTime;
  }

  getVisibilityBonus(): number {
    if (!this.activeToolId) {
      return 0;
    }

    return TOOL_DEFINITIONS[this.activeToolId].visibilityBonus;
  }

  getSpeedMultiplier(): number {
    if (!this.activeToolId) {
      return 1;
    }

    return TOOL_DEFINITIONS[this.activeToolId].speedMultiplier;
  }

  getCompassActive(): boolean {
    return this.activeToolId === 'compass';
  }

  getMapRevealFraction(): number {
    return this.activeToolId === 'map_fragment' ? 0.2 : 0;
  }
}
