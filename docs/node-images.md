# Node Images Guide

Learn how to use images as node backgrounds in Graphium, from basic setup to advanced techniques like automatic texture atlasing, caching, and performance optimization.

## Overview

Graphium supports displaying images within nodes through an efficient texture atlas system. Images are automatically downloaded, cached, packed into a GPU texture atlas, and rendered with excellent performance even for hundreds of unique images.

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

// Using a data URL (base64 encoded image)
const imgData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...';
graph.setNodeImage('user456', imgData);

// Using a local file (in development)
graph.setNodeImage('user789', '/avatars/user789.png');
```

### Image Display Modes
Control how images fit within the node circle:

```ts
// 'cover' - fills the entire node (may crop edges) - DEFAULT
graph.setNodeImage('user123', url, 'cover');

// 'contain' - fits entire image within node (may have padding)
graph.setNodeImage('user123', url, 'contain');

// Remove image (shows node color instead)
graph.setNodeImage('user123', null);
```

### Waiting for Images to Load
```ts
// Wait for all pending images to load
await graph.loadImages();

// Wait for a specific image (not directly supported, but you can track manually)
const imagePromises = {};
function loadNodeImage(nodeId, url) {
  imagePromises[nodeId] = new Promise((resolve, reject) => {
    graph.setNodeImage(nodeId, url);
    // In a real implementation, you'd listen to imageload/imageerror events
    // For now, we'll approximate with a timeout
    setTimeout(() => resolve(), 1000); // Placeholder
  });
  
  return imagePromises[nodeId];
}

// Load multiple images and wait for all
await Promise.all([
  loadNodeImage('alice', 'alice.jpg'),
  loadNodeImage('bob', 'bob.jpg'),
  loadNodeImage('carol', 'carol.jpg')
]);
```

## Image Events

Graphium provides events to track image loading status:

```ts
// When an image loads successfully
graph.on('imageload', event => {
  console.log(`Image loaded: ${event.url}`);
  console.log(`For node: ${event.nodeId}`);
});

// When an image fails to load
graph.on('imageerror', event => {
  console.log(`Image failed to load: ${event.url}`);
  console.log(`For node: ${event.nodeId}`);
  console.log(`Error: ${event.error}`);
});

// You can also check if a specific node's image is loading
// (This would require tracking in your application code)
```

## How Image Handling Works

### Automatic Texture Atlasing
1. **Deduplication**: Same URL used multiple times only loads/downloads once
2. **Download**: Images are fetched with CORS-friendly settings
3. **Processing**: Images are decoded and resized to power-of-two dimensions
4. **Atlasing**: Images are packed into a 1024x1024 (or 2048x2048 if needed) texture atlas
5. **Upload**: Atlas is uploaded to GPU as a texture
6. **Rendering**: Nodes sample from the atlas using texture coordinates

### Caching Mechanism
- **Memory Cache**: Recently used images kept in memory for fast access
- **URL-Based**: Images identified by their URL - same URL = cached image
- **Automatic Cleanup**: Least recently used images removed when atlas needs space
- **Perspective**: Cache survives viewport changes but is cleared on `graph.destroy()`

## Image Configuration Options

### Global Image Settings
```ts
// Set default image behavior (applies to nodes without explicit settings)
graph.setImageOptions({
  defaultMode: 'contain',     // 'cover' or 'contain'
  loadingPlaceholder: null,   // URL or data URL to show while loading
  errorPlaceholder: null,     // URL or data URL to show on error
  cacheSize: 500,             // Maximum number of cached images
  maxAtlasSize: 2048          // Maximum texture atlas size (power of 2)
});
```

### Per-Node Image Options
```ts
// Set image with specific display mode
graph.setNodeImage('nodeId', url, 'cover');

// Or using the handle API for chaining
graph.node('nodeId')
  .image(url, 'contain')     // Set image and display mode
  .imageOptions({
    placeholder: 'placeholder.jpg',
    onError: () => console.log('Image failed to load')
  });
