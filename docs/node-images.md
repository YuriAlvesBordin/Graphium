# Node Images Guide

Learn how to use images as node backgrounds in Graphium, from basic setup to how the texture atlas works and how to keep image-heavy graphs fast.

## Overview

Graphium renders node images through a GPU texture atlas. Images are downloaded once per URL, drawn into a fixed atlas canvas, uploaded to the GPU and sampled by the node shader. The system is fully automatic: you only set a URL per node.

## Basic Usage

### Setting Node Images

```ts
// When adding a node
graph.addNode('user123', {
  label: 'Alice',
  image: 'https://example.com/alice.jpg'
});

// Or after adding a node
graph.setNodeImage('user123', 'https://example.com/alice.jpg');

// Using the handle API for chaining
graph.node('user456').image('https://example.com/bob.jpg');

// Using a data URL (base64 encoded image)
const imgData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...';
graph.setNodeImage('user789', imgData);

// Using a local path served by your app
graph.setNodeImage('user000', '/avatars/user000.png');
```

### Image Display Modes

Control how images fit within the node circle:

```ts
// 'cover' - fills the entire node (may crop edges) - DEFAULT
graph.setNodeImage('user123', url, 'cover');

// 'contain' - fits the whole image inside the node (may show padding)
graph.setNodeImage('user123', url, 'contain');

// Remove image (falls back to the node fill color)
graph.setNodeImage('user123', null);
```

### Waiting for Images to Load

`loadImages()` resolves once every requested image finished loading or failed:

```ts
graph.setNodeImage('alice', 'alice.jpg');
graph.setNodeImage('bob', 'bob.jpg');

await graph.loadImages(); // ready for a clean screenshot or first paint
```

## Image Events

Image loading is asynchronous. The graph forwards two atlas events:

```ts
// Fires when an image finished loading and entered the atlas
graph.on('imageload', event => {
  console.log(`Image loaded: ${event.url} (slot ${event.slot})`);
});

// Fires when an image failed to download or decode
graph.on('imageerror', event => {
  console.log(`Image failed: ${event.url}`);
});

// Both payloads carry: { type, url, slot }
```

Nodes whose image has not arrived yet (or that failed) render with their normal fill color and border, so a slow or broken image never blocks rendering.

## How Image Handling Works

1. **Deduplication**: the same URL is downloaded and stored once, no matter how many nodes reference it
2. **Download**: images load through `new Image()` with `crossOrigin: 'anonymous'`
3. **Atlasing**: each loaded image is drawn into its own cell of a 1024x1024 offscreen canvas
4. **Upload**: the atlas canvas is uploaded to the GPU once per change, not per image
5. **Rendering**: nodes sample their cell from the atlas texture; the GPU does the cover or contain scaling

### Atlas Capacity and Recycling

The atlas is a fixed 8x8 grid of 128px cells, so **64 distinct image URLs can be rendered at the same time**. Slots are managed automatically:

- An image entry stays in the atlas while at least one rendered node references its URL
- When no rendered node uses the URL for a full rendered frame, the entry is dropped and its slot is recycled for the next new URL
- This means images can rotate freely over the lifetime of a graph: showing more than 64 distinct URLs across time works, as long as fewer than 64 are visible in the same frame
- If more than 64 distinct URLs are requested within one frame, the extras render without an image (plain node color) until earlier images leave the view

There is no global image configuration API: options like `setImageOptions`, `maxAtlasSize` or `cacheSize` do not exist. The atlas size and grid are fixed. To change which image a node shows, call `setNodeImage` again with the new URL.

## CORS Requirements

Cross-origin images load with `crossOrigin: 'anonymous'`. The server hosting the images must answer with CORS headers, or the load fails and `imageerror` fires:

```
# Recommended cache + CORS response headers
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=31536000, immutable
```

Same-origin images and data URLs never hit this restriction.

## Performance Considerations

### Image Size Optimization
- The atlas cell is 128x128px, so serving images around that size avoids wasted GPU memory and upload time
- **Format**: JPEG for photographs, PNG for graphics with transparency, WebP for best compression
- **Preprocessing**: resize and compress images before serving for best performance

### Loading Strategies

**Eager loading** is the simplest strategy and fits most dashboards:

```ts
// Set every image, then wait once before revealing the graph
for (const user of users) {
  graph.addNode(user.id, { label: user.name, image: user.avatarUrl });
}
await graph.loadImages();
graph.render();
```

**Deferred loading** keeps the first paint fast on huge graphs: add nodes without images, then assign images as your application data arrives. The atlas picks up new URLs automatically and recycles slots as nodes scroll out of view.

```ts
graph.on('imageload', () => graph.requestRender()); // optional: explicit repaint on arrival
users.forEach(user => graph.setNodeImage(user.id, user.avatarUrl));
```

## Troubleshooting

### Images never appear
1. Open the console and listen for `imageerror`: a CORS failure or a 404 shows up there
2. Verify the server sends `Access-Control-Allow-Origin` for cross-origin URLs
3. Check that the URL is reachable and returns an image content type

### Some images appear, others do not
More than 64 distinct image URLs are visible in the same frame. Reduce the number of images shown at once, or render them in waves (assign URLs in batches and clear the ones that scroll away).

### Images flash or appear late
Image loading is asynchronous by design. If the first paint must include images, `await graph.loadImages()` before revealing the container.

### A node shows the wrong image
Setting a new URL on a node swaps its image as soon as the new one loads. If two nodes must show different images, make sure they use different URLs: the atlas deduplicates by URL, so two nodes sharing a URL intentionally share one cell.
