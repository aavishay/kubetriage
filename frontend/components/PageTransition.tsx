import React from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();

  return (
    <div key={location.pathname} className="kt-page-enter">
      {children}
    </div>
  );
};

// Hook for scroll animations
export const useScrollAnimation = () => {
  // Intentionally empty — scroll animations are handled via CSS + IntersectionObserver
  // in consuming components. This hook is kept for backward compatibility.
};

// Stagger animation hook
export const useStaggerAnimation = (itemCount: number, baseDelay: number = 50) => {
  return (index: number) => ({
    animationDelay: `${index * baseDelay}ms`,
  });
};
