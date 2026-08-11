import { Emitter } from './emitter.js';
import { InMemoryCache, type CacheOptions } from './cache.js';
import { createAuth, type AuthState } from './auth.js';
import { FetchTransport, type FetchLike } from './fetch-client.js';
import { MediaConfigError } from './errors.js';
import type {
  CuratedPhotosParams,
  MediaKind,
  MediaPhoto,
  MediaResult,
  MediaVideo,
  MediaEventMap,
  PagingParams,
  PopularVideosParams,
  SearchPhotosParams,
  SearchVideosParams,
  TrackInput,
  TrackKind,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.pexels.com/v1';

export interface MediaClientConfig {
  /** Pexels API key. Can be omitted here and set later via `configure()`. */
  apiKey?: string;
  /** API base URL. Defaults to Pexels v1. */
  baseUrl?: string;
  /** Injectable fetch for tests/SSR. Falls back to the global fetch. */
  fetchImpl?: FetchLike;
  /** Abort requests after this many ms. Default 10s. */
  timeoutMs?: number;
  cache?: CacheOptions;
  /** Attach the default console logger for activity events. Default true. */
  defaultListener?: boolean;
  /** Minimal logger used for diagnostics. Defaults to console. */
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export interface MediaClient {
  /** Typed activity emitter: `view` and `download` at minimum. */
  readonly events: Emitter<MediaEventMap>;
  readonly photos: PhotosApi;
  readonly videos: VideosApi;
  /** Read-only access to the cache metadata for introspection. */
  readonly cache: InMemoryCache;
  /** Replace the API key at runtime (e.g. on a 401). */
  configure(patch: { apiKey?: string }): void;
  /** Manually record an activity event. */
  track(type: TrackKind, input: TrackInput): void;
}

export interface PhotosApi {
  search(params: SearchPhotosParams): Promise<MediaResult<MediaPhoto>>;
  curated(params?: CuratedPhotosParams): Promise<MediaResult<MediaPhoto>>;
  get(id: number): Promise<MediaPhoto>;
}

export interface VideosApi {
  search(params: SearchVideosParams): Promise<MediaResult<MediaVideo>>;
  popular(params?: PopularVideosParams): Promise<MediaResult<MediaVideo>>;
  get(id: number): Promise<MediaVideo>;
}

/**
 * Create a configured media client. One client instance owns its auth, cache,
 * de-dupe map, and emitter; create one per application process.
 */
export function createMediaClient(config: MediaClientConfig = {}): MediaClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const auth = createAuth(config.apiKey);
  const transport = new FetchTransport({
    baseUrl,
    auth,
    fetchImpl: config.fetchImpl,
    timeoutMs: config.timeoutMs,
  });
  const events = new Emitter<MediaEventMap>();
  const cache = new InMemoryCache(config.cache);
  const logger = config.logger ?? console;

  /** In-flight request de-dupe: same key + params share one promise. */
  const pending = new Map<string, Promise<unknown>>();

  if (config.defaultListener !== false) {
    events.on('view', (payload) => logger.info('[media-core] view', payload));
    events.on('download', (payload) => logger.info('[media-core] download', payload));
  }

  const emitActivity = (type: TrackKind, input: TrackInput): void => {
    events.emit(type, {
      type,
      kind: input.kind,
      id: input.id,
      source: input.source ?? 'sdk',
      at: Date.now(),
    });
  };

  /**
   * Fetch JSON through the transport with cache + de-dupe. Single-item lookups
   * are cached; lists are only de-duplicated in flight.
   */
  const requestJson = async <T>(options: {
    path: string;
    query: Record<string, string | number | undefined>;
    cacheable: boolean;
  }): Promise<T> => {
    const key = dedupeKey(options.path, options.query);

    if (options.cacheable) {
      const hit = cache.get<T>(key);
      if (hit !== undefined) return hit;
    }

    const inflight = pending.get(key);
    if (inflight) return inflight as Promise<T>;

    const promise = transport
      .get<T>({ path: options.path, query: options.query })
      .then((value) => {
        if (options.cacheable) cache.set(key, value);
        return value;
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, promise);
    return promise;
  };

  const photos: PhotosApi = {
    async search(params) {
      const q = validateQuery(params.query);
      const query = {
        query: q,
        ...paging(params),
        ...photoFilters(params),
        ...(params.locale ? { locale: params.locale } : {}),
      };
      const raw = await requestJson<unknown>({
        path: '/search',
        query,
        cacheable: false,
      });
      return mapPhotoPage(raw);
    },

    async curated(params) {
      const query = {
        ...paging(params),
        ...photoFilters(params),
      };
      const raw = await requestJson<unknown>({ path: '/curated', query, cacheable: false });
      return mapPhotoPage(raw);
    },

    async get(id) {
      const photo = await requestJson<unknown>({
        path: `/photos/${validateId(id, 'photo')}`,
        query: {},
        cacheable: true,
      });
      emitActivity('view', { kind: 'photo', id, source: 'client.get' });
      return mapPhoto(photo);
    },
  };

  const videos: VideosApi = {
    async search(params) {
      const q = validateQuery(params.query);
      const query = {
        query: q,
        ...paging(params),
        ...(params.orientation ? { orientation: params.orientation } : {}),
        ...(params.size ? { size: params.size } : {}),
        ...(params.locale ? { locale: params.locale } : {}),
      };
      const raw = await requestJson<unknown>({ path: '/videos/search', query, cacheable: false });
      return mapVideoPage(raw);
    },

    async popular(params) {
      const query = {
        ...paging(params),
        ...(params?.minWidth ? { min_width: params.minWidth } : {}),
        ...(params?.minHeight ? { min_height: params.minHeight } : {}),
        ...(params?.minDuration ? { min_duration: params.minDuration } : {}),
        ...(params?.maxDuration ? { max_duration: params.maxDuration } : {}),
      };
      const raw = await requestJson<unknown>({ path: '/videos/popular', query, cacheable: false });
      return mapVideoPage(raw);
    },

    async get(id) {
      const video = await requestJson<unknown>({
        path: `/videos/videos/${validateId(id, 'video')}`,
        query: {},
        cacheable: true,
      });
      emitActivity('view', { kind: 'video', id, source: 'client.get' });
      return mapVideo(video);
    },
  };

  const client: MediaClient = {
    events,
    photos,
    videos,
    cache,
    configure({ apiKey }) {
      if (apiKey !== undefined) auth.setKey(apiKey);
    },
    track(type, input) {
      emitActivity(type, input);
    },
  };

  return client;
}

// ---------------------------------------------------------------------------
// Param helpers
// ---------------------------------------------------------------------------

function paging(params: PagingParams | undefined): Record<string, number> {
  const out: Record<string, number> = { page: 1, per_page: 80 };
  if (params?.page !== undefined) {
    if (!Number.isInteger(params.page) || params.page < 1) {
      throw new MediaConfigError(`Invalid page "${params.page}"; expected a positive integer.`);
    }
    out.page = params.page;
  }
  if (params?.perPage !== undefined) {
    const clamped = Math.min(Math.max(Math.trunc(params.perPage), 1), 80);
    out.per_page = clamped;
  }
  return out;
}

function validateQuery(query: string): string {
  const trimmed = query?.trim();
  if (!trimmed) throw new MediaConfigError('A non-empty "query" is required for search.');
  return trimmed;
}

function validateId(id: number, kind: MediaKind): number {
  if (!Number.isInteger(id) || id <= 0) {
    throw new MediaConfigError(`Invalid ${kind} id "${id}".`);
  }
  return id;
}

function photoFilters(
  params: SearchPhotosParams | CuratedPhotosParams | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (params?.orientation) out.orientation = params.orientation;
  if (params?.size) out.size = params.size;
  if (params && 'color' in params && params.color) out.color = params.color;
  return out;
}

function dedupeKey(path: string, query: Record<string, string | number | undefined>): string {
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`);
  return [path, ...parts].join('&');
}

// ---------------------------------------------------------------------------
// Response normalization (raw Pexels JSON -> public types)
// ---------------------------------------------------------------------------

interface RawPhotoPage {
  page?: number;
  per_page?: number;
  total_results?: number;
  photos?: RawPhoto[];
  next_page?: string | null;
  prev_page?: string | null;
}

interface RawPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string | null;
  alt: string;
  liked: boolean;
  src: Record<string, string>;
}

function mapPhoto(raw: unknown): MediaPhoto {
  const r = raw as RawPhoto;
  if (!r || typeof r !== 'object' || !r.id || !r.src) {
    throw new MediaConfigError('Provider returned a malformed photo object.');
  }
  return {
    id: r.id,
    width: r.width,
    height: r.height,
    url: r.url,
    photographer: r.photographer,
    photographerUrl: r.photographer_url,
    photographerId: r.photographer_id,
    avgColor: r.avg_color ?? null,
    alt: r.alt ?? '',
    liked: r.liked ?? false,
    src: {
      original: r.src.original ?? '',
      large2x: r.src.large2x ?? '',
      large: r.src.large ?? '',
      medium: r.src.medium ?? '',
      small: r.src.small ?? '',
      portrait: r.src.portrait ?? '',
      landscape: r.src.landscape ?? '',
      tiny: r.src.tiny ?? '',
    },
  };
}

function mapPhotoPage(raw: unknown): MediaResult<MediaPhoto> {
  const r = raw as RawPhotoPage;
  const items = Array.isArray(r.photos) ? r.photos.map(mapPhoto) : [];
  return {
    items,
    page: r.page ?? 1,
    perPage: r.per_page ?? items.length,
    totalResults: r.total_results ?? items.length,
    nextPage: r.next_page ?? null,
    prevPage: r.prev_page ?? null,
  };
}

interface RawVideoPage {
  page?: number;
  per_page?: number;
  total_results?: number;
  videos?: RawVideo[];
  next_page?: string | null;
  prev_page?: string | null;
}

interface RawVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  user: { id: number; name: string; url: string };
  video_files: Array<{
    id: number;
    quality: string;
    file_type: string;
    width: number | null;
    height: number | null;
    link: string;
    fps: number | null;
  }>;
  video_pictures: Array<{ id: number; picture: string; nr: number }>;
}

function mapVideo(raw: unknown): MediaVideo {
  const r = raw as RawVideo;
  if (!r || typeof r !== 'object' || !r.id || !Array.isArray(r.video_files)) {
    throw new MediaConfigError('Provider returned a malformed video object.');
  }
  const largestPicture = [...r.video_pictures].sort((a, b) => a.nr - b.nr)[0];
  return {
    id: r.id,
    width: r.width,
    height: r.height,
    url: r.url,
    image: r.image,
    thumbnail: largestPicture?.picture ?? r.image,
    duration: r.duration,
    user: r.user,
    videoFiles: r.video_files.map((f) => ({
      id: f.id,
      quality: f.quality === 'hd' || f.quality === 'sd' || f.quality === 'hls' ? f.quality : 'sd',
      fileType: f.file_type,
      width: f.width,
      height: f.height,
      link: f.link,
      fps: f.fps,
    })),
    videoPictures: r.video_pictures.map((p) => ({ id: p.id, picture: p.picture, nr: p.nr })),
  };
}

function mapVideoPage(raw: unknown): MediaResult<MediaVideo> {
  const r = raw as RawVideoPage;
  const items = Array.isArray(r.videos) ? r.videos.map(mapVideo) : [];
  return {
    items,
    page: r.page ?? 1,
    perPage: r.per_page ?? items.length,
    totalResults: r.total_results ?? items.length,
    nextPage: r.next_page ?? null,
    prevPage: r.prev_page ?? null,
  };
}
