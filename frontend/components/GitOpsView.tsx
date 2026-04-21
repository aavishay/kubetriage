import React, { useState, useEffect, useMemo } from 'react';
import { GitOpsResource, GitOpsSummary, GitOpsStatusResponse } from '../types';
import {
  GitBranch, CheckCircle2, AlertTriangle, XCircle, Clock, Loader2,
  ChevronDown, ChevronUp, RefreshCw, GitCommit, ExternalLink,
  AlertCircle, Minus, Info
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
  gray: '#6b7280'
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
      return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
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
      resources = resources.filter(r =>
        r.namespace.toLowerCase().includes(namespaceFilter.toLowerCase())
      );
    }
    if (statusFilter !== 'all') {
      resources = resources.filter(r =>
        r.healthStatus.toLowerCase() === statusFilter.toLowerCase() ||
        r.syncStatus.toLowerCase() === statusFilter.toLowerCase()
      );
    }
    return resources;
  }, [data, activeTab, namespaceFilter, statusFilter]);

  const summary: GitOpsSummary = data?.summary || {
    total: 0, synced: 0, outOfSync: 0, degraded: 0,
    progressing: 0, suspended: 0, unknown: 0
  };

  const summaryCards = [
    { title: 'Total', value: summary.total, color: 'text-text-primary', bg: 'bg-bg-hover' },
    { title: 'Synced', value: summary.synced, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Out of Sync', value: summary.outOfSync, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: 'Degraded', value: summary.degraded, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: 'Progressing', value: summary.progressing, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Suspended', value: summary.suspended, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  ];

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <div className="p-6 bg-bg-hover rounded-full mb-6 animate-pulse">
          <GitBranch className="w-12 h-12 text-text-tertiary" />
        </div>
        <h2 className="text-2xl font-black text-text-primary uppercase tracking-tighter mb-2">
          Loading GitOps Status
        </h2>
        <p className="text-text-tertiary">Scanning ArgoCD and Flux resources...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-primary uppercase tracking-tighter flex items-center gap-3">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm hover:border-primary-500/30 transition-all"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">
              {card.title}
            </p>
            <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex bg-bg-card rounded-xl border border-border-main p-1">
          {(['all', 'argocd', 'flux'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
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
              <h2 className="text-sm font-black uppercase tracking-widest text-text-primary">
                GitOps Resources
              </h2>
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
            filteredResources.map(resource => (
              <div
                key={`${resource.tool}-${resource.kind}-${resource.namespace}-${resource.name}`}
                className={`rounded-2xl border-2 transition-all ${
                  selectedResource === `${resource.tool}-${resource.name}`
                    ? 'border-primary-500 bg-primary-500/5'
                    : 'border-border-main hover:border-primary-500/30 bg-bg-hover/30'
                }`}
              >
                {/* Row Header */}
                <div
                  className="p-5 cursor-pointer"
                  onClick={() => setSelectedResource(
                    selectedResource === `${resource.tool}-${resource.name}`
                      ? null
                      : `${resource.tool}-${resource.name}`
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-text-primary">{resource.name}</span>
                      <span className="px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-500 text-[10px] font-black uppercase">
                        {resource.tool}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-bg-hover text-text-tertiary text-[10px] font-bold">
                        {resource.kind}
                      </span>
                      <span className="text-[10px] text-text-tertiary">{resource.namespace}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {resource.misconfigurations && resource.misconfigurations.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 text-[10px] font-black">
                          {resource.misconfigurations.length} Issues
                        </span>
                      )}
                      {selectedResource === `${resource.tool}-${resource.name}` ? (
                        <ChevronUp className="w-4 h-4 text-text-tertiary" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-text-tertiary" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase border flex items-center gap-1 ${getStatusColor(resource.syncStatus)}`}>
                        {getStatusIcon(resource.syncStatus)}
                        {resource.syncStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase border flex items-center gap-1 ${getStatusColor(resource.healthStatus)}`}>
                        {getStatusIcon(resource.healthStatus)}
                        {resource.healthStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <GitCommit className="w-3.5 h-3.5 text-text-tertiary" />
                      <span className="font-mono text-text-secondary truncate max-w-[120px]">
                        {resource.revision ? resource.revision.slice(0, 8) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="w-3.5 h-3.5 text-text-tertiary" />
                      <span className="text-text-secondary">
                        {resource.lastSyncTime
                          ? new Date(resource.lastSyncTime).toLocaleTimeString()
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedResource === `${resource.tool}-${resource.name}` && (
                  <div className="px-5 pb-5 pt-2 border-t border-border-main space-y-4 animate-in fade-in slide-in-from-top-2">
                    {/* Source URL */}
                    {resource.sourceUrl && (
                      <div className="flex items-center gap-2 text-xs">
                        <ExternalLink className="w-3.5 h-3.5 text-text-tertiary" />
                        <a
                          href={resource.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-500 hover:underline truncate"
                        >
                          {resource.sourceUrl}
                        </a>
                      </div>
                    )}

                    {/* Message */}
                    {resource.message && (
                      <div className="p-3 rounded-xl bg-bg-card border border-border-main">
                        <p className="text-[10px] font-black uppercase text-text-tertiary mb-1">Message</p>
                        <p className="text-xs text-text-secondary">{resource.message}</p>
                      </div>
                    )}

                    {/* Conditions */}
                    {resource.conditions && resource.conditions.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase text-text-tertiary mb-2">Conditions</p>
                        <div className="space-y-2">
                          {resource.conditions.map((cond, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-3 p-3 rounded-xl bg-bg-card border border-border-main"
                            >
                              <span className={`mt-0.5 ${cond.status === 'True' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {cond.status === 'True' ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <AlertCircle className="w-4 h-4" />
                                )}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold text-text-primary">{cond.type}</span>
                                  <span className="text-[10px] text-text-tertiary">{cond.status}</span>
                                </div>
                                {cond.reason && (
                                  <p className="text-[10px] text-text-secondary">{cond.reason}</p>
                                )}
                                {cond.message && (
                                  <p className="text-[10px] text-text-secondary mt-1">{cond.message}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sync Errors */}
                    {resource.syncErrors && resource.syncErrors.length > 0 && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                          <span className="text-sm font-bold text-rose-500">Sync Errors</span>
                        </div>
                        <ul className="space-y-1">
                          {resource.syncErrors.map((err, i) => (
                            <li key={i} className="text-xs text-rose-400 flex items-start gap-2">
                              <span className="mt-1">•</span>
                              {err}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Misconfigurations */}
                    {resource.misconfigurations && resource.misconfigurations.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-bold text-amber-500">Misconfigurations</span>
                        </div>
                        <ul className="space-y-1">
                          {resource.misconfigurations.map((m, i) => (
                            <li key={i} className="text-xs text-amber-400 flex items-start gap-2">
                              <span className="mt-1">•</span>
                              {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Resource Stats (ArgoCD only) */}
                    {resource.tool === 'ArgoCD' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-bg-hover">
                          <p className="text-[10px] font-black uppercase text-text-tertiary mb-1">Resources</p>
                          <p className="text-xl font-bold text-text-primary">
                            {resource.readyResources}/{resource.resourceCount}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-bg-hover">
                          <p className="text-[10px] font-black uppercase text-text-tertiary mb-1">Health</p>
                          <p className="text-xl font-bold text-text-primary">
                            {resource.healthStatus}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
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
