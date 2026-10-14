# Theming Guide

Learn how to customize Graphium's appearance using its flexible theming system. Create beautiful, consistent visualizations that match your application's design language.

## Overview

Graphium's theming system allows you to customize virtually every visual aspect of your graph:
- Node appearance (size, color, border, images)
- Link appearance (color, width, curvature, arrows, dashing)
- Labels (font, size, color, background)
- Background and viewport elements
- Interactive states (hover, selection)

## Built-In Themes

Graphium includes four professionally designed themes:

### Midnight (Default)
Dark theme with vibrant accent colors - ideal for dashboards and data visualization applications.
```ts
graph.setTheme({ name: 'midnight' });
```

### Light
Clean, light theme suitable for reports, documentation, and bright environments.
```ts
graph.setTheme({ name: 'light' });
```

### slate
Cool, neutral theme with blue-gray tones - great for professional applications.
```ts
graph.setTheme({ name: 'slate' });
```

### sunset
Warm, gradient-inspired theme - perfect for creative displays and presentations.
```ts
graph.setTheme({ name: 'sunset' });
```

## Theme Structure

A Graphium theme consists of several sections, each controlling different visual elements:

```ts
interface ThemeOptions {
  background: string;           // Canvas background color
  
  node: {                       // Node appearance
    radius: number;             // Node radius in pixels
    borderWidth: number;        // Border width in pixels
    colorPalette: string[];     // Palette for automatic node coloring
    defaultColor: string;       // Fallback color when palette exhausted
    imageOpacity: number;       // Opacity of node images (0-1)
  };
  
  edge: {                       // Link/edge appearance
    color: string;              // Default link color
    width: number;              // Default link width in pixels
    curvature: number;          // Default curvature (-1 to 1)
    arrowEnabled: boolean;      // Whether to show arrow heads
    arrowSize: number;          // Size of arrow heads
    dashEnabled: boolean;       // Whether dashed lines are enabled
    dashArray: number[];        // Pattern for dashed lines [dash, gap, ...]
  };
  
  label: {                      // Text label appearance
    enabled: boolean;           // Whether to show labels
    size: number;               // Font size in pixels
    color: string;              // Text color
    background: string;         // Background color (CSS rgba format)
    borderRadius: number;       // Background border radius
    padding: number;            // Horizontal padding around text
    fontFamily: string;         // Font family
    fontWeight: number;         // Font weight (100-900)
  };
  
  hoverRing: {                  // Appearance when hovering over nodes
    color: string;              // Ring color
    width: number;              // Ring width in pixels
  };
  
  selectedRing: {               // Appearance when selecting nodes/links
    color: string;              // Ring color
    width: number;              // Ring width in pixels
  };
}
```

## Creating Custom Themes

You can create a custom theme by providing any subset of theme values. Missing values will inherit from the current theme (or defaults if no theme is set).

### Simple Customization
```ts
// Just change the background color
graph.setTheme({ background: '#1a1a1a' });

// Change node size and color palette
graph.setTheme({
  node: {
    radius: 16,
    colorPalette: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3']
  }
});
```

### Complete Custom Theme
```ts
graph.setTheme({
  background: '#0f1419',
  
  node: {
    radius: 14,
    borderWidth: 2,
    colorPalette: ['#ff9ff3', '#feca57', '#48dbfb', '#1dd1a1', '#ff6b6b'],
    defaultColor: '#ffffff',
    imageOpacity: 0.9
  },
  
  edge: {
    color: '#636e72',
    width: 1.8,
    curvature: 0.1,
    arrowEnabled: true,
    arrowSize: 6,
    dashEnabled: true,
    dashArray: [4, 2]
  },
  
  label: {
    enabled: true,
    size: 12,
    color: '#ffffff',
    background: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 6,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    fontWeight: 500
  },
  
  hoverRing: {
    color: '#00cec9',
    width: 3
  },
  
  selectedRing: {
    color: '#ff9ff3',
    width: 4
  }
});
```

## Theme Inheritance and Merging

Themes merge intelligently - you only need to specify the values you want to change:

```ts
// Start with midnight theme
graph.setTheme({ name: 'midnight' });

// Later, just override the colors
graph.setTheme({
  node: { colorPalette: ['#ff6b6b', '#4ecdc4', '#ffe66d'] },
  edge: { color: '#51586b' },
  background: '#0b0e14'
});

// The other values (node.radius, label.size, etc.) remain from midnight theme
```

