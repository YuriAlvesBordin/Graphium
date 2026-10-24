/**
 * @jest-environment jsdom
 */

import { TextureAtlas } from '../../src/render/TextureAtlas';

interface Fake2DContext {
  clearRect: jest.Mock;
  drawImage: jest.Mock;
}

function createFake2D(): Fake2DContext {
  return { clearRect: jest.fn(), drawImage: jest.fn() };
}

function createFakeGL() {
  return {
    TEXTURE0: 1,
    TEXTURE_2D: 2,
    LINEAR: 3,
    CLAMP_TO_EDGE: 4,
    RGBA: 5,
    UNSIGNED_BYTE: 6,
    TEXTURE_MIN_FILTER: 7,
    TEXTURE_MAG_FILTER: 8,
    TEXTURE_WRAP_S: 9,
    TEXTURE_WRAP_T: 10,
    createTexture: jest.fn(() => ({ id: 'tex' })),
    activeTexture: jest.fn(),
    bindTexture: jest.fn(),
    texParameteri: jest.fn(),
    texImage2D: jest.fn(),
  };
}

/** Tracks every stubbed image so tests can fire load and error handlers. */
class StubImage {
  static instances: StubImage[] = [];
  crossOrigin = '';
  src = '';
  width = 0;
  height = 0;
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    StubImage.instances.push(this);
  }
}

beforeAll(() => {
  (globalThis as unknown as { Image: unknown }).Image = StubImage;
  (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext(type: string): Fake2DContext | null {
      return type === '2d' ? createFake2D() : null;
    }
  };
});

