import { useEffect, useRef, useState } from 'react';
import { useReelSwiper } from '@fotoowl/media-ui-react';
import { useMediaClient } from '@fotoowl/media-react';
import type { MediaVideo } from '@fotoowl/media-react';
import { pickVideoFile, formatDuration } from '../lib/video.js';

/**
 * How many slides around the active one get a real <video> element mounted.
 * Everything else renders a cheap poster <img>. At most 2*REEL_WINDOW+1 video
 * elements/streams exist at once instead of one per slide (30+).
 */
const REEL_WINDOW = 1;

export interface ReelsViewProps {
  videos: readonly MediaVideo[];
  initialIndex: number;
  onClose: () => void;
}

export function ReelsView({ videos, initialIndex, onClose }: ReelsViewProps) {
  const client = useMediaClient();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const videoRefs = useRef(new Map<number, HTMLVideoElement>());

  const reel = useReelSwiper<MediaVideo>({
    items: videos,
    initialIndex,
    getItemId: (video) => String(video.id),
    onActiveIndexChange: (_, video) => {
      client.track('view', { kind: 'video', id: video.id, source: 'reels' });
    },
  });

  // Seed the window from `initialIndex` (the tapped slide) on first render —
  // the hook's activeIndex starts at 0 until the scroll settles, which would
  // otherwise mount/start the first slides instead of the one we opened.
  const [current, setCurrent] = useState(initialIndex);
  useEffect(() => {
    setCurrent(reel.activeIndex);
  }, [reel.activeIndex]);

  // Play only the active slide; pause + rewind its buffered neighbours so the
  // next one restarts cleanly. React removing the `autoPlay` attribute does
  // NOT pause a playing video, so this effect does it explicitly.
  useEffect(() => {
    const active = current;
    for (const [index, el] of videoRefs.current) {
      if (index === active) {
        void el.play().catch(() => {});
      } else {
        el.pause();
        el.currentTime = 0;
      }
    }
  }, [current]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const inWindow = (index: number) => Math.abs(index - current) <= REEL_WINDOW;

  return (
    <div className="reels-overlay">
      <div {...reel.containerProps} className="media-reel">
        {videos.map((video, index) => (
          <section key={video.id} {...reel.getItemProps(index)} className="reel-slide">
            {inWindow(index) ? (
              <video
                className="reel-video"
                src={pickVideoFile(video)}
                poster={video.thumbnail}
                autoPlay={index === current}
                muted
                loop
                playsInline
                controls
                preload="auto"
                ref={(node) => {
                  if (node) videoRefs.current.set(index, node);
                  else videoRefs.current.delete(index);
                }}
              />
            ) : (
              <img className="reel-poster" src={video.thumbnail} alt="" loading="lazy" />
            )}
            <p className="reel-meta">
              @{video.user.name} · {formatDuration(video.duration)}
            </p>
            <button
              type="button"
              className="reel-download"
              onClick={() =>
                client.track('download', { kind: 'video', id: video.id, source: 'reels' })
              }
            >
              Track download
            </button>
          </section>
        ))}
      </div>
      <button type="button" className="reels-close" onClick={onClose} aria-label="Close reels">
        ✕
      </button>
      <p className="reels-hint">Scroll vertically · ↑ ↓ · Esc to close</p>
    </div>
  );
}
