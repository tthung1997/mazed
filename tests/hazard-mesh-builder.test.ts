import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HazardMeshBuilder } from '../src/game/rendering/HazardMeshBuilder';
import type { HazardInstance } from '../src/types/hazards';

describe('HazardMeshBuilder', () => {
  it('centers applied door template bounds on hazard tile even for asymmetric templates', () => {
    const builder = new HazardMeshBuilder();
    const hazards: HazardInstance[] = [
      {
        id: 'one-way',
        type: 'one_way_door',
        tileX: 4,
        tileY: 6,
        meta: { allowedDirection: 'east' },
      },
    ];

    const renderData = builder.build(hazards);
    const template = new THREE.Group();
    const asymmetric = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    asymmetric.position.set(0.9, 0, -0.35);
    template.add(asymmetric);

    builder.applyDoorModelTemplate(renderData, template);

    const oneWayModel = renderData.meshByHazardId.get('one-way');
    expect(oneWayModel).toBeTruthy();

    const bounds = new THREE.Box3().setFromObject(oneWayModel!);
    const center = bounds.getCenter(new THREE.Vector3());

    expect(center.x).toBeCloseTo(4.5, 5);
    expect(center.z).toBeCloseTo(6.5, 5);
  });

  it('centers one-way and locked doors on their hazard tile', () => {
    const builder = new HazardMeshBuilder();
    const hazards: HazardInstance[] = [
      {
        id: 'one-way',
        type: 'one_way_door',
        tileX: 3,
        tileY: 4,
        meta: { allowedDirection: 'north' },
      },
      {
        id: 'locked',
        type: 'locked_door',
        tileX: 7,
        tileY: 2,
        meta: { requiresKey: true, passageAxis: 'vertical', open: false },
      },
    ];

    const renderData = builder.build(hazards);
    const oneWayModel = renderData.meshByHazardId.get('one-way');
    const lockedModel = renderData.meshByHazardId.get('locked');

    expect(oneWayModel?.position.x).toBeCloseTo(3.5, 5);
    expect(oneWayModel?.position.z).toBeCloseTo(4.5, 5);
    expect(lockedModel?.position.x).toBeCloseTo(7.5, 5);
    expect(lockedModel?.position.z).toBeCloseTo(2.5, 5);
  });

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
        meta: { requiresKey: true, passageAxis: 'horizontal', open: false },
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

  it('keeps pressure plate mesh and tints linked pressure door with matching color key', () => {
    const builder = new HazardMeshBuilder();
    const hazards: HazardInstance[] = [
      {
        id: 'pressure-door',
        type: 'pressure_plate_door',
        tileX: 5,
        tileY: 5,
        meta: {
          colorKey: 'violet',
          passageAxis: 'vertical',
          closeDelaySeconds: 2,
          open: false,
          closeTimerSeconds: null,
        },
      },
      {
        id: 'pressure-plate',
        type: 'pressure_plate',
        tileX: 3,
        tileY: 5,
        meta: {
          linkedDoorId: 'pressure-door',
          colorKey: 'violet',
          active: false,
        },
      },
    ];

    const renderData = builder.build(hazards);
    const template = new THREE.Group();
    template.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));

    builder.applyDoorModelTemplate(renderData, template);

    const pressureDoorModel = renderData.meshByHazardId.get('pressure-door');
    const pressurePlateModel = renderData.meshByHazardId.get('pressure-plate');

    expect(pressureDoorModel).toBeTruthy();
    expect(pressurePlateModel).toBeTruthy();
    expect(pressurePlateModel?.position.y).toBeCloseTo(0, 5);
    expect(pressureDoorModel?.rotation.y).toBeCloseTo(0, 5);

    let tintedMaterial: THREE.MeshStandardMaterial | null = null;
    pressureDoorModel?.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
        tintedMaterial = node.material;
      }
    });

    expect(tintedMaterial).toBeTruthy();
    expect(tintedMaterial?.color.getHexString()).toBe('c4b5fd');
  });
});
