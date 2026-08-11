import { createContext, useContext } from 'react';
import type { MediaClient } from '@fotoowl/media-core';

export interface MediaContextValue {
  client: MediaClient;
}

export const MediaContext = createContext<MediaContextValue | null>(null);

export function useMediaClient(): MediaClient {
  const value = useContext(MediaContext);
  if (!value) {
    throw new Error(
      'useMediaClient() must be used inside a <MediaProvider>. ' +
        'Wrap your app in <MediaProvider apiKey="..."> to access the media client.',
    );
  }
  return value.client;
}