## Dynamic Theming

Change themes at runtime for interactive experiences:

```ts
// Theme switcher UI
const themeButtons = document.querySelectorAll('.theme-btn');
themeButtons.forEach(button => {
  button.addEventListener('click', () => {
    const themeName = button.dataset.theme;
    graph.setTheme({ name: themeName });
    
    // Update UI
    themeButtons.forEach(btn => btn.classList.toggle('active', btn === button));
  });
});

// Animated theme transition
function transitionTheme(fromTheme, toTheme, duration = 500) {
  const startTime = performance.now();
  
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2; // Ease in-out
    
    // In a real implementation, you would interpolate between theme values
    // For simplicity, we'll just switch at the end
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      graph.setTheme({ name: toTheme });
    }
  }
  
  requestAnimationFrame(animate);
}
```

## Node and Link Styling Beyond Themes

While themes set default styles, you can override individual nodes and links:

### Per-Node Styling
```ts
// Style a specific node
graph.node('important-node')
  .style({
    radius: 25,                    // Larger radius
    color: '#ffd166',              // Specific color
    borderWidth: 3,                // Thicker border
    borderColor: '#ffffff'         // White border
  })
  .fix();                          // Lock position

// Use handles for chaining
graph.node('user123')
  .image('/avatars/user123.png')   // Set profile image
  .label('John Doe')               // Custom label
  .color('#4ecdc4')                // Node color
  .size(18)                        // Node radius
  .borderWidth(2)                  // Border width
  .select();                       // Select it
```

### Per-Link Styling
```ts
// Style a specific link
graph.linkById('alice~bob~0')
  .curve(0.4)                      // Curved link
  .width(3)                        // Thicker line
  .color('#ff6b6b')                // Red color
  .dashed([8, 4])                  // Longer dashes
  .arrowSize(8)                    // Larger arrow
  .arrowEnabled(true);             // Ensure arrow is shown

// Or use the link handle
graph.link('alice~bob')
  .curve(-0.2)                     // Curve the other way
  .pulse(true)                     // Make it pulse (if supported)
  .label('Friends')                // Add label to link
  .labelPosition(0.5);             // Label at midpoint
```

## Color Palettes and Automatic Coloring

Graphium automatically assigns colors from your theme's palette based on node IDs:

### How Automatic Coloring Works
1. Each node ID is hashed to a number
2. That number is used as an index into the `colorPalette` array
3. If the index exceeds the palette length, it wraps around
4. This ensures consistent coloring: the same node ID always gets the same color

### Custom Palette Strategies
```ts
// Use a gradient-like palette for smooth transitions
graph.setTheme({
  node: {
    colorPalette: [
      '#ff6b6b', '#ff8e8e', '#ffb1b1', '#ffd4d4', // Reds
      '#ffd4b1', '#fff8b1',                      // Yellows
      '#b1ffb1', '#8eff8e',                      // Greens
      '#b1e0ff', '#8ecfff'                       // Blues
    ]
  }
});

// Use distinct palettes for different node types
function setNodeTypePalette(graph, nodeTypePaletteMap) {
  // This would require custom implementation outside Graphium
  // You could store node types separately and apply colors manually
}

// Example manual coloring based on node type
nodes.forEach(node => {
  let color;
  switch (node.type) {
    case 'user': color = '#ff6b6b'; break;
    case 'group': color = '#4ecdc4'; break;
    case 'event': color = '#ffe66d'; break;
    default: color = '#95e1d3';
  }
  graph.node(node.id).style({ color });
});
```

## Advanced Styling Techniques

### Gradient Nodes (via Images)
While Graphium doesn't natively support gradient fills, you can use node images:
```ts
// Create a gradient canvas
function createGradientNode(color1, color2, size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  return canvas.toDataURL();
}

// Use as node image
const gradientImg = createGradientNode('#ff6b6b', '#4ecdc4');
graph.node('special').image(gradientImg);
```

### Patterned Links
Create custom dashed patterns:
```ts
// Various dash patterns
graph.link('a~b').dashed([5, 3]);      // Standard dash
graph.link('a~b').dashed([10, 5]);     // Longer dash
graph.link('a~b').dashed([2, 2, 6, 2]); // Dash-dot-dot
graph.link('a~b').dashed([1, 1]);      // Dotted
graph.link('a~b').dashed([15, 3, 3, 3]); // Morse code like
```

