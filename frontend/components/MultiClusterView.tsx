import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe, Server, Activity, AlertTriangle, CheckCircle2, XCircle,
  ArrowRight, TrendingUp, Cpu, MemoryStick, DollarSign, Box,
  ChevronDown, ChevronUp, RefreshCw, Layers, Zap, MapPin,
  ArrowUpRight, Clock, AlertCircle, Minus, BarChart3, Grid3X3,
  Search, Filter, Download, Shield, Info
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { ClusterStatus, AggregatedWorkload, CrossClusterIncident, GlobalSummary } from '../types';

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

export const MultiClusterView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MultiClusterData | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'workloads' | 'incidents'>('overview');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/clusters/aggregate');
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
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredWorkloads = useMemo(() => {
    if (!data) return [];
    return data.workloads.filter(w => {
      const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           w.clusterName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || w.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [data, searchTerm, statusFilter]);

  const clusterHealthData = useMemo(() => {
    if (!data) return [];
    return data.clusters.map(c => ({
      name: c.name,
      nodes: c.nodeCount,
      healthy: c.healthyNodeCount,
      utilization: c.totalCpu > 0 ? (c.usedCpu / c.totalCpu) * 100 : 0
    }));
  }, [data]);

  const workloadDistribution = useMemo(() => {
    if (!data) return [];
    const byCluster: Record<string, number> = {};
    data.workloads.forEach(w => {
      byCluster[w.clusterName] = (byCluster[w.clusterName] || 0) + 1;
    });
    return Object.entries(byCluster).map(([name, value]) => ({ name, value }));
  }, [data]);

  const statusDistribution = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Healthy', value: data.summary.healthyWorkloads, color: COLORS.success },
      { name: 'Warning', value: data.summary.warningWorkloads, color: COLORS.warning },
      { name: 'Critical', value: data.summary.criticalWorkloads, color: COLORS.danger }
    ];
  }, [data]);

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
        return <Minus className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return 'text-emerald-500';
      case 'degraded': return 'text-amber-500';
      case 'offline': return 'text-rose-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return 'bg-emerald-500/10';
      case 'degraded': return 'bg-amber-500/10';
      case 'offline': return 'bg-rose-500/10';
      default: return 'bg-gray-500/10';
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <div className="p-6 bg-bg-hover rounded-full mb-6 animate-pulse">
          <Globe className="w-12 h-12 text-primary-500" />
        </div>
        <h2 className="text-2xl font-black text-text-primary uppercase tracking-tighter mb-2">
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
    <div className="flex flex-col gap-6 p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-primary uppercase tracking-tighter flex items-center gap-3">
            <Globe className="w-7 h-7 text-primary-500" />
            Multi-Cluster Federation
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            Unified view across {data.summary.totalClusters} clusters • {data.summary.totalWorkloads} workloads
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-bg-card rounded-xl border border-border-main p-1">
            {(['overview', 'workloads', 'incidents'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${
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
              <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">Clusters</p>
              <p className="text-3xl font-black text-text-primary">{data.summary.totalClusters}</p>
              <p className="text-xs text-emerald-500 font-semibold mt-1">
                {data.summary.healthyClusters} healthy
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
              <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">Workloads</p>
              <p className="text-3xl font-black text-text-primary">{data.summary.totalWorkloads}</p>
              <p className="text-xs text-amber-500 font-semibold mt-1">
                {data.summary.warningWorkloads + data.summary.criticalWorkloads} need attention
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
              <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">Active Incidents</p>
              <p className="text-3xl font-black text-text-primary">{data.summary.activeIncidents}</p>
              <p className={`text-xs font-semibold mt-1 ${data.summary.criticalIncidents > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {data.summary.criticalIncidents} critical
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
              <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">Monthly Cost</p>
              <p className="text-3xl font-black text-text-primary">
                ${data.summary.estimatedMonthlyCost.toFixed(0)}
              </p>
              <p className="text-xs text-text-tertiary font-semibold mt-1">
                Across all clusters
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
            {data.clusters.map((cluster) => (
              <div
                key={cluster.id}
                className={`bg-bg-card rounded-2xl p-5 border-2 cursor-pointer transition-all ${
                  selectedCluster === cluster.id
                    ? 'border-primary-500 bg-primary-500/5'
                    : 'border-border-main hover:border-primary-500/30'
                }`}
                onClick={() => setSelectedCluster(selectedCluster === cluster.id ? null : cluster.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${getStatusBg(cluster.status)}`}>
                      <Server className={`w-5 h-5 ${getStatusColor(cluster.status)}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-text-primary">{cluster.name}</h3>
                      <p className="text-xs text-text-tertiary">{cluster.provider} • {cluster.region}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${getStatusBg(cluster.status)} ${getStatusColor(cluster.status)}`}>
                    {cluster.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 rounded-lg bg-bg-hover">
                    <p className="text-[10px] text-text-tertiary uppercase">Nodes</p>
                    <p className="font-bold text-text-primary">{cluster.healthyNodeCount}/{cluster.nodeCount}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-bg-hover">
                    <p className="text-[10px] text-text-tertiary uppercase">Workloads</p>
                    <p className="font-bold text-text-primary">{cluster.workloadCount}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-bg-hover">
                    <p className="text-[10px] text-text-tertiary uppercase">Incidents</p>
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
              <h3 className="text-sm font-black uppercase tracking-widest text-text-primary mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary-500" />
                Cluster Utilization
              </h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clusterHealthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '12px'
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
              <h3 className="text-sm font-black uppercase tracking-widest text-text-primary mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary-500" />
                Workload Status Distribution
              </h3>
              <div className="h-[250px] flex items-center justify-center">
                {statusDistribution.some(s => s.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '12px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-text-tertiary">No workload data available</p>
                )}
              </div>
              <div className="flex justify-center gap-6 mt-4">
                {statusDistribution.filter(s => s.value > 0).map(s => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-text-secondary">{s.name}: {s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cross-Cluster Incidents */}
          {data.incidents.length > 0 && (
            <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
              <div className="p-6 border-b border-border-main bg-bg-hover/50">
                <h3 className="text-sm font-black uppercase tracking-widest text-text-primary flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  Cross-Cluster Incidents ({data.incidents.length})
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {data.incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="p-4 rounded-xl border-2 border-rose-500/20 bg-rose-500/5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-text-primary flex items-center gap-2">
                          {incident.pattern === 'Cascading' && (
                            <span className="px-2 py-0.5 rounded bg-rose-500 text-white text-[10px] font-black">
                              CASCADING
                            </span>
                          )}
                          {incident.title}
                        </h4>
                        <p className="text-sm text-text-secondary mt-1">{incident.description}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                        incident.severity === 'Critical' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {incident.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-tertiary">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {incident.affectedClusters.length} clusters affected
                      </span>
                      <span className="flex items-center gap-1">
                        <Box className="w-3 h-3" />
                        {incident.affectedWorkloads.length} workloads
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Started {new Date(incident.startedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Workloads View */}
      {viewMode === 'workloads' && (
        <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
          <div className="p-6 border-b border-border-main bg-bg-hover/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">
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
                  className="flex items-center justify-between p-4 rounded-xl border border-border-main bg-bg-hover/30 hover:border-primary-500/30 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${getStatusBg(workload.status)}`}>
                      {getStatusIcon(workload.status)}
                    </div>
                    <div>
                      <h4 className="font-bold text-text-primary">{workload.name}</h4>
                      <p className="text-xs text-text-tertiary">
                        {workload.namespace} • {workload.kind} • {workload.clusterName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-bold text-text-primary">
                        {workload.availableReplicas}/{workload.replicas}
                      </p>
                      <p className="text-[10px] text-text-tertiary uppercase">Replicas</p>
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
        <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
          <div className="p-6 border-b border-border-main bg-bg-hover/50">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">
              All Incidents ({data.incidents.length})
            </h3>
          </div>
          <div className="p-6">
            {data.incidents.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-text-primary mb-2">No Cross-Cluster Incidents</h4>
                <p className="text-text-tertiary">All systems operating normally across clusters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="p-5 rounded-xl border-2 border-rose-500/20 bg-rose-500/5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-text-primary text-lg">{incident.title}</h4>
                        <p className="text-sm text-text-secondary mt-1">{incident.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                          incident.severity === 'Critical' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {incident.severity}
                        </span>
                        <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase bg-bg-hover text-text-secondary">
                          {incident.pattern}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-bold text-text-tertiary uppercase mb-2">Affected Clusters</p>
                        <div className="flex flex-wrap gap-2">
                          {incident.affectedClusters.map((clusterId) => (
                            <span
                              key={clusterId}
                              className="px-2 py-1 rounded-lg bg-bg-card border border-border-main text-xs font-medium"
                            >
                              {clusterId}
                            </span>
                          ))}
                        </div>
                      </div>
                      {incident.rootCause && (
                        <div className="p-3 rounded-lg bg-bg-hover">
                          <p className="text-xs font-bold text-text-tertiary uppercase mb-1">Root Cause</p>
                          <p className="text-sm text-text-secondary">{incident.rootCause}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 text-text-tertiary text-xs">
        <Clock className="w-3 h-3" />
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};
