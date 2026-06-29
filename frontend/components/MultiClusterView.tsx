import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Globe, Server, AlertTriangle, CheckCircle2, XCircle,
  DollarSign, Box, RefreshCw,
  ArrowUpRight, Clock, AlertCircle, Minus, BarChart3,
  Search, Filter, X
} from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { ClusterStatus, AggregatedWorkload, CrossClusterIncident, GlobalSummary } from '../types';
import { MultiClusterIncidentsList } from './MultiClusterIncidentsList';

interface CorrelatedEvent {
  id: string;
  eventType: string;
  message: string;
  clusters: string[];
  count: number;
  firstSeen: string;
  lastSeen: string;
  correlationScore: number;
}

interface MultiClusterData {
  timestamp: string;
  clusters: ClusterStatus[];
  workloads: AggregatedWorkload[];
  incidents: CrossClusterIncident[];
  summary: GlobalSummary;
  correlatedEvents: CorrelatedEvent[];
}

const COLORS = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#f43f5e',
  info: '#3b82f6'
};

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'ready':
      return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    case 'degraded':
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    case 'offline':
    case 'critical':
      return <XCircle className="w-5 h-5 text-rose-500" />;
    default:
      return <Minus className="w-5 h-5 text-text-tertiary" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'healthy': return 'text-emerald-500';
    case 'degraded': return 'text-amber-500';
    case 'offline': return 'text-rose-500';
    default: return 'text-text-tertiary';
  }
};

const getStatusBg = (status: string) => {
  switch (status.toLowerCase()) {
    case 'healthy': return 'bg-emerald-500/10';
    case 'degraded': return 'bg-amber-500/10';
    case 'offline': return 'bg-rose-500/10';
    default: return 'bg-text-tertiary/10';
  }
};

