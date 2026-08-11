import { MediaApiError, MediaNetworkError, errorFromResponse } from './errors.js';
import type { AuthState } from './auth.js';

export type FetchLike = typeof globalThis.fetch;

export interface FetchClientOptions {
  baseUrl: string;
  auth: AuthState;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export interface GetRequest {
  path: string;
  /** Query params; undefined values are dropped. */
  query?: Record<string, string | number | undefined>;
}

/**
 * Low-level transport. Owns URL construction, auth header injection, timeout,
 * and translating HTTP responses into typed SDK errors. It has no knowledge of
 * specific endpoints or payload shapes.
 */
export class FetchTransport {
  private readonly baseUrl: string;
  private readonly auth: AuthState;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: FetchClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.auth = options.auth;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async get<T>(request: GetRequest): Promise<T> {
    const url = this.buildUrl(request.path, request.query);
    const headers = this.auth.authHeader();

    const response = await this.rawFetch(url, headers);
    if (!response.ok) {
      throw await errorFromResponse(response, `Request failed with status ${response.status}.`);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new MediaApiError({
        message: 'Provider returned an unparseable body.',
        status: response.status,
        code: 'INVALID_RESPONSE',
      });
    }
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    if (query) {
      for (const [name, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(name, String(value));
      }
    }
    return url.toString();
  }

  private async rawFetch(url: string, headers: Record<string, string>): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json', ...headers },
        signal: controller.signal,
      });
    } catch (cause) {
      const aborted = cause instanceof Error && cause.name === 'AbortError';
      throw new MediaNetworkError(
        aborted ? `Request timed out after ${this.timeoutMs}ms.` : 'Network request failed.',
        cause,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
