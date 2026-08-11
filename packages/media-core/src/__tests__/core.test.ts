import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createMediaClient } from '../client.js';
import { createAuth } from '../auth.js';
import { Emitter } from '../emitter.js';
import { InMemoryCache } from '../cache.js';
import {
  MediaApiError,
  MediaAuthError,
  MediaConfigError,
  MediaNetworkError,
} from '../errors.js';
import type { FetchLike } from '../fetch-client.js';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): FetchLike {
  return async (input, init) => handler(String(input), init) as Response;
}

/* ------------------------------------------------------------------------- */

describe('Emitter', () => {
  it('calls listeners and supports unsubscribe', () => {
    const emitter = new Emitter<{ ping: { n: number } }>();
    const seen: number[] = [];
    const off = emitter.on('ping', (p) => seen.push(p.n));
    emitter.emit('ping', { n: 1 });
    off();
    emitter.emit('ping', { n: 2 });
    assert.deepEqual(seen, [1]);
  });

  it('once fires a single time', () => {
    const emitter = new Emitter<{ ping: void }>();
    let count = 0;
    emitter.once('ping', () => count++);
    emitter.emit('ping', undefined);
    emitter.emit('ping', undefined);
    assert.equal(count, 1);
  });

  it('removeAll clears listeners', () => {
    const emitter = new Emitter<{ ping: void }>();
    let count = 0;
    emitter.on('ping', () => count++);
    emitter.removeAll('ping');
    emitter.emit('ping', undefined);
    assert.equal(count, 0);
  });
});

describe('auth', () => {
  it('reports missing key and guards the value', () => {
    const auth = createAuth();
    assert.equal(auth.hasKey(), false);
    assert.throws(() => auth.authHeader(), MediaConfigError);
  });

  it('sets and swaps keys', () => {
    const auth = createAuth('  secret  ');
    assert.equal(auth.hasKey(), true);
    assert.deepEqual(auth.authHeader(), { Authorization: 'secret' });
    auth.setKey('second');
    assert.deepEqual(auth.authHeader(), { Authorization: 'second' });
    auth.clearKey();
    assert.equal(auth.hasKey(), false);
  });
});

describe('InMemoryCache', () => {
  it('expires entries after ttl', async () => {
    const cache = new InMemoryCache({ ttlMs: 20 });
    cache.set('a', 1);
    assert.equal(cache.get('a'), 1);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(cache.get('a'), undefined);
  });

  it('evicts the oldest entry at capacity', () => {
    const cache = new InMemoryCache({ maxEntries: 2, ttlMs: 60_000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), 3);
  });
});

