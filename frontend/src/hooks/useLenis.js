import { useEffect, useRef, useCallback } from 'react';
import Lenis from 'lenis';

/**
 * Initializes Lenis smooth scrolling for the application shell while
 * respecting `prefers-reduced-motion: reduce` and nested scroll containers
 * (`.shell-nav`, `.modal-box`, `.inv-modal`, and `[data-lenis-prevent]`).
 *
 * Automatically resets scroll position to the top when `pathname` changes.
 */
export default function useLenis(pathname) {
  const lenisRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      return undefined;
    }

    const lenis = new Lenis({
      autoRaf: true,
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
      prevent: (node) =>
        node?.classList?.contains('shell-nav') ||
        node?.classList?.contains('modal-box') ||
        node?.classList?.contains('inv-modal') ||
        node?.closest?.('[data-lenis-prevent]') !== null,
    });

    lenisRef.current = lenis;

    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollToTop = useCallback((immediate = true) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate });
    } else if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    if (pathname === undefined) return;
    scrollToTop(true);
  }, [pathname, scrollToTop]);

  return { lenisRef, scrollToTop };
}