### Node Borders and Effects
```ts
// Double border effect (using two nodes)
// Not directly supported, but you could:
// 1. Make the main node slightly smaller
// 2. Add a second, slightly larger node behind it with border color
// 3. Or use node images with border effects pre-rendered

// Pulsing animation (manual implementation)
let pulsePhase = 0;
function updatePulse() {
  pulsePhase += 0.05;
  const pulseSize = 1 + Math.sin(pulsePhase) * 0.2; // 0.8 to 1.2 scale
  
  graph.node('pulsing-node').style({
    radius: 12 * pulseSize
  });
  
  requestAnimationFrame(updatePulse);
}
updatePulse();
```

## Theme Best Practices

### Accessibility Considerations
```ts
// High contrast theme for accessibility
graph.setTheme({
  background: '#000000',
  node: {
    radius: 16,
    borderWidth: 3,
    colorPalette: ['#ffffff', '#ffff00', '#ff00ff', '#00ffff'],
    defaultColor: '#ffffff'
  },
  edge: {
    color: '#ffffff',
    width: 2,
    arrowEnabled: true
  },
  label: {
    size: 14,
    color: '#ffffff',
    background: 'rgba(0,0,0,0.7)' // High contrast background
  },
  hoverRing: {
    color: '#ffff00',
    width: 4
  },
  selectedRing: {
    color: '#ff00ff',
    width: 5
  }
});

// Ensure sufficient color contrast
// Use tools like WebAIM Contrast Checker to verify:
// - Node color vs background: ≥ 4.5:1 for normal text
// - Label text vs label background: ≥ 4.5:1
// - Ring colors vs node/background: ≥ 3:1 for UI components
```

### Performance Tips
```ts
// Simple themes render faster
graph.setTheme({
  background: '#ffffff',
  node: { radius: 8, borderWidth: 1, colorPalette: ['#333'] },
  edge: { color: '#999', width: 1, arrowEnabled: false },
  label: { enabled: false }, // Disable labels for huge graphs
  hoverRing: { width: 0 },   // Disable hover effects
  selectedRing: { width: 2 }
});

// For animated themes, minimize expensive changes:
// - Changing colors is cheap
// - Changing node radius requires recalculating collision shapes
// - Changing link width is moderately expensive
// - Disabling/enabling features (arrows, labels) has minimal runtime cost
```

### Consistency with Your Application
```ts
// Match your application's CSS variables
const rootStyles = getComputedStyle(document.documentElement);
const appBg = rootStyles.getPropertyValue('--app-background');
const appPrimary = rootStyles.getPropertyValue('--app-primary');
const appSecondary = rootStyles.getPropertyValue('--app-secondary');

graph.setTheme({
  background: appBg,
  node: {
    colorPalette: [appPrimary, appSecondary, 
                  lightenColor(appPrimary, 20), 
                  darkenColor(appSecondary, 20)]
  },
  edge: { color: appSecondary },
  label: { color: appPrimary }
});

// Helper functions (simplified)
function lightenColor(color, percent) {
  // Implementation would convert to HSL, adjust lightness, convert back
  return color; // Placeholder
}

function darkenColor(color, percent) {
  // Implementation would convert to HSL, adjust lightness, convert back
  return color; // Placeholder
}
```

## Theme API Reference

```ts
// Set theme by name (built-in)
graph.setTheme({ name: 'midnight'|'light'|'slate'|'sunset' });

// Set theme with custom values (partial update)
graph.setTheme(partialTheme: Partial<ThemeOptions>);

// Get current theme
const currentTheme = graph.theme;

// Reset to default theme
graph.setTheme({ name: 'midnight' }); // Or whatever your default is

// Theme change event
graph.on('themechange', () => {
  console.log('Theme changed:', graph.theme);
});

// Note: Graphium doesn't emit a explicit themechange event by default
// You would need to wrap setTheme to detect changes:
const originalSetTheme = graph.setTheme.bind(graph);
graph.setTheme = (options) => {
  const result = originalSetTheme(options);
  // Emit custom event or callback here
  return result;
};
```

## Examples

