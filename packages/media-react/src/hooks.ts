import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type {
  ActivityEvent,
  CuratedPhotosParams,
  MediaPhoto,
  MediaResult,
  MediaVideo,
  PopularVideosParams,
  SearchPhotosParams,
  SearchVideosParams,
  TrackKind,
} from '@fotoowl/media-core';
import { MediaConfigError, MediaError } from '@fotoowl/media-core';
import { useMediaClient } from './context.js';

/**
 * Shared paginated state returned by every list hook.
 * `isLoading` is the first-page load; `isLoadingMore` is an appended page.
 */
export interface PaginatedState<T> {
  data: T[] | null;
  page: number;
  perPage: number;
  totalResults: number | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: MediaError | null;
  loadMore: () => void;
  refetch: () => void;
  reset: () => void;
}

interface PaginatedAction<T> {
  type: 'start' | 'success' | 'error' | 'reset';
  more?: boolean;
  page?: number;
  result?: MediaResult<T>;
  error?: MediaError;
}

function initialState<T>(page = 1, perPage = 15): PaginatedState<T> {
  return {
    data: null,
    page,
    perPage,
    totalResults: null,
    hasMore: true,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    loadMore: () => {},
    refetch: () => {},
    reset: () => {},
  };
}

function paginatedReducer<T>(state: PaginatedState<T>, action: PaginatedAction<T>): PaginatedState<T> {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        isLoading: !action.more,
        isLoadingMore: action.more === true,
        error: null,
      };
    case 'success': {
      const result = action.result!;
      const data = action.more ? [...(state.data ?? []), ...result.items] : result.items;
      return {
        ...state,
        data,
        page: action.page ?? result.page,
        perPage: result.perPage,
        totalResults: result.totalResults,
        hasMore: result.nextPage != null,
        isLoading: false,
        isLoadingMore: false,
        error: null,
      };
    }
    case 'error':
      return { ...state, isLoading: false, isLoadingMore: false, error: action.error ?? null };
    case 'reset':
      return { ...initialState<T>(state.page, state.perPage) };
    default:
      return state;
  }
}

export interface PaginatedOptions {
  /** Initial page to request. Default 1. */
  page?: number;
  /** Items per page. Default 15 (clamped to 1..80 by the core). */
  perPage?: number;
  /** Set false to keep the query dormant (no request until enabled). */
  enabled?: boolean;
}

/**
 * Low-level pagination orchestrator shared by the public hooks.
 *
 * Only adapts core results into React state: latest-request-wins, dedupe of
 * loadMore while a load is in flight, and reset when `run` changes identity.
 */
export function usePaginatedQuery<T>(
  run: (page: number) => Promise<MediaResult<T>>,
  options: PaginatedOptions = {},
): PaginatedState<T> {
  const { page: initialPage = 1, perPage = 15, enabled = true } = options;
  const [state, dispatch] = useReducer(paginatedReducer<T>, initialPage, () =>
    initialState<T>(initialPage, perPage),
  );

  const runRef = useRef(run);
  runRef.current = run;
  const versionRef = useRef(0);
  const loadingRef = useRef(false);

  const execute = useCallback(async (targetPage: number, append: boolean) => {
    const version = ++versionRef.current;
    loadingRef.current = true;
    dispatch({ type: 'start', more: append });
    try {
      const result = await runRef.current(targetPage);
      if (version !== versionRef.current) return;
      dispatch({ type: 'success', page: targetPage, result, more: append });
    } catch (error) {
      if (version !== versionRef.current) return;
      dispatch({
        type: 'error',
        error: error instanceof MediaError ? error : new MediaConfigError('Unknown error.'),
        more: append,
      });
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !state.hasMore || state.isLoading || state.isLoadingMore) return;
    void execute(state.page + 1, true);
  }, [execute, state]);

  const refetch = useCallback(() => {
    void execute(initialPage, false);
  }, [execute, initialPage]);

  const reset = useCallback(() => {
    versionRef.current++;
    loadingRef.current = false;
    dispatch({ type: 'reset' });
  }, []);

  useEffect(() => {
    if (!enabled) {
      reset();
      return;
    }
    reset();
    void execute(initialPage, false);
    return () => {
      versionRef.current++;
    };
  }, [enabled, execute, initialPage, reset, run]);

  const api = useMemo<PaginatedState<T>>(
    () => ({ ...state, loadMore, refetch, reset }),
    [state, loadMore, refetch, reset],
  );

  return api;
}

/* ---------------------------------------------------------------------------
 * Photo hooks
 * ------------------------------------------------------------------------- */

export interface UseMediaSearchPhotosOptions extends PaginatedOptions {
  orientation?: SearchPhotosParams['orientation'];
  size?: SearchPhotosParams['size'];
  color?: SearchPhotosParams['color'];
  locale?: SearchPhotosParams['locale'];
}

/** Search Pexels photos. Pass a query to search; the hook resets on query change. */
export function useMediaSearchPhotos(
  query: string,
  options: UseMediaSearchPhotosOptions = {},
): PaginatedState<MediaPhoto> {
  const client = useMediaClient();
  const { page, perPage, enabled, orientation, size, color, locale } = options;

  const run = useCallback(
    (p: number) =>
      client.photos.search({
        query,
        page: p,
        perPage,
        orientation,
        size,
        color,
        locale,
      }),
    [client, query, perPage, orientation, size, color, locale],
  );

  return usePaginatedQuery(run, { page, perPage, enabled });
}

