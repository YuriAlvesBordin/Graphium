import { alphaOf, blueOf, DEFAULT_COLOR, DEFAULT_PALETTE, deterministicColor, greenOf, packRGBA, redOf, unpackRGBA } from '../../src/core/colors';

describe('packRGBA', () => {
  it('should return the fallback for null and undefined', () => {
    expect(packRGBA(null)).toBe(DEFAULT_COLOR);
    expect(packRGBA(undefined)).toBe(DEFAULT_COLOR);
    expect(packRGBA(null, 0x12345678)).toBe(0x12345678);
  });

  it('should pass packed numbers through unsigned', () => {
    expect(packRGBA(0xff6b6bff)).toBe(0xff6b6bff);
    expect(packRGBA(-1)).toBe(0xffffffff);
  });

  it('should pack normalized channel arrays', () => {
    expect(packRGBA([1, 0, 0])).toBe(0xff0000ff);
    expect(packRGBA([0, 1, 0, 0.5])).toBe(0x00ff0080);
    // Missing channels default to black; missing alpha defaults to opaque.
    expect(packRGBA([])).toBe(0x000000ff);
  });

  it('should clamp array channels into the valid range', () => {
    expect(packRGBA([2, -1, 0.5])).toBe(0xff0080ff);
    expect(packRGBA([1, 1, 1, 9])).toBe(0xffffffff);
  });

  it('should parse named colors including grey and transparent', () => {
    expect(packRGBA('red')).toBe(0xff0000ff);
    expect(packRGBA('WHITE')).toBe(0xffffffff);
    expect(packRGBA('grey')).toBe(0x808080ff);
    expect(packRGBA('gray')).toBe(0x808080ff);
    expect(packRGBA('transparent')).toBe(0x00000000);
    expect(packRGBA('not-a-color')).toBe(DEFAULT_COLOR);
  });

  it('should parse hex colors of length 3, 4, 6 and 8', () => {
    expect(packRGBA('#f00')).toBe(0xff0000ff);
    expect(packRGBA('#f00c')).toBe(0xff0000cc);
    expect(packRGBA('#00ff00')).toBe(0x00ff00ff);
    expect(packRGBA('#0000ff80')).toBe(0x0000ff80);
  });

  it('should return the fallback for malformed hex', () => {
    expect(packRGBA('#ff')).toBe(DEFAULT_COLOR);
    expect(packRGBA('#fffff')).toBe(DEFAULT_COLOR);
    expect(packRGBA('#gggggg')).toBe(0x000000ff);
  });

  it('should parse rgb() and rgba() functions', () => {
    expect(packRGBA('rgb(255, 0, 0)')).toBe(0xff0000ff);
    expect(packRGBA('rgba(0, 255, 0, 0.5)')).toBe(0x00ff0080);
    expect(packRGBA('rgb(100% 0% 50%)')).toBe(0xff0080ff);
    expect(packRGBA('rgba(0%, 0%, 100%, 0.25)')).toBe(0x0000ff40);
  });

  it('should return the fallback for malformed rgb functions', () => {
    expect(packRGBA('rgb()')).toBe(DEFAULT_COLOR);
    expect(packRGBA('rgb(1, 2)')).toBe(DEFAULT_COLOR);
    expect(packRGBA('rgb 1 2 3')).toBe(DEFAULT_COLOR);
  });

  it('should trim and lowercase input text', () => {
    expect(packRGBA('  #FF0000  ')).toBe(0xff0000ff);
  });
});

describe('unpackRGBA', () => {
  it('should expand packed channels into normalized floats', () => {
    const out = new Float32Array(4);
    unpackRGBA(0xff804020, out, 0);
    expect(out[0]).toBeCloseTo(1);
    expect(out[1]).toBeCloseTo(0x80 / 255);
    expect(out[2]).toBeCloseTo(0x40 / 255);
    expect(out[3]).toBeCloseTo(0x20 / 255);
  });

  it('should write at the requested offset', () => {
    const out = new Float32Array(8);
    unpackRGBA(0x000000ff, out, 4);
    expect(out[7]).toBe(1);
    expect(out[0]).toBe(0);
  });
});

describe('channel accessors', () => {
  it('should extract each channel byte', () => {
    const packed = 0x11223344;
    expect(redOf(packed)).toBe(0x11);
    expect(greenOf(packed)).toBe(0x22);
    expect(blueOf(packed)).toBe(0x33);
    expect(alphaOf(packed)).toBe(0x44);
  });
});

describe('deterministicColor', () => {
  it('should always return the same color for the same key', () => {
    expect(deterministicColor('alice')).toBe(deterministicColor('alice'));
    expect(deterministicColor(42)).toBe(deterministicColor(42));
  });

  it('should return a color from the supplied palette', () => {
    const palette = [0x111111ff, 0x222222ff];
    for (const key of ['a', 'b', 'c', 'd', 'e']) {
      expect(palette).toContain(deterministicColor(key, palette));
    }
    expect(DEFAULT_PALETTE.length).toBeGreaterThan(0);
  });

  it('should treat numbers and their text form identically', () => {
    expect(deterministicColor(7)).toBe(deterministicColor('7'));
  });
});