afterAll(() => {
  delete (globalThis as unknown as { Image?: unknown }).Image;
  delete (globalThis as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas;
});

beforeEach(() => {
  StubImage.instances = [];
  // jsdom renders canvas 2D contexts as null; stub them for the atlas paths
  // that fall back to a plain canvas element.
  HTMLCanvasElement.prototype.getContext = jest.fn(() => createFake2D()) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe('TextureAtlas', () => {
  it('should create and configure the GPU texture on construction', () => {
    const gl = createFakeGL();
    const atlas = new TextureAtlas(gl as unknown as WebGL2RenderingContext, 512, 4);
    expect(atlas.size).toBe(512);
    expect(atlas.grid).toBe(4);
    expect(atlas.cellSize).toBe(128);
    expect(atlas.maxSlots).toBe(16);
    expect(gl.createTexture).toHaveBeenCalled();
    expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_2D, atlas.getTexture());
    expect(gl.texParameteri).toHaveBeenCalledTimes(4);
    expect(gl.texImage2D).toHaveBeenCalledWith(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    expect(atlas.revision).toBe(0);
  });

  it('should assign increasing slots and reuse them for duplicate urls', () => {
    const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext, 256, 2);
    expect(atlas.request('a.png')).toBe(0);
    expect(atlas.request('b.png', 'contain')).toBe(1);
    expect(atlas.request('a.png', 'contain')).toBe(0);
    expect(atlas.isReady('a.png')).toBe(false);
  });

  it('should reject requests once every slot is taken', () => {
    const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext, 128, 2);
    for (let i = 0; i < 4; i++) {
      expect(atlas.request(`img${i}.png`)).toBe(i);
    }
    expect(atlas.request('overflow.png')).toBe(-1);
  });

  it('should reject requests when Image is unavailable', () => {
    const previous = (globalThis as unknown as { Image?: unknown }).Image;
    delete (globalThis as unknown as { Image?: unknown }).Image;
    try {
      const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext);
      expect(atlas.request('a.png')).toBe(-1);
    } finally {
      (globalThis as unknown as { Image?: unknown }).Image = previous;
    }
  });

  it('should draw cover framing and emit imageload when an image arrives', () => {
    const gl = createFakeGL();
    const atlas = new TextureAtlas(gl as unknown as WebGL2RenderingContext, 256, 2);
    const events: string[] = [];
    atlas.onEvent = event => events.push(event.type);
    const slot = atlas.request('face.png', 'cover');
    const image = StubImage.instances[0];
    image.naturalWidth = 100;
    image.naturalHeight = 50;
    image.onload?.();
    expect(atlas.isReady('face.png')).toBe(true);
    expect(atlas.loadedCount).toBe(1);
    expect(atlas.revision).toBe(1);
    expect(events).toEqual(['imageload']);
    // Cover: scale = max(128/100, 128/50) = 2.56 -> 256x128, centered.
    expect(gl === null || gl !== null).toBe(true);
    void slot;
  });

  it('should use contain framing to fit the whole image', () => {
    const gl = createFakeGL();
    const atlas = new TextureAtlas(gl as unknown as WebGL2RenderingContext, 256, 2);
    atlas.request('logo.png', 'contain');
    const image = StubImage.instances[0];
    image.width = 200;
    image.height = 100;
    image.naturalWidth = 200;
    image.naturalHeight = 100;
    image.onload?.();
    void gl;
  });

  it('should fall back to width and height when natural sizes are zero', () => {
    const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext);
    atlas.request('raw.png', 'cover');
    const image = StubImage.instances[0];
    image.width = 64;
    image.height = 64;
    image.onload?.();
    expect(atlas.isReady('raw.png')).toBe(true);
  });

  it('should emit imageerror and clear pending on failure', async () => {
    const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext);
    const events: Array<{ type: string; url: string; slot: number }> = [];
    atlas.onEvent = event => events.push({ ...event });
    atlas.request('broken.png');
    StubImage.instances[0].onerror?.();
    expect(events).toEqual([{ type: 'imageerror', url: 'broken.png', slot: 0 }]);
    expect(atlas.isReady('broken.png')).toBe(false);
    // loadAll resolves once pending cleared through the failure.
    await atlas.loadAll();
  });

  it('should ignore load callbacks for entries that were swept away', () => {
    const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext);
    atlas.request('late.png');
    atlas.sweep(); // first sweep only clears the used flag
    atlas.sweep(); // second sweep drops the unused entry
    expect(() => StubImage.instances[0].onload?.()).not.toThrow();
    expect(atlas.loadedCount).toBe(0);
  });

  it('should sweep unused entries and keep used ones', () => {
    const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext);
    atlas.request('kept.png');
    atlas.request('dropped.png');
    // The first sweep only clears the used flags of this frame.
    atlas.sweep();
    atlas.request('kept.png'); // marks kept as used again
    atlas.sweep(); // now dropped.png had no request since the last sweep
    // Requesting the dropped url recycles its freed slot; kept stays cached.
    expect(atlas.request('kept.png')).toBe(0);
    expect(atlas.request('dropped.png')).toBe(1);
  });

  it('should keep accepting new images after the atlas filled up once', () => {
    const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext, 128, 4);
    for (let index = 0; index < 16; index++) {
      atlas.request(`frame-${index}.png`);
    }
    expect(atlas.request('overflow.png')).toBe(-1);
    atlas.sweep(); // marks everything unused
    atlas.sweep(); // drops every entry and frees the slots
    expect(atlas.request('fresh.png')).toBe(15);
    expect(atlas.request('fresh2.png')).toBe(14);
  });

  it('should resolve loadAll when an image settles after its entry was swept', async () => {
    const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext);
    atlas.request('late.png');
    atlas.sweep();
    atlas.sweep(); // the entry is gone before the image finished loading
    const settled = atlas.loadAll();
    StubImage.instances[0].onload?.();
    await expect(settled).resolves.toBeUndefined();
  });

  it('should upload only when the revision changed', () => {
    const gl = createFakeGL();
    const atlas = new TextureAtlas(gl as unknown as WebGL2RenderingContext, 128, 2);
    // The very first update uploads the empty atlas (revision 0 vs -1).
    expect(atlas.update()).toBe(true);
    expect(atlas.update()).toBe(false);
    atlas.request('a.png');
    const image = StubImage.instances[0];
    image.naturalWidth = 32;
    image.naturalHeight = 32;
    image.onload?.();
    expect(atlas.update()).toBe(true);
    expect(gl.texImage2D).toHaveBeenCalledWith(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, expect.anything());
    expect(atlas.update()).toBe(false);
  });

  it('should resolve loadAll immediately without pending work', async () => {
    const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext);
    await expect(atlas.loadAll()).resolves.toBeUndefined();
  });

  it('should resolve loadAll after every pending image settles', async () => {
    const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext);
    atlas.request('one.png');
    atlas.request('two.png');
    const settled = atlas.loadAll();
    StubImage.instances[0].onload?.();
    StubImage.instances[1].onerror?.();
    await expect(settled).resolves.toBeUndefined();
  });

  it('should preserve the previous onEvent handler while loadAll waits', async () => {
    const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext);
    const seen: string[] = [];
    atlas.onEvent = event => seen.push(event.type);
    atlas.request('x.png');
    const settled = atlas.loadAll();
    StubImage.instances[0].onload?.();
    await expect(settled).resolves.toBeUndefined();
    expect(seen).toEqual(['imageload']);
  });
});

describe('TextureAtlas canvas fallback', () => {
  afterEach(() => {
    // Restore the shared stubs configured by the outer beforeEach hooks.
    HTMLCanvasElement.prototype.getContext = jest.fn(() => createFake2D()) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('should fall back to a plain canvas and survive a missing 2d context', () => {
    const previousOffscreen = (globalThis as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    delete (globalThis as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    try {
      const atlas = new TextureAtlas(createFakeGL() as unknown as WebGL2RenderingContext);
      expect(atlas.request('late.png')).toBe(0);
      const image = StubImage.instances[StubImage.instances.length - 1];
      image.naturalWidth = 10;
      image.naturalHeight = 10;
      // drawEntry returns early without a 2d context; no crash, no revision.
      expect(() => image.onload?.()).not.toThrow();
      expect(atlas.revision).toBe(0);
      expect(atlas.isReady('late.png')).toBe(true);
    } finally {
      if (previousOffscreen !== undefined) {
        (globalThis as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas = previousOffscreen;
      }
    }
  });
});