export type UseMediaCuratedPhotosOptions = PaginatedOptions &
  Pick<CuratedPhotosParams, 'orientation' | 'size'>;

/** Curated/trending photos feed. */
export function useMediaCuratedPhotos(
  options: UseMediaCuratedPhotosOptions = {},
): PaginatedState<MediaPhoto> {
  const client = useMediaClient();
  const { page, perPage, enabled, orientation, size } = options;

  const run = useCallback(
    (p: number) => client.photos.curated({ page: p, perPage, orientation, size }),
    [client, perPage, orientation, size],
  );

  return usePaginatedQuery(run, { page, perPage, enabled });
}

/* ---------------------------------------------------------------------------
 * Video hooks
 * ------------------------------------------------------------------------- */

export type UseMediaSearchVideosOptions = PaginatedOptions &
  Pick<SearchVideosParams, 'orientation' | 'size' | 'locale'>;

export function useMediaSearchVideos(
  query: string,
  options: UseMediaSearchVideosOptions = {},
): PaginatedState<MediaVideo> {
  const client = useMediaClient();
  const { page, perPage, enabled, orientation, size, locale } = options;

  const run = useCallback(
    (p: number) =>
      client.videos.search({ query, page: p, perPage, orientation, size, locale }),
    [client, query, perPage, orientation, size, locale],
  );

  return usePaginatedQuery(run, { page, perPage, enabled });
}

export type UseMediaPopularVideosOptions = PaginatedOptions &
  Pick<PopularVideosParams, 'minWidth' | 'minHeight' | 'minDuration' | 'maxDuration'>;

export function useMediaPopularVideos(
  options: UseMediaPopularVideosOptions = {},
): PaginatedState<MediaVideo> {
  const client = useMediaClient();
  const { page, perPage, enabled, minWidth, minHeight, minDuration, maxDuration } = options;

  const run = useCallback(
    (p: number) =>
      client.videos.popular({
        page: p,
        perPage,
        minWidth,
        minHeight,
        minDuration,
        maxDuration,
      }),
    [client, perPage, minWidth, minHeight, minDuration, maxDuration],
  );

  return usePaginatedQuery(run, { page, perPage, enabled });
}

/* ---------------------------------------------------------------------------
 * Single-item hooks
 * ------------------------------------------------------------------------- */

export interface SingleItemState<T> {
  data: T | null;
  isLoading: boolean;
  error: MediaError | null;
  refetch: () => void;
}

export interface UseMediaItemOptions {
  /** Set false to keep the lookup dormant. */
  enabled?: boolean;
}

function useSingleItem<T>(
  fetcher: () => Promise<T>,
  options: UseMediaItemOptions,
  deps: unknown[],
): SingleItemState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<MediaError | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const enabled = options.enabled ?? true;
  const versionRef = useRef(0);

  const run = useCallback(async () => {
    if (!enabled) return;
    const version = ++versionRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (version !== versionRef.current) return;
      setData(result);
    } catch (cause) {
      if (version !== versionRef.current) return;
      setError(cause instanceof MediaError ? cause : new MediaConfigError('Unknown error.'));
    } finally {
      if (version === versionRef.current) setIsLoading(false);
    }
  }, [enabled]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void run();
    return () => {
      versionRef.current++;
    };
  }, deps);

  const refetch = useCallback(() => {
    void run();
  }, [run]);

  return { data, isLoading, error, refetch };
}

export function useMediaPhoto(
  id: number | null,
  options: UseMediaItemOptions = {},
): SingleItemState<MediaPhoto> {
  const client = useMediaClient();
  const enabled = options.enabled !== false && id != null;
  return useSingleItem(() => client.photos.get(id!), { ...options, enabled }, [client, id]);
}

export function useMediaVideo(
  id: number | null,
  options: UseMediaItemOptions = {},
): SingleItemState<MediaVideo> {
  const client = useMediaClient();
  const enabled = options.enabled !== false && id != null;
  return useSingleItem(() => client.videos.get(id!), { ...options, enabled }, [client, id]);
}

/* ---------------------------------------------------------------------------
 * Activity hook
 * ------------------------------------------------------------------------- */

export interface UseMediaActivityOptions {
  /** Keep at most this many events. Default 50. */
  limit?: number;
  /** Restrict to specific event types. Default: both. */
  types?: TrackKind[];
  /** Set false to stop recording (the default console logger keeps working). */
  enabled?: boolean;
}

export interface MediaActivityState {
  activity: ActivityEvent[];
  clear: () => void;
}

/**
 * Subscribe to the SDK's activity events (`view`, `download`) and keep a
 * recent list. The core's default console logger is unaffected — the wrapper
 * only adds an independent subscriber.
 */
export function useMediaActivity(options: UseMediaActivityOptions = {}): MediaActivityState {
  const client = useMediaClient();
  const { limit = 50, types = ['view', 'download'], enabled = true } = options;

  const [activity, setActivity] = useReducer(
    (prev: ActivityEvent[], action: ActivityEvent | 'clear') =>
      action === 'clear' ? [] : [action, ...prev].slice(0, limit),
    [] as ActivityEvent[],
  );
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;
    const offs = types.map((type) =>
      client.events.on(type, (payload) => {
        if (enabledRef.current) setActivity(payload as ActivityEvent);
      }),
    );
    return () => {
      offs.forEach((off) => off());
    };
  }, [client, types, limit, enabled]);

  const clear = useCallback(() => {
    setActivity('clear');
  }, []);

  return { activity, clear };
}