describe('client', () => {
  function makeClient(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
    return createMediaClient({
      apiKey: 'test-key',
      fetchImpl: mockFetch(handler),
      defaultListener: false,
      cache: { ttlMs: 60_000 },
    });
  }

  it('normalizes a photo search response', async () => {
    let requested = '';
    const client = makeClient((url) => {
      requested = url;
      return jsonResponse({
        total_results: 1,
        page: 1,
        per_page: 2,
        photos: [
          {
            id: 123,
            width: 100,
            height: 200,
            url: 'https://pexels.com/photo/123',
            photographer: 'Jane',
            photographer_url: 'https://pexels.com/jane',
            photographer_id: 7,
            avg_color: '#000000',
            alt: 'alt text',
            liked: false,
            src: { original: 'https://img/o', small: 'https://img/s' },
          },
        ],
        next_page: 'https://api.pexels.com/v1/next',
        prev_page: null,
      });
    });

    const result = await client.photos.search({ query: 'dogs', perPage: 2 });
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]!.id, 123);
    assert.equal(result.items[0]!.src.original, 'https://img/o');
    assert.equal(result.items[0]!.src.small, 'https://img/s');
    assert.equal(result.totalResults, 1);
    assert.ok(requested.includes('/search'), `expected /search in ${requested}`);
    assert.ok(!requested.includes('/photos/search'), 'search must not use /photos/search');
    assert.ok(requested.includes('query=dogs'));
  });

  it('maps provider errors to typed SDK errors', async () => {
    const client = makeClient((url) => {
      if (url.includes('unauthorized')) {
        return jsonResponse({ error: 'invalid key' }, 401);
      }
      if (url.includes('rate')) {
        return jsonResponse({ error: 'rate limited' }, 429, { 'retry-after': '5' });
      }
      return jsonResponse({ error: 'nope' }, 404);
    });

    await assert.rejects(
      () => client.photos.search({ query: 'unauthorized' }),
      (err: unknown) => err instanceof MediaAuthError && err.status === 401,
    );

    await assert.rejects(
      () => client.photos.search({ query: 'rate' }),
      (err: unknown) =>
        err instanceof MediaApiError &&
        err.code === 'RATE_LIMITED' &&
        err.retryAfter === 5,
    );

    await assert.rejects(
      () => client.photos.search({ query: 'missing' }),
      (err: unknown) => err instanceof MediaApiError && err.code === 'NOT_FOUND',
    );
  });

  it('wraps network failures as MediaNetworkError', async () => {
    const client = createMediaClient({
      apiKey: 'k',
      defaultListener: false,
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as FetchLike,
    });
    await assert.rejects(
      () => client.photos.curated(),
      (err: unknown) => err instanceof MediaNetworkError,
    );
  });

  it('rejects invalid query / pagination input', async () => {
    const client = makeClient(() => jsonResponse({ photos: [] }));
    await assert.rejects(() => client.photos.search({ query: '   ' }), MediaConfigError);
    await assert.rejects(() => client.photos.search({ query: 'ok', page: 0 }), MediaConfigError);
  });

  it('de-duplicates concurrent identical requests', async () => {
    let calls = 0;
    const client = makeClient(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return jsonResponse({ total_results: 0, page: 1, per_page: 80, photos: [] });
    });

    const [a, b] = await Promise.all([
      client.photos.search({ query: 'same', page: 1 }),
      client.photos.search({ query: 'same', page: 1 }),
    ]);
    assert.equal(a.page, 1);
    assert.equal(b.page, 1);
    assert.equal(calls, 1, 'identical concurrent requests share one promise');
  });

  it('caches single-item lookups and reuses the cache', async () => {
    let calls = 0;
    const client = makeClient(() => {
      calls++;
      return jsonResponse({
        id: 42,
        width: 1,
        height: 1,
        url: 'https://x',
        photographer: 'p',
        photographer_url: 'https://x',
        photographer_id: 1,
        avg_color: null,
        alt: '',
        liked: false,
        src: { original: 'https://o' },
      });
    });

    const first = await client.photos.get(42);
    const second = await client.photos.get(42);
    assert.equal(first.id, 42);
    assert.equal(second.id, 42);
    assert.equal(calls, 1, 'second get() should hit cache');
  });

  it('emits a view event on get() and download on track()', async () => {
    const views: unknown[] = [];
    const downloads: unknown[] = [];
    const client = makeClient(() =>
      jsonResponse({
        id: 9,
        width: 1,
        height: 1,
        url: 'https://x',
        photographer: 'p',
        photographer_url: 'https://x',
        photographer_id: 1,
        avg_color: null,
        alt: '',
        liked: false,
        src: { original: 'https://o' },
      }),
    );

    client.events.on('view', (e) => views.push(e));
    client.events.on('download', (e) => downloads.push(e));

    await client.photos.get(9);
    assert.equal(views.length, 1);
    assert.equal((views[0] as { id: number }).id, 9);

    client.track('download', { kind: 'photo', id: 9, source: 'lightbox' });
    assert.equal(downloads.length, 1);
    assert.equal((downloads[0] as { source: string }).source, 'lightbox');
  });

  it('emits nothing for views on list endpoints', async () => {
    const views: unknown[] = [];
    const client = makeClient(() => jsonResponse({ total_results: 0, page: 1, per_page: 1, photos: [] }));
    client.events.on('view', (e) => views.push(e));
    await client.photos.curated({ perPage: 1 });
    assert.equal(views.length, 0);
  });
});
