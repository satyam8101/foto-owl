/**
 * Public type contracts for @fotoowl/media-core.
 *
 * Deliberately independent of the Pexels wire shape: endpoint methods
 * normalize raw responses into these types, so consumers never reach into
 * the API's JSON structure.
 */

export type MediaKind = 'photo' | 'video';

export interface MediaPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographerUrl: string;
  photographerId: number;
  avgColor: string | null;
  alt: string;
  liked: boolean;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
}

export interface MediaVideoFile {
  id: number;
  quality: 'hd' | 'sd' | 'hls';
  fileType: string;
  width: number | null;
  height: number | null;
  link: string;
  fps: number | null;
}

export interface MediaVideoPicture {
  id: number;
  picture: string;
  nr: number;
}

export interface MediaVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  thumbnail: string;
  duration: number;
  user: { id: number; name: string; url: string };
  videoFiles: MediaVideoFile[];
  videoPictures: MediaVideoPicture[];
}

export type MediaItem = MediaPhoto | MediaVideo;

/** Normalized, paginated response shape used by every listing endpoint. */
export interface MediaResult<T> {
  items: T[];
  page: number;
  perPage: number;
  totalResults: number;
  nextPage: string | null;
  prevPage: string | null;
}

/** Activity payloads the SDK emits. `source` is a free-form caller label. */
export interface ActivityEventBase {
  kind: MediaKind;
  id: number;
  source: string;
  at: number;
}

export interface ViewEvent extends ActivityEventBase {
  type: 'view';
}

export interface DownloadEvent extends ActivityEventBase {
  type: 'download';
}

export type ActivityEvent = ViewEvent | DownloadEvent;

/** Map of event name -> payload, used to type the emitter. */
export interface MediaEventMap {
  view: ViewEvent;
  download: DownloadEvent;
}

export type TrackKind = 'view' | 'download';

export interface TrackInput {
  kind: MediaKind;
  id: number;
  source?: string;
}

/** Common search options accepted by every listing endpoint. */
export interface PagingParams {
  page?: number;
  perPage?: number;
}

export type PhotoOrientation = 'landscape' | 'portrait' | 'square';
export type PhotoSize = 'large' | 'medium' | 'small';
export type VideoOrientation = 'landscape' | 'portrait';
export type VideoSize = 'large' | 'medium' | 'small';

export interface SearchPhotosParams extends PagingParams {
  query: string;
  orientation?: PhotoOrientation;
  size?: PhotoSize;
  color?: string;
  locale?: string;
}

export interface SearchVideosParams extends PagingParams {
  query: string;
  orientation?: VideoOrientation;
  size?: VideoSize;
  locale?: string;
}

export interface CuratedPhotosParams extends PagingParams {
  orientation?: PhotoOrientation;
  size?: PhotoSize;
}

export interface PopularVideosParams extends PagingParams {
  minWidth?: number;
  minHeight?: number;
  minDuration?: number;
  maxDuration?: number;
}
