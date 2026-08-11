import { MediaConfigError } from './errors.js';

/**
 * Auth handling.
 *
 * The API key is held per-client instance (never module-global, never
 * serialized into errors or logs). Callers that do not need the key can read
 * only `hasKey()`; the raw key is only reachable through `authHeader()` which
 * is consumed by the transport.
 */

export interface AuthState {
  /** True when a non-empty key is configured. */
  hasKey(): boolean;
  /**
   * The Authorization header for the provider. Throws `MediaConfigError` when
   * no key is configured. The key value is intentionally not exposed any other
   * way on this interface.
   */
  authHeader(): Record<string, string>;
  /** Replace the current key. */
  setKey(key: string): void;
  /** Remove the current key. */
  clearKey(): void;
}

export function createAuth(initialKey?: string): AuthState {
  let key = initialKey?.trim() || '';

  return {
    hasKey(): boolean {
      return key.length > 0;
    },
    authHeader(): Record<string, string> {
      if (!key) {
        throw new MediaConfigError(
          'No Pexels API key configured. Pass { apiKey } to createMediaClient() ' +
            'or call client.configure({ apiKey }).',
        );
      }
      // Pexels accepts the raw key (or "Bearer <key>") as the Authorization value.
      return { Authorization: key };
    },
    setKey(next: string): void {
      key = next.trim();
    },
    clearKey(): void {
      key = '';
    },
  };
}
