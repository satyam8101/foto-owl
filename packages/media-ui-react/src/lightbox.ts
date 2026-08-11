import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';

/**
 * Headless lightbox / modal with focus + keyboard handling for the web.
 *
 * Renders nothing. It manages index state, arrow-key + Escape navigation, a
 * simple focus trap, and body scroll locking. The consumer renders the actual
 * media (image/video) and captions.
 *
 * Prop-getters returned are meant to be spread:
 * ```tsx
 * if (!lightbox.open) return null;
 * return (
 *   <div {...lightbox.getBackdropProps()}>
 *     <div {...lightbox.getPanelProps()}>
 *       <button {...lightbox.getCloseButtonProps()}>✕</button>
 *       <img src={item.src} {...lightbox.getImageWrapProps()} />
 *       <button {...lightbox.getPrevButtonProps()}>‹</button>
 *       <button {...lightbox.getNextButtonProps()}>›</button>
 *     </div>
 *   </div>
 * );
 * ```
 */

export interface LightboxOptions<T> {
  open: boolean;
  onClose: () => void;
  items: readonly T[];
  /** Index to show when opened. Default 0. */
  initialIndex?: number;
  /** Wrap around at the ends. Default false. */
  loop?: boolean;
  /** Stable id per item for a11y labelling. */
  getItemId?: (item: T, index: number) => string;
  /** Trap Tab focus inside the panel. Default true. */
  focusTrap?: boolean;
  /** Click on the backdrop closes. Default true. */
  closeOnBackdrop?: boolean;
  /** Lock body scroll while open. Default true. */
  lockScroll?: boolean;
}

export interface Lightbox<T> {
  index: number;
  item: T | null;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  close: () => void;
  getBackdropProps: () => {
    'data-media-lightbox': '';
    role: 'presentation';
    onClick: (event: MouseEvent<HTMLDivElement>) => void;
  };
  getPanelProps: () => {
    ref: (node: HTMLDivElement | null) => void;
    role: 'dialog';
    'aria-modal': true;
    'aria-label': string;
    tabIndex: -1;
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  };
  getCloseButtonProps: () => {
    type: 'button';
    'aria-label': string;
    onClick: () => void;
  };
  getPrevButtonProps: () => {
    type: 'button';
    'aria-label': string;
    disabled: boolean;
    onClick: () => void;
  };
  getNextButtonProps: () => {
    type: 'button';
    'aria-label': string;
    disabled: boolean;
    onClick: () => void;
  };
  getItemProps: (index: number) => { id: string; 'data-index': number };
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function useLightbox<T>(options: LightboxOptions<T>): Lightbox<T> {
  const {
    open,
    onClose,
    items,
    initialIndex = 0,
    loop = false,
    getItemId,
    focusTrap = true,
    closeOnBackdrop = true,
    lockScroll = true,
  } = options;

  const [index, setIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
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

  // Reset to the requested index whenever the lightbox transitions closed->open.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setIndex(clamp(initialIndex));
    }
    wasOpenRef.current = open;
  }, [open, initialIndex, clamp]);

  // Clamp if the item list shrinks while open.
  useEffect(() => {
    if (open) setIndex((i) => clamp(i));
  }, [open, items.length, clamp]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open || !lockScroll) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, lockScroll]);

  // Capture focus on open, restore focus on close.
  useEffect(() => {
    if (open) {
      lastFocused.current = document.activeElement as HTMLElement | null;
      const timer = window.setTimeout(() => panelRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
    const target = lastFocused.current;
    if (target && document.contains(target)) target.focus();
    return undefined;
  }, [open]);

  const trapTab = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const root = panelRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      } else if (event.key === 'Tab' && focusTrap) {
        trapTab(event);
      }
    },
    [close, prev, next, focusTrap, trapTab],
  );

  const item = index >= 0 && index < items.length ? (items[index] ?? null) : null;

  const getBackdropProps = useCallback(
    () => ({
      'data-media-lightbox': '' as const,
      role: 'presentation' as const,
      onClick: (event: MouseEvent<HTMLDivElement>) => {
        if (closeOnBackdrop && event.target === event.currentTarget) close();
      },
    }),
    [closeOnBackdrop, close],
  );

  const getPanelProps = useCallback(
    () => ({
      ref: (node: HTMLDivElement | null) => {
        panelRef.current = node;
      },
      role: 'dialog' as const,
      'aria-modal': true as const,
      'aria-label': 'Media viewer',
      tabIndex: -1 as const,
      onKeyDown: handleKeyDown,
    }),
    [handleKeyDown],
  );

  const getCloseButtonProps = useCallback(
    () => ({
      type: 'button' as const,
      'aria-label': 'Close viewer',
      onClick: close,
    }),
    [close],
  );

  const getPrevButtonProps = useCallback(
    () => ({
      type: 'button' as const,
      'aria-label': 'Previous',
      disabled: !loop && index === 0,
      onClick: prev,
    }),
    [loop, index, prev],
  );

  const getNextButtonProps = useCallback(
    () => ({
      type: 'button' as const,
      'aria-label': 'Next',
      disabled: !loop && (index >= items.length - 1 || items.length === 0),
      onClick: next,
    }),
    [loop, index, items.length, next],
  );

  const getItemProps = useCallback(
    (i: number) => ({
      id: getItemId?.(items[i]!, i) ?? `media-item-${i}`,
      'data-index': i,
    }),
    [getItemId, items],
  );

  return {
    index,
    item,
    next,
    prev,
    goTo,
    close,
    getBackdropProps,
    getPanelProps,
    getCloseButtonProps,
    getPrevButtonProps,
    getNextButtonProps,
    getItemProps,
  };
}
