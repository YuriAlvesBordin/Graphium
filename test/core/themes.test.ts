import { BUILT_IN_THEMES, themeNames } from '../../src/core/themes';

describe('Built in themes', () => {
  it('should list every theme in a stable order', () => {
    expect(themeNames()).toEqual(['midnight', 'light', 'slate', 'sunset']);
    expect(themeNames().sort()).toEqual(Object.keys(BUILT_IN_THEMES).sort());
  });

  it('should define a complete option set for every theme', () => {
    for (const name of themeNames()) {
      const theme = BUILT_IN_THEMES[name];
      expect(theme.background).toMatch(/^#/);
      // Palettes are optional: the resolver falls back to the shared palette.
      if (theme.node.colorPalette) {
        expect(theme.node.colorPalette.length).toBeGreaterThan(0);
      }
      expect(theme.node.radius).toBeGreaterThan(0);
      expect(theme.edge.color).toMatch(/^#/);
      expect(theme.label.color.length).toBeGreaterThan(0);
      expect(theme.hoverRing.color).toMatch(/^#/);
      expect(theme.selectedRing.color).toMatch(/^#/);
    }
  });

  it('should keep the midnight theme aligned with the library defaults', () => {
    expect(BUILT_IN_THEMES.midnight.background).toBe('#0b0e14');
    expect(BUILT_IN_THEMES.midnight.hoverRing.color).toBe('#4f8ef7');
  });
});
