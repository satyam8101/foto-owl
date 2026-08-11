import { useCallback, useMemo, useRef } from 'react';
import type { FlatListProps } from 'react-native';

/**
 * Headless infinite-scroll grid for React Native.
 *
 * Spread `getFlatListProps()` onto a <FlatList> and `getItemProps(i)` onto each
 * rendered cell. Rendering, layout styles, and the footer spinner are the
 * consumer's job — this hook only wires load-more and pull-to-refresh.
 */

export interface MediaGridOptions<T> {
  /** The items to lay out. */
  items: readonly T[];
  /** True while the provider has another page to load. */
  hasMore: boolean;
  /** True while a load is in flight. */
  isLoading: boolean;
  /** Called when the list scrolls near its end. */
  onLoadMore: () => void;
  /** Called when the user pull-to-refreshes. */
  onRefresh?: () => void;
  /** Override the spinner/refreshing flag. Defaults to `isLoading`. */
  refreshing?: boolean;
  /** FlatList keyExtractor; defaults to index. */
  keyExtractor?: (item: T, index: number) => string;
  /** 0..1 fraction of list length from the end that triggers onLoadMore. Default 0.5. */
  onEndReachedThreshold?: number;
}

export type MediaGridFlatListProps<T> = Pick<
  FlatListProps<T>,
  | 'data'
  | 'keyExtractor'
  | 'onEndReached'
  | 'onEndReachedThreshold'
  | 'refreshing'
  | 'onRefresh'
>;

export interface MediaGrid<T> {
  getFlatListProps: () => MediaGridFlatListProps<T>;
  getItemProps: (index: number) => { 'data-index': number };
  isLoadingMore: boolean;
  hasMore: boolean;
}

export function useMediaGrid<T>(options: MediaGridOptions<T>): MediaGrid<T> {
  const {
    items,
    hasMore,
    isLoading,
    onLoadMore,
    onRefresh,
    refreshing,
    keyExtractor,
    onEndReachedThreshold = 0.5,
  } = options;

  const stateRef = useRef({ hasMore, isLoading });
  stateRef.current = { hasMore, isLoading };
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  const handleEndReached = useCallback(() => {
    const { hasMore: h, isLoading: l } = stateRef.current;
    if (!h || l) return;
    onLoadMoreRef.current();
  }, []);

  const getFlatListProps = useMemo(
    () => (): MediaGridFlatListProps<T> => ({
      data: [...items],
      keyExtractor,
      onEndReached: handleEndReached,
      onEndReachedThreshold,
      refreshing: refreshing ?? (isLoading && onRefresh != null),
      onRefresh,
    }),
    [items, keyExtractor, handleEndReached, onEndReachedThreshold, refreshing, isLoading, onRefresh],
  );

  const getItemProps = useCallback(
    (index: number) => ({ 'data-index': index }),
    [],
  );

  return { getFlatListProps, getItemProps, isLoadingMore: isLoading, hasMore };
}