export const MultiClusterView: React.FC = () => {
  const { selectedClusterIds } = useMonitoring();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MultiClusterData | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'workloads' | 'incidents'>('overview');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClusterIds.length > 0) {
        params.set('clusters', selectedClusterIds.join(','));
      }
      const url = `/api/clusters/aggregate${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch multi-cluster data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedClusterIds]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [selectedClusterIds]);

  const visibleClusters = useMemo(() => {
    if (!data) return [];
    if (selectedClusterIds.length === 0) return data.clusters;
    return data.clusters.filter(c => selectedClusterIds.includes(c.id));
  }, [data, selectedClusterIds]);

  const visibleWorkloads = useMemo(() => {
    if (!data || !data.workloads) return [];
    if (selectedClusterIds.length === 0) return data.workloads;
    return data.workloads.filter(w => selectedClusterIds.includes(w.clusterId));
  }, [data, selectedClusterIds]);

  const visibleIncidents = useMemo(() => {
    if (!data || !data.incidents) return [];
    if (selectedClusterIds.length === 0) return data.incidents;
    return data.incidents.filter(i =>
      (i.affectedClusters || []).some(id => selectedClusterIds.includes(id))
    );
  }, [data, selectedClusterIds]);

  const derivedSummary = useMemo(() => {
    if (!data) return null;
    const clusters = visibleClusters;
    const workloads = visibleWorkloads;
    const incidents = visibleIncidents;
    const healthyClusters = clusters.filter(c => c.status.toLowerCase() === 'healthy').length;
    const degradedClusters = clusters.filter(c => c.status.toLowerCase() === 'degraded').length;
    const offlineClusters = clusters.filter(c => c.status.toLowerCase() === 'offline').length;
    const healthyWorkloads = workloads.filter(w => w.status === 'Healthy').length;
    const warningWorkloads = workloads.filter(w => w.status === 'Warning').length;
    const criticalWorkloads = workloads.filter(w => w.status === 'Critical').length;
    const criticalIncidents = incidents.filter(i => i.severity === 'Critical').length;
    const totalCpu = clusters.reduce((sum, c) => sum + c.totalCpu, 0);
    const usedCpu = clusters.reduce((sum, c) => sum + c.usedCpu, 0);
    const totalMemory = clusters.reduce((sum, c) => sum + c.totalMemory, 0);
    const usedMemory = clusters.reduce((sum, c) => sum + c.usedMemory, 0);
    return {
      totalClusters: clusters.length,
      healthyClusters,
      degradedClusters,
      offlineClusters,
      totalWorkloads: workloads.length,
      healthyWorkloads,
      warningWorkloads,
      criticalWorkloads,
      activeIncidents: incidents.length,
      criticalIncidents,
      totalCpu,
      totalMemory,
      cpuUtilization: totalCpu > 0 ? (usedCpu / totalCpu) * 100 : 0,
      memoryUtilization: totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0,
      estimatedMonthlyCost: 0
    };
  }, [visibleClusters, visibleWorkloads, visibleIncidents, data]);

  const summary = useMemo(() => {
    if (!data) return null;
    if (selectedClusterIds.length === 0) return data.summary;
    const s = derivedSummary;
    if (!s) return data.summary;
    return {
      ...s,
      estimatedMonthlyCost: visibleClusters.reduce((sum, c) => {
        // rough cost proxy: $0.05 / vCPU + $0.0065 / GB-month
        const cpuCost = c.totalCpu * 0.05;
        const memCost = (c.totalMemory / 1024) * 0.0065;
        return sum + cpuCost + memCost;
      }, 0)
    };
  }, [data, selectedClusterIds, derivedSummary, visibleClusters]);

  const filteredWorkloads = useMemo(() => {
    return visibleWorkloads.filter(w => {
      const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           w.clusterName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || w.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [visibleWorkloads, searchTerm, statusFilter]);

  const clusterHealthData = useMemo(() => {
    return visibleClusters.map(c => ({
      name: c.name,
      nodes: c.nodeCount,
      healthy: c.healthyNodeCount,
      utilization: c.totalCpu > 0 ? (c.usedCpu / c.totalCpu) * 100 : 0
    }));
  }, [visibleClusters]);

  const workloadDistribution = useMemo(() => {
    const byCluster: Record<string, number> = {};
    visibleWorkloads.forEach(w => {
      byCluster[w.clusterName] = (byCluster[w.clusterName] || 0) + 1;
    });
    return Object.entries(byCluster).map(([name, value]) => ({ name, value }));
  }, [visibleWorkloads]);

  const statusDistribution = useMemo(() => {
    if (!summary) return [];
    return [
      { name: 'Healthy', value: summary.healthyWorkloads, color: COLORS.success },
      { name: 'Warning', value: summary.warningWorkloads, color: COLORS.warning },
      { name: 'Critical', value: summary.criticalWorkloads, color: COLORS.danger }
    ];
  }, [summary]);


  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <div className="p-6 bg-bg-hover rounded-full mb-6 animate-pulse">
          <Globe className="w-12 h-12 text-primary-500" />
        </div>
        <h2 className="text-2xl font-black text-text-primary   mb-2">
          Loading Multi-Cluster View
        </h2>
        <p className="text-text-tertiary">Aggregating data from all connected clusters...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-black text-text-primary mb-2">Failed to Load Data</h2>
        <p className="text-text-tertiary mb-4">Could not fetch multi-cluster information</p>
        <button onClick={fetchData} className="kt-button kt-button-primary">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 font-sans animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-primary   flex items-center gap-3">
            <Globe className="w-7 h-7 text-primary-500" />
            Multi-Cluster Federation
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            Unified view across {summary?.totalClusters ?? 0} clusters • {summary?.totalWorkloads ?? 0} workloads
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-bg-card rounded-xl border border-border-main p-1">
            {(['overview', 'workloads', 'incidents'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg text-sm font-bold  transition-all ${
                  viewMode === mode
                    ? 'bg-primary-600 text-white'
                    : 'text-text-tertiary hover:text-text-primary'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
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

      {/* Global Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold   text-text-tertiary mb-1">Clusters</p>
              <p className="text-3xl font-black text-text-primary">{summary?.totalClusters ?? 0}</p>
              <p className="text-xs text-emerald-500 font-semibold mt-1">
                {summary?.healthyClusters ?? 0} healthy
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <Server className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold   text-text-tertiary mb-1">Workloads</p>
              <p className="text-3xl font-black text-text-primary">{summary?.totalWorkloads ?? 0}</p>
              <p className="text-xs text-amber-500 font-semibold mt-1">
                {(summary?.warningWorkloads ?? 0) + (summary?.criticalWorkloads ?? 0)} need attention
              </p>
            </div>
            <div className="p-3 rounded-xl bg-primary-500/10">
              <Box className="w-5 h-5 text-primary-500" />
            </div>
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold   text-text-tertiary mb-1">Active Incidents</p>
              <p className="text-3xl font-black text-text-primary">{summary?.activeIncidents ?? 0}</p>
              <p className={`text-xs font-semibold mt-1 ${(summary?.criticalIncidents ?? 0) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {summary?.criticalIncidents ?? 0} critical
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold   text-text-tertiary mb-1">Monthly Cost</p>
              <p className="text-3xl font-black text-text-primary">
                ${(summary?.estimatedMonthlyCost ?? 0).toFixed(0)}
              </p>
              <p className="text-xs text-text-tertiary font-semibold mt-1">
                {selectedClusterIds.length === 0 ? 'Across all clusters' : `Across ${selectedClusterIds.length} selected cluster${selectedClusterIds.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10">
              <DollarSign className="w-5 h-5 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Cluster Health Overview */}
      {viewMode === 'overview' && (
        <>
          {/* Cluster Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleClusters.map((cluster) => (
              <div
                key={cluster.id}
                className={`bg-bg-card rounded-2xl p-5 border-2 cursor-pointer transition-all ${
                  selectedCluster === cluster.id
                    ? 'border-primary-500 bg-primary-500/5'
                    : 'border-border-main hover:border-primary-500/30'
                }`}
                onClick={() => setSelectedCluster(selectedCluster === cluster.id ? null : cluster.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 ${getStatusBg(cluster.status)}`}>
                      <Server className={`w-5 h-5 ${getStatusColor(cluster.status)}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-text-primary truncate">{cluster.displayName || cluster.name}</h3>
                      <p className="text-xs text-text-tertiary truncate">{cluster.provider} • {cluster.region}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-semibold shrink-0 ${getStatusBg(cluster.status)} ${getStatusColor(cluster.status)}`}>
                    {cluster.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 rounded-lg bg-bg-hover">
                    <p className="text-[10px] text-text-tertiary ">Nodes</p>
                    <p className="font-bold text-text-primary">{cluster.healthyNodeCount}/{cluster.nodeCount}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-bg-hover">
                    <p className="text-[10px] text-text-tertiary ">Workloads</p>
                    <p className="font-bold text-text-primary">{cluster.workloadCount}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-bg-hover">
                    <p className="text-[10px] text-text-tertiary ">Incidents</p>
                    <p className={`font-bold ${cluster.incidentCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {cluster.incidentCount}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-tertiary">v{cluster.version}</span>
                  <span className="text-text-tertiary">
                    Last seen: {new Date(cluster.lastConnected).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cluster Utilization Chart */}
            <div className="bg-bg-card rounded-3xl border border-border-main p-6">
              <h3 className="text-sm font-black   text-text-primary mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary-500" />
                Cluster Utilization
              </h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clusterHealthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--kt-border-main)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--kt-fg-tertiary)', fontSize: 10 }} />
                    <YAxis tick={{ fill: 'var(--kt-fg-tertiary)', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--kt-bg-card)',
                        border: '1px solid var(--kt-border-main)',
                        borderRadius: '12px',
                        color: 'var(--kt-fg-primary)'
                      }}
                    />
                    <Bar dataKey="nodes" name="Total Nodes" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="healthy" name="Healthy" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Workload Status Distribution */}
            <div className="bg-bg-card rounded-3xl border border-border-main p-6">
              <h3 className="text-sm font-black   text-text-primary mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary-500" />
                Workload Status Distribution
              </h3>
              <div className="h-[250px] flex items-center justify-center relative">
                {statusDistribution.some(s => s.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="var(--kt-bg-card)"
                        strokeWidth={2}
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value} workloads`, name]}
                        contentStyle={{
                          backgroundColor: 'var(--kt-bg-card)',
                          border: '1px solid var(--kt-border-main)',
                          borderRadius: '12px',
                          color: 'var(--kt-fg-primary)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-text-tertiary">No workload data available</p>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-text-primary">{summary?.totalWorkloads ?? 0}</span>
                  <span className="text-[10px] text-text-tertiary">Workloads</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {statusDistribution.filter(s => s.value > 0).map(s => (
                  <div key={s.name} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-bg-hover/50 border border-border-main">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[10px] font-semibold text-text-secondary">{s.name}</span>
                    </div>
                    <span className="text-lg font-bold" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cross-Cluster Incidents */}
          {visibleIncidents.length > 0 && (
            <MultiClusterIncidentsList incidents={visibleIncidents} />
          )}
        </>
      )}

      {/* Workloads View */}
      {viewMode === 'workloads' && (
        <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
          <div className="p-6 border-b border-border-main bg-bg-hover/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-sm font-black   text-text-primary">
                All Workloads ({filteredWorkloads.length})
              </h3>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <input
                    type="text"
                    placeholder="Search workloads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="kt-input pl-10 pr-4 text-xs"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="kt-select text-xs"
                >
                  <option value="all">All Status</option>
                  <option value="healthy">Healthy</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid gap-4">
              {filteredWorkloads.slice(0, 50).map((workload) => (
                <div
                  key={workload.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border-main bg-bg-hover/30 hover:border-primary-500/30 transition-all gap-3"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${getStatusBg(workload.status)}`}>
                      {getStatusIcon(workload.status)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-text-primary truncate">{workload.name}</h4>
                      <p className="text-xs text-text-tertiary truncate">
                        {workload.namespace} • {workload.kind} • {workload.clusterName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 ml-11 sm:ml-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-text-primary">
                        {workload.availableReplicas}/{workload.replicas}
                      </p>
                      <p className="text-[10px] text-text-tertiary ">Replicas</p>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-primary-500 transition-colors">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {filteredWorkloads.length > 50 && (
              <p className="text-center text-text-tertiary text-sm mt-4">
                Showing 50 of {filteredWorkloads.length} workloads
              </p>
            )}
          </div>
        </div>
      )}

      {/* Incidents View */}
      {viewMode === 'incidents' && (
        <MultiClusterIncidentsList incidents={visibleIncidents} />
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 text-text-tertiary text-xs">
        <Clock className="w-3 h-3" />
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};
