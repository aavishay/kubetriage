import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to trap focus within a modal/dialog element
 * When open, focus is cycled through focusable elements within the container
 * When closed, focus is returned to the previously focused element
 *
 * @param isOpen - Whether the modal/dialog is currently open
 * @returns ref to attach to the container element
 *
 * @example
 * const modalRef = useFocusTrap(isOpen);
 * return (
 *   <div ref={modalRef} role="dialog" aria-modal="true">
 *     <button>Focusable</button>
 *     <input />
 *   </div>
 * );
 */
export function useFocusTrap(isOpen: boolean): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    const container = containerRef.current;
    if (!container) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors));
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Store current focus
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus first focusable element when modal opens
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    } else {
      // Restore previous focus when modal closes
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen, getFocusableElements]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Trap focus within the container
      if (e.shiftKey) {
        // Shift + Tab: cycle to last element if at first
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: cycle to first element if at last
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, getFocusableElements]);

  return containerRef;
}
