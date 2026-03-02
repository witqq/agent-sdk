import { useState, useCallback, useMemo, useRef, useEffect } from "react";

/** Configuration for message list virtualization. */
export interface VirtualizeOptions {
  /** Estimated height of each message item in pixels (default: 80). */
  estimatedItemHeight?: number;
  /** Number of extra items to render above and below the visible area (default: 3). */
  overscan?: number;
}

/** Result of the useVirtualMessages hook. */
export interface VirtualMessagesResult<T> {
  /** Slice of items to actually render. */
  visibleItems: T[];
  /** Start index in the original array. */
  startIndex: number;
  /** End index (exclusive) in the original array. */
  endIndex: number;
  /** Height of the spacer above rendered items (px). */
  topSpacerHeight: number;
  /** Height of the spacer below rendered items (px). */
  bottomSpacerHeight: number;
  /** Total estimated height of all items (px). */
  totalHeight: number;
  /** Scroll event handler to attach to the container. */
  onScroll: (event: { currentTarget: { scrollTop: number; clientHeight: number } }) => void;
  /** Ref callback to measure container on mount. */
  containerRef: (el: HTMLElement | null) => void;
}

/**
 * Hook providing windowed rendering for a list of items.
 *
 * Only items within the visible viewport (plus overscan) are returned.
 * Consumers render top/bottom spacer divs to preserve scroll position.
 *
 * @param items - Full array of items
 * @param options - Virtualization config
 */
export function useVirtualMessages<T>(
  items: readonly T[],
  options: VirtualizeOptions = {},
): VirtualMessagesResult<T> {
  const { estimatedItemHeight = 80, overscan = 3 } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerElRef = useRef<HTMLElement | null>(null);

  const containerRef = useCallback((el: HTMLElement | null) => {
    containerElRef.current = el;
    if (el) {
      setContainerHeight(el.clientHeight);
    }
  }, []);

  // Re-measure on resize
  useEffect(() => {
    const el = containerElRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setContainerHeight(el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback(
    (event: { currentTarget: { scrollTop: number; clientHeight: number } }) => {
      setScrollTop(event.currentTarget.scrollTop);
      setContainerHeight(event.currentTarget.clientHeight);
    },
    [],
  );

  const result = useMemo(() => {
    const totalCount = items.length;
    const totalHeight = totalCount * estimatedItemHeight;

    if (totalCount === 0 || containerHeight === 0) {
      return {
        visibleItems: items.slice(),
        startIndex: 0,
        endIndex: totalCount,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        totalHeight,
      };
    }

    const rawStart = Math.floor(scrollTop / estimatedItemHeight) - overscan;
    const startIndex = Math.max(0, rawStart);

    const visibleCount = Math.ceil(containerHeight / estimatedItemHeight);
    const rawEnd = Math.floor(scrollTop / estimatedItemHeight) + visibleCount + overscan;
    const endIndex = Math.min(totalCount, rawEnd);

    return {
      visibleItems: items.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      topSpacerHeight: startIndex * estimatedItemHeight,
      bottomSpacerHeight: (totalCount - endIndex) * estimatedItemHeight,
      totalHeight,
    };
  }, [items, scrollTop, containerHeight, estimatedItemHeight, overscan]);

  return {
    ...result,
    onScroll,
    containerRef,
  };
}
