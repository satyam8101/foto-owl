---
name: media-data-wiring
description: Use ONLY when building UI that must fetch media (photos/videos) from Pexels via this repo's SDK. Teaches how to wire @fotoowl/media-react — MediaProvider setup, auth via apiKey, the paginated hooks (useMediaSearchPhotos, useMediaCuratedPhotos, useMediaSearchVideos, useMediaPopularVideos, useMediaPhoto, useMediaVideo), debouncing search, and tracking view/download activity events. Triggers on words like "fetch", "search", "curated", "Pexels", "grid data", "load more", "infinite scroll data", "activity", "track".
---

# Wiring media data with @fotoowl/media-react

This repo is a headless media SDK. `@fotoowl/media-react` is a thin React
adapter around `@fotoowl/media-core`. Hooks hold React state and call the core
client — they contain **no business logic** and **no UI**. Use them to get data;
use `@fotoowl/media-ui-react` (see the `media-components` skill) to render it.

## Rules that matter

- Import data hooks ONLY from `@fotoowl/media-react`.
- Never call `@fotoowl/media-core` directly from app code. The wrappers are the
  only layer allowed to touch core. `useMediaClient()` is the single escape
  hatch you may use — and only to call `client.track(...)`.
- Never import `@fotoowl/media-ui-react` and `@fotoowl/media-react` from each
  other's files; the app wires them together.
- Debounce the search input in the app layer (see below). The hooks reset and
  refetch when the query string they receive changes.

## 1. Provide the client (one place, top of app)

```tsx
// App.tsx — import from '@fotoowl/media-react' (NOT from media-core)
import { MediaProvider } from '@fotoowl/media-react';
import { PEXELS_API_KEY } from './config';

export function App() {
  return (
    <MediaProvider apiKey={PEXELS_API_KEY || undefined}>
      <Shell />
    </MediaProvider>
  );
}
```

- `apiKey` is the Pexels key. Runtime key changes are applied via
  `client.configure({ apiKey })` — the provider handles that; don't recreate
  the provider.
- A missing key produces a `MediaConfigError` on the hook's `error` field.
  Render a helpful banner instead of crashing.
- Read the key from `import.meta.env.VITE_PEXELS_API_KEY` via a small
  `config.ts`; never hard-code it, never log it.

## 2. Pick the right hook

| Need | Hook |
|---|---|
| Search photos | `useMediaSearchPhotos(query, options)` |
| Trending/curated photos | `useMediaCuratedPhotos(options)` |
| Search videos | `useMediaSearchVideos(query, options)` |
| Popular videos | `useMediaPopularVideos(options)` |
| One photo by id | `useMediaPhoto(id, options)` |
| One video by id | `useMediaVideo(id, options)` |
| Client / events | `useMediaClient()` / `useMediaActivity(options)` |

### Paginated hooks return exactly this shape

```ts
{
  data: T[] | null;          // null before the first page resolves
  page: number;
  perPage: number;
  totalResults: number | null;
  hasMore: boolean;          // whether another page exists (nextPage != null)
  isLoading: boolean;        // first-page load
  isLoadingMore: boolean;    // an appended page load
  error: MediaError | null;  // typed: MediaApiError | MediaAuthError | MediaConfigError | MediaNetworkError
  loadMore(): void;          // call from infinite scroll; no-ops while loading
  refetch(): void;           // re-run page 1
  reset(): void;
}
```

- `data` may be `null` — gate rendering on `data ?? []`, and keep an "empty"
  state that only shows once `!isLoading && !isLoadingMore && data?.length === 0`.
- `loadMore` is idempotent: the hook ignores it while a load is in flight.
  Just hand it to the grid's `onLoadMore`.
- Show `error.message` in an alert region; do not clear the old list on error.

### Switch search ↔ curated with `enabled`, never conditionally

Hooks must be called unconditionally. Use the `enabled` flag:

```tsx
const searching = query.trim().length > 0;
const curated = useMediaCuratedPhotos({ enabled: !searching, perPage: 30 });
const searched = useMediaSearchPhotos(query, { enabled: searching, perPage: 30 });
const state = searching ? searched : curated;
```

### Single-item hooks

```ts
{ data: T | null; isLoading: boolean; error: MediaError | null; refetch(): void }
```
Pass `id={null}` to keep them dormant (they won't fire).

## 3. Debounce search in the app

```tsx
const [query, setQuery] = useState('');
const [debounced, setDebounced] = useState('');
useEffect(() => {
  const t = setTimeout(() => setDebounced(query.trim()), 350);
  return () => clearTimeout(t);
}, [query]);
// pass `debounced` to the hooks. Optionally key your browser by `debounced`
// so internal state (lightbox/reels) resets on a new search.
```

Do NOT debounce inside the hook or the SDK — the SDK is framework-agnostic and
hooks are state adapters.

## 4. Track activity (view / download)

The SDK emits `view` and `download` events. The default console logger is
attached by core. To add an independent subscriber that shows activity in UI:

```tsx
const { activity, clear } = useMediaActivity({ limit: 25 });
// activity: ActivityEvent[]  (newest first) — { type, kind, id, source, at }
```

To record a manual event (e.g. user opened the lightbox or pressed download):

```tsx
const client = useMediaClient();
client.track('view', { kind: 'photo', id: photo.id, source: 'photo-grid' });
client.track('download', { kind: 'photo', id: photo.id, source: 'photo-lightbox' });
```

`source` is a free-form caller label — use it to describe where the event
happened. Do not fabricate events on every render; fire them in event handlers
or in `useEffect` keyed on the thing being tracked.

## 5. What NOT to do

- Do not import `@fotoowl/media-core` in app components for data.
- Do not build your own pagination/fetch logic — the hooks exist for that.
- Do not pass inline non-`useCallback` fetchers; the hooks depend on `run`
  identity to know when the query changed. The public hooks handle this
  internally — just pass primitive params.
- Do not call `loadMore` from a `useEffect` keyed on `data` (infinite loops).
  Wire it to the grid's load-more trigger instead.
