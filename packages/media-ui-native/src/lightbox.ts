import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModalProps, ViewProps } from 'react-native';

/**
 * Headless lightbox for React Native.
 *
 * Spread `getModalProps()` onto an RN <Modal> and `getContentProps()` onto the
 * inner view; render your media + buttons with the navigation prop-getters.
 * Handles index state, Android back button (onRequestClose), and prev/next.
 */

export interface LightboxOptions<T> {
  open: boolean;
  onClose: () => void;
  items: readonly T[];
  /** Index to show when opened. Default 0. */
  initialIndex?: number;
  /** Wrap around at the ends. Default false. */
  loop?: boolean;
  /** Stable id per item. */
  getItemId?: (item: T, index: number) => string;
}

export interface Lightbox<T> {
  index: number;
  item: T | null;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  close: () => void;
  getModalProps: () => Pick<ModalProps, 'visible' | 'transparent' | 'animationType' | 'onRequestClose' | 'statusBarTranslucent'>;
  getContentProps: () => Pick<ViewProps, 'onAccessibilityEscape'>;
  getCloseButtonProps: () => { 'aria-label': string; onPress: () => void };
  getPrevButtonProps: () => { 'aria-label': string; onPress: () => void; disabled: boolean };
  getNextButtonProps: () => { 'aria-label': string; onPress: () => void; disabled: boolean };
  getItemProps: (index: number) => { 'data-index': number };
}

export function useLightbox<T>(options: LightboxOptions<T>): Lightbox<T> {
  const {
    open,
    onClose,
    items,
    initialIndex = 0,
    loop = false,
    getItemId,
  } = options;

  const [index, setIndex] = useState(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const clamp = useCallback(
    (i: number): number => {
      if (items.length === 0) return 0;
      if (loop) return ((i % items.length) + items.length) % items.length;
      return Math.max(0, Math.min(i, items.length - 1));
    },
    [items.length, loop],
  );

  const next = useCallback(() => setIndex((i) => clamp(i + 1)), [clamp]);
  const prev = useCallback(() => setIndex((i) => clamp(i - 1)), [clamp]);
  const goTo = useCallback((i: number) => setIndex(clamp(i)), [clamp]);
  const close = useCallback(() => onCloseRef.current(), []);

  useEffect(() => {
    if (open) setIndex(clamp(initialIndex));
  }, [open, initialIndex, clamp]);

  useEffect(() => {
    if (open) setIndex((i) => clamp(i));
  }, [open, items.length, clamp]);

  const item = index >= 0 && index < items.length ? (items[index] ?? null) : null;

  const getModalProps = useCallback(
    () => ({
      visible: open,
      transparent: true,
      animationType: 'fade' as const,
      onRequestClose: close,
      statusBarTranslucent: true,
    }),
    [open, close],
  );

  const getContentProps = useCallback(
    () => ({ onAccessibilityEscape: close }),
    [close],
  );

  const getCloseButtonProps = useCallback(
    () => ({ 'aria-label': 'Close viewer', onPress: close }),
    [close],
  );

  const getPrevButtonProps = useCallback(
    () => ({
      'aria-label': 'Previous',
      onPress: prev,
      disabled: !loop && index === 0,
    }),
    [loop, index, prev],
  );

  const getNextButtonProps = useCallback(
    () => ({
      'aria-label': 'Next',
      onPress: next,
      disabled: !loop && (index >= items.length - 1 || items.length === 0),
    }),
    [loop, index, items.length, next],
  );

  const getItemProps = useCallback(
    (i: number) => ({ 'data-index': i, id: getItemId?.(items[i]!, i) ?? `media-item-${i}` }),
    [getItemId, items],
  );

  return {
    index,
    item,
    next,
    prev,
    goTo,
    close,
    getModalProps,
    getContentProps,
    getCloseButtonProps,
    getPrevButtonProps,
    getNextButtonProps,
    getItemProps,
  };
}
