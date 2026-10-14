/**
 * Implements a minimal typed event emitter used across the library. Handlers
 * receive one payload object and may be removed through the returned
 * unsubscribe function or through the emitter API.
 */

export type EventListener<T = unknown> = (payload: T) => void;
export type Unsubscribe = () => void;

export class Emitter {
  private handlers = new Map<string, Array<EventListener<never>>>();

  /** Registers a listener for an event type and returns an unsubscribe handle. */
  on<T>(type: string, listener: EventListener<T>): Unsubscribe {
    const list = this.handlers.get(type);
    if (!list) {
      this.handlers.set(type, [listener as EventListener<never>]);
    } else {
      list.push(listener as EventListener<never>);
    }
    return () => this.off(type, listener);
  }

  /** Registers a listener that fires once and then removes itself. */
  once<T>(type: string, listener: EventListener<T>): Unsubscribe {
    const wrapped: EventListener<T> = payload => {
      unsubscribe();
      listener(payload);
    };
    const unsubscribe = this.on(type, wrapped);
    return unsubscribe;
  }

  /** Removes a specific listener or every listener of a type. */
  off<T>(type: string, listener?: EventListener<T>): this {
    if (!listener) {
      this.handlers.delete(type);
      return this;
    }
    const list = this.handlers.get(type);
    if (list) {
      const index = list.indexOf(listener as EventListener<never>);
      if (index >= 0) {
        list.splice(index, 1);
      }
      if (list.length === 0) {
        this.handlers.delete(type);
      }
    }
    return this;
  }

  /** Invokes every listener registered for the given event type. */
  emit<T>(type: string, payload: T): this {
    const list = this.handlers.get(type);
    if (!list) {
      return this;
    }
    for (let index = 0; index < list.length; index++) {
      (list[index] as EventListener<T>)(payload);
    }
    return this;
  }

  /** Removes all registered listeners and resets the emitter. */
  clear(): void {
    this.handlers.clear();
  }
}
