/**
 * Owns the on demand render loop: rAF scheduling, revision based dirty
 * checking, auto fit bookkeeping and the frame timing statistics.
 */

import type { GraphModel } from '../core/GraphModel.js';
import type { PhysicsEngine } from '../physics/PhysicsEngine.js';
import type { Camera } from './Camera.js';
import type { LabelLayer } from './LabelLayer.js';
import type { Renderer } from './Renderer.js';
import type { TextureAtlas } from './TextureAtlas.js';

/** Collaborators and hooks the loop needs from the main facade. */
export interface RenderLoopDeps {
  model: GraphModel;
  physics: PhysicsEngine;
  camera: Camera;
  renderer: Renderer;
  labels: LabelLayer;
  atlas: TextureAtlas;
  /** Whether the simulation should step on every frame. */
  isRunning(): boolean;
  /** Whether the owning instance was destroyed. */
  isDestroyed(): boolean;
  /** Whether the view should fit itself when data first appears. */
  autoFit: boolean;
  /** Fits the view to the graph; used by the auto fit path. */
  fitView(): void;
  /** Optional hook invoked before rendering when the frame is dirty. */
  beforeRender?: () => void;
}

export class RenderLoop {
  private readonly deps: RenderLoopDeps;
  private rafActive = false;
  private rafHandle = 0;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private lastTime = 0;
  private didAutoFit = false;
  private lastCameraRevision = -1;
  private lastTopologyRevision = -1;
  private lastAppearanceRevision = -1;
  private lastPositionRevision = -1;
  private lastAtlasRevision = -1;
  private forceDirty = false;
  /** Exponential moving averages surfaced by the stats snapshot. */
  fps = 60;
  frameMs = 16;
  physicsMs = 0;

  constructor(deps: RenderLoopDeps) {
    this.deps = deps;
  }

  /** Advances physics and renders once, returning the kinetic energy. */
  step(dt = 1 / 60): number {
    const energy = this.deps.physics.step(dt);
    this.renderFrame();
    return energy;
  }

  /** Performs one render pass immediately without stepping the simulation. */
  renderNow(): void {
    this.renderFrame();
  }

  /** Requests a render on the next scheduled frame. */
  requestRender(): void {
    this.forceDirty = true;
    this.invalidate();
  }

  /** Marks the view dirty and guarantees a scheduled frame. */
  invalidate(): void {
    this.scheduleFrame();
  }

  /** Schedules a loop iteration when none is pending. */
  schedule(): void {
    this.scheduleFrame();
  }

  /** Allows the next data arrival to trigger the auto fit again. */
  resetAutoFit(): void {
    this.didAutoFit = false;
  }

  /** Cancels any pending frame; called during teardown. */
  cancel(): void {
    if (this.rafHandle && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = 0;
    }
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  /** Performs one render pass and label update with revision bookkeeping. */
  private renderFrame(): void {
    if (this.deps.isDestroyed()) {
      return;
    }
    if (this.deps.autoFit && !this.didAutoFit && this.deps.model.nodeCount > 0) {
      this.didAutoFit = true;
      this.deps.fitView();
    }
    this.deps.renderer.render(this.deps.model);
    this.deps.labels.update();
    this.lastCameraRevision = this.deps.camera.revision;
    this.lastTopologyRevision = this.deps.model.topologyRevision;
    this.lastAppearanceRevision = this.deps.model.appearanceRevision;
    this.lastPositionRevision = this.deps.model.positionRevision;
    this.lastAtlasRevision = this.deps.atlas.revision;
  }

  /** Schedules a loop iteration when none is pending. */
  private scheduleFrame(): void {
    if (this.rafActive || this.deps.isDestroyed()) {
      return;
    }
    this.rafActive = true;
    if (typeof requestAnimationFrame === 'function') {
      this.rafHandle = requestAnimationFrame(this.frame);
    } else {
      this.timeoutHandle = setTimeout(() => this.frame(performance.now()), 16);
    }
  }

  /** Runs one loop iteration, stepping physics and rendering when dirty. */
  private frame = (time: number): void => {
    this.rafActive = false;
    if (this.deps.isDestroyed()) {
      return;
    }
    const dt = this.lastTime > 0 ? Math.min(0.05, (time - this.lastTime) / 1000) : 1 / 60;
    this.lastTime = time;
    const started = performance.now();
    if (this.deps.isRunning()) {
      this.deps.physics.step(dt);
    }
    this.physicsMs = performance.now() - started;
    const dirty =
      this.forceDirty ||
      this.deps.camera.revision !== this.lastCameraRevision ||
      this.deps.model.topologyRevision !== this.lastTopologyRevision ||
      this.deps.model.appearanceRevision !== this.lastAppearanceRevision ||
      this.deps.model.positionRevision !== this.lastPositionRevision ||
      this.deps.atlas.revision !== this.lastAtlasRevision;
    this.forceDirty = false;
    if (dirty) {
      this.deps.beforeRender?.();
      this.renderFrame();
    }
    const frameDuration = performance.now() - started;
    this.frameMs = this.frameMs * 0.9 + frameDuration * 0.1;
    this.fps = this.fps * 0.9 + (1 / Math.max(0.001, dt)) * 0.1;
    if (this.deps.isRunning() && !this.deps.physics.sleeping) {
      this.scheduleFrame();
    } else {
      this.lastTime = 0;
    }
  };
}
