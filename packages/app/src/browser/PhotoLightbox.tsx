import { useLightbox } from '@fotoowl/media-ui-react';
import { useMediaClient } from '@fotoowl/media-react';
import type { MediaPhoto } from '@fotoowl/media-react';

export interface PhotoLightboxProps {
  photos: readonly MediaPhoto[];
  initialIndex: number;
  onClose: () => void;
}

export function PhotoLightbox({ photos, initialIndex, onClose }: PhotoLightboxProps) {
  const client = useMediaClient();
  const lightbox = useLightbox<MediaPhoto>({
    open: true,
    onClose,
    items: photos,
    initialIndex,
    loop: true,
    getItemId: (photo) => String(photo.id),
  });

  const photo = lightbox.item;

  return (
    <div {...lightbox.getBackdropProps()} className="lightbox">
      <div {...lightbox.getPanelProps()} className="lightbox-panel">
        <button {...lightbox.getCloseButtonProps()} className="lightbox-close">
          ✕
        </button>

        {photo ? (
          <>
            <figure className="lightbox-media">
              <img
                src={photo.src.large2x || photo.src.large || photo.src.original}
                alt={photo.alt || ''}
              />
              <figcaption>
                Photo by{' '}
                <a href={photo.photographerUrl} target="_blank" rel="noreferrer">
                  {photo.photographer}
                </a>
              </figcaption>
            </figure>
            <div className="lightbox-actions">
              <a className="btn" href={photo.url} target="_blank" rel="noreferrer">
                View on Pexels
              </a>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  client.track('download', { kind: 'photo', id: photo.id, source: 'photo-lightbox' })
                }
              >
                Track download
              </button>
            </div>
          </>
        ) : null}

        <button {...lightbox.getPrevButtonProps()} className="lightbox-nav lightbox-prev">
          ‹
        </button>
        <button {...lightbox.getNextButtonProps()} className="lightbox-nav lightbox-next">
          ›
        </button>

        <p className="lightbox-counter">
          {lightbox.index + 1} / {photos.length}
        </p>
      </div>
    </div>
  );
}
