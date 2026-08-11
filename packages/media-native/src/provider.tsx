import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createMediaClient, type MediaClient, type MediaClientConfig } from '@fotoowl/media-core';
import { MediaContext } from './context.js';

export interface MediaProviderProps {
  apiKey?: string;
  /** Extra client config. Read once at mount; keep the reference stable. */
  config?: Omit<MediaClientConfig, 'apiKey'>;
  /** Prebuilt client (tests, custom instances). */
  client?: MediaClient;
  children: ReactNode;
}

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
