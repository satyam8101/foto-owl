import { useState } from 'react';
import { useMediaClient, useMediaPopularVideos, useMediaSearchVideos } from '@fotoowl/media-react';
import { useMediaGrid } from '@fotoowl/media-ui-react';
import type { MediaVideo } from '@fotoowl/media-react';
import { ReelsView } from '../reels/ReelsView.js';
import { formatDuration } from '../lib/video.js';

export function VideoBrowser({ query }: { query: string }) {
  const client = useMediaClient();
  const searching = query.length > 0;

  const popular = useMediaPopularVideos({ enabled: !searching, perPage: 30 });
  const searched = useMediaSearchVideos(query, { enabled: searching, perPage: 30 });
  const state = searching ? searched : popular;
  const items = state.data ?? [];

  const [reelsIndex, setReelsIndex] = useState<number | null>(null);

  const grid = useMediaGrid({
    items,
    hasMore: state.hasMore,
    isLoading: state.isLoading || state.isLoadingMore,
    onLoadMore: () => state.loadMore(),
  });

  const openReels = (index: number) => {
    const video = items[index];
    if (video) {
      client.track('view', { kind: 'video', id: video.id, source: 'video-grid' });
      setReelsIndex(index);
    }
  };

  return (
    <section className="browser" aria-label={searching ? `Results for "${query}"` : 'Popular videos'}>
      <p className="browser-heading">
        {searching ? (
          <>Results for “{query}”{state.totalResults != null ? ` (${state.totalResults})` : ''}</>
        ) : (
          'Popular videos'
        )}
      </p>

      {state.error ? (
        <p className="error" role="alert">
          {state.error.message}
        </p>
      ) : null}

      {!state.isLoading && !state.isLoadingMore && items.length === 0 && !state.error ? (
        <p className="empty">No videos found.</p>
      ) : null}

      {items.length > 0 ? (
        <div {...grid.containerProps} className="grid grid-videos">
          {items.map((video, index) => (
            <button
              key={video.id}
              type="button"
              {...grid.getItemProps(index)}
              className="grid-item grid-item-video"
              onClick={() => openReels(index)}
              aria-label={`Play video by ${video.user.name}`}
            >
              <img src={video.thumbnail} alt="" loading="lazy" />
              <span className="video-duration">{formatDuration(video.duration)}</span>
            </button>
          ))}
          <div {...grid.loaderProps} className="grid-loader" aria-hidden={!state.hasMore}>
            {state.isLoadingMore ? 'Loading more…' : ''}
          </div>
        </div>
      ) : null}

      {reelsIndex != null && items[reelsIndex] ? (
        <ReelsView videos={items} initialIndex={reelsIndex} onClose={() => setReelsIndex(null)} />
      ) : null}
    </section>
  );
}
