import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HazardMeshBuilder } from '../src/game/rendering/HazardMeshBuilder';
import type { HazardInstance } from '../src/types/hazards';

describe('HazardMeshBuilder', () => {
  it('slides one-way door down, keeps it open, and closes only when requested', () => {
    const builder = new HazardMeshBuilder();
    const hazards: HazardInstance[] = [
      {
        id: 'one-way',
        type: 'one_way_door',
        tileX: 1,
        tileY: 1,
        meta: { allowedDirection: 'east' },
      },
      {
        id: 'locked',
        type: 'locked_door',
        tileX: 2,
        tileY: 1,
        meta: { requiresKey: true, open: false },
      },
    ];

    const renderData = builder.build(hazards);
    const template = new THREE.Group();
    template.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));

    builder.applyDoorModelTemplate(renderData, template);
    builder.triggerOneWayDoorOpen(renderData, 'one-way');
    builder.updateDoorAnimations(renderData, 0.1);

    const oneWayModel = renderData.meshByHazardId.get('one-way');
    const lockedModel = renderData.meshByHazardId.get('locked');

    expect(oneWayModel).toBeTruthy();
    expect(lockedModel).toBeTruthy();

    const partiallyLoweredY = oneWayModel?.position.y ?? 0;
    expect(partiallyLoweredY).toBeLessThan(0);
    expect(oneWayModel?.rotation.y).toBeCloseTo(Math.PI * 0.5, 5);

    builder.updateDoorAnimations(renderData, 0.3);
    const loweredY = oneWayModel?.position.y ?? 0;
    expect(loweredY).toBeLessThan(partiallyLoweredY);

    builder.updateDoorAnimations(renderData, 0.3);
    expect(oneWayModel?.position.y).toBeCloseTo(loweredY, 5);

    builder.triggerOneWayDoorClose(renderData, 'one-way');
    builder.updateDoorAnimations(renderData, 0.3);
    expect(oneWayModel?.position.y).toBeCloseTo(0, 5);
    expect(oneWayModel?.rotation.y).toBeCloseTo(Math.PI * 0.5, 5);

    const lockedBaseYaw = lockedModel?.rotation.y ?? 0;
    builder.triggerOneWayDoorOpen(renderData, 'one-way');
    builder.updateDoorAnimations(renderData, 0.1);
    expect(lockedModel?.rotation.y).toBeCloseTo(lockedBaseYaw, 5);
  });
});
