import React, { useState, useEffect, useMemo } from 'react';
import {
  GitOpsResource,
  GitOpsSummary,
  GitOpsStatusResponse,
  AppResource,
} from '../types';
import {
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  GitCommit,
  ExternalLink,
  AlertCircle,
  Minus,
  Info,
  Trash2,
  GitPullRequest,
  Eye,
  EyeOff,
  FileDiff,
  Filter,
  Layers,
} from 'lucide-react';

interface GitOpsViewProps {
  clusterId?: string;
}

const COLORS = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#f43f5e',
  info: '#3b82f6',
  gray: '#6b7280',
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Synced':
    case 'Healthy':
    case 'Ready':
      return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    case 'OutOfSync':
    case 'Degraded':
      return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    case 'Progressing':
    case 'Reconciling':
      return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    case 'Suspended':
    case 'Stalled':
      return 'text-text-tertiary bg-text-tertiary/10 border-text-tertiary/20';
    default:
      return 'text-text-tertiary bg-bg-hover border-border-main';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Synced':
    case 'Healthy':
    case 'Ready':
      return <CheckCircle2 className="w-3.5 h-3.5" />;
    case 'OutOfSync':
    case 'Degraded':
    case 'Stalled':
      return <XCircle className="w-3.5 h-3.5" />;
    case 'Progressing':
    case 'Reconciling':
      return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    case 'Suspended':
      return <Minus className="w-3.5 h-3.5" />;
    default:
      return <Info className="w-3.5 h-3.5" />;
  }
};

