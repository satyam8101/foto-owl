import { MediaProvider } from '@fotoowl/media-react';
import { PEXELS_API_KEY } from './config.js';
import { Shell } from './Shell.js';

export function App() {
  return (
    <MediaProvider apiKey={PEXELS_API_KEY || undefined}>
      <Shell />
    </MediaProvider>
  );
}
