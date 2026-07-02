import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Globe, Server, AlertTriangle, CheckCircle2, XCircle,
  DollarSign, Box, RefreshCw,
  ArrowUpRight, Clock, AlertCircle, Minus, BarChart3,
  Search, Filter, X
} from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { ClusterStatus, AggregatedWorkload, CrossClusterIncident, GlobalSummary } from '../types';
import { MultiClusterIncidentsList } from './MultiClusterIncidentsList';
import { StatusBadge } from './dashboard/StatusBadge';

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
  primary: '#00c8f0',
  success: '#2ecc71',
  warning: '#f5a623',
  danger: '#e74c3c',
  info: '#4fc1ff'
};

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'healthy': case 'ready': return <CheckCircle2 className="w-5 h-5 text-success" />;
    case 'degraded': case 'warning': return <AlertTriangle className="w-5 h-5 text-warning" />;
    case 'offline': case 'critical': return <XCircle className="w-5 h-5 text-danger" />;
    default: return <Minus className="w-5 h-5 text-text-tertiary" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'healthy': return 'text-success';
    case 'degraded': return 'text-warning';
    case 'offline': return 'text-danger';
    default: return 'text-text-tertiary';
  }
};

const getStatusBg = (status: string) => {
  switch (status.toLowerCase()) {
    case 'healthy': return 'bg-success/10 border-success/20';
    case 'degraded': return 'bg-warning/10 border-warning/20';
    case 'offline': return 'bg-danger/10 border-danger/20';
    default: return 'bg-text-tertiary/10 border-border-main';
  }
};

