import { describe, expect, it } from 'vitest';
import { ToolSystem } from '../src/game/systems/ToolSystem';

describe('ToolSystem', () => {
  it('expires timed tools at the correct time', () => {
    let now = 1_000;
    const system = new ToolSystem(() => now);

    system.equip('basic_torch');
    expect(system.getActiveToolId()).toBe('basic_torch');

    now = 60_500;
    const notYet = system.update(100);
    expect(notYet).toBeNull();

    now = 61_100;
    const expired = system.update(100);
    expect(expired?.toolId).toBe('basic_torch');
    expect(system.getActiveToolId()).toBeNull();
  });

  it('consumes one-shot active tools', () => {
    const system = new ToolSystem();
    system.equip('map_fragment');

    const consumed = system.consumeActiveOneShot();
    expect(consumed).toBe('map_fragment');
    expect(system.getActiveToolId()).toBeNull();
  });
});
