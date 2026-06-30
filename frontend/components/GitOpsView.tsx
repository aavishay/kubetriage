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
  GitPullRequest,
  Eye,
  EyeOff,
  FileDiff,
  Layers,
} from 'lucide-react';

interface GitOpsViewProps {
  clusterId?: string;
}

const COLORS = {
  primary: '#f5a623',
  success: '#2ecc71',
  warning: '#f5a623',
  danger: '#e74c3c',
  info: '#4fc1ff',
  gray: '#6b6e75',
};

const getStatusClasses = (status: string) => {
  switch (status) {
    case 'Synced':
    case 'Healthy':
    case 'Ready':
      return 'bg-success/10 border-success/20 text-success';
    case 'OutOfSync':
    case 'Degraded':
      return 'bg-danger/10 border-danger/20 text-danger';
    case 'Progressing':
    case 'Reconciling':
      return 'bg-warning/10 border-warning/20 text-warning';
    case 'Suspended':
    case 'Stalled':
      return 'bg-text-tertiary/10 border-text-tertiary/20 text-text-tertiary';
    default:
      return 'bg-bg-hover border-border-main text-text-tertiary';
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
  created: { marker: '+', label: 'created', color: 'text-success', bg: 'bg-success/10 border-success/20' },
  unchanged: { marker: ' ', label: 'unchanged', color: 'text-text-tertiary', bg: 'bg-bg-hover border-border-main' },
  configured: { marker: '~', label: 'configured', color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
  modified: { marker: '~', label: 'modified', color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
  pruned: { marker: '−', label: 'pruned', color: 'text-danger', bg: 'bg-danger/10 border-danger/20' },
  unknown: { marker: '?', label: 'unknown', color: 'text-text-tertiary', bg: 'bg-bg-hover border-border-main' },
};

const resourceHealthIcon = (status: string) => {
  switch (status) {
    case 'Healthy':
      return <CheckCircle2 className="w-3 h-3 text-success" />;
    case 'Degraded':
      return <XCircle className="w-3 h-3 text-danger" />;
    case 'Progressing':
      return <Loader2 className="w-3 h-3 text-warning animate-spin" />;
    default:
      return <Minus className="w-3 h-3 text-text-tertiary" />;
  }
};

const summaryCard = (label: string, value: React.ReactNode, colorClass: string) => (
  <div className="kt-panel p-4">
    <div className="relative z-10">
      <p className="text-[11px] font-sans font-semibold text-text-tertiary mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
    </div>
  </div>
);

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
    <div className="kt-panel overflow-hidden">
      <div className="kt-panel-header">
        <span className="flex items-center gap-2">
          <FileDiff className="w-4 h-4 text-primary-500" /> Resource Diff
        </span>
        <div className="flex items-center gap-2">
          {hasChanged && (
            <span className="kt-badge kt-badge-danger">{changed.length} changed</span>
          )}
          <span className="kt-badge kt-badge-info">{resources.length} total</span>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="kt-button kt-button-ghost kt-button-sm"
          >
            {showAll ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showAll ? 'show changed only' : `show all ${resources.length}`}
          </button>
        </div>
      </div>

      <div className="p-4 relative z-10">
        <div className="flex flex-wrap gap-2 mb-3">
          {(['all', 'changed', 'created', 'configured', 'pruned', 'unchanged'] as const).map((f) => {
            const count = f === 'all' ? resources.length : counts[f] || 0;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`kt-button kt-button-sm ${active ? 'kt-button-primary' : 'kt-button-secondary'}`}
              >
                {f[0].toUpperCase() + f.slice(1)} ({count})
              </button>
            );
          })}
        </div>

        <div className="border border-border-main overflow-hidden text-[11px] font-sans">
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
                      ? 'bg-danger/5'
                      : actionKey === 'configured' || actionKey === 'modified'
                      ? 'bg-warning/5'
                      : actionKey === 'created'
                      ? 'bg-success/5'
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
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold kt-badge ${cfg.color} ${cfg.bg}`}
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
                          r.syncStatus === 'Synced' ? 'text-success' : 'text-danger'
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
      <div className="flex flex-col gap-5 p-0 kt-page-enter">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2">
            <div className="kt-skeleton kt-skeleton-heading w-48" />
            <div className="kt-skeleton kt-skeleton-text w-72" />
          </div>
          <div className="kt-skeleton w-24 h-9 rounded-md" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="kt-panel p-4 space-y-3"
            >
              <div className="kt-skeleton kt-skeleton-text w-16" />
              <div className="kt-skeleton kt-skeleton-heading w-12" />
            </div>
          ))}
        </div>
        <div className="kt-skeleton w-full h-10 rounded-md" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="kt-panel p-4 flex items-center gap-4"
            >
              <div className="kt-skeleton w-10 h-10 rounded-md shrink-0" />
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
    <div className="flex flex-col gap-5 p-0 font-sans kt-page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-sans text-2xl font-bold text-text-primary flex items-center gap-3">
            <GitBranch className="w-7 h-7 text-primary-500" />
            GitOps Status
          </h1>
          <p className="text-text-tertiary text-sm mt-1 font-sans">
            ArgoCD and Flux CD sync progress, health, and reconciliation results
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="kt-button kt-button-secondary kt-button-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {summaryCard('Total', summary.total, 'text-text-primary')}
        {summaryCard('Synced', summary.synced, 'text-success')}
        {summaryCard('Out of Sync', summary.outOfSync, 'text-danger')}
        {summaryCard('Degraded', summary.degraded, 'text-danger')}
        {summaryCard('Progressing', summary.progressing, 'text-warning')}
        {summaryCard('Suspended', summary.suspended, 'text-text-tertiary')}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex bg-bg-card border border-border-main p-0.5">
          {(['all', 'argocd', 'flux'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`kt-button kt-button-sm ${activeTab === tab ? 'kt-button-primary' : 'kt-button-secondary'}`}
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
      <div className="kt-panel overflow-hidden">
        <div className="kt-panel-header">
          <span className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary-500" /> GitOps Resources
          </span>
          <span className="text-[10px] text-text-tertiary font-sans">
            {filteredResources.length} resources matching filters
          </span>
        </div>

        <div className="p-4 relative z-10 space-y-4">
          {filteredResources.length === 0 ? (
            <div className="text-center py-12">
              <GitBranch className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
              <p className="text-text-tertiary font-sans">
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
                  className={`border transition-all overflow-hidden ${
                    isExpanded
                      ? 'border-primary-500 kt-amber-glow bg-bg-card'
                      : 'border-border-main hover:border-primary-500/30 bg-bg-main'
                  }`}
                >
                  {/* Row Header */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() =>
                      setSelectedResource(isExpanded ? null : `${resource.tool}-${resource.name}`)
                    }
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-sans font-semibold text-text-primary truncate">
                          {resource.name}
                        </span>
                        <span className="kt-badge kt-badge-info">
                          {resource.tool}
                        </span>
                        <span className="kt-badge bg-bg-hover text-text-tertiary border-border-main">
                          {resource.kind}
                        </span>
                        <span className="text-[10px] text-text-tertiary truncate">
                          {resource.namespace}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {resource.misconfigurations && resource.misconfigurations.length > 0 && (
                          <span className="kt-badge kt-badge-danger">
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
                          className={`kt-badge ${getStatusClasses(resource.syncStatus)}`}
                        >
                          {getStatusIcon(resource.syncStatus)}
                          <span className="truncate">{resource.syncStatus}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`kt-badge ${getStatusClasses(resource.healthStatus)}`}
                        >
                          {getStatusIcon(resource.healthStatus)}
                          <span className="truncate">{resource.healthStatus}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs min-w-0">
                        <GitCommit className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                        <span className="text-text-secondary truncate">
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
                    <div className="px-4 pb-4 pt-2 border-t border-border-main space-y-5 animate-in fade-in slide-in-from-top-2">
                      {/* Top row: stats + source */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 kt-panel p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <ExternalLink className="w-3.5 h-3.5 text-text-tertiary" />
                            <span className="kt-text-label">Source</span>
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
                            <span className="text-sm text-text-tertiary font-sans">No source URL</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="kt-panel p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <Layers className="w-3.5 h-3.5 text-text-tertiary" />
                              <span className="kt-text-label">Resources</span>
                            </div>
                            <p className="text-xl font-bold text-text-primary">
                              {resource.readyResources}/{resource.resourceCount}
                            </p>
                            {changedCount > 0 && (
                              <p className="text-[10px] text-danger mt-1 font-sans">
                                {changedCount} changed
                              </p>
                            )}
                          </div>
                          <div className="kt-panel p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <Info className="w-3.5 h-3.5 text-text-tertiary" />
                              <span className="kt-text-label">Health</span>
                            </div>
                            <p className="text-xl font-bold text-text-primary">
                              {resource.healthStatus}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Operation message */}
                      {resource.message && (
                        <div className="kt-panel p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <GitCommit className="w-3.5 h-3.5 text-text-tertiary" />
                            <span className="kt-text-label">Last Operation</span>
                          </div>
                          <p className="text-sm text-text-secondary font-sans">{resource.message}</p>
                        </div>
                      )}

                      {/* Conditions */}
                      {resource.conditions && resource.conditions.length > 0 && (
                        <div>
                          <p className="kt-text-label mb-2">Conditions</p>
                          <div className="space-y-2">
                            {resource.conditions.map((cond, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-3 p-3 border border-border-main bg-bg-main"
                              >
                                <span className={`mt-0.5 kt-led ${cond.status === 'True' ? 'kt-led-success' : 'kt-led-danger'}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-sans font-semibold text-text-primary">
                                      {cond.type}
                                    </span>
                                    <span className="text-[10px] text-text-tertiary font-sans">
                                      {cond.status}
                                    </span>
                                  </div>
                                  {cond.reason && (
                                    <p className="text-[10px] text-text-secondary font-sans">{cond.reason}</p>
                                  )}
                                  {cond.message && (
                                    <p className="text-[10px] text-text-secondary mt-1 font-sans">
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
                            <div className="p-4 bg-danger/10 border border-danger/20">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-danger" />
                                <span className="text-sm font-bold text-danger">Sync Errors</span>
                              </div>
                              <ul className="space-y-1">
                                {resource.syncErrors.map((err, i) => (
                                  <li
                                    key={i}
                                    className="text-xs text-danger flex items-start gap-2 font-sans"
                                  >
                                    <span className="mt-1">•</span>
                                    <span className="break-words">{err}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {resource.misconfigurations && resource.misconfigurations.length > 0 && (
                            <div className="p-4 bg-warning/10 border border-warning/20">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-warning" />
                                <span className="text-sm font-bold text-warning">
                                  Misconfigurations
                                </span>
                              </div>
                              <ul className="space-y-1">
                                {resource.misconfigurations.map((m, i) => (
                                  <li
                                    key={i}
                                    className="text-xs text-warning flex items-start gap-2 font-sans"
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
      <div className="flex items-center justify-center gap-2 text-text-tertiary text-xs font-sans font-medium">
        <Clock className="w-3 h-3" />
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};