const summaryCard = (label: string, value: React.ReactNode, sub: React.ReactNode, icon: React.ElementType, iconColor: string) => (
  <div className="kt-panel p-4">
    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-[11px] font-sans font-semibold text-text-tertiary mb-1">{label}</p>
        <p className="text-3xl font-bold text-text-primary">{value}</p>
        <p className="text-xs mt-1 font-sans">{sub}</p>
      </div>
      <div className={`p-2.5 bg-bg-main border border-border-main ${iconColor}`}>
        <icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

const tooltipStyle = {
  backgroundColor: 'var(--kt-bg-card)',
  borderColor: 'var(--kt-border-main)',
  color: 'var(--kt-fg-primary)',
  borderRadius: '2px',
  border: '1px solid var(--kt-border-main)',
  fontSize: '12px',
  fontWeight: '700',
  padding: '8px 12px',
  fontFamily: 'var(--font-sans)',
  boxShadow: 'var(--kt-shadow-lg)'
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
      if (selectedClusterIds.length > 0) params.set('clusters', selectedClusterIds.join(','));
      const url = `/api/clusters/aggregate${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setLastRefresh(new Date());
      }
    } catch (error) { console.error('Failed to fetch multi-cluster data:', error); }
    finally { setLoading(false); }
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
    return data.incidents.filter(i => (i.affectedClusters || []).some(id => selectedClusterIds.includes(id)));
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
      totalClusters: clusters.length, healthyClusters, degradedClusters, offlineClusters,
      totalWorkloads: workloads.length, healthyWorkloads, warningWorkloads, criticalWorkloads,
      activeIncidents: incidents.length, criticalIncidents,
      totalCpu, totalMemory,
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
        const cpuCost = c.totalCpu * 0.05;
        const memCost = (c.totalMemory / 1024) * 0.0065;
        return sum + cpuCost + memCost;
      }, 0)
    };
  }, [data, selectedClusterIds, derivedSummary, visibleClusters]);

  const filteredWorkloads = useMemo(() => {
    return visibleWorkloads.filter(w => {
      const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) || w.clusterName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || w.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [visibleWorkloads, searchTerm, statusFilter]);

  const clusterHealthData = useMemo(() => visibleClusters.map(c => ({ name: c.name, nodes: c.nodeCount, healthy: c.healthyNodeCount, utilization: c.totalCpu > 0 ? (c.usedCpu / c.totalCpu) * 100 : 0 })), [visibleClusters]);
  const workloadDistribution = useMemo(() => {
    const byCluster: Record<string, number> = {};
    visibleWorkloads.forEach(w => { byCluster[w.clusterName] = (byCluster[w.clusterName] || 0) + 1; });
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

  if (loading && !data) return (
    <div className="flex flex-col items-center justify-center min-h-[600px]">
      <div className="p-6 bg-bg-hover border border-border-main mb-6 animate-pulse">
        <Globe className="w-12 h-12 text-primary-500" />
      </div>
      <h2 className="font-sans text-2xl font-bold text-text-primary mb-2">Loading multi-cluster view</h2>
      <p className="text-text-tertiary font-sans">Aggregating data from all connected clusters...</p>
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-[600px]">
      <AlertCircle className="w-12 h-12 text-danger mb-4" />
      <h2 className="font-sans text-xl font-bold text-text-primary mb-2">Failed to load data</h2>
      <p className="text-text-tertiary mb-4 font-sans">Could not fetch multi-cluster information</p>
      <button onClick={fetchData} className="kt-button kt-button-primary">
        <RefreshCw className="w-4 h-4" /> Retry
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 p-0 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="font-sans text-2xl font-bold text-text-primary flex items-center gap-3">
            <Globe className="w-7 h-7 text-primary-500" />
            Multi-cluster federation
          </h1>
          <p className="text-text-tertiary text-sm mt-1 font-sans">
            {summary?.totalClusters ?? 0} clusters • {summary?.totalWorkloads ?? 0} workloads
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-bg-card border border-border-main p-0.5">
            {(['overview', 'workloads', 'incidents'] as const).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1.5 text-xs font-sans font-semibold border transition-all ${viewMode === mode ? 'bg-primary-500/10 text-primary-500 border-primary-500/30' : 'text-text-tertiary hover:text-text-primary border-transparent'}`}>
                {mode}
              </button>
            ))}
          </div>
          <button onClick={fetchData} disabled={loading} className="kt-button kt-button-secondary kt-button-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCard('Clusters', summary?.totalClusters ?? 0, <span className="text-success">{summary?.healthyClusters ?? 0} healthy</span>, Server, 'text-success')}
        {summaryCard('Workloads', summary?.totalWorkloads ?? 0, <span className="text-warning">{(summary?.warningWorkloads ?? 0) + (summary?.criticalWorkloads ?? 0)} need attention</span>, Box, 'text-primary-500')}
        {summaryCard('Active incidents', summary?.activeIncidents ?? 0, <span className={(summary?.criticalIncidents ?? 0) > 0 ? 'text-danger' : 'text-success'}>{summary?.criticalIncidents ?? 0} critical</span>, AlertTriangle, (summary?.criticalIncidents ?? 0) > 0 ? 'text-danger' : 'text-success')}
        {summaryCard('Monthly cost', `$${(summary?.estimatedMonthlyCost ?? 0).toFixed(0)}`, <span>{selectedClusterIds.length === 0 ? 'Across all clusters' : `Across ${selectedClusterIds.length} selected`}</span>, DollarSign, 'text-warning')}
      </div>

      {viewMode === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleClusters.map((cluster) => (
              <div key={cluster.id} onClick={() => setSelectedCluster(selectedCluster === cluster.id ? null : cluster.id)} className={`kt-panel p-4 cursor-pointer transition-all ${selectedCluster === cluster.id ? 'border-primary-500 kt-cyan-glow' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-3 relative z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 shrink-0 border ${getStatusBg(cluster.status)}`}>
                      <Server className={`w-5 h-5 ${getStatusColor(cluster.status)}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-sans font-semibold text-text-primary truncate">{cluster.displayName || cluster.name}</h3>
                      <p className="text-xs text-text-tertiary font-sans">{cluster.provider} • {cluster.region}</p>
                    </div>
                  </div>
                  <StatusBadge status={cluster.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3 relative z-10">
                  <div className="text-center p-2 border border-border-main bg-bg-main">
                    <p className="text-[10px] text-text-tertiary font-sans font-medium">Nodes</p>
                    <p className="font-bold text-text-primary font-sans">{cluster.healthyNodeCount}/{cluster.nodeCount}</p>
                  </div>
                  <div className="text-center p-2 border border-border-main bg-bg-main">
                    <p className="text-[10px] text-text-tertiary font-sans font-medium">Workloads</p>
                    <p className="font-bold text-text-primary font-sans">{cluster.workloadCount}</p>
                  </div>
                  <div className="text-center p-2 border border-border-main bg-bg-main">
                    <p className="text-[10px] text-text-tertiary font-sans font-medium">Incidents</p>
                    <p className={`font-bold ${cluster.incidentCount > 0 ? 'text-danger' : 'text-success'} font-sans`}>{cluster.incidentCount}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs relative z-10 font-sans">
                  <span className="text-text-tertiary">v{cluster.version}</span>
                  <span className="text-text-tertiary">Last seen: {new Date(cluster.lastConnected).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="kt-panel p-5">
              <div className="kt-panel-header mb-4 -mx-5 -mt-5">
                <BarChart3 className="w-4 h-4 text-primary-500" /> Cluster utilization
              </div>
              <div className="h-[250px] relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clusterHealthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--kt-border-main)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--kt-fg-tertiary)', fontSize: 10 }} />
                    <YAxis tick={{ fill: 'var(--kt-fg-tertiary)', fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="nodes" name="Total Nodes" fill={COLORS.primary} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="healthy" name="Healthy" fill={COLORS.success} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="kt-panel p-5">
              <div className="kt-panel-header mb-4 -mx-5 -mt-5">
                <AlertTriangle className="w-4 h-4 text-primary-500" /> Workload status distribution
              </div>
              <div className="h-[250px] flex items-center justify-center relative z-10">
                {statusDistribution.some(s => s.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={3} dataKey="value" stroke="var(--kt-bg-card)" strokeWidth={2}>
                        {statusDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value} workloads`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-text-tertiary font-sans">No workload data available</p>}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-text-primary">{summary?.totalWorkloads ?? 0}</span>
                  <span className="text-[10px] text-text-tertiary font-sans font-medium">Workloads</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 relative z-10">
                {statusDistribution.filter(s => s.value > 0).map(s => (
                  <div key={s.name} className="flex flex-col items-center gap-1 p-2 border border-border-main bg-bg-main">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[10px] font-sans font-semibold text-text-secondary">{s.name}</span>
                    </div>
                    <span className="text-lg font-bold" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {visibleIncidents.length > 0 && <MultiClusterIncidentsList incidents={visibleIncidents} />}
        </>
      )}

      {viewMode === 'workloads' && (
        <div className="kt-panel overflow-hidden">
          <div className="kt-panel-header">
            <span>All workloads ({filteredWorkloads.length})</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input type="text" placeholder="Search workloads..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="kt-input pl-9 pr-3 py-1.5 text-xs w-48" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="kt-select text-xs py-1.5">
                <option value="all">All status</option>
                <option value="healthy">Healthy</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="p-4 relative z-10">
            <div className="grid gap-2">
              {filteredWorkloads.slice(0, 50).map((workload) => (
                <div key={workload.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-border-main bg-bg-main hover:border-primary-500/30 transition-all gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 shrink-0 border ${getStatusBg(workload.status)}`}>{getStatusIcon(workload.status)}</div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-text-primary truncate">{workload.name}</h4>
                      <p className="text-xs text-text-tertiary font-sans">{workload.namespace} • {workload.kind} • {workload.clusterName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 shrink-0 ml-10 sm:ml-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-text-primary">{workload.availableReplicas}/{workload.replicas}</p>
                      <p className="text-[10px] text-text-tertiary font-sans font-medium">Replicas</p>
                    </div>
                    <button className="p-2 border border-border-main hover:border-primary-500/30 hover:text-primary-500 text-text-tertiary transition-colors"><ArrowUpRight className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            {filteredWorkloads.length > 50 && <p className="text-center text-text-tertiary text-sm mt-4 font-sans font-medium">Showing 50 of {filteredWorkloads.length} workloads</p>}
          </div>
        </div>
      )}

      {viewMode === 'incidents' && <MultiClusterIncidentsList incidents={visibleIncidents} />}

      <div className="flex items-center justify-center gap-2 text-text-tertiary text-xs font-sans font-medium">
        <Clock className="w-3 h-3" /> Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};
