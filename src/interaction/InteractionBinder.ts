/**
 * Connects user input to graph behavior: builds the pointer controller,
 * routes pointer and physics events, maintains the hover state and exposes
 * link hit testing.
 */

import type { Emitter } from '../core/events.js';
import { GraphModel, LINK_HIDDEN, STATE_HOVER, STATE_NORMAL } from '../core/GraphModel.js';
import type { SelectionController } from '../core/SelectionController.js';
import type { GraphiumOptions, InteractionOptions } from '../core/types.js';
import type { PhysicsEngine } from '../physics/PhysicsEngine.js';
import type { SpatialHash } from '../physics/SpatialHash.js';
import { PointerController } from './PointerController.js';
import type { Camera } from '../render/Camera.js';
import { distanceToEdge } from '../render/geometry.js';

/** Collaborators and hooks the binder needs from the main facade. */
export interface InteractionDeps {
  canvas: HTMLCanvasElement;
  model: GraphModel;
  physics: PhysicsEngine;
  camera: Camera;
  hash: SpatialHash;
  events: Emitter;
  interaction: GraphiumOptions['interaction'];
  selection: SelectionController;
  invalidate: () => void;
}

export class InteractionBinder {
  private pointer: PointerController | null = null;
  private hoverIndex = -1;

  constructor(private readonly deps: InteractionDeps) {
    this.wirePointer();
    this.wireEvents();
  }

  /** Updates interaction options on the live pointer controller. */
  setInteraction(options: InteractionOptions): void {
    if (this.pointer) {
      Object.assign(this.pointer.options, options);
    }
  }

  /** Finds the link index closest to a world position within a radius. */
  pickLinkAt(worldX: number, worldY: number, hitRadius = 8): number {
    const model = this.deps.model;
    const tolerance = hitRadius / Math.max(this.deps.camera.zoom, 0.0001);
    let best = -1;
    let bestDistance = Infinity;
    for (let link = 0; link < model.linkCount; link++) {
      if (model.linkFlags[link] & LINK_HIDDEN) {
        continue;
      }
      const source = model.source[link];
      const target = model.target[link];
      const distance = distanceToEdge(worldX, worldY, model.x[source], model.y[source], model.x[target], model.y[target], model.linkCurvature[link]);
      const limit = tolerance + model.linkWidth[link] / Math.max(this.deps.camera.zoom, 0.0001);
      if (distance <= limit && distance < bestDistance) {
        best = link;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Releases the pointer controller. */
  destroy(): void {
    this.pointer?.destroy();
  }

  /** Builds the pointer controller when interaction is not disabled. */
  private wirePointer(): void {
    const interaction = this.deps.interaction;
    if (interaction === false) {
      return;
    }
    const settings: InteractionOptions = interaction === true || interaction === undefined ? {} : interaction;
    this.pointer = new PointerController(this.deps.canvas, this.deps.camera, this.deps.model, this.deps.physics, this.deps.hash, this.deps.events, {
      wheelZoomSpeed: settings.wheelZoomSpeed,
      dragThreshold: settings.dragThreshold,
      longPressMs: settings.longPressMs,
      linkHitRadius: settings.linkHitRadius,
      hoverEnabled: settings.hoverEnabled,
      panEnabled: settings.panEnabled,
      zoomEnabled: settings.zoomEnabled,
      dragEnabled: settings.dragEnabled,
      pickLink: (worldX, worldY, radius) => this.pickLinkAt(worldX, worldY, radius),
    });
  }

  /** Connects library internal reactions to emitter traffic. */
  private wireEvents(): void {
    const { physics, events, selection, invalidate } = this.deps;
    physics.onSleep = energy => {
      events.emit('sleep', { energy });
    };
    physics.onWake = () => {
      events.emit('wake', {});
      invalidate();
    };
    events.on('pan', () => invalidate());
    events.on('zoom', () => invalidate());
    events.on('pinch', () => invalidate());
    events.on('hover', payload => {
      const event = payload as unknown as { nodeIndex?: number };
      this.setHover(typeof event.nodeIndex === 'number' ? event.nodeIndex : -1);
      invalidate();
    });
    events.on('click', payload => {
      const event = payload as unknown as { nodeIndex: number; linkIndex: number };
      if (event.linkIndex >= 0) {
        selection.selectLink(event.linkIndex, true);
      } else if (event.nodeIndex >= 0) {
        selection.selectNode(event.nodeIndex, true);
      } else {
        selection.clear();
      }
      invalidate();
    });
    events.on('drag', () => {
      physics.wake();
      invalidate();
    });
    events.on('dragend', () => invalidate());
    events.on('imageload', () => invalidate());
  }

  /** Updates the hovered node and keeps the previous one consistent. */
  private setHover(index: number): void {
    const previous = this.hoverIndex;
    if (previous === index) {
      return;
    }
    const state = this.deps.model.state;
    if (previous >= 0 && state[previous] === STATE_HOVER) {
      state[previous] = STATE_NORMAL;
    }
    this.hoverIndex = index;
    if (index >= 0 && state[index] === STATE_NORMAL) {
      state[index] = STATE_HOVER;
    }
    // The renderer derives hover styling from the state byte, so the dirty
    // check needs the revision to move even while the simulation sleeps.
    this.deps.model.appearanceRevision++;
  }
}
