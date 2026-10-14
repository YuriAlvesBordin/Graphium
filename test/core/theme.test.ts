import { resolveTheme, DEFAULT_THEME } from '../../src/core/theme';
import { packRGBA } from '../../src/core/colors';
import type { ThemeOptions, ThemeResolved } from '../../src/core/types';

describe('Theme Resolution', () => {
  it('should return default theme when no theme provided', () => {
    const result = resolveTheme(undefined);
    expect(result).toEqual(DEFAULT_THEME);
  });

  it('should merge background color', () => {
    const theme: ThemeOptions = { background: '#ff0000' };
    const result = resolveTheme(theme);
    expect(result.background).toBe('#ff0000');
    // Other values should remain default
    expect(result.nodeRadius).toBe(DEFAULT_THEME.nodeRadius);
  });

  it('should merge node radius', () => {
    const theme: ThemeOptions = { node: { radius: 20 } };
    const result = resolveTheme(theme);
    expect(result.nodeRadius).toBe(20);
    expect(result.background).toBe(DEFAULT_THEME.background);
  });

  it('should merge node color palette', () => {
    const theme: ThemeOptions = {
      node: {
        colorPalette: ['#ffffff', '#000000']
      }
    };
    const result = resolveTheme(theme);
    expect(result.nodeColorPalette).toEqual([
      packRGBA('#ffffff'),
      packRGBA('#000000')
    ]);
  });

  it('should merge edge curvature', () => {
    const theme: ThemeOptions = { edge: { curvature: 0.5 } };
    const result = resolveTheme(theme);
    expect(result.edgeCurvature).toBe(0.5);
  });

  it('should handle partial theme merges', () => {
    const theme: ThemeOptions = {
      node: { radius: 15, color: '#ff0000ff' },
      edge: { width: 2.5 }
    };
    const result = resolveTheme(theme);
    expect(result.nodeRadius).toBe(15);
    expect(result.nodeColor).toBe(packRGBA('#ff0000ff'));
    expect(result.edgeWidth).toBe(2.5);
    // Defaults should be preserved
    expect(result.background).toBe(DEFAULT_THEME.background);
    expect(result.nodeBorderWidth).toBe(DEFAULT_THEME.nodeBorderWidth);
  });

  it('should correctly handle previous theme as base', () => {
    const previous: ThemeResolved = { ...DEFAULT_THEME, nodeRadius: 30 };
    const theme: ThemeOptions = { edge: { width: 3.0 } };
    const result = resolveTheme(theme, previous);
    expect(result.nodeRadius).toBe(30); // from previous
    expect(result.edgeWidth).toBe(3.0); // from theme
    expect(result.background).toBe(DEFAULT_THEME.background);
  });
});
