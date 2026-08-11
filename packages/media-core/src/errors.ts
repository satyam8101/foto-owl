/**
 * Typed error hierarchy for the media SDK.
 *
 * Every network/API failure surfaces as one of these, never as a bare
 * `Error`. The API key never appears in any message.
 */

export type MediaErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'INVALID_RESPONSE';

export class MediaError extends Error {
  override name = 'MediaError';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** Misuse of the SDK: missing key, invalid query, bad pagination, etc. */
export class MediaConfigError extends MediaError {
  override name = 'MediaConfigError';
}

/** The configured API key was missing or rejected by the provider. */
export class MediaAuthError extends MediaError {
  override name = 'MediaAuthError';
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** The provider responded with a non-2xx status. */
export class MediaApiError extends MediaError {
  override name = 'MediaApiError';
  readonly status: number;
  readonly code: MediaErrorCode;
  readonly retryAfter: number | null;
  readonly body: unknown;

  constructor(input: {
    message: string;
    status: number;
    code: MediaErrorCode;
    retryAfter?: number | null;
    body?: unknown;
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.status = input.status;
    this.code = input.code;
    this.retryAfter = input.retryAfter ?? null;
    this.body = input.body;
  }
}

/** The request never reached the provider (offline, DNS, timeout, abort). */
export class MediaNetworkError extends MediaError {
  override name = 'MediaNetworkError';
  override readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.cause = cause;
  }
}

const CODE_BY_STATUS: Record<number, MediaErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
};

function codeForStatus(status: number): MediaErrorCode {
  if (status >= 500) return 'SERVER_ERROR';
  return CODE_BY_STATUS[status] ?? 'BAD_REQUEST';
}

export interface ApiErrorLike {
  message?: string;
  error?: string;
  code?: string | number;
}

/** Best-effort extraction of a human-readable message from an error body. */
export function extractErrorMessage(body: unknown, fallback: string): string {
  if (!body) return fallback;
  if (typeof body === 'string') return body.length > 0 ? body : fallback;
  if (typeof body !== 'object') return fallback;
  const b = body as ApiErrorLike;
  return b.message ?? b.error ?? fallback;
}

/** Turn an HTTP response into the matching typed error. */
export async function errorFromResponse(
  response: Response,
  fallback: string,
): Promise<MediaError> {
  let body: unknown = null;
  let message = fallback;

  try {
    body = await response.json();
    message = extractErrorMessage(body, fallback);
  } catch {
    // non-JSON error body; keep the fallback message
  }

  const status = response.status;
  if (status === 401) return new MediaAuthError(message, status);

  const retryAfterRaw = response.headers.get('retry-after');
  const retryAfter = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) || null : null;

  return new MediaApiError({
    message,
    status,
    code: codeForStatus(status),
    retryAfter,
    body,
  });
}