```

## Performance Considerations

### Image Size Optimization
- **Recommended Size**: 64x64 to 256x256 pixels for most use cases
- **Maximum Size**: Atlas will automatically resize larger images, but very large images waste memory
- **Format**: JPEG for photographs, PNG for graphics with transparency, WebP for best compression
- **Preprocessing**: Resize and compress images before serving for best performance

### Atlas Management
```ts
// Monitor atlas usage
const stats = graph.renderer.stats();
// stats.imageAtlasUsage - percentage of atlas used (0-1)
// stats.imageCacheSize - number of images in cache
// stats.imageLoadQueue - number of images waiting to load

// Pre-size atlas for known image count
graph.setImageOptions({ 
  maxAtlasSize: 2048, 
  cacheSize: 1000 
});

// Or let it auto-resize (starts at 1024, doubles to 2048 if needed)
```

### Loading Strategies
#### Eager Loading
```ts
// Load all images upfront (good for known, limited sets)
const imageUrls = [
  'user1.jpg', 'user2.jpg', 'user3.jpg',
  // ... hundreds of URLs
];

// Start loading all
imageUrls.forEach(url => {
  // Associate with nodes later
  graph.setImageOptions({ preload: true }); // Hypothetical API
});

// Better approach: load as nodes are added
nodes.forEach(node => {
  graph.addNode(node.id, { image: node.imageUrl });
  // Images begin loading immediately
});
```

#### Lazy Loading
```ts
// Load images only when nodes enter viewport
graph.on('viewportchange', (visibleNodes) => {
  visibleNodes.forEach(nodeId => {
    const node = graph.getNode(nodeId);
    if (node.image && !node.imageLoaded) {
      // Trigger load
      graph.setNodeImage(nodeId, node.image.url);
    }
  });
});

// Alternative: load on hover or interaction
graph.on('hover', (event) => {
  if (event.nodeId && !graph.nodeImageLoaded(event.nodeId)) {
    // Start loading hovered node's image
    const node = graph.getNode(event.nodeId);
    if (node.image) {
      graph.setNodeImage(event.nodeId, node.image.url);
    }
  }
});
```

## Handling Image Failures

### Graceful Degradation
```ts
// Set up error handling
graph.on('imageerror', event => {
  console.warn(`Failed to load image for ${event.nodeId}: ${event.url}`);
  
  // Option 1: Use a fallback image
  graph.setNodeImage(event.nodeId, '/fallbacks/default-avatar.png');
  
  // Option 2: Show initials or symbol
  const node = graph.getNode(event.nodeId);
  if (node.label) {
    const initials = node.label
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    
    // Create a text-based image (would require canvas manipulation)
    // const fallbackImg = createInitialsImage(initials, node.color);
    // graph.setNodeImage(event.nodeId, fallbackImg);
  }
  
  // Option 3: Just use node color (default behavior)
  // graph.setNodeImage(event.nodeId, null); // Already happens automatically
});
```

### Retry Mechanism
```ts
const failedAttempts = new Map();

graph.on('imageerror', event => {
  const attempts = failedAttempts.get(event.url) || 0;
  
  if (attempts < 3) {
    failedAttempts.set(event.url, attempts + 1);
    
    // Retry after delay
    setTimeout(() => {
      graph.setNodeImage(event.nodeId, event.url);
    }, 1000 * (attempts + 1)); // Exponential backoff
  } else {
    // Give up and use fallback
    graph.setNodeImage(event.nodeId, '/fallbacks/permanent-failure.png');
    failedAttempts.delete(event.url);
  }
});
```

## Advanced Techniques

### Dynamic Image Updates
```ts
// Change image based on node status
function updateUserStatusImage(nodeId, status) {
  let imageUrl;
  
  switch (status) {
    case 'online':    imageUrl = `/status/${nodeId}-online.png`; break;
    case 'away':      imageUrl = `/status/${nodeId}-away.png`; break;
    case 'busy':      imageUrl = `/status/${nodeId}-busy.png`; break;
    case 'offline':   imageUrl = `/status/${nodeId}-offline.png`; break;
    default:          imageUrl = `/status/${nodeId}.png`; break;
  }
  
  graph.setNodeImage(nodeId, imageUrl);
}

