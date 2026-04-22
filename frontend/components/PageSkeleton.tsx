import React from 'react';

export const PageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header skeleton matching Layout header height */}
      <div className="h-16 bg-bg-card/50 border-b border-border-main rounded-xl flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="kt-skeleton w-8 h-8 rounded-lg" />
          <div className="kt-skeleton kt-skeleton-text w-40" />
        </div>
        <div className="flex items-center gap-2">
          <div className="kt-skeleton w-10 h-10 rounded-xl" />
          <div className="kt-skeleton w-10 h-10 rounded-xl" />
          <div className="kt-skeleton w-10 h-10 rounded-xl" />
        </div>
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-bg-card border border-border-main rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div className="kt-skeleton w-10 h-10 rounded-xl" />
              <div className="kt-skeleton kt-skeleton-text w-16" />
            </div>
            <div className="kt-skeleton kt-skeleton-text w-24" />
            <div className="kt-skeleton kt-skeleton-heading w-16" />
          </div>
        ))}
      </div>

      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 bg-bg-card border border-border-main rounded-2xl p-6 space-y-3">
          <div className="kt-skeleton kt-skeleton-text w-32" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="kt-skeleton w-full h-20 rounded-xl" />
          ))}
        </div>
        <div className="lg:col-span-3 bg-bg-card border border-border-main rounded-2xl p-6 space-y-3">
          <div className="kt-skeleton kt-skeleton-text w-40" />
          <div className="kt-skeleton w-full h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
};