const actionConfig: Record<string, { marker: string; label: string; color: string; bg: string }> = {
  created: { marker: '+', label: 'created', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  unchanged: { marker: ' ', label: 'unchanged', color: 'text-text-tertiary', bg: 'bg-bg-hover' },
  configured: { marker: '~', label: 'configured', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  modified: { marker: '~', label: 'modified', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  pruned: { marker: '−', label: 'pruned', color: 'text-rose-500', bg: 'bg-rose-500/10' },
  unknown: { marker: '?', label: 'unknown', color: 'text-text-tertiary', bg: 'bg-bg-hover' },
};

const resourceHealthIcon = (status: string) => {
  switch (status) {
    case 'Healthy':
      return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
    case 'Degraded':
      return <XCircle className="w-3 h-3 text-rose-500" />;
    case 'Progressing':
      return <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />;
    default:
      return <Minus className="w-3 h-3 text-text-tertiary" />;
  }
};

interface ResourceDiffProps {
  resources: AppResource[];
}

const ResourceDiff: React.FC<ResourceDiffProps> = ({ resources }) => {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'changed' | 'created' | 'configured' | 'pruned' | 'unchanged'>('all');

  const changed = resources.filter(
    (r) => r.action !== 'unchanged' || r.syncStatus === 'OutOfSync' || r.requiresPruning,
  );

  const filtered = useMemo(() => {
    let list = showAll ? resources : changed;
    if (filter === 'all') return list;
    if (filter === 'changed') return list.filter((r) => r.action !== 'unchanged' || r.syncStatus === 'OutOfSync');
    return list.filter((r) => r.action === filter || (filter === 'pruned' && r.requiresPruning));
  }, [resources, changed, showAll, filter]);

  const counts = useMemo(() => {
    return resources.reduce(
      (acc, r) => {
        const key = r.requiresPruning ? 'pruned' : r.action || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [resources]);

  const hasChanged = changed.length > 0;

  const sorted = [...filtered].sort((a, b) => {
    const order = (r: AppResource) => {
      if (r.requiresPruning) return 0;
      if (r.action === 'configured' || r.action === 'modified') return 1;
      if (r.action === 'created') return 2;
      if (r.syncStatus === 'OutOfSync') return 3;
      return 4;
    };
    const diff = order(a) - order(b);
    if (diff !== 0) return diff;
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    if (a.namespace !== b.namespace) return (a.namespace || '').localeCompare(b.namespace || '');
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileDiff className="w-4 h-4 text-text-tertiary" />
          <span className="text-xs font-bold text-text-primary">Resource Diff</span>
          {hasChanged && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold">
              {changed.length} changed
            </span>
          )}
          <span className="text-[10px] text-text-tertiary">
            {resources.length} total
          </span>
        </div>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-primary transition-colors"
        >
          {showAll ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showAll ? 'show changed only' : `show all ${resources.length}`}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'changed', 'created', 'configured', 'pruned', 'unchanged'] as const).map((f) => {
          const count = f === 'all' ? resources.length : counts[f] || 0;
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                active
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-bg-card text-text-tertiary border-border-main hover:border-primary-500/30'
              }`}
            >
              {f[0].toUpperCase() + f.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border-main overflow-hidden font-mono text-[11px]">
        <div className="overflow-x-auto custom-scrollbar">
          {sorted.length === 0 ? (
            <div className="px-3 py-2 text-text-tertiary text-[11px] bg-bg-hover">
              No resources match the current filter
            </div>
          ) : (
            <div className="divide-y divide-border-main/50">
              {sorted.map((r, i) => {
                const actionKey = r.requiresPruning ? 'pruned' : r.action || 'unknown';
                const cfg = actionConfig[actionKey] || actionConfig.unknown;
                const isOutOfSync = r.syncStatus === 'OutOfSync';
                const rowBg =
                  actionKey === 'pruned'
                    ? 'bg-rose-500/5'
                    : actionKey === 'configured' || actionKey === 'modified'
                    ? 'bg-amber-500/5'
                    : actionKey === 'created'
                    ? 'bg-emerald-500/5'
                    : 'bg-bg-hover/30';
                const displayName = r.namespace ? `${r.namespace}/${r.name}` : r.name;

                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2 ${rowBg}`}
                  >
                    <span
                      className={`w-4 text-center font-bold shrink-0 ${cfg.color}`}
                      title={cfg.label}
                    >
                      {cfg.marker}
                    </span>
                    <span className="text-text-tertiary shrink-0 w-4">
                      {resourceHealthIcon(r.healthStatus)}
                    </span>
                    <span className="text-text-tertiary shrink-0 min-w-[80px]">{r.kind}</span>
                    <span
                      className={`flex-1 truncate ${
                        isOutOfSync || actionKey !== 'unchanged'
                          ? 'text-text-primary font-semibold'
                          : 'text-text-secondary'
                      }`}
                    >
                      {displayName}
                    </span>
                    {actionKey !== 'unchanged' && (
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}
                      >
                        {cfg.label}
                      </span>
                    )}
                    {r.message && (
                      <span
                        className="text-text-tertiary truncate max-w-[180px] shrink-0 text-[10px]"
                        title={r.message}
                      >
                        {r.message}
                      </span>
                    )}
                    <span
                      className={`shrink-0 text-[10px] ${
                        r.syncStatus === 'Synced' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {r.syncStatus}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const GitOpsView: React.FC<GitOpsViewProps> = ({ clusterId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GitOpsStatusResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'argocd' | 'flux'>('all');
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [namespaceFilter, setNamespaceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/gitops/status?cluster=${clusterId || ''}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch GitOps status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [clusterId]);

  const filteredResources = useMemo(() => {
    if (!data) return [];
    let resources: GitOpsResource[] = [];
    if (activeTab === 'all' || activeTab === 'argocd') {
      resources = resources.concat(data.argocd || []);
    }
    if (activeTab === 'all' || activeTab === 'flux') {
      resources = resources.concat(data.flux || []);
    }

    if (namespaceFilter) {
      resources = resources.filter((r) =>
        r.namespace.toLowerCase().includes(namespaceFilter.toLowerCase()),
      );
    }
    if (statusFilter !== 'all') {
      resources = resources.filter(
        (r) =>
          r.healthStatus.toLowerCase() === statusFilter.toLowerCase() ||
          r.syncStatus.toLowerCase() === statusFilter.toLowerCase(),
      );
    }
    return resources;
  }, [data, activeTab, namespaceFilter, statusFilter]);

  const summary: GitOpsSummary = data?.summary || {
    total: 0,
    synced: 0,
    outOfSync: 0,
    degraded: 0,
    progressing: 0,
    suspended: 0,
    unknown: 0,
  };

  const summaryCards = [
    { title: 'Total', value: summary.total, color: 'text-text-primary', bg: 'bg-bg-hover' },
    { title: 'Synced', value: summary.synced, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Out of Sync', value: summary.outOfSync, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: 'Degraded', value: summary.degraded, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: 'Progressing', value: summary.progressing, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Suspended', value: summary.suspended, color: 'text-text-tertiary', bg: 'bg-text-tertiary/10' },
  ];

  const formatAge = (timestamp?: string) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-6 p-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2">
            <div className="kt-skeleton kt-skeleton-heading w-48" />
            <div className="kt-skeleton kt-skeleton-text w-72" />
          </div>
          <div className="kt-skeleton w-24 h-9 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm space-y-3"
            >
              <div className="kt-skeleton kt-skeleton-text w-16" />
              <div className="kt-skeleton kt-skeleton-heading w-12" />
            </div>
          ))}
        </div>
        <div className="kt-skeleton w-full h-10 rounded-xl" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-bg-card rounded-2xl p-4 border border-border-main shadow-sm flex items-center gap-4"
            >
              <div className="kt-skeleton w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="kt-skeleton kt-skeleton-text w-48" />
                <div className="kt-skeleton kt-skeleton-text w-32" />
              </div>
              <div className="kt-skeleton w-20 h-6 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-primary flex items-center gap-3">
            <GitBranch className="w-7 h-7 text-primary-500" />
            GitOps Status
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            ArgoCD and Flux CD sync progress, health, and reconciliation results
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="kt-button kt-button-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm hover:border-primary-500/30 transition-all"
          >
            <p className="text-[10px] font-semibold text-text-tertiary mb-1">{card.title}</p>
            <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex bg-bg-card rounded-xl border border-border-main p-1">
          {(['all', 'argocd', 'flux'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab
                  ? 'bg-primary-500 text-white'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              {tab === 'all' ? 'All Resources' : tab}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Filter by namespace..."
          value={namespaceFilter}
          onChange={(e) => setNamespaceFilter(e.target.value)}
          className="kt-input text-sm flex-1 sm:max-w-[200px]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="kt-select text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="healthy">Healthy</option>
          <option value="synced">Synced</option>
          <option value="degraded">Degraded</option>
          <option value="outofsync">Out of Sync</option>
          <option value="progressing">Progressing</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Resources Table */}
      <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
        <div className="p-6 border-b border-border-main bg-bg-hover/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-600 rounded-xl shadow-lg shadow-primary-600/20">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-text-primary">GitOps Resources</h2>
              <p className="text-[10px] text-text-tertiary font-semibold">
                {filteredResources.length} resources matching filters
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {filteredResources.length === 0 ? (
            <div className="text-center py-12">
              <GitBranch className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
              <p className="text-text-tertiary">
                {data?.argocd?.length === 0 && data?.flux?.length === 0
                  ? 'No GitOps tools detected on this cluster'
                  : 'No resources match the current filters'}
              </p>
            </div>
          ) : (
            filteredResources.map((resource) => {
              const isExpanded = selectedResource === `${resource.tool}-${resource.name}`;
              const changedCount =
                resource.resources?.filter(
                  (r) => r.action !== 'unchanged' || r.syncStatus === 'OutOfSync' || r.requiresPruning,
                ).length || 0;

              return (
                <div
                  key={`${resource.tool}-${resource.kind}-${resource.namespace}-${resource.name}`}
                  className={`rounded-2xl border-2 transition-all ${
                    isExpanded
                      ? 'border-primary-500 bg-primary-500/5'
                      : 'border-border-main hover:border-primary-500/30 bg-bg-hover/30'
                  }`}
                >
                  {/* Row Header */}
                  <div
                    className="p-5 cursor-pointer"
                    onClick={() =>
                      setSelectedResource(isExpanded ? null : `${resource.tool}-${resource.name}`)
                    }
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-bold text-text-primary truncate text-base">
                          {resource.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 text-[10px] font-semibold">
                          {resource.tool}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-bg-hover text-text-tertiary text-[10px] font-bold">
                          {resource.kind}
                        </span>
                        <span className="text-[10px] text-text-tertiary truncate">
                          {resource.namespace}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {resource.misconfigurations && resource.misconfigurations.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-semibold">
                            {resource.misconfigurations.length} Issues
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-text-tertiary" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-text-tertiary" />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-semibold border flex items-center gap-1 truncate ${getStatusColor(
                            resource.syncStatus,
                          )}`}
                        >
                          {getStatusIcon(resource.syncStatus)}
                          <span className="truncate">{resource.syncStatus}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-semibold border flex items-center gap-1 truncate ${getStatusColor(
                            resource.healthStatus,
                          )}`}
                        >
                          {getStatusIcon(resource.healthStatus)}
                          <span className="truncate">{resource.healthStatus}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs min-w-0">
                        <GitCommit className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                        <span className="font-mono text-text-secondary truncate">
                          {resource.revision ? resource.revision.slice(0, 8) : '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs min-w-0">
                        <Clock className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                        <span className="text-text-secondary truncate">
                          {formatAge(resource.lastSyncTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-border-main space-y-5 animate-in fade-in slide-in-from-top-2">
                      {/* Top row: stats + source */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 p-4 rounded-xl bg-bg-card border border-border-main">
                          <div className="flex items-center gap-2 mb-2">
                            <ExternalLink className="w-3.5 h-3.5 text-text-tertiary" />
                            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                              Source
                            </span>
                          </div>
                          {resource.sourceUrl ? (
                            <a
                              href={resource.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary-500 hover:underline break-all"
                              title={resource.sourceUrl}
                            >
                              {resource.sourceUrl}
                            </a>
                          ) : (
                            <span className="text-sm text-text-tertiary">No source URL</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-4 rounded-xl bg-bg-card border border-border-main">
                            <div className="flex items-center gap-2 mb-1">
                              <Layers className="w-3.5 h-3.5 text-text-tertiary" />
                              <span className="text-[10px] font-bold text-text-tertiary">Resources</span>
                            </div>
                            <p className="text-xl font-bold text-text-primary">
                              {resource.readyResources}/{resource.resourceCount}
                            </p>
                            {changedCount > 0 && (
                              <p className="text-[10px] text-rose-500 mt-1">
                                {changedCount} changed
                              </p>
                            )}
                          </div>
                          <div className="p-4 rounded-xl bg-bg-card border border-border-main">
                            <div className="flex items-center gap-2 mb-1">
                              <Info className="w-3.5 h-3.5 text-text-tertiary" />
                              <span className="text-[10px] font-bold text-text-tertiary">Health</span>
                            </div>
                            <p className="text-xl font-bold text-text-primary">
                              {resource.healthStatus}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Operation message */}
                      {resource.message && (
                        <div className="p-4 rounded-xl bg-bg-card border border-border-main">
                          <div className="flex items-center gap-2 mb-1">
                            <GitCommit className="w-3.5 h-3.5 text-text-tertiary" />
                            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                              Last Operation
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary">{resource.message}</p>
                        </div>
                      )}

                      {/* Conditions */}
                      {resource.conditions && resource.conditions.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2">
                            Conditions
                          </p>
                          <div className="space-y-2">
                            {resource.conditions.map((cond, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-3 p-3 rounded-xl bg-bg-card border border-border-main"
                              >
                                <span
                                  className={`mt-0.5 ${
                                    cond.status === 'True' ? 'text-emerald-500' : 'text-rose-500'
                                  }`}
                                >
                                  {cond.status === 'True' ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4" />
                                  )}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-text-primary">
                                      {cond.type}
                                    </span>
                                    <span className="text-[10px] text-text-tertiary">
                                      {cond.status}
                                    </span>
                                  </div>
                                  {cond.reason && (
                                    <p className="text-[10px] text-text-secondary">{cond.reason}</p>
                                  )}
                                  {cond.message && (
                                    <p className="text-[10px] text-text-secondary mt-1">
                                      {cond.message}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alerts */}
                      {(resource.syncErrors?.length || resource.misconfigurations?.length) ? (
                        <div className="space-y-3">
                          {resource.syncErrors && resource.syncErrors.length > 0 && (
                            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                                <span className="text-sm font-bold text-rose-500">Sync Errors</span>
                              </div>
                              <ul className="space-y-1">
                                {resource.syncErrors.map((err, i) => (
                                  <li
                                    key={i}
                                    className="text-xs text-rose-400 flex items-start gap-2"
                                  >
                                    <span className="mt-1">•</span>
                                    <span className="break-words">{err}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {resource.misconfigurations && resource.misconfigurations.length > 0 && (
                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span className="text-sm font-bold text-amber-500">
                                  Misconfigurations
                                </span>
                              </div>
                              <ul className="space-y-1">
                                {resource.misconfigurations.map((m, i) => (
                                  <li
                                    key={i}
                                    className="text-xs text-amber-400 flex items-start gap-2"
                                  >
                                    <span className="mt-1">•</span>
                                    <span className="break-words">{m}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : null}

                      {/* Resource Diff (ArgoCD only) */}
                      {resource.tool === 'ArgoCD' && resource.resources && resource.resources.length > 0 && (
                        <ResourceDiff resources={resource.resources} />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Last Updated */}
      <div className="flex items-center justify-center gap-2 text-text-tertiary text-xs">
        <Clock className="w-3 h-3" />
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};
