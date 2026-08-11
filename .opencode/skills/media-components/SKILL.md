---
name: media-components
description: Use ONLY when building UI to render media (photo/video grids, lightboxes, vertical reels) from this repo. Teaches the headless contract of @fotoowl/media-ui-react — useMediaGrid, useLightbox, useReelSwiper — prop-getters to spread, the no-styles styling contract (required CSS), and the a11y/keyboard contract. Triggers on words like "grid", "infinite scroll", "lightbox", "modal", "reel", "swiper", "thumbnail", "render media".
---

# Using @fotoowl/media-ui-react (headless components)

`@fotoowl/media-ui-react` is a **pure UI layer**: no data fetching, no styles,
no knowledge of Pexels or the SDK. Components take `items` and callbacks as
plain props and hand back **prop-getters** — functions/objects you spread onto
your own elements.

**Important:** the component package must never import `@fotoowl/media-react`
or `@fotoowl/media-core`. In app code, do not put data-hook calls inside these
components; fetch in a page/browser component and pass data down as props.

## Styling contract (no styles shipped)

The hooks return only behavior + attributes. Layout and appearance are 100% the
consumer's CSS. The required CSS for each primitive is listed below — if you
omit it the feature silently degrades (no snap, no scroll lock), so add it.

## 1. Grid — `useMediaGrid`

```tsx
import { useMediaGrid } from '@fotoowl/media-ui-react';
import { useMediaSearchPhotos } from '@fotoowl/media-react'; // data lives here, not in the grid

const { data } = useMediaSearchPhotos(query, { perPage: 30 });
const items = data ?? [];

const grid = useMediaGrid({
  items,
  hasMore: state.hasMore,
  isLoading: state.isLoading || state.isLoadingMore,
  onLoadMore: state.loadMore,
});

return (
  <div {...grid.containerProps} className="grid">
    {items.map((item, i) => (
      <button key={item.id} type="button" {...grid.getItemProps(i)} onClick={() => open(i)}>
        <img src={item.src.medium} alt={item.alt || ''} loading="lazy" />
      </button>
    ))}
    <div {...grid.loaderProps} className="grid-loader">
      {grid.isLoadingMore ? 'Loading more…' : ''}
    </div>
  </div>
);
```

Required CSS (consumer-supplied):

```css
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
```

- `loaderProps` carries an IntersectionObserver sentinel: render it as the
  last grid child. `onLoadMore` fires when it enters the viewport.
- `getItemProps(i)` returns `{ id, ref, 'data-index', 'data-media-grid-item' }`.
  Spread them **before** your own props (yours win).
- For images use `loading="lazy"` and keep `aspect-ratio` on the cell to avoid
  layout shift.

## 2. Lightbox — `useLightbox`

```tsx
const lightbox = useLightbox<MediaPhoto>({
  open: !!index,            // control it yourself
  onClose: () => setIndex(null),
  items: photos,
  initialIndex: index ?? 0,
  loop: true,
  getItemId: (p) => String(p.id),
});

return (
  <div {...lightbox.getBackdropProps()} className="lightbox">
    <div {...lightbox.getPanelProps()} className="lightbox-panel">
      <button {...lightbox.getCloseButtonProps()}>✕</button>
      {lightbox.item && (
        <img src={lightbox.item.src.large2x} alt={lightbox.item.alt} />
      )}
      <button {...lightbox.getPrevButtonProps()}>‹</button>
      <button {...lightbox.getNextButtonProps()}>›</button>
    </div>
  </div>
);
```

Behavior the hook already provides:
- **Keyboard:** `Escape` closes, `ArrowLeft`/`ArrowRight` navigate (on the
  focused panel), `Tab` is trapped inside the panel when `focusTrap` (default
  true).
- **Focus:** panel is focused on open, focus is restored to the trigger on
  close.
- **Scroll lock:** `document.body` scroll is locked while open (`lockScroll`,
  default true).

Required CSS (consumer-supplied) — at minimum:

```css
.lightbox { position: fixed; inset: 0; background: rgba(0,0,0,.85); display: flex; align-items: center; justify-content: center; z-index: 50; }
.lightbox-panel { position: relative; outline: none; }
```

- The backdrop closes on click via `closeOnBackdrop` (default true) — the hook
  checks `event.target === event.currentTarget`, so clicks inside the panel
  won't close it.
- The panel must have `outline: none` for the focus ring; add your own
  `:focus-visible` style.
- Render it with `open` computed from your own state so the lightbox unmounts
  when closed.

## 3. Reel Swiper — `useReelSwiper` (vertical snap paging)

```tsx
const reel = useReelSwiper<MediaVideo>({
  items: videos,
  initialIndex,
  getItemId: (v) => String(v.id),
  onActiveIndexChange: (i, video) => trackView(video),
});

return (
  <div {...reel.containerProps} className="media-reel">
    {videos.map((video, i) => (
      <section key={video.id} {...reel.getItemProps(i)} className="reel-slide">
        <video
          src={pick(video)}
          poster={video.thumbnail}
          autoPlay={i === reel.activeIndex}
          muted
          loop
          playsInline
          controls
          preload="metadata"
        />
      </section>
    ))}
  </div>
);
```

**Required CSS for snapping** (this is the headless contract — without it there
is no snap):

```css
.media-reel { overflow-y: auto; scroll-snap-type: y mandatory; overscroll-behavior: contain; height: 100%; }
.media-reel > * { scroll-snap-align: start; scroll-snap-stop: always; }
```

- `activeIndex` + `onActiveIndexChange` are driven by an IntersectionObserver
  with `threshold` (default 0.6).
- **Virtualize the slides — never mount a `<video>` per slide.** Render a real
  `<video>` only for the active index ± 1 window; every other slide renders a
  cheap poster `<img loading="lazy">`. The slide sections themselves always
  exist (they give the scroll container its full height so snapping works);
  only the `<video>` elements are windowed. At most 3 streams/`<video>` nodes
  exist at once instead of 30+.
- **Play only the active slide, never `autoPlay` on every slide.** Give each
  mounted `<video>` `autoPlay={i === activeIndex}`, `muted loop playsInline
  controls`, and `preload="auto"` (only ~3 are mounted, so that's fine). In the
  consumer, keep a `Map<index, HTMLVideoElement>` of refs and pause + rewind
  every non-active video whenever `activeIndex` changes — React removing the
  `autoPlay` attribute does NOT pause a playing video, so the effect must do it
  explicitly. Unmuted autoplay is blocked by the browser; keep `muted` and let
  users unmute via `controls`.
- Keyboard on the focused container: `↑/↓`, `PageUp/PageDown`, `Home`, `End`.
- `scrollToIndex(i, { behavior: 'auto' })` is exposed; open a reel deep in a
  long list with an instant jump (`behavior: 'auto'`) rather than animating
  through every slide — that avoids churning video mounts.

## Accessibility checklist

- Grid cells: `<button>` (keyboard + focus), `aria-label` from `alt`/photographer.
- Loader: `aria-live="polite"` is already in `loaderProps`.
- Lightbox: `role="dialog"`, `aria-modal` come from `getPanelProps`; keep a
  `type="button"` on nav/close buttons.
- Reel: container has `tabIndex={0}` + `aria-label` from `containerProps`.

## Composition rules (enforced by the architecture)

- `@fotoowl/media-ui-react` components never call data hooks. Receive data as
  props.
- Pass `onLoadMore` from the data hook straight to `useMediaGrid`; the grid
  dedupes via `isLoading`.
- Track `view`/`download` events in the page component (see the
  `media-data-wiring` skill), not inside UI components.
