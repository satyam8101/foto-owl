/**
 * Minimal typed event emitter.
 *
 * Framework-agnostic by design: it only depends on TypeScript. It powers the
 * SDK's activity events (`view`, `download`) and is exported so consumers can
 * build their own typed channels on top of it.
 */

export type Listener<T> = (payload: T) => void;

/** Unsubscribes the listener it was returned from. */
export interface Unsubscribe {
  (): void;
}

type EventMap = object;

export class Emitter<M extends EventMap = Record<string, unknown>> {
  private listeners = new Map<keyof M, Set<Listener<never>>>();

  /** Register a listener. Returns an unsubscribe function. */
  on<K extends keyof M>(event: K, listener: Listener<M[K]>): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => this.off(event, listener);
  }

  /** Register a listener that fires at most once. */
  once<K extends keyof M>(event: K, listener: Listener<M[K]>): Unsubscribe {
    const wrapped: Listener<M[K]> = (payload) => {
      this.off(event, wrapped);
      listener(payload);
    };
    return this.on(event, wrapped);
  }

  off<K extends keyof M>(event: K, listener: Listener<M[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener as Listener<never>);
    if (set.size === 0) this.listeners.delete(event);
  }

  removeAll(event?: keyof M): void {
    if (event === undefined) {
      this.listeners.clear();
      return;
    }
    this.listeners.delete(event);
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        (listener as Listener<M[K]>)(payload);
      } catch (error) {
        // A throwing listener must never break the emitter for other listeners.
        console.error('[media-core] event listener threw:', error);
      }
    }
  }

  listenerCount(event: keyof M): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /** Snapshot of all listeners for a channel (for debugging/tests). */
  has(event: keyof M, listener: Listener<M[keyof M]>): boolean {
    return this.listeners.get(event)?.has(listener as Listener<never>) ?? false;
  }
}