// Update in real-time
setInterval(() => {
  // Fetch status from server and update images
  fetch('/api/user-statuses')
    .then(res => res.json())
    .then(statuses => {
      statuses.forEach(({ nodeId, status }) => {
        updateUserStatusImage(nodeId, status);
      });
    });
}, 30000); // Every 30 seconds
```

### Image-Based Node Identification
Instead of or in addition to labels, use images for identification:
```ts
// For applications where images are primary identifiers
graph.setTheme({
  label: { enabled: false }, // Disable text labels
  node: { radius: 24, borderWidth: 2 } // Make room for images
});

// Add nodes with images as primary ID
users.forEach(user => {
  graph.addNode(user.id, {
    image: user.profilePicUrl,
    // Optional: tooltip or hover card shows name
    // Would require custom implementation using hover events
  });
});

// Show name on hover
graph.on('hover', event => {
  if (event.nodeId) {
    const user = users.find(u => u.id === event.nodeId);
    if (user) {
      // Show tooltip with user.name
      // Implementation would use DOM overlay or custom renderer extension
    }
  }
});
```

### Circular Image Cropping
Ensure images display as circles (not squares) by pre-processing:
```ts
// Server-side: Pre-process images to be circular
// Client-side: Use mask or shader (advanced)

// Simpler approach: Upload already-circular images
// Most avatar services provide circular options:
// - Gravatar: ?s=200&d=mp  (already circular)
// - Cloudinary: w_200,h_200,c_fill,r_max
// - AWS S3 with Lambda@Edge for image processing

// Or use CSS-like approach with node images:
// (Would require custom shader or pre-made circular images)
```

## Image Quality and Formats

### Format Selection Guide
| Format | Best For | Pros | Cons |
|--------|----------|------|------|
| **JPEG** | Photographs, complex images | Small file size, good quality | No transparency, compression artifacts |
| **PNG** | Graphics, logos, transparency | Lossless, transparency support | Larger file size |
| **WebP** | Modern browsers | Superior compression, transparency | Not supported in very old browsers |
| **SVG** | Icons, simple graphics | Infinite scalability, tiny size | Not rasterized - would need conversion |

### Recommended Settings for Graphium
- **Size**: 128x128px maximum (atlas will downscale if needed)
- **Format**: WebP if browser support allows, otherwise JPEG for photos, PNG for graphics
- **Quality**: 80-90% for JPEG, 75-85% for WebP
- **Color Profile**: sRGB (standard web color profile)

## Performance Optimization Tips

### 1. Image Preprocessing
```bash
# Resize and optimize images before uploading
# Using ImageMagick
mogrify -path optimized -resize 256x256\> *.jpg

# Using WebP conversion
cwebp -q 80 input.jpg -o output.webp

# Using SVGO for SVG optimization
svgo input.svg --output output.svg
```

### 2. Cache Control Headers
When serving images from your server:
```
Cache-Control: public, max-age=31536000, immutable
ETag: "v1.0"
```
This allows aggressive caching since image URLs rarely change.

### 3. CDN Usage
Serve images from a CDN for:
- Faster global delivery
- Automatic caching
- Image optimization services (Cloudinary, Imgix, etc.)
- DDoS protection

### 4. Batch Loading Optimization
```ts
// Instead of this (triggers multiple atlas updates):
users.forEach(user => {
  graph.setNodeImage(user.id, user.avatarUrl);
});

// Do this (still multiple updates but better than individual calls):
// Actually, Graphium batches internally, so both approaches are similar
// The key is not to call setNodeImage in a tight render loop

