/**
 * @fotoowl/media-native
 *
 * React Native adapter around @fotoowl/media-core. Mirrors the @fotoowl/media-react
 * hook contract, adapted to RN idioms (pull-to-refresh, onEndReached). Hooks
 * hold state only; all logic lives in media-core.
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