### Corporate Dashboard Theme
```ts
graph.setTheme({
  background: '#f8f9fa',
  node: {
    radius: 12,
    borderWidth: 2,
    colorPalette: ['#2c3e50', '#e74c3c', '#ecf0f1', '#3498db', '#2ecc71'],
    defaultColor: '#95a5a6'
  },
  edge: {
    color: '#bdc3c7',
    width: 1.5,
    arrowEnabled: true,
    arrowSize: 5
  },
  label: {
    size: 11,
    color: '#2c3e50',
    background: 'rgba(255,255,255,0.8)',
    borderRadius: 3,
    padding: 4
  },
  hoverRing: {
    color: '#3498db',
    width: 3
  },
  selectedRing: {
    color: '#e74c3c',
    width: 4
  }
});
```

### Game-Like Visualization
```ts
graph.setTheme({
  background: '#0a0a0a',
  node: {
    radius: 10,
    borderWidth: 1,
    colorPalette: ['#ff006e', '#ffb400', '#00cd6c', '#00a8ff', '#9d4edd'],
    defaultColor: '#ffffff',
    imageOpacity: 1
  },
  edge: {
    color: '#4cc9f0',
    width: 1.2,
    curvature: 0.15,
    arrowEnabled: true,
    arrowSize: 5,
    dashEnabled: true,
    dashArray: [3, 1]
  },
  label: {
    enabled: false // Often disabled in games for performance
  },
  hoverRing: {
    color: '#ff9f1c',
    width: 2
  },
  selectedRing: {
    color: '#ff006e',
    width: 3
  }
});
```

### Scientific Network Diagram
```ts
graph.setTheme({
  background: '#ffffff',
  node: {
    radius: 8,
    borderWidth: 1.5,
    colorPalette: ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557'],
    defaultColor: '#6c757d'
  },
  edge: {
    color: '#6c757d',
    width: 1,
    arrowEnabled: false, // Often undirected in scientific networks
    dashEnabled: true,
    dashArray: [2, 2]
  },
  label: {
    size: 10,
    color: '#212529',
    background: 'rgba(255,255,255,0.7)',
    borderRadius: 3,
    padding: 3
  },
  hoverRing: {
    color: '#457b9d',
    width: 2
  },
  selectedRing: {
    color: '#e63946',
    width: 3
  }
});
```

## Troubleshooting

### Colors Not Applying
1. **Specificity**: Per-node/link styles override theme defaults
2. **Timing**: Make sure to set theme before adding nodes/links if you want automatic coloring
3. **Cache**: Node colors are cached when created - you may need to restyle existing nodes

### Theme Changes Not Visible
1. **Render Trigger**: Some theme changes may not trigger automatic render
   - Solution: Call `graph.requestRender()` after theme changes
2. **Partial Updates**: Only changed properties are updated - others retain previous values
3. **Conflicting Styles**: Check if you have conflicting per-node/link styles

### Performance Issues with Complex Themes
1. **Expensive Properties**: `label.background` with complex CSS can impact performance
2. **Image Processing**: Node images require GPU uploads - optimize image sizes
3. ** frequent Changes**: Avoid rapidly changing theme properties in animation loops

## Integration with CSS

For perfect integration with your website's design system:

```ts
// Extract colors from CSS
function getCssVariable(variable) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(variable).trim();
}

// Apply to Graphium theme
graph.setTheme({
  background: getCssVariable('--color-bg-primary'),
  node: {
    colorPalette: [
      getCssVariable('--color-primary'),
      getCssVariable('--color-secondary'),
      getCssVariable('--color-accent'),
      getCssVariable('--color-success')
    ]
  },
  edge: { color: getCssVariable('--color-muted') },
  label: {
    color: getCssVariable('--color-text-primary'),
    background: getCssVariable('--color-bg-secondary')
  }
});

// Update theme when CSS variables change (e.g., dark mode toggle)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (e.matches) {
    // Dark mode
    graph.setTheme({ /* dark theme values */ });
  } else {
    // Light mode
    graph.setTheme({ /* light theme values */ });
  }
});
```

## Related Topics

- [Node Images](./node-images.md) - Use custom images as node backgrounds
- [Events & Interaction](./events-interaction.md) - Respond to hover/click events
- [Performance Tuning](./performance-tuning.md) - Optimize rendering performance
- [API Reference](https://github.com/YuriAlvesBordin/Graphium/blob/main/docs/api-reference.md) - Complete method listings