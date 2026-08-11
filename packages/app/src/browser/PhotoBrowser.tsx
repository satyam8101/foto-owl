import { useState } from 'react';
import { useMediaClient, useMediaCuratedPhotos, useMediaSearchPhotos } from '@fotoowl/media-react';
import { useMediaGrid } from '@fotoowl/media-ui-react';
import type { MediaPhoto } from '@fotoowl/media-react';
import { PhotoLightbox } from './PhotoLightbox.js';

export function PhotoBrowser({ query }: { query: string }) {
  const client = useMediaClient();
  const searching = query.length > 0;

  const curated = useMediaCuratedPhotos({ enabled: !searching, perPage: 30 });
  const searched = useMediaSearchPhotos(query, { enabled: searching, perPage: 30 });
  const state = searching ? searched : curated;
  const items = state.data ?? [];

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const grid = useMediaGrid({
    items,
    hasMore: state.hasMore,
    isLoading: state.isLoading || state.isLoadingMore,
    onLoadMore: () => state.loadMore(),
  });

  const openAt = (index: number) => {
    const photo = items[index];
    if (photo) {
      client.track('view', { kind: 'photo', id: photo.id, source: 'photo-grid' });
      setLightboxIndex(index);
    }
  };

  return (
    <section className="browser" aria-label={searching ? `Results for "${query}"` : 'Curated photos'}>
      <p className="browser-heading">
        {searching ? (
          <>Results for “{query}”{state.totalResults != null ? ` (${state.totalResults})` : ''}</>
        ) : (
          'Curated photos'
        )}
      </p>

      {state.error ? (
        <p className="error" role="alert">
          {state.error.message}
        </p>
      ) : null}

      {!state.isLoading && !state.isLoadingMore && items.length === 0 && !state.error ? (
        <p className="empty">No photos found.</p>
      ) : null}

      {items.length > 0 ? (
        <div {...grid.containerProps} className="grid">
          {items.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              {...grid.getItemProps(index)}
              className="grid-item"
              onClick={() => openAt(index)}
              aria-label={photo.alt || `Photo by ${photo.photographer}`}
            >
              <img
                src={photo.src.medium}
                alt={photo.alt || ''}
                loading="lazy"
                width={photo.width}
                height={photo.height}
              />
            </button>
          ))}
          <div {...grid.loaderProps} className="grid-loader" aria-hidden={!state.hasMore}>
            {state.isLoadingMore ? 'Loading more…' : ''}
          </div>
        </div>
      ) : null}

      {lightboxIndex != null && items[lightboxIndex] ? (
        <PhotoLightbox
          photos={items}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </section>
  );
}
