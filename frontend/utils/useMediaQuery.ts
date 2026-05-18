import { useState, useEffect } from 'react';

/**
 * Hook to track media query matches
 * Useful for responsive design that needs JS logic, not just CSS
 *
 * @param query - CSS media query string (e.g., '(min-width: 768px)')
 * @returns boolean indicating if the media query matches
 *
 * @example
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 * const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);

    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Modern API
    if (media.addEventListener) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }

    // Legacy API fallback
    media.addListener(listener);
    return () => media.removeListener(listener);
  }, [query]);

  return matches;
}

/**
 * Predefined media query hooks for common breakpoints
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}
