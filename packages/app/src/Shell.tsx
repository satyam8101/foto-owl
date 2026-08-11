import { useEffect, useState } from 'react';
import { PEXELS_API_KEY } from './config.js';
import { PhotoBrowser } from './browser/PhotoBrowser.js';
import { VideoBrowser } from './browser/VideoBrowser.js';
import { ActivityFeed } from './activity/ActivityFeed.js';

type Tab = 'photos' | 'videos';

export function Shell() {
  const [tab, setTab] = useState<Tab>('photos');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="app">
      <header className="header">
        <h1 className="brand">foto·owl</h1>
        <input
          className="search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search photos & videos (e.g. mountains, cats, neon)…"
          aria-label="Search media"
        />
        <nav className="tabs" aria-label="Media type">
          <button
            type="button"
            className={`tab ${tab === 'photos' ? 'active' : ''}`}
            onClick={() => setTab('photos')}
          >
            Photos
          </button>
          <button
            type="button"
            className={`tab ${tab === 'videos' ? 'active' : ''}`}
            onClick={() => setTab('videos')}
          >
            Videos
          </button>
        </nav>
      </header>

      {!PEXELS_API_KEY && (
        <div className="banner" role="status">
          No API key configured. Create <code>packages/app/.env</code> from{' '}
          <code>.env.example</code> and set <code>VITE_PEXELS_API_KEY</code> to your free Pexels
          key. Without it the app shows error states instead of media.
        </div>
      )}

      <main className="main">
        {tab === 'photos' ? (
          <PhotoBrowser key={`photos:${debouncedQuery}`} query={debouncedQuery} />
        ) : (
          <VideoBrowser key={`videos:${debouncedQuery}`} query={debouncedQuery} />
        )}
      </main>

      <ActivityFeed />
    </div>
  );
}
