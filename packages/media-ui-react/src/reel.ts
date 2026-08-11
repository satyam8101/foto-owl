import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

/**
 * Headless vertical "reels" swiper with active-item detection.
 *
 * Renders nothing. The hook measures each item against the scroll container
 * with an IntersectionObserver and reports the most-visible index. Consumers
 * supply the markup and the CSS that makes it snap:
 *
 * ```css
 * .media-reel { overflow-y: auto; scroll-snap-type: y mandatory; height: 100%; overscroll-behavior: contain; }
 * .media-reel > * { scroll-snap-align: start; scroll-snap-stop: always; }
 * ```
 */

export interface ReelSwiperOptions<T> {
  items: readonly T[];
  /** Called whenever the active (most visible) item changes. */
  onActiveIndexChange?: (index: number, item: T) => void;
  /** Stable id per item. */
  getItemId?: (item: T, index: number) => string;
  /** Fraction of an item that must be visible to become active. Default 0.6. */
  threshold?: number;
  /** Index to land on when mounted (e.g. opening a reel at a clicked item). */
  initialIndex?: number;
  /** Accessible label for the region. Default "Vertical media list". */
  'aria-label'?: string;
}

export interface ReelSwiper<T> {
  activeIndex: number;
  containerProps: {
    ref: (node: HTMLElement | null) => void;
    tabIndex: 0;
    'aria-label': string;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    'data-media-reel': '';
  };
  getItemProps: (index: number) => {
    ref: (node: HTMLElement | null) => void;
    id: string;
    'data-index': number;
    'data-active': boolean;
    'data-media-reel-item': '';
  };
  /** Programmatically scroll to an index (used by keyboard + callers). */
  scrollToIndex: (index: number, options?: { behavior?: 'auto' | 'smooth' }) => void;
}

export function useReelSwiper<T>(options: ReelSwiperOptions<T>): ReelSwiper<T> {
  const {
    items,
    onActiveIndexChange,
    getItemId,
    threshold = 0.6,
    initialIndex = 0,
    'aria-label': ariaLabel = 'Vertical media list',
  } = options;

  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef(new Map<number, HTMLElement>());
  const onChangeRef = useRef(onActiveIndexChange);
  onChangeRef.current = onActiveIndexChange;

  // Reset the active index when the item list identity changes (e.g. new search).
  useEffect(() => {
    setActiveIndex(Math.max(0, Math.min(initialIndex, items.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(i, items.length - 1)),
    [items.length],
  );

  // Land on the initial index after the first layout pass. Jumps instantly so
  // opening a reel (possibly deep in a long list) doesn't animate through every
  // slide — the active-item observer then settles immediately.
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const target = clamp(initialIndex);
    if (target > 0) {
      requestAnimationFrame(() => scrollToIndex(target, { behavior: 'auto' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Observe item visibility to determine the active index.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let bestIndex = -1;
        let bestRatio = 0;
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index ?? -1);
          if (index >= 0 && entry.intersectionRatio >= bestRatio) {
            bestIndex = index;
            bestRatio = entry.intersectionRatio;
          }
        }
        if (bestIndex >= 0) {
          setActiveIndex(bestIndex);
          onChangeRef.current?.(bestIndex, items[bestIndex]!);
        }
      },
      { root: container, threshold },
    );
    for (const node of itemRefs.current.values()) observer.observe(node);
    return () => observer.disconnect();
  }, [items, threshold]);

  const scrollToIndex = useCallback(
    (i: number, options?: { behavior?: 'auto' | 'smooth' }) => {
      const target = clamp(i);
      const container = containerRef.current;
      const node = itemRefs.current.get(target);
      if (!container || !node) return;
      const containerTop = container.getBoundingClientRect().top;
      const nodeTop = node.getBoundingClientRect().top;
      container.scrollTo({
        top: container.scrollTop + (nodeTop - containerTop),
        behavior: options?.behavior ?? 'smooth',
      });
    },
    [clamp],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const step = (delta: number) => {
        event.preventDefault();
        scrollToIndex(activeIndex + delta);
      };
      switch (event.key) {
        case 'ArrowDown':
        case 'PageDown':
          step(1);
          break;
        case 'ArrowUp':
        case 'PageUp':
          step(-1);
          break;
        case 'Home':
          event.preventDefault();
          scrollToIndex(0);
          break;
        case 'End':
          event.preventDefault();
          scrollToIndex(items.length - 1);
          break;
        default:
          break;
      }
    },
    [activeIndex, scrollToIndex, items.length],
  );

  const containerProps = useMemo(
    () => ({
      'data-media-reel': '' as const,
      ref: (node: HTMLElement | null) => {
        containerRef.current = node;
      },
      tabIndex: 0 as const,
      'aria-label': ariaLabel,
      onKeyDown: handleKeyDown,
    }),
    [ariaLabel, handleKeyDown],
  );

  const getItemProps = useMemo(
    () => (index: number) => ({
      ref: (node: HTMLElement | null) => {
        if (node) itemRefs.current.set(index, node);
        else itemRefs.current.delete(index);
      },
      id: getItemId?.(items[index]!, index) ?? `media-reel-item-${index}`,
      'data-index': index,
      'data-active': index === activeIndex,
      'data-media-reel-item': '' as const,
    }),
    [getItemId, items, activeIndex],
  );

  return { activeIndex, containerProps, getItemProps, scrollToIndex };
}
