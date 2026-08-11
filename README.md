# foto·owl — Headless Media SDK + Component Library

A small headless media SDK ecosystem for the Pexels API, built as a take-home
task. It demonstrates clean layer separation:

```
app → media-react / media-native   (data wiring — the ONLY layer that imports media-core)
app → media-ui-react / media-ui-native (pure headless UI — imports NOBODY)
```

```
┌──────────────────────────────────────────────────────────────┐
│  packages/app  (Vite + React demo)                            │
│  imports BOTH media-react (data) and media-ui-react (UI)      │
└───────────┬──────────────────────────┬────────────────────────┘
            │                          │
   ┌────────▼────────┐        ┌────────▼─────────┐
   │ media-react     │        │ media-ui-react   │   headless UI:
   │ media-native    │        │ media-ui-native  │   Grid, Lightbox, Reel
   │ (wrappers)      │        │ (components)     │   prop-getters, no styles
   └────────┬────────┘        └──────────────────┘
            │ imports
   ┌────────▼────────┐
   │ media-core      │   framework-agnostic: client, auth, events,
   │                 │   cache, de-dupe, typed errors. No React/DOM.
   └────────┬────────┘
            │
      Pexels API (HTTP)
```

**Constraint enforcement (the thing being tested):**

- `app → wrappers → core`, and separately `app → components`.
- Wrappers and components **never import each other**.
- Components **never import core**; they take data/callbacks as plain props and
  don't know Pexels exists.
- Core imports **nothing** platform-specific — it runs anywhere `fetch()` does
  (Node 18+, browsers, RN, a CLI). It could power a different UI with zero
  changes.

## Packages

| Package | Layer | What's inside |
|---|---|---|
| `packages/media-core` | SDK core | Typed Pexels client (`search`, `curated`, `popular`, `get`), per-client auth, typed `Emitter` for `view`/`download` events, in-memory cache + in-flight de-dupe, typed error hierarchy |
| `packages/media-react` | Wrapper | `MediaProvider`, `useMediaClient`, paginated hooks, single-item hooks, `useMediaActivity`. State only — no business logic |
| `packages/media-native` | Wrapper | Same hook contract as `media-react`, RN idioms (`getRefreshProps`, `onEndReached`). Independent implementation |
| `packages/media-ui-react` | Headless UI (web) | `useMediaGrid`, `useLightbox`, `useReelSwiper` — prop-getters, zero styles, keyboard/focus/scroll behavior |
| `packages/media-ui-native` | Headless UI (RN) | Same three primitives against `FlatList`/`Modal` |
| `packages/app` | Demo (web) | Search → Grid → Lightbox → Reels, plus an activity feed that subscribes to SDK events |

## Quick start

```bash
npm install
# create packages/app/.env from packages/app/.env.example with a free Pexels key
cp packages/app/.env.example packages/app/.env
npm run dev          # Vite dev server -> http://localhost:5173
```

Other scripts:

```bash
npm run build        # compiles media-core, media-react, media-ui-react -> dist
npm run build:app    # production bundle of the web app
npm run typecheck    # tsc --noEmit across all packages
npm test             # media-core unit tests (node:test + mocked fetch)
```

## media-core — design notes

- **Auth:** the key is held per-client instance and only readable through
  `authHeader()` (used by the transport). It is never included in error
  messages or logs, and it's swappable at runtime via `client.configure()`.
- **Events:** `client.events` is a typed `Emitter`. `view` fires automatically
  on `get(id)`; the app calls `client.track('view' | 'download', {...})` for UI
  actions. A default listener logs every event to the console; consumers can
  subscribe independently (see `useMediaActivity`).
- **Cache + de-dupe:** identical in-flight requests share one promise; single
  item `get` results are cached with a TTL. List pages are only de-duplicated
  (never stale-cached).
- **Errors:** `MediaConfigError`, `MediaAuthError`, `MediaApiError` (with
  `code`, `retryAfter` from `Retry-After`), `MediaNetworkError`. Every network
  failure surfaces as one of these, never a bare `Error`.
- **Portability:** pure TS, `import type` everywhere, no DOM lib needed (it
  builds with `lib: ES2022` only; `@types/node` is dev-only). The included
  tests mock `fetch` and run under `node:test`.

## Skills for AI coding tools

Two agent skills ship in `.opencode/skills/` (opencode-compatible `SKILL.md`
format; portable to Claude Code by copying into `~/.claude/skills/`, or Cursor
via `.cursor/skills/`):

1. **`media-data-wiring`** — how to set up `MediaProvider`, auth via `apiKey`,
   which hook to use, the exact `PaginatedState` shape, the `enabled`-flag
   pattern for switching search ↔ curated/popular, debouncing in the app layer,
   and tracking `view`/`download` activity.
