import { PRESETS, presetNames } from '../../src/physics/presets';
import type { PhysicsPresetName } from '../../src/core/types';

describe('Physics presets', () => {
  it('should expose the four presets in display order', () => {
    expect(presetNames()).toEqual(['silk', 'bouncy', 'crystal', 'liquid']);
    expect(Object.keys(PRESETS).sort()).toEqual(['bouncy', 'crystal', 'liquid', 'silk']);
    for (const name of presetNames()) {
      expect(PRESETS[name as PhysicsPresetName].label.length).toBeGreaterThan(0);
    }
  });

  it('should differentiate the presets through damping', () => {
    expect(PRESETS.silk.values.damping).toBe(0.92);
    expect(PRESETS.bouncy.values.damping).toBe(0.84);
    expect(PRESETS.crystal.values.damping).toBeLessThan(PRESETS.silk.values.damping as number);
    expect(PRESETS.liquid.values.damping).toBeGreaterThan(PRESETS.silk.values.damping as number);
  });

  it('should always provide a full option set per preset', () => {
    for (const name of presetNames()) {
      const values = PRESETS[name].values;
      for (const key of ['repulsion', 'springStrength', 'gravity', 'maxSpeed', 'temperature', 'throwFactor'] as const) {
        expect(typeof values[key]).toBe('number');
      }
    }
  });
});
