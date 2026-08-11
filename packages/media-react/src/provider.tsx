import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createMediaClient, type MediaClient, type MediaClientConfig } from '@fotoowl/media-core';
import { MediaContext } from './context.js';

export interface MediaProviderProps {
  /**
   * Pexels API key. Runtime changes are applied via `client.configure()` so the
   * client instance (and its emitter/cache) survives key swaps.
   */
  apiKey?: string;
  /**
   * Extra client config (baseUrl, cache, fetchImpl, ...). Because the client is
   * created once, keep this reference stable (module-level constant) — it is
   * only read on first mount.
   */
  config?: Omit<MediaClientConfig, 'apiKey'>;
  /** Provide an already-built client (SSR, tests, custom instances). */
  client?: MediaClient;
  children: ReactNode;
}

/**
 * Provides the media client to the hook surface. No business logic lives here;
 * it only wires a media-core client instance into React context.
 */
export function MediaProvider({ apiKey, config, client: prebuilt, children }: MediaProviderProps) {
  const initialConfig = useRef(config).current;

  const client = useMemo<MediaClient>(
    () => prebuilt ?? createMediaClient({ apiKey, ...initialConfig }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prebuilt, apiKey],
  );

  useEffect(() => {
    if (prebuilt) return;
    if (apiKey !== undefined) client.configure({ apiKey });
  }, [client, prebuilt, apiKey]);

  const value = useMemo(() => ({ client }), [client]);

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}
