/**
 * @fotoowl/media-core
 *
 * Framework-agnostic media SDK core: a typed Pexels client with auth, event
 * emission, caching and request de-dupe. No React, no DOM, no platform APIs.
 *
 * Importable anywhere fetch() exists: Node 18+, browsers, React Native,
 * workers, CLIs.
 */

export {
  createMediaClient,
  type MediaClient,
  type MediaClientConfig,
  type PhotosApi,
  type VideosApi,
} from './client.js';

export {
  Emitter,
  type Listener,
  type Unsubscribe,
} from './emitter.js';

export {
  InMemoryCache,
  type CacheOptions,
} from './cache.js';

export {
  MediaError,
  MediaConfigError,
  MediaAuthError,
  MediaApiError,
  MediaNetworkError,
  type MediaErrorCode,
} from './errors.js';

export type {
  MediaKind,
  MediaPhoto,
  MediaVideo,
  MediaVideoFile,
  MediaVideoPicture,
  MediaItem,
  MediaResult,
  ActivityEvent,
  ViewEvent,
  DownloadEvent,
  MediaEventMap,
  TrackKind,
  TrackInput,
  PagingParams,
  PhotoOrientation,
  PhotoSize,
  VideoOrientation,
  VideoSize,
  SearchPhotosParams,
  SearchVideosParams,
  CuratedPhotosParams,
  PopularVideosParams,
} from './types.js';