// Better: Load during initialization or user interaction lulls
```

### 5. Monitor and Tune
```ts
// Check image statistics periodically
setInterval(() => {
  const stats = graph.renderer.stats();
  
  if (stats.imageAtlasUsage > 0.9) {
    console.warn('Image atlas nearly full - consider increasing maxAtlasSize');
  }
  
  if (stats.imageLoadQueue > 50) {
    console.warn('Large image load queue - consider preloading or pagination');
  }
  
  // Adjust based on usage
  if (stats.imageCacheHitRate < 0.7) {
    // Low cache hit rate - images not being reused
    // Consider if you really need so many unique images
  }
}, 5000);
```

## Security Considerations

### CORS and Image Loading
Graphium fetches images using `fetch()` with `crossOrigin: 'anonymous'`. For this to work:

1. **Server Must Send CORS Headers**:
   ```
   Access-Control-Allow-Origin: *
   ```
   Or specifically allow your domain.

2. **Alternative: Proxy Through Your Server**
   If you cannot modify the image server's CORS headers:
   ```ts
   // Instead of direct URL:
   // 'https://external-site.com/user123.jpg'
   
   // Use your own proxy:
   '/api/image-proxy?url=https%3A%2F%2Fexternal-site.com%2Fuser123.jpg'
   ```
   Your proxy would:
   - Fetch the image
   - Serve it with appropriate CORS headers
   - Optionally cache and resize

### Data URLs and Security
```ts
// Data URLs are generally safe but be cautious with:
// - Extremely large data URLs (can cause memory issues)
// - Data URLs from untrusted sources (theoretical XSS risk if mis-handled)

// Graphium treats data URLs as opaque strings - no HTML/JS execution
const safeDataUrl = 'data:image/png;base64,VALID_BASE64_DATA';
graph.setNodeImage('nodeId', safeDataUrl);

// But avoid:
const dangerousUrl = 'data:text/html,<script>alert("xss")</script>';
// This won't execute as JS, but wastes bandwidth
```

### Rate Loading and Abuse Prevention
```ts
// Protect against malicious users setting many image URLs
const imageSetCount = new Map();
const MAX_IMAGES_PER_MINUTE = 50;

graph.on('beforeSetNodeImage', (event) => {  // Hypothetical event
  const userId = getCurrentUserId(); // From your auth system
  const count = imageSetCount.get(userId) || 0;
  
  if (count >= MAX_IMAGES_PER_MINUTE) {
    // Reject or rate limit
    return false; // Prevent the image from being set
  }
  
  imageSetCount.set(userId, count + 1);
  
  // Reset counter every minute
  setTimeout(() => {
    imageSetCount.set(userId, Math.max(0, (imageSetCount.get(userId) || 0) - 1));
  }, 60000 / MAX_IMAGES_PER_MINUTE);
  
  return true; // Allow the image to be set
});
```

## Common Use Cases

### Social Network Profile Pictures
```ts
// Typical social network implementation
users.forEach(user => {
  const node = graph.addNode(user.id, {
    label: user.name,
    // Use thumbnail for performance
    image: user.profilePicThumbnailUrl // 128x128 version
  });
  
  // Optional: show full profile on click
  graph.on('click', event => {
    if (event.nodeId) {
      const user = users.find(u => u.id === event.nodeId);
      if (user) {
        // Show modal with full-size image and bio
        showUserProfile(user);
      }
    }
  });
});

// Handle image updates when users change profile pictures
socket.on('profile-picture-updated', ({ userId, newUrl }) => {
  graph.setNodeImage(userId, newUrl);
});
```

### Organizational Charts
```ts
// Show employee photos in org chart
employees.forEach(emp => {
  graph.addNode(emp.id, {
    label: `${emp.name}\n${emp.title}`,
    image: emp.photoUrl,
    // Make managers larger
    radius: emp.isManager ? 18 : 14
  });
  
  // Link to manager
  if (emp.managerId) {
    graph.link(emp.managerId, emp.id);
  }
});

// Use different image styles by role
graph.setTheme({
  node: {
    // Base settings
    radius: 14,
    imageOpacity: 0.9
  }
});

