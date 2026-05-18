import React, { memo } from 'react';

/**
 * VisuallyHidden component - content is hidden visually but available to screen readers
 * Useful for providing context to screen reader users without affecting the visual design
 *
 * @example
 * <button>
 *   <Icon />
 *   <VisuallyHidden>Delete item</VisuallyHidden>
 * </button>
 */
const VisuallyHiddenComponent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <span
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {children}
    </span>
  );
};

export const VisuallyHidden = memo(VisuallyHiddenComponent);
