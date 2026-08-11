import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlatList, FlatListProps, ViewToken } from 'react-native';

/**
 * Headless vertical "reels" swiper for React Native.
 *
 * Uses FlatList with `pagingEnabled` and `onViewableItemsChanged` to report the
 * active (most visible) index. Spread `getFlatListProps()` onto a vertical
 * FlatList and `getItemProps(i)` onto each cell; render your video/photo in the
 * cell. No styles are shipped.
 */

export interface ReelSwiperOptions<T> {
  items: readonly T[];
  /** Called when the active item changes. */
  onActiveIndexChange?: (index: number, item: T) => void;
  /** Fraction of the item that must be visible to become active. Default 0.6. */
  threshold?: number;
  /** Index to land on when mounted. */
  initialIndex?: number;
  /** FlatList keyExtractor; defaults to index. */
  keyExtractor?: (item: T, index: number) => string;
  /** Overrides the underlying FlatList (e.g. onScrollToIndexFailed). */
  getExtraFlatListProps?: () => Partial<FlatListProps<T>>;
}

export type ReelFlatListProps<T> = Omit<Partial<FlatListProps<T>>, 'data'> & {
  data: T[];
  keyExtractor?: (item: T, index: number) => string;
  ref: (node: FlatList<T> | null) => void;
};

export interface ReelSwiper<T> {
  activeIndex: number;
  getFlatListProps: () => ReelFlatListProps<T>;
  getItemProps: (index: number) => { 'data-index': number; 'data-active': boolean };
  /** Animated scroll to an index. */
  scrollToIndex: (index: number) => void;
}

type ViewabilityChange = {
  viewableItems: ViewToken[];
};

export function useReelSwiper<T>(options: ReelSwiperOptions<T>): ReelSwiper<T> {
  const {
    items,
    onActiveIndexChange,
    threshold = 0.6,
    initialIndex = 0,
    keyExtractor,
    getExtraFlatListProps,
  } = options;

  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<T> | null>(null);
  const onChangeRef = useRef(onActiveIndexChange);
  onChangeRef.current = onActiveIndexChange;

  // Land on the initial index after the first layout pass.
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const target = Math.max(0, Math.min(initialIndex, items.length - 1));
    if (target > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: target, animated: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(i, items.length - 1)),
    [items.length],
  );

  // Stable handler: FlatList requires onViewableItemsChanged to keep identity.
  const handlerRef = useRef<(info: ViewabilityChange) => void>(() => {});
  handlerRef.current = ({ viewableItems }: ViewabilityChange) => {
    const first = viewableItems[0];
    if (first?.index == null) return;
    setActiveIndex(first.index);
    onChangeRef.current?.(first.index, items[first.index]!);
  };
  const onViewableItemsChanged = useCallback(
    (info: ViewabilityChange) => handlerRef.current(info),
    [],
  );

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: threshold * 100 }),
    [threshold],
  );

  const getFlatListProps = useMemo(
    () => (): ReelFlatListProps<T> => ({
      ...(getExtraFlatListProps?.() ?? {}),
      ref: (node: FlatList<T> | null) => {
        listRef.current = node;
      },
      data: [...items],
      keyExtractor,
      pagingEnabled: true,
      showsVerticalScrollIndicator: false,
      onViewableItemsChanged,
      viewabilityConfig,
    }),
    [items, keyExtractor, onViewableItemsChanged, viewabilityConfig, getExtraFlatListProps],
  );

  const getItemProps = useCallback(
    (index: number) => ({
      'data-index': index,
      'data-active': index === activeIndex,
    }),
    [activeIndex],
  );

  const scrollToIndex = useCallback(
    (index: number) => {
      listRef.current?.scrollToIndex({ index: clamp(index), animated: true });
    },
    [clamp],
  );

  return { activeIndex, getFlatListProps, getItemProps, scrollToIndex };
}