// Then override for executives
executives.forEach(execId => {
  graph.node(execId)
    .style({ radius: 22 })  // Larger for executives
    .imageOptions({ 
      // Could add a border effect for executives
    });
});
```

### Game Avatars and Items
```ts
// Game character selector
characters.forEach(char => {
  graph.addNode(char.id, {
    label: char.name,
    image: char.portraitUrl,
    // Add rarity coloring
    color: RARITY_COLORS[char.rarity]
  });
  
  // Show details on hover
  graph.on('hover', event => {
    if (event.nodeId) {
      const char = characters.find(c => c.id === event.nodeId);
      if (char) {
        showCharacterTooltip(char);
      }
    }
  });
});

// Item crafting diagram
items.forEach(item => {
  graph.addNode(item.id, {
    label: item.name,
    image: item.iconUrl,
    // Size by item tier
    radius: 10 + (item.tier * 2)
  });
  
  // Link crafting recipes
  item.recipe.forEach(ingredientId => {
    graph.link(item.id, ingredientId);
  });
});
```

### Data Visualization with Icons
```ts
// Use icons instead of photos for conceptual nodes
const iconMap = {
  database: '/icons/database.png',
  server: '/icons/server.png',
  user: '/icons/user.png',
  network: '/icons/network.png',
  firewall: '/icons/firewall.png'
};

infrastructureComponents.forEach(comp => {
  graph.addNode(comp.id, {
    label: comp.name,
    image: iconMap[comp.type] || '/icons/unknown.png',
    color: getColorByServiceType(comp.type)
  });
  
  // Link connections
  comp.connections.forEach(targetId => {
    graph.link(comp.id, targetId);
  });
});
```

## Troubleshooting

### Images Not Showing
1. **Check Network**: Use browser dev tools to see if images are downloading
2. **CORS Issues**: Look for "Access to image at '...' from origin '...' has been blocked by CORS policy"
3. **Invalid URLs**: Verify URLs are correctly formatted and accessible
4. **Atlas Full**: Check if you've exceeded maxAtlasSize - increase it if needed
5. **Wrong Display Mode**: Try switching between 'cover' and 'contain'

### Poor Image Quality
1. **Source Image Low Res**: Use higher resolution source images
2. **Atlas Downscaling**: If atlas is full, images may be downsampled - increase maxAtlasSize
3. **Compression Artifacts**: Use less compression (higher quality) for source images
4. **Scaling Issues**: Images scaled non-uniformly can appear stretched

### Performance Issues
1. **Too Many Unique Images**: Consider limiting to 500-1000 unique images max
2. **Large Image Files**: Resize images to reasonable dimensions before use
3. **Frequent Changes**: Rapidly changing many images causes frequent atlas updates
4. **Cache Thrashing**: If you're constantly loading new images, consider increasing cache size

### Specific Error Messages
- **"Failed to execute 'texImage2D' on 'WebGLRenderingContext'"**: Usually means invalid image data or unsupported format
- **"Image size exceeds maximum texture size"**: Image is too large for GPU - resize source image
- **"Invalid argument"**: Usually related to image dimensions not being power of two (modern GL handles this, but very old devices might not)

## API Reference

```ts
// Set image for a node
graph.setNodeImage(nodeId: string, url: string|null, mode?: 'cover'|'contain');

// Remove image (show node color)
graph.setNodeImage(nodeId: string, null);

// Set image options (global settings)
graph.setImageOptions(options: Partial<ImageOptions>);

// Wait for all images to load
await graph.loadImages(): Promise<void>;

// Image events
graph.on('imageload', (event: { nodeId: string, url: string }) => {});
graph.on('imageerror', (event: { 
  nodeId: string, 
  url: string, 
  error: Error 
}) => {});

// Check if node has image (application-level tracking)
// Graphium doesn't expose this directly - track in your app:
const hasImage = (nodeId) => {
  // You would need to track this yourself when calling setNodeImage
  return !!nodeImages[nodeId]; // Hypothetical
};

// Get image statistics
const stats = graph.renderer.stats();
// stats.imageAtlasUsage - 0 to 1
// stats.imageCacheSize - number of cached images
// stats.imageLoadQueue - number of images waiting to load
// stats.imageUploads - number of atlas uploads to GPU
// stats.imageCacheHitRate - ratio of cache hits to requests
```