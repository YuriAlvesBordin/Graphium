# Changelog

All notable changes to Graphium will be documented in this file.

## [2.1.1] - 2026-10-23

### Fixed
- Spatial hash no longer hangs when items spread across more distinct cells than the initial table capacity; the cell table now grows during rebuild
- Hover highlight now repaints on fully settled (sleeping) graphs by moving the appearance revision
- Texture atlas recycles freed slots after sweep, so node images keep loading after the first 64 distinct URLs; pending cleanup no longer leaves loadAll unresolved and late image loads cannot paint into a recycled slot
- Clear error message when WebGL2 is unavailable instead of a TypeError inside the texture atlas
- Unknown physics preset names fail with a readable error listing the available presets
- The resize observer is disconnected on destroy()
- Node picking falls back to a linear scan before the physics spatial hash is built, so dragging and clicking work with autoStart disabled
- Label culling compares CSS pixel bounds on HiDPI screens, avoiding up to twice the necessary label work

## [2.1.0] - 2026-10-23

### Added
- Smooth edge length animation: per-link `restLength` changes now ease through the physics solver instead of jumping, driven by the new `restLengthSmooth` physics option (default `0.12`, `0` restores instant snapping)
- `LinkHandle.restLength(value)` fluent shortcut for changing one edge's rest length
- Changing a link's `restLength` or `strength` now wakes the simulation, so length updates apply even on a fully settled graph
- "Edge rest length" slider in the playground demo

## [Unreleased]

### Added
- Fluent interface consistency: setter methods now return `this` for chaining
- Bulk operations: `addNodes()`, `addLinks()`, `removeNodes()`, `removeLinks()`
- Explicit add semantics: `addNodeIfAbsent()`, `addLinkIfAbsent()`
- Enhanced event payloads: events now include node/link snapshots and IDs
- Advanced label styling: customizable font, color, background, padding, alignment, multi-line
- Export capabilities: `exportImage()` (PNG/JPEG) and `exportJSON()` methods
- Theme system: built-in themes and custom theme support via `setTheme()`
- Auto-destroy option: automatic cleanup for SPA environments
- Comprehensive examples showcasing new features

### Changed
- Updated default appearance options to include label styling properties
- Improved label management system to support HTML content and styling
- Updated README with detailed feature documentation and import alternatives
- Minor performance optimizations in appearance change handling

### Fixed
- Fixed default export consistency issues with different module systems
- Corrected label positioning calculations for various styling options
- Ensured proper cleanup of MutationObserver in auto-destroy feature

## [0.1.0] - 2026-09-03
### Added
- Initial release of Graphium with core features:
  - WebGL2-based high-performance rendering
  - Physics-based force-directed layout
  - Edge conflict detection and resolution
  - Rich interaction capabilities
  - Zero-dependency ES module distribution
  - TypeScript definitions