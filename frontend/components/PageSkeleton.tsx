import React from 'react';

export const PageSkeleton: React.FC = () => {
  return (
    <div className="space-y-5 animate-fade-in" aria-busy="true" aria-label="Loading page content">
      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="kt-panel p-4 space-y-3">
            <div className="flex justify-between items-start relative z-10">
              <div className="kt-skeleton w-9 h-9" />
              <div className="kt-skeleton kt-skeleton-text w-14" />
            </div>
            <div className="kt-skeleton kt-skeleton-text w-24 relative z-10" />
            <div className="kt-skeleton kt-skeleton-heading w-16 relative z-10" />
          </div>
        ))}
      </div>

      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 kt-panel p-5 space-y-3">
          <div className="kt-skeleton kt-skeleton-text w-32 relative z-10" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="kt-skeleton w-full h-16 relative z-10" />
          ))}
        </div>
        <div className="lg:col-span-3 kt-panel p-5 space-y-3">
          <div className="kt-skeleton kt-skeleton-text w-40 relative z-10" />
          <div className="kt-skeleton w-full h-40 relative z-10" />
        </div>
      </div>
    </div>
  );
};
