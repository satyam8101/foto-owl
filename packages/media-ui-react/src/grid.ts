import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * Headless infinite-scroll grid.
 *
 * Renders nothing; gives you prop-getters to spread onto your own markup. The
 * hook observes a "loader" element (rendered by the consumer) with an
 * IntersectionObserver and calls `onLoadMore` when it scrolls into view and
 * more items are available.
 *
 * Required consumer CSS (no styles are shipped):
 * ```css
 * .media-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
 * ```
 */

export interface MediaGridOptions<T> {
  /** The items to lay out. */
  items: readonly T[];
  /** True while the provider has another page to load. */
  hasMore: boolean;
  /** True while a load is in flight (the observer stays quiet). */
  isLoading: boolean;
  /** Called when the loader enters the viewport. */
  onLoadMore: () => void;
  /** Stable id per item; defaults to the index-based key. */
  getItemId?: (item: T, index: number) => string;
  /**
   * How many px before the loader to start loading. Default 400, which makes
   * infinite scroll feel seamless; set 0 to load only when fully visible.
   */
  threshold?: number;
  /** Overrides the IntersectionObserver rootMargin entirely. */
  rootMargin?: string;
  /** Scroll container to use as the observer root (default: viewport). */
  getScrollParent?: () => Element | null;
  /** Disable auto-loading (e.g. while a manual load is in progress). */
  disabled?: boolean;
}

export interface MediaGridItemProps {
  id: string;
  ref: (node: HTMLElement | null) => void;
  'data-index': number;
  'data-media-grid-item': '';
}

export interface MediaGridLoaderProps {
  ref: (node: HTMLDivElement | null) => void;
  'aria-live': 'polite';
  'aria-busy': boolean;
}

export interface MediaGrid<T> {
  /** Spread onto the outer grid container. */
  containerProps: { ref: (node: HTMLElement | null) => void; 'data-media-grid': '' };
  /** Props for the i-th item element. */
  getItemProps: (index: number) => MediaGridItemProps;
  /** Spread onto a sentinel element rendered after the last item. */
  loaderProps: MediaGridLoaderProps;
  isLoading: boolean;
  hasMore: boolean;
  /** Smooth-scroll the container back to the first item. */
  scrollToTop: () => void;
}

export function useMediaGrid<T>(options: MediaGridOptions<T>): MediaGrid<T> {
  const {
    items,
    hasMore,
    isLoading,
    onLoadMore,
    getItemId,
    threshold = 400,
    rootMargin,
    getScrollParent,
    disabled = false,
  } = options;

  const containerRef = useRef<HTMLElement | null>(null);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<number, HTMLElement>());
  const stateRef = useRef({ hasMore, isLoading, disabled });
  stateRef.current = { hasMore, isLoading, disabled };
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;
    if (disabled || !hasMore || isLoading) return;

    const root = getScrollParent?.() ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        const { hasMore: h, isLoading: l, disabled: d } = stateRef.current;
        if (d || !h || l) return;
        onLoadMoreRef.current();
      },
      { root, rootMargin: rootMargin ?? `0px 0px ${threshold}px 0px`, threshold: 0 },
    );
    observer.observe(loader);
    return () => observer.disconnect();
  }, [disabled, hasMore, isLoading, threshold, rootMargin, getScrollParent]);

  const containerProps = useMemo(
    () => ({
      'data-media-grid': '' as const,
      ref: (node: HTMLElement | null) => {
        containerRef.current = node;
      },
    }),
    [],
  );

  const getItemProps = useMemo(() => {
    return (index: number): MediaGridItemProps => ({
      id: getItemId?.(items[index]!, index) ?? `media-item-${index}`,
      ref: (node: HTMLElement | null) => {
        if (node) itemRefs.current.set(index, node);
        else itemRefs.current.delete(index);
      },
      'data-index': index,
      'data-media-grid-item': '',
    });
  }, [getItemId, items]);

  const loaderProps = useMemo(
    () => ({
      ref: (node: HTMLDivElement | null) => {
        loaderRef.current = node;
      },
      'aria-live': 'polite' as const,
      'aria-busy': isLoading,
    }),
    [isLoading],
  );

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { containerProps, getItemProps, loaderProps, isLoading, hasMore, scrollToTop };
}
