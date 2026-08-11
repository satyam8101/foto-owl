import type { MediaVideo } from '@fotoowl/media-react';

/**
 * Pick a playable file with a fast start: prefer an ~720p HD mp4 (the tallest
 * HD files are frequently 4K and buffer slowly), then the smallest mp4, then
 * any file.
 */
export function pickVideoFile(video: MediaVideo): string {
  const mp4 = video.videoFiles.filter((file) => file.fileType === 'video/mp4');
  const hd = mp4.filter((file) => file.quality === 'hd');
  const nearest720 = [...hd].sort(
    (a, b) => Math.abs((a.height ?? 0) - 720) - Math.abs((b.height ?? 0) - 720),
  )[0];
  const smallestMp4 = [...mp4].sort((a, b) => (a.height ?? 0) - (b.height ?? 0))[0];
  const best = nearest720 ?? smallestMp4 ?? video.videoFiles[0];
  return best?.link ?? '';
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
