import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { Search, Filter, X, Clock, CheckCircle2, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { CrossClusterIncident } from '../types';
import { useDebounce } from '../hooks/useDebounce';

const SEVERITY_CONFIG: Record<string, { bar: string; badge: string; dot: string }> = {
  Critical: { bar: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', dot: 'bg-rose-500' },
  High: { bar: 'bg-orange-500', badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', dot: 'bg-orange-500' },
  Medium: { bar: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', dot: 'bg-amber-500' },
  Low: { bar: 'bg-blue-500', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', dot: 'bg-blue-500' },
};

const DEFAULT_SEVERITY = { bar: 'bg-slate-500', badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', dot: 'bg-slate-500' };

const PAGE_SIZE = 50;

const stripMarkdown = (text: string) => {
  if (!text) return '';
  return text
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
};

const formatRelativeTime = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Unknown';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const markdownComponents = {
  h1: ({ children, ...props }: any) => (
    <h1 className="text-base font-bold text-text-primary mt-4 mb-2 first:mt-0" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-sm font-bold text-text-primary mt-3 mb-2 first:mt-0 flex items-center gap-2" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-xs font-bold text-text-secondary mt-3 mb-1.5 first:mt-0 uppercase tracking-wide" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: any) => (
    <p className="text-xs text-text-secondary leading-relaxed mb-2 last:mb-0" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="space-y-1.5 my-2 list-none pl-0" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="space-y-1.5 my-2 list-decimal pl-4" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="flex gap-2 items-start text-xs text-text-secondary leading-relaxed" {...props}>
      <span className="mt-1.5 w-1 h-1 rounded-full bg-primary-500/60 shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  strong: ({ children, ...props }: any) => (
    <strong className="font-semibold text-text-primary" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }: any) => (
    <em className="italic text-text-secondary" {...props}>{children}</em>
  ),
  code: ({ inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code className="bg-primary-500/10 text-primary-600 dark:text-primary-400 px-1 py-0.5 rounded text-[11px] font-mono" {...props}>
          {children}
        </code>
      );
    }
    return (
      <div className="my-2 overflow-hidden rounded-lg border border-border-main bg-bg-main">
        <pre className="p-3 overflow-x-auto text-[11px] font-mono text-text-secondary leading-relaxed custom-scrollbar">
          <code {...props}>{children}</code>
        </pre>
      </div>
    );
  },
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="border-l-2 border-primary-500/30 pl-3 my-2 text-text-tertiary italic" {...props}>{children}</blockquote>
  ),
};

interface IncidentRowProps {
  incident: CrossClusterIncident;
}

const IncidentRow = memo(function IncidentRow({ incident }: IncidentRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDescriptionClamped, setIsDescriptionClamped] = useState(false);
  const [isRootCauseClamped, setIsRootCauseClamped] = useState(false);
  const [copied, setCopied] = useState(false);

  const severity = SEVERITY_CONFIG[incident.severity] || DEFAULT_SEVERITY;
  const affectedClusters = incident.affectedClusters || [];
  const visibleClusters = affectedClusters.slice(0, 6);
  const hiddenCount = affectedClusters.length - visibleClusters.length;

  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const rootCauseRef = useRef<HTMLSpanElement>(null);

  const cleanedDescription = stripMarkdown(incident.description);
  const cleanedRootCause = stripMarkdown(incident.rootCause || '');

  useEffect(() => {
    const el = descriptionRef.current;
    if (el) {
      setIsDescriptionClamped(el.scrollHeight > el.clientHeight + 1);
    }
  }, [cleanedDescription]);

  useEffect(() => {
    const el = rootCauseRef.current;
    if (el) {
      setIsRootCauseClamped(el.scrollHeight > el.clientHeight + 1);
    }
  }, [cleanedRootCause]);

  const canExpand = isDescriptionClamped || (incident.rootCause && isRootCauseClamped);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(incident.description);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy incident description', err);
    }
  }, [incident.description]);

  return (
    <div className="flex items-stretch gap-0 hover:bg-bg-hover/40 transition-colors group">
      <div className={`w-1 shrink-0 ${severity.bar}`} />
      <div className="flex-1 min-w-0 p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-semibold text-text-primary text-sm truncate">{incident.title}</h4>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${severity.badge}`}>
                {incident.severity}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg-hover text-text-tertiary border border-border-main">
                {incident.pattern}
              </span>
            </div>

            {isExpanded ? (
              <div className="animate-fade-in">
                <ReactMarkdown components={markdownComponents}>
                  {incident.description}
                </ReactMarkdown>
              </div>
            ) : (
              <p
                ref={descriptionRef}
                className="text-xs text-text-secondary line-clamp-2 leading-relaxed"
              >
                {cleanedDescription}
              </p>
            )}

            <div className="flex items-center gap-3 mt-1.5">
              {canExpand && (
                <button
                  onClick={toggleExpanded}
                  className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-500 flex items-center gap-1 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" /> Show more
                    </>
                  )}
                </button>
              )}
              <button
                onClick={copyToClipboard}
                className="text-[10px] font-semibold text-text-tertiary hover:text-text-primary flex items-center gap-1 transition-colors"
                title="Copy incident description"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copy
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary shrink-0 whitespace-nowrap">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(incident.startedAt)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-2.5">
          {visibleClusters.map((clusterId) => (
            <span
              key={clusterId}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-main border border-border-main text-[10px] font-medium text-text-secondary truncate max-w-[160px]"
            >
              <span className={`w-1 h-1 rounded-full ${severity.dot}`} />
              {clusterId}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="text-[10px] text-text-tertiary">
              +{hiddenCount} more
            </span>
          )}
        </div>

        {incident.rootCause && (
          <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-text-tertiary">
            <span className="font-semibold text-text-secondary shrink-0">Root cause:</span>
            {isExpanded ? (
              <div className="flex-1 animate-fade-in">
                <ReactMarkdown components={markdownComponents}>
                  {incident.rootCause}
                </ReactMarkdown>
              </div>
            ) : (
              <span
                ref={rootCauseRef}
                className="line-clamp-1"
              >
                {cleanedRootCause}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

interface MultiClusterIncidentsListProps {
  incidents: CrossClusterIncident[];
}

export const MultiClusterIncidentsList: React.FC<MultiClusterIncidentsListProps> = memo(function MultiClusterIncidentsList({ incidents }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [patternFilter, setPatternFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const debouncedSearch = useDebounce(searchTerm, 150);

  const filteredIncidents = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    return incidents.filter(i => {
      const matchesSearch = !term ||
        i.title.toLowerCase().includes(term) ||
        i.description.toLowerCase().includes(term) ||
        (i.rootCause || '').toLowerCase().includes(term) ||
        (i.affectedClusters || []).some(c => c.toLowerCase().includes(term));
      const matchesSeverity = severityFilter === 'all' || i.severity === severityFilter;
      const matchesPattern = patternFilter === 'all' || i.pattern === patternFilter;
      return matchesSearch && matchesSeverity && matchesPattern;
    });
  }, [incidents, debouncedSearch, severityFilter, patternFilter]);

  // Reset pagination when filters change
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearch, severityFilter, patternFilter]);

  const visibleIncidents = useMemo(() => {
    return filteredIncidents.slice(0, visibleCount);
  }, [filteredIncidents, visibleCount]);

  const hasMore = visibleIncidents.length < filteredIncidents.length;

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setSeverityFilter('all');
    setPatternFilter('all');
  }, []);

  const loadMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleSeverityChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSeverityFilter(e.target.value);
  }, []);

  const handlePatternChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setPatternFilter(e.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return (
    <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
      <div className="p-4 md:p-5 border-b border-border-main bg-bg-hover/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h3 className="text-sm font-black text-text-primary">
            All Incidents ({filteredIncidents.length}{filteredIncidents.length !== incidents.length && ` of ${incidents.length}`})
          </h3>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search incidents..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="kt-input pl-10 pr-4 py-2 text-xs w-full sm:w-56"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
              <select
                value={severityFilter}
                onChange={handleSeverityChange}
                className="kt-select text-xs py-2"
              >
                <option value="all">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <select
                value={patternFilter}
                onChange={handlePatternChange}
                className="kt-select text-xs py-2"
              >
                <option value="all">All Patterns</option>
                <option value="Cascading">Cascading</option>
                <option value="Correlated">Correlated</option>
                <option value="Isolated">Isolated</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <div className="p-0">
        {incidents.length === 0 ? (
          <div className="text-center py-12 px-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h4 className="text-lg font-bold text-text-primary mb-2">No Cross-Cluster Incidents</h4>
            <p className="text-text-tertiary text-sm">All systems operating normally across selected clusters</p>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="text-center py-12 px-6">
            <Search className="w-10 h-10 text-text-tertiary mx-auto mb-3 opacity-40" />
            <h4 className="text-base font-bold text-text-primary mb-1">No incidents match filters</h4>
            <p className="text-text-tertiary text-sm mb-4">Try adjusting search or filter criteria</p>
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-500"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border-main">
            {visibleIncidents.map((incident) => (
              <IncidentRow key={incident.id} incident={incident} />
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                className="w-full py-3 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center gap-1.5 border-t border-border-main"
              >
                Load {Math.min(PAGE_SIZE, filteredIncidents.length - visibleIncidents.length)} more
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default MultiClusterIncidentsList;
