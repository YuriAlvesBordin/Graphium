import { DEFAULT_THEME, resolveTheme } from '../../src/core/theme';
import { packRGBA } from '../../src/core/colors';
import type { ThemeOptions, ThemeResolved } from '../../src/core/types';

describe('Theme Resolution', () => {
  it('should return default theme when no theme provided', () => {
    const result = resolveTheme(undefined);
    expect(result).toEqual(DEFAULT_THEME);
  });

  it('should merge background color', () => {
    const result = resolveTheme({ background: '#ff0000' });
    expect(result.background).toBe('#ff0000');
    expect(result.nodeRadius).toBe(DEFAULT_THEME.nodeRadius);
  });

  it('should merge every node option', () => {
    const result = resolveTheme({
      node: {
        radius: 20,
        color: '#ff0000',
        colorPalette: ['#ffffff', '#000000'],
        borderColor: '#00ff00',
        borderWidth: 5,
        borderOpacity: 0.4,
        opacity: 0.7,
      },
    });
    expect(result.nodeRadius).toBe(20);
    expect(result.nodeColor).toBe(packRGBA('#ff0000'));
    expect(result.nodeColorPalette).toEqual([packRGBA('#ffffff'), packRGBA('#000000')]);
    expect(result.nodeBorderColor).toBe(packRGBA('#00ff00'));
    expect(result.nodeBorderWidth).toBe(5);
    expect(result.nodeBorderOpacity).toBe(0.4);
    expect(result.nodeOpacity).toBe(0.7);
  });

  it('should merge every edge option', () => {
    const result = resolveTheme({
      edge: {
        color: '#123456',
        width: 4,
        opacity: 0.5,
        curvature: 0.8,
        style: 'dashed',
        arrowEnabled: true,
        arrowSize: 9,
        arrowWidth: 3,
      },
    });
    expect(result.edgeColor).toBe(packRGBA('#123456'));
    expect(result.edgeWidth).toBe(4);
    expect(result.edgeOpacity).toBe(0.5);
    expect(result.edgeCurvature).toBe(0.8);
    expect(result.edgeStyle).toBe('dashed');
    expect(result.edgeArrowEnabled).toBe(true);
    expect(result.edgeArrowSize).toBe(9);
    expect(result.edgeArrowWidth).toBe(3);
  });

  it('should merge ring groups', () => {
    const result = resolveTheme({
      hoverRing: { color: '#111111', width: 7 },
      selectedRing: { color: '#222222', width: 8 },
      fixedRing: { color: '#333333', width: 9 },
    });
    expect(result.hoverRingColor).toBe(packRGBA('#111111'));
    expect(result.hoverRingWidth).toBe(7);
    expect(result.selectedRingColor).toBe(packRGBA('#222222'));
    expect(result.selectedRingWidth).toBe(8);
    expect(result.fixedRingColor).toBe(packRGBA('#333333'));
    expect(result.fixedRingWidth).toBe(9);
  });

  it('should merge disabled opacity and selected edge options', () => {
    const result = resolveTheme({
      disabledOpacity: 0.1,
      selectedEdge: { color: '#444444', widthMultiplier: 3, opacity: 0.9 },
    });
    expect(result.disabledOpacity).toBe(0.1);
    expect(result.selectedEdgeColor).toBe(packRGBA('#444444'));
    expect(result.selectedEdgeWidthMultiplier).toBe(3);
    expect(result.selectedEdgeOpacity).toBe(0.9);
  });

  it('should merge every label option', () => {
    const result = resolveTheme({
      label: {
        enabled: false,
        position: 'above',
        offset: 12,
        size: 14,
        color: '#abcdef',
        font: 'Georgia, serif',
        weight: 700,
        background: 'rgba(0,0,0,0.5)',
        padding: [10, 6],
        radius: 9,
      },
    });
    expect(result.labelEnabled).toBe(false);
    expect(result.labelPosition).toBe('above');
    expect(result.labelOffset).toBe(12);
    expect(result.labelSize).toBe(14);
    expect(result.labelColor).toBe('#abcdef');
    expect(result.labelFont).toBe('Georgia, serif');
    expect(result.labelWeight).toBe(700);
    expect(result.labelBackground).toBe('rgba(0,0,0,0.5)');
    expect(result.labelPadding).toEqual([10, 6]);
    expect(result.labelRadius).toBe(9);
  });

  it('should ignore empty groups without changing defaults', () => {
    const result = resolveTheme({ node: {}, edge: {}, label: {} });
    expect(result).toEqual(DEFAULT_THEME);
  });

  it('should correctly handle previous theme as base', () => {
    const previous: ThemeResolved = { ...DEFAULT_THEME, nodeRadius: 30, edgeWidth: 9 };
    const theme: ThemeOptions = { edge: { width: 3.0 } };
    const result = resolveTheme(theme, previous);
    expect(result.nodeRadius).toBe(30); // from previous
    expect(result.edgeWidth).toBe(3.0); // from theme
    expect(result.background).toBe(DEFAULT_THEME.background);
  });
});