2. **`media-components`** — the headless contract: prop-getters to spread, the
   **required consumer CSS** for grid/reel snapping, the a11y/keyboard contract
   (Escape/arrows, focus trap, scroll lock), and composition rules.

**How they were used/tested:** both skills were written from the actual package
APIs, then used as the spec to steer the app implementation (deliverable #4).
Concretely, the skills drove: the `enabled`-flag search/curated switch, the
`data ?? []` + `!isLoading` empty-state and `role="alert"` error-state contract,
grid cells as `<button>`s with `aria-label`s, the reels `scroll-snap` CSS
contract, `view`/`download` tracking fired from page components (not inside UI
components), Escape-to-close and body-scroll-lock behavior in the lightbox and
reels, and `pickVideoFile`/muted-autoplay handling for videos. The
`media-components` skill even caught that `VideoBrowser` was missing the empty
state before shipping.

## What was AI-assisted vs hand-written

- **Hand-written (design decisions):** dependency boundary design, the
  `Emitter`/auth/cache/error contracts, the hook return shapes, the
  prop-getter APIs, and the demo app's UX flow. These follow the task's
  evaluation criteria directly.
- **AI-assisted (implementation):** the bulk of the TypeScript scaffolding,
  normalization layers, tsconfig/workspace wiring, and the demo CSS were
  written with an AI coding tool. The two `SKILL.md` docs above were authored
  to steer AI output during the app build, and then used as a review checklist.
- **AI-assisted + verified:** media-core unit tests were AI-drafted, then run
  under `node:test` (15/15 passing).

## Scoping decisions (time pressure)

- **Web app is the runnable deliverable**; the RN packages (`media-native`,
  `media-ui-native`) are fully typed and compile, but were **not** run on a
  device/simulator (no RN toolchain in this environment). They typecheck
  against real `react-native` types.
- **No real API key committed.** The app reads `VITE_PEXELS_API_KEY` and shows
  a helpful banner when missing; core behavior is covered by mocked-fetch unit
  tests.
- **Infinite scroll on the web** uses an `IntersectionObserver` sentinel rather
  than window-scroll math — simpler and container-agnostic.
- **Video player** is the browser `<video>` element with `muted` autoplay +
  `controls` (no player library — out of scope, visual polish isn't scored).
- **No bundling for RN** (Metro config, `.xcodeproj` etc.) — out of scope.
- **Search debounce lives in the app**, not the SDK, to keep core
  framework-agnostic.

## Submission / deployment

The repo ships a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`)
that builds the app **and** the two TypeDoc sites, then serves all three from a
single GitHub Pages site:

| What | URL |
|---|---|
| GitHub repo | `https://github.com/<user>/<repo>` |
| Live app | `https://<user>.github.io/<repo>/` |
| SDK docs (`media-core`) | `https://<user>.github.io/<repo>/docs/sdk/` |
| Components docs (`media-ui-react`) | `https://<user>.github.io/<repo>/docs/components/` |

The production build uses a **relative Vite base**, so it works under any
Pages subpath regardless of repo name. Docs are generated with TypeDoc
(`npm run docs:site`), and the app needs a Pexels key injected at build time.

**To deploy (from this machine, run these four):**

```bash
gh auth login                              # 1. authenticate once
gh repo create foto-owl --public --source=. --remote=origin --push
gh secret set PEXELS_API_KEY               # 2. free key from https://www.pexels.com/api/
git push -u origin main                    # 3. push triggers the Pages workflow
```

Then on GitHub: **Settings → Pages → Source → "GitHub Actions"** (do this once;
the workflow handles the rest). The first run takes a few minutes — the
**Environment** tab (`github-pages`) shows the live URL when it finishes.

> The build works without the secret (the app shows a "no key" banner), but
> media won't load until `PEXELS_API_KEY` is set in **Settings → Secrets →
> Actions**. No key is ever committed — `.env` is gitignored and the workflow
> injects it only at build time.

**Local docs preview:** `npm run build:app && npm run docs:site`, then
`npm run preview --workspace @fotoowl/app` (serves `/docs/sdk/` and
`/docs/components/` too).

## Testing

```bash
npm test   # media-core: emitter, auth, cache, error mapping, de-dupe, cache reuse, events
```

Coverage highlights: concurrent identical requests share one fetch call;
`get(id)` hits cache on the second call; 401 → `MediaAuthError`, 429 →
`MediaApiError` with `retryAfter`; empty/invalid query → `MediaConfigError`;
`view` is emitted only for single-item `get`, never list endpoints.
