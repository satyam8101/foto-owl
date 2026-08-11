/**
 * @fotoowl/media-react
 *
 * React adapter around @fotoowl/media-core. Provider + hooks only — every
 * hook here delegates to the core client and holds React state; there is no
 * business logic in this package.
 */

export {
  MediaProvider,
  type MediaProviderProps,
} from './provider.js';

export {
  useMediaClient,
  MediaContext,
  type MediaContextValue,
} from './context.js';

export {
  usePaginatedQuery,
  useMediaSearchPhotos,
  useMediaCuratedPhotos,
  useMediaSearchVideos,
  useMediaPopularVideos,
  useMediaPhoto,
  useMediaVideo,
  useMediaActivity,
  type PaginatedState,
  type PaginatedOptions,
  type UseMediaSearchPhotosOptions,
  type UseMediaCuratedPhotosOptions,
  type UseMediaSearchVideosOptions,
  type UseMediaPopularVideosOptions,
  type SingleItemState,
  type UseMediaItemOptions,
  type UseMediaActivityOptions,
  type MediaActivityState,
} from './hooks.js';

export type {
  MediaClient,
  MediaClientConfig,
  MediaPhoto,
  MediaVideo,
  MediaResult,
  ActivityEvent,
  MediaEventMap,
  MediaError,
  MediaApiError,
  MediaAuthError,
  MediaConfigError,
  MediaNetworkError,
} from '@fotoowl/media-core';
