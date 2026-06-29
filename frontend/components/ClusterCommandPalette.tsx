import React, { useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { Search, Command, Check, Server, Cloud, Zap, Globe } from 'lucide-react';
import { Cluster } from '../types';

const ProviderIcon = ({ provider, className }: { provider: Cluster['provider']; className?: string }) => {
  switch (provider) {
    case 'GKE': return <Cloud className={`${className} text-blue-500`} />;
    case 'EKS': return <Zap className={`${className} text-orange-500`} />;
    case 'AKS': return <Globe className={`${className} text-blue-400`} />;
    default: return <Server className={`${className} text-text-secondary`} />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Active': return 'bg-emerald-500';
    case 'Degraded': return 'bg-amber-500';
    default: return 'bg-red-500';
  }
};

interface ClusterCommandPaletteProps {
  clusters: Cluster[];
  selectedClusterIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (clusterId: string) => void;
}

interface ResultItemProps {
  cluster: Cluster;
  index: number;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: (clusterId: string) => void;
  onHover: (index: number) => void;
}

const ResultItem = memo(function ResultItem({
  cluster,
  index,
  isSelected,
  isChecked,
  onSelect,
  onHover,
}: ResultItemProps) {
  const handleClick = useCallback(() => onSelect(cluster.id), [cluster.id, onSelect]);
  const handleMouseEnter = useCallback(() => onHover(index), [index, onHover]);

  return (
    <button
      data-cluster-index={index}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
        isSelected
          ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
          : 'hover:bg-bg-hover'
      }`}
    >
      <div className="p-1.5 rounded-lg bg-bg-hover">
        <ProviderIcon provider={cluster.provider} className="w-4 h-4 shrink-0 text-text-secondary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isSelected ? 'text-primary-500' : 'text-text-primary'}`}>
          {cluster.displayName || cluster.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(cluster.status)}`}></span>
          <p className="text-[10px] text-text-tertiary font-mono uppercase">{cluster.region} :: {cluster.provider}</p>
        </div>
      </div>
      {isChecked && <Check className="w-4 h-4 text-primary-500 shrink-0" />}
    </button>
  );
});

export const ClusterCommandPalette: React.FC<ClusterCommandPaletteProps> = ({
  clusters,
  selectedClusterIds,
  isOpen,
  onClose,
  onSelect,
}) => {
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredClusters = useMemo(() => {
    if (!query) return clusters;
    const normalized = query.toLowerCase();
    return clusters.filter(c =>
      (c.displayName || c.name).toLowerCase().includes(normalized) ||
      c.provider.toLowerCase().includes(normalized) ||
      (c.region || '').toLowerCase().includes(normalized)
    );
  }, [clusters, query]);

  // Clamp selected index when results change
  useEffect(() => {
    setSelectedIndex(prev => Math.max(0, Math.min(prev, Math.max(0, filteredClusters.length - 1))));
  }, [filteredClusters.length]);

  // Scroll selected item into view using data attribute (no ref array churn)
  useEffect(() => {
    if (!isOpen || filteredClusters.length === 0) return;
    const container = resultsRef.current;
    if (!container) return;

    const item = container.querySelector(`[data-cluster-index="${selectedIndex}"]`) as HTMLElement | null;
    if (!item) return;

    const rafId = requestAnimationFrame(() => {
      const itemRect = item.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const padding = 8;

      if (itemRect.bottom > containerRect.bottom - padding) {
        container.scrollTop += itemRect.bottom - containerRect.bottom + padding;
      } else if (itemRect.top < containerRect.top + padding) {
        container.scrollTop += itemRect.top - containerRect.top - padding;
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [selectedIndex, filteredClusters.length, isOpen]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredClusters.length === 0) return;
      setSelectedIndex(prev => Math.min(filteredClusters.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredClusters.length === 0) return;
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cluster = filteredClusters[selectedIndex];
      if (cluster) {
        onSelect(cluster.id);
        onClose();
      }
    }
  }, [filteredClusters, selectedIndex, onSelect, onClose]);

  const handleSelect = useCallback((clusterId: string) => {
    onSelect(clusterId);
    onClose();
  }, [onSelect, onClose]);

  const handleHover = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Cluster search"
    >
      <div
        className="w-full max-w-lg bg-bg-card border border-border-main rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-main">
          <Search className="w-5 h-5 text-text-tertiary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search clusters..."
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary text-sm outline-none min-w-0"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex items-center gap-1 text-[10px] text-text-tertiary bg-bg-hover px-1.5 py-0.5 rounded border border-border-main shrink-0">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[320px] overflow-y-auto custom-scrollbar p-1.5"
        >
          {filteredClusters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-text-tertiary">
              <Search className="w-6 h-6 mb-2 opacity-40" />
              <p className="text-xs">No clusters found</p>
            </div>
          ) : (
            filteredClusters.map((cluster, idx) => (
              <ResultItem
                key={cluster.id}
                cluster={cluster}
                index={idx}
                isSelected={idx === selectedIndex}
                isChecked={selectedClusterIds.includes(cluster.id)}
                onSelect={handleSelect}
                onHover={handleHover}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border-main bg-bg-hover flex items-center justify-between text-[10px] text-text-tertiary">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="bg-bg-card border border-border-main px-1 rounded">↓↑</span> navigate</span>
            <span className="flex items-center gap-1"><span className="bg-bg-card border border-border-main px-1 rounded">↵</span> select</span>
          </div>
          <span>{filteredClusters.length} cluster{filteredClusters.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ClusterCommandPalette);
