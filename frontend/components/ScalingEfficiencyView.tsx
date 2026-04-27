import React, { useState, useEffect, useMemo } from 'react';
import { KarpenterEfficiencyMetrics, KEDAEfficiencyMetrics, HPAMetrics, EfficiencySummary, UnifiedProvisionerMetrics, UnifiedNodePool, NodeClaim, NodeClaimsSummary, NodeClaimsResponse } from '../types';
import {
  Zap, Activity, TrendingUp, AlertTriangle, CheckCircle2,
  Cpu, MemoryStick, Server, Clock, DollarSign, Gauge,
  ChevronDown, ChevronUp, RefreshCw, Scale, Box,
  ArrowUpRight, ArrowDownRight, Minus, Info, Cloud, CloudCog
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';

interface ScalingEfficiencyViewProps {
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

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899'];

// Helper function to format age from timestamp
const formatAge = (timestamp?: string): string => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d`;
  }
  return `${diffHours}h`;
};

export const ScalingEfficiencyView: React.FC<ScalingEfficiencyViewProps> = ({ clusterId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    karpenter: KarpenterEfficiencyMetrics[];
    keda: KEDAEfficiencyMetrics[];
    hpa: HPAMetrics[];
    summary: EfficiencySummary | null;
    unifiedProvisioners: UnifiedProvisionerMetrics[];
    detectedProvisioners: string[];
  }>({ karpenter: [], keda: [], hpa: [], summary: null, unifiedProvisioners: [], detectedProvisioners: [] });
  const [selectedNodePool, setSelectedNodePool] = useState<string | null>(null);
  const [selectedKEDAWorkload, setSelectedKEDAWorkload] = useState<string | null>(null);
  const [selectedHPA, setSelectedHPA] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedProvisionerType, setSelectedProvisionerType] = useState<string>('all');
  // Sort state for Node Pools, KEDA and HPA
  const [nodePoolSortBy, setNodePoolSortBy] = useState<'name' | 'totalCost' | 'utilization' | 'binPacking'>('name');
  const [nodePoolSortOrder, setNodePoolSortOrder] = useState<'asc' | 'desc'>('asc');
  const [kedaSortBy, setKedaSortBy] = useState<'name' | 'currentReplicas' | 'efficiency'>('currentReplicas');
  const [kedaSortOrder, setKedaSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hpaSortBy, setHpaSortBy] = useState<'name' | 'currentReplicas' | 'cpuUtilization'>('currentReplicas');
  const [hpaSortOrder, setHpaSortOrder] = useState<'asc' | 'desc'>('desc');

  // Node Claims state
  const [nodeClaims, setNodeClaims] = useState<NodeClaim[]>([]);
  const [nodeClaimsSummary, setNodeClaimsSummary] = useState<NodeClaimsSummary | null>(null);
  const [nodeClaimsLoading, setNodeClaimsLoading] = useState(false);
  const [selectedNodeClaim, setSelectedNodeClaim] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cluster/scaling-efficiency?cluster=${clusterId || ''}`);
      if (response.ok) {
        const result = await response.json();
        setData({
          karpenter: result.karpenterMetrics || [],
          keda: result.kedaMetrics || [],
          hpa: result.hpaMetrics || [],
          summary: result.summary || null,
          unifiedProvisioners: result.unifiedProvisioners || [],
          detectedProvisioners: result.detectedProvisioners || []
        });
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch scaling efficiency:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNodeClaims = async () => {
    setNodeClaimsLoading(true);
    try {
      const response = await fetch(`/api/cluster/node-claims?cluster=${clusterId || ''}`);
      if (response.ok) {
        const result: NodeClaimsResponse = await response.json();
        setNodeClaims(result.claims || []);
        setNodeClaimsSummary(result.summary || null);
      }
    } catch (error) {
      console.error('Failed to fetch node claims:', error);
    } finally {
      setNodeClaimsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchNodeClaims();
    const interval = setInterval(() => {
      fetchData();
      fetchNodeClaims();
    }, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [clusterId]);

  // Summary Cards Data
  const summaryCards = useMemo(() => {
    if (!data.summary) return [];

    return [
      {
        title: 'Node Pools',
        value: data.summary.totalNodePools,
        subtext: `${data.summary.totalCostOptimized} cost-optimized`,
        icon: Server,
        color: 'text-primary-500',
        bgColor: 'bg-primary-500/10'
      },
      {
        title: 'KEDA Scalers',
        value: data.summary.totalKedaScalers,
        subtext: 'Active auto-scaling',
        icon: Zap,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10'
      },
      {
        title: 'HPA Scalers',
        value: data.summary.totalHpaScalers,
        subtext: 'Native K8s scaling',
        icon: Scale,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10'
      },
      {
        title: 'Avg Utilization',
        value: `${data.summary.avgNodeUtilization.toFixed(1)}%`,
        subtext: data.summary.avgNodeUtilization > 70 ? 'Healthy' : 'Underutilized',
        icon: Activity,
        color: data.summary.avgNodeUtilization > 70 ? 'text-emerald-500' : 'text-amber-500',
        bgColor: data.summary.avgNodeUtilization > 70 ? 'bg-emerald-500/10' : 'bg-amber-500/10'
      },
      {
        title: 'Bin Packing',
        value: `${data.summary.avgBinPackingEfficiency.toFixed(1)}%`,
        subtext: 'Efficiency score',
        icon: Box,
        color: data.summary.avgBinPackingEfficiency > 80 ? 'text-emerald-500' : 'text-amber-500',
        bgColor: data.summary.avgBinPackingEfficiency > 80 ? 'bg-emerald-500/10' : 'bg-amber-500/10'
      },
      {
        title: 'Issues',
        value: data.summary.issuesFound,
        subtext: data.summary.issuesFound > 0 ? 'Requires attention' : 'All systems healthy',
        icon: AlertTriangle,
        color: data.summary.issuesFound > 0 ? 'text-rose-500' : 'text-emerald-500',
        bgColor: data.summary.issuesFound > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'
      }
    ];
  }, [data.summary]);

  // KEDA Efficiency Chart Data
  const kedaChartData = useMemo(() => {
    return data.keda.map(k => ({
      name: k.workloadName,
      efficiency: k.efficiencyScore,
      current: k.currentReplicas,
      min: k.minReplicas,
      max: k.maxReplicas
    }));
  }, [data.keda]);

  // Sorted KEDA data
  const sortedKeda = useMemo(() => {
    return [...data.keda].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      switch (kedaSortBy) {
        case 'name':
          aVal = a.workloadName;
          bVal = b.workloadName;
          break;
        case 'currentReplicas':
          aVal = a.currentReplicas;
          bVal = b.currentReplicas;
          break;
        case 'efficiency':
          aVal = a.efficiencyScore;
          bVal = b.efficiencyScore;
          break;
        default:
          aVal = a.currentReplicas;
          bVal = b.currentReplicas;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return kedaSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return kedaSortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [data.keda, kedaSortBy, kedaSortOrder]);

  // Sorted HPA data
  const sortedHpa = useMemo(() => {
    return [...data.hpa].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      switch (hpaSortBy) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'currentReplicas':
          aVal = a.currentReplicas;
          bVal = b.currentReplicas;
          break;
        case 'cpuUtilization':
          aVal = a.cpuUtilization?.currentUtilization || 0;
          bVal = b.cpuUtilization?.currentUtilization || 0;
          break;
        default:
          aVal = a.currentReplicas;
          bVal = b.currentReplicas;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return hpaSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return hpaSortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [data.hpa, hpaSortBy, hpaSortOrder]);

  const getEfficiencyColor = (score: number) => {
    if (score >= 80) return COLORS.success;
    if (score >= 60) return COLORS.warning;
    return COLORS.danger;
  };

  const getEfficiencyLabel = (score: number) => {
    if (score >= 80) return 'Optimal';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  // Helper function to get provider icon
  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'aws':
        return 'AWS';
      case 'azure':
        return 'Azure';
      case 'gcp':
        return 'GCP';
      default:
        return provider.toUpperCase();
    }
  };

  // Helper function to get provisioner display name
  const getProvisionerDisplayName = (type: string) => {
    switch (type) {
      case 'karpenter':
        return 'Karpenter';
      case 'azure-nap':
        return 'Azure NAP';
      case 'aks-managed':
        return 'AKS Managed';
      case 'cluster-autoscaler':
        return 'Cluster Autoscaler';
      default:
        return type;
    }
  };

  // Filter and sort node pools based on selected provisioner type and sort options
  const filteredNodePools = useMemo(() => {
    const pools: UnifiedNodePool[] = [];
    data.unifiedProvisioners.forEach(p => {
      if (selectedProvisionerType === 'all' || p.provisionerType === selectedProvisionerType) {
        pools.push(...p.nodePools);
      }
    });
    return pools.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (nodePoolSortBy) {
        case 'totalCost':
          aVal = a.totalMonthlyCost || 0;
          bVal = b.totalMonthlyCost || 0;
          break;
        case 'utilization':
          aVal = a.utilizationPercent;
          bVal = b.utilizationPercent;
          break;
        case 'binPacking':
          aVal = a.binPackingEfficiency;
          bVal = b.binPackingEfficiency;
          break;
        default:
          return nodePoolSortOrder === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
      }
      return nodePoolSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data.unifiedProvisioners, selectedProvisionerType, nodePoolSortBy, nodePoolSortOrder]);

  // Node Pool Chart Data
  const nodePoolChartData = useMemo(() => {
    return filteredNodePools.map(np => ({
      name: np.name,
      utilization: np.utilizationPercent,
      binPacking: np.binPackingEfficiency,
      totalNodes: np.totalNodes,
      readyNodes: np.readyNodes
    }));
  }, [filteredNodePools]);

  // Cost Analysis Data
  const costAnalysisData = useMemo(() => {
    return filteredNodePools.map(np => ({
      name: np.name,
      costPerCPU: np.costPerCPU || 0,
      costPerMemory: np.costPerGBMemory || 0
    }));
  }, [filteredNodePools]);

  if (loading && !data.summary) {
    return (
      <div className="flex flex-col gap-6 p-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2">
            <div className="kt-skeleton kt-skeleton-heading w-56" />
            <div className="kt-skeleton kt-skeleton-text w-80" />
          </div>
          <div className="kt-skeleton w-24 h-9 rounded-xl" />
        </div>
        {/* Summary cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm space-y-3">
              <div className="flex justify-between">
                <div className="kt-skeleton kt-skeleton-text w-20" />
                <div className="kt-skeleton w-8 h-8 rounded-xl" />
              </div>
              <div className="kt-skeleton kt-skeleton-heading w-16" />
              <div className="kt-skeleton kt-skeleton-text w-28" />
            </div>
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-bg-card rounded-3xl border border-border-main p-6 space-y-4">
            <div className="kt-skeleton kt-skeleton-text w-40" />
            <div className="kt-skeleton w-full h-[250px] rounded-xl" />
          </div>
          <div className="bg-bg-card rounded-3xl border border-border-main p-6 space-y-4">
            <div className="kt-skeleton kt-skeleton-text w-40" />
            <div className="kt-skeleton w-full h-[250px] rounded-xl" />
          </div>
        </div>
        {/* Node pool cards skeleton */}
        <div className="space-y-3">
          <div className="kt-skeleton kt-skeleton-text w-32" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-bg-card rounded-2xl p-4 border border-border-main shadow-sm flex items-center gap-4">
              <div className="kt-skeleton w-12 h-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="kt-skeleton kt-skeleton-text w-48" />
                <div className="kt-skeleton kt-skeleton-text w-64" />
              </div>
              <div className="kt-skeleton w-24 h-8 rounded-lg" />
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
          <h1 className="text-2xl font-black text-text-primary   flex items-center gap-3">
            <Zap className="w-7 h-7 text-primary-500" />
            Scaling Efficiency
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            Unified node provisioning & KEDA event-driven scaling analytics
          </p>
          {data.detectedProvisioners.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              {data.detectedProvisioners.map(provisioner => (
                <span
                  key={provisioner}
                  className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 text-[10px] font-semibold "
                >
                  {getProvisionerDisplayName(provisioner)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data.unifiedProvisioners.length > 1 && (
            <select
              value={selectedProvisionerType}
              onChange={(e) => setSelectedProvisionerType(e.target.value)}
              className="kt-select text-sm"
            >
              <option value="all">All Provisioners</option>
              {data.unifiedProvisioners.map(p => (
                <option key={p.provisionerType} value={p.provisionerType}>
                  {getProvisionerDisplayName(p.provisionerType)}
                </option>
              ))}
            </select>
          )}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm hover:border-primary-500/30 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold   text-text-tertiary mb-1">
                  {card.title}
                </p>
                <p className="text-2xl font-black text-text-primary">{card.value}</p>
                <p className={`text-xs font-semibold mt-1 ${card.color}`}>
                  {card.subtext}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${card.bgColor}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Unified Node Pools (Karpenter + Azure NAP) */}
        <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
          <div className="p-6 border-b border-border-main bg-bg-hover/50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary-600 rounded-xl shadow-lg shadow-primary-600/20">
                  <Server className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-black   text-text-primary">
                    Node Pools
                  </h2>
                  <p className="text-[10px] text-text-tertiary font-semibold">
                    Unified node provisioning across cloud providers
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={nodePoolSortBy}
                  onChange={(e) => setNodePoolSortBy(e.target.value as any)}
                  className="kt-select text-xs"
                >
                  <option value="name">Name</option>
                  <option value="totalCost">Total Cost</option>
                  <option value="utilization">Utilization</option>
                  <option value="binPacking">Bin Packing</option>
                </select>
                <button
                  onClick={() => setNodePoolSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="kt-button kt-button-secondary p-1.5"
                  title={nodePoolSortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
                >
                  {nodePoolSortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {filteredNodePools.length === 0 ? (
              <div className="text-center py-12">
                <Server className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                <p className="text-text-tertiary">No node pools found</p>
              </div>
            ) : (
              <>
                {/* Sort Controls */}
                <div className="flex items-center gap-4 p-3 rounded-xl bg-bg-card/50 border border-border-main">
                  <span className="text-xs font-semibold text-text-tertiary">Sort by:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (nodePoolSortBy === 'name') {
                          setNodePoolSortOrder(nodePoolSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setNodePoolSortBy('name');
                          setNodePoolSortOrder('asc');
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        nodePoolSortBy === 'name'
                          ? 'bg-primary-500 text-white'
                          : 'bg-bg-hover text-text-tertiary hover:bg-bg-hover/80'
                      }`}
                    >
                      Name {nodePoolSortBy === 'name' && (nodePoolSortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                      onClick={() => {
                        if (nodePoolSortBy === 'utilization') {
                          setNodePoolSortOrder(nodePoolSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setNodePoolSortBy('utilization');
                          setNodePoolSortOrder('desc');
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        nodePoolSortBy === 'utilization'
                          ? 'bg-primary-500 text-white'
                          : 'bg-bg-hover text-text-tertiary hover:bg-bg-hover/80'
                      }`}
                    >
                      Utilization {nodePoolSortBy === 'utilization' && (nodePoolSortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                      onClick={() => {
                        if (nodePoolSortBy === 'totalCost') {
                          setNodePoolSortOrder(nodePoolSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setNodePoolSortBy('totalCost');
                          setNodePoolSortOrder('desc');
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        nodePoolSortBy === 'totalCost'
                          ? 'bg-primary-500 text-white'
                          : 'bg-bg-hover text-text-tertiary hover:bg-bg-hover/80'
                      }`}
                    >
                      Cost {nodePoolSortBy === 'totalCost' && (nodePoolSortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                  </div>
                </div>

                {/* NodePool Cards */}
                <div className="space-y-4">
                  {filteredNodePools.map((np) => (
                    <div
                      key={`${np.provisionerType}-${np.name}`}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                        selectedNodePool === `${np.provisionerType}-${np.name}`
                          ? 'border-primary-500 bg-primary-500/5'
                          : 'border-border-main hover:border-primary-500/30 bg-bg-hover/30'
                      }`}
                      onClick={() => setSelectedNodePool(
                        selectedNodePool === `${np.provisionerType}-${np.name}` ? null : `${np.provisionerType}-${np.name}`
                      )}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-text-primary">{np.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            np.provisionerType === 'karpenter'
                              ? 'bg-primary-500/10 text-primary-500'
                              : 'bg-cyan-500/10 text-cyan-500'
                          }`}>
                            {np.provisionerType === 'azure-nap' ? 'Azure NAP' : np.provisionerType === 'karpenter' ? 'Karpenter' : np.provisionerType}
                          </span>
                          {np.nodeClass && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-semibold">
                              {np.nodeClass}
                            </span>
                          )}
                          {np.readyNodes !== np.totalNodes && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-semibold">
                              {np.totalNodes - np.readyNodes} Not Ready
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-text-primary">
                            {np.readyNodes}/{np.totalNodes}
                          </span>
                          {selectedNodePool === `${np.provisionerType}-${np.name}` ? (
                            <ChevronUp className="w-4 h-4 text-text-tertiary" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-text-tertiary" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-[10px] font-semibold text-text-tertiary">Nodes</p>
                          <p className="text-lg font-bold text-text-primary">{np.totalNodes}</p>
                          <p className="text-[10px] text-text-tertiary">{np.readyNodes} ready</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-semibold text-text-tertiary">Utilization</p>
                          <p className={`text-lg font-bold ${
                            np.utilizationPercent > 70 ? 'text-emerald-500' :
                            np.utilizationPercent > 40 ? 'text-amber-500' : 'text-rose-500'
                          }`}>
                            {np.utilizationPercent.toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-semibold text-text-tertiary">Bin Packing</p>
                          <p className="text-lg font-bold text-text-primary">{np.binPackingEfficiency.toFixed(0)}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-semibold text-text-tertiary">Cost/Month</p>
                          <p className="text-lg font-bold text-text-primary">${(np.totalMonthlyCost || 0).toFixed(0)}</p>
                        </div>
                      </div>

                      {/* Instance Types Preview */}
                      {((np.instanceTypes?.length || 0) > 0 || (np.vmSizeNames?.length || 0) > 0) && (
                        <div className="flex flex-wrap gap-2">
                          {np.instanceTypes?.slice(0, 3).map(it => (
                            <span key={it} className="px-2 py-1 rounded bg-bg-card text-xs text-text-secondary">{it}</span>
                          ))}
                          {np.vmSizeNames?.slice(0, 3).map(vs => (
                            <span key={vs} className="px-2 py-1 rounded bg-bg-card text-xs text-text-secondary">{vs}</span>
                          ))}
                          {((np.instanceTypes?.length || 0) + (np.vmSizeNames?.length || 0)) > 3 && (
                            <span className="px-2 py-1 rounded bg-bg-card text-xs text-text-tertiary">
                              +{((np.instanceTypes?.length || 0) + (np.vmSizeNames?.length || 0)) - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Expanded Details */}
                      {selectedNodePool === `${np.provisionerType}-${np.name}` && (
                        <div className="mt-4 pt-4 border-t border-border-main space-y-3 animate-in fade-in slide-in-from-top-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div className="p-2 rounded-lg bg-bg-card">
                              <p className="text-[10px] font-semibold text-text-tertiary">CPUs</p>
                              <p className="text-text-primary">{np.totalCPUs || 0}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-bg-card">
                              <p className="text-[10px] font-semibold text-text-tertiary">Memory</p>
                              <p className="text-text-primary">{np.totalMemoryGB || 0} GB</p>
                            </div>
                            <div className="p-2 rounded-lg bg-bg-card">
                              <p className="text-[10px] font-semibold text-text-tertiary">Cost/CPU</p>
                              <p className="text-text-primary">${np.costPerCPU?.toFixed(2) || '-'}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-bg-card">
                              <p className="text-[10px] font-semibold text-text-tertiary">Age</p>
                              <p className="text-text-primary">{formatAge(np.creationTimestamp)}</p>
                            </div>
                          </div>
                          {(np.instanceTypes?.length || 0) > 0 && (
                            <div>
                              <span className="text-text-tertiary text-sm">Instance Types:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {np.instanceTypes?.map(it => (
                                  <span key={it} className="px-2 py-1 rounded bg-bg-card text-xs text-text-secondary">{it}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {(np.vmSizeNames?.length || 0) > 0 && (
                            <div>
                              <span className="text-text-tertiary text-sm">VM Sizes:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {np.vmSizeNames?.map(vs => (
                                  <span key={vs} className="px-2 py-1 rounded bg-bg-card text-xs text-text-secondary">{vs}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {np.misconfigurations && np.misconfigurations.length > 0 && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                                <span className="text-sm font-bold text-rose-500">Configuration Issues</span>
                              </div>
                              <ul className="space-y-1">
                                {np.misconfigurations.map((m, i) => (
                                  <li key={i} className="text-xs text-rose-400 flex items-start gap-2">
                                    <span className="mt-1">•</span>
                                    {m}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Utilization Chart */}
                {filteredNodePools.length > 0 && (
                  <div className="h-[250px] mt-6">
                    <p className="text-[10px] font-semibold text-text-tertiary mb-4">
                      Utilization vs Bin-Packing Efficiency
                    </p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={nodePoolChartData}>
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
                        <Bar dataKey="utilization" name="Utilization %" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="binPacking" name="Bin Packing %" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* KEDA Scalers */}
        <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
          <div className="p-6 border-b border-border-main bg-bg-hover/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/20">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-black   text-text-primary">
                  KEDA Event Scalers
                </h2>
                <p className="text-[10px] text-text-tertiary font-semibold">
                  Event-driven scaling efficiency & trigger performance
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {data.keda.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                <p className="text-text-tertiary">No KEDA ScaledObjects found</p>
              </div>
            ) : (
              <>
                {/* Sort Controls */}
                <div className="flex items-center gap-4 p-3 rounded-xl bg-bg-card/50 border border-border-main">
                  <span className="text-xs font-semibold text-text-tertiary">Sort by:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (kedaSortBy === 'currentReplicas') {
                          setKedaSortOrder(kedaSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setKedaSortBy('currentReplicas');
                          setKedaSortOrder('desc');
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        kedaSortBy === 'currentReplicas'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-bg-hover text-text-tertiary hover:bg-bg-hover/80'
                      }`}
                    >
                      Replicas {kedaSortBy === 'currentReplicas' && (kedaSortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                      onClick={() => {
                        if (kedaSortBy === 'name') {
                          setKedaSortOrder(kedaSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setKedaSortBy('name');
                          setKedaSortOrder('asc');
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        kedaSortBy === 'name'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-bg-hover text-text-tertiary hover:bg-bg-hover/80'
                      }`}
                    >
                      Name {kedaSortBy === 'name' && (kedaSortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                      onClick={() => {
                        if (kedaSortBy === 'efficiency') {
                          setKedaSortOrder(kedaSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setKedaSortBy('efficiency');
                          setKedaSortOrder('desc');
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        kedaSortBy === 'efficiency'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-bg-hover text-text-tertiary hover:bg-bg-hover/80'
                      }`}
                    >
                      Efficiency {kedaSortBy === 'efficiency' && (kedaSortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                  </div>
                </div>

                {/* KEDA Cards */}
                <div className="space-y-4">
                  {sortedKeda.map((keda) => (
                    <div
                      key={keda.workloadName}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                        selectedKEDAWorkload === keda.workloadName
                          ? 'border-emerald-500 bg-emerald-500/5'
                          : 'border-border-main hover:border-emerald-500/30 bg-bg-hover/30'
                      }`}
                      onClick={() => setSelectedKEDAWorkload(
                        selectedKEDAWorkload === keda.workloadName ? null : keda.workloadName
                      )}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-text-primary">{keda.workloadName}</span>
                          <span className="text-[10px] text-text-tertiary">{keda.namespace}</span>
                          {!keda.isReady && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-semibold">
                              Not Ready
                            </span>
                          )}
                          {keda.isFallback && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-semibold">
                              Fallback
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {keda.efficiencyScore >= 80 ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : keda.efficiencyScore >= 60 ? (
                              <Minus className="w-4 h-4 text-amber-500" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-rose-500" />
                            )}
                            <span
                              className="text-sm font-bold"
                              style={{ color: getEfficiencyColor(keda.efficiencyScore) }}
                            >
                              {keda.efficiencyScore.toFixed(0)}%
                            </span>
                          </div>
                          {selectedKEDAWorkload === keda.workloadName ? (
                            <ChevronUp className="w-4 h-4 text-text-tertiary" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-text-tertiary" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-[10px] font-semibold  text-text-tertiary">Replicas</p>
                          <p className="text-lg font-bold text-text-primary">
                            {keda.currentReplicas}
                          </p>
                          <p className="text-[10px] text-text-tertiary">
                            {keda.minReplicas}-{keda.maxReplicas}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-semibold  text-text-tertiary">Efficiency</p>
                          <p className={`text-lg font-bold ${
                            keda.efficiencyScore >= 80 ? 'text-emerald-500' :
                            keda.efficiencyScore >= 60 ? 'text-amber-500' : 'text-rose-500'
                          }`}>
                            {getEfficiencyLabel(keda.efficiencyScore)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-semibold  text-text-tertiary">At Min</p>
                          <p className="text-lg font-bold text-text-primary">
                            {keda.timeAtMinPercent.toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-semibold  text-text-tertiary">At Max</p>
                          <p className={`text-lg font-bold ${
                            keda.timeAtMaxPercent > 20 ? 'text-rose-500' : 'text-text-primary'
                          }`}>
                            {keda.timeAtMaxPercent.toFixed(0)}%
                          </p>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {selectedKEDAWorkload === keda.workloadName && (
                        <div className="mt-4 pt-4 border-t border-border-main space-y-4 animate-in fade-in slide-in-from-top-2">
                          <div>
                            <p className="text-[10px] font-semibold  text-text-tertiary mb-2">Triggers</p>
                            <div className="space-y-2">
                              {keda.triggerTypes.map((trigger, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-3 rounded-xl bg-bg-card border border-border-main"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 text-[10px] font-bold">
                                      {trigger.type}
                                    </span>
                                    <span className="text-sm text-text-secondary">{trigger.metricName}</span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-text-primary">
                                      {trigger.currentValue.toFixed(2)} / {trigger.targetValue}
                                    </p>
                                    <p className="text-[10px] text-text-tertiary">
                                      Latency: {trigger.triggerLatency.toFixed(0)}ms
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-xl bg-bg-hover">
                              <p className="text-[10px] font-semibold  text-text-tertiary mb-1">Cooldown Efficiency</p>
                              <p className="text-xl font-bold text-text-primary">
                                {keda.cooldownEfficiency.toFixed(0)}%
                              </p>
                            </div>
                            <div className="p-3 rounded-xl bg-bg-hover">
                              <p className="text-[10px] font-semibold  text-text-tertiary mb-1">Scale-up Latency</p>
                              <p className="text-xl font-bold text-text-primary">
                                {(keda.scaleUpLatency / 1000).toFixed(1)}s
                              </p>
                            </div>
                          </div>

                          {keda.misconfigurations && keda.misconfigurations.length > 0 && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                                <span className="text-sm font-bold text-rose-500">Configuration Issues</span>
                              </div>
                              <ul className="space-y-1">
                                {keda.misconfigurations.map((m, i) => (
                                  <li key={i} className="text-xs text-rose-400 flex items-start gap-2">
                                    <span className="mt-1">•</span>
                                    {m}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Efficiency Chart */}
                {kedaChartData.length > 0 && (
                  <div className="h-[250px] mt-6">
                    <p className="text-[10px] font-semibold  text-text-tertiary mb-4">
                      Scaling Efficiency by Workload
                    </p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={kedaChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--kt-border-main)" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--kt-fg-tertiary)', fontSize: 10 }} />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fill: 'var(--kt-fg-tertiary)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--kt-bg-card)',
                            border: '1px solid var(--kt-border-main)',
                            borderRadius: '12px',
                            color: 'var(--kt-fg-primary)'
                          }}
                        />
                        <Bar dataKey="efficiency" name="Efficiency %" radius={[0, 4, 4, 0]}>
                          {kedaChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getEfficiencyColor(entry.efficiency)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* HPA Horizontal Pod Autoscalers */}
      <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
        <div className="p-6 border-b border-border-main bg-bg-hover/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black   text-text-primary">
                HPA Horizontal Pod Autoscalers
              </h2>
              <p className="text-[10px] text-text-tertiary font-semibold">
                Native Kubernetes HPA scaling metrics
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {data.hpa.length === 0 ? (
            <div className="text-center py-12">
              <Scale className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
              <p className="text-text-tertiary">No HPA resources found</p>
            </div>
          ) : (
            <>
              {/* Sort Controls */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-bg-card/50 border border-border-main">
                <span className="text-xs font-semibold text-text-tertiary">Sort by:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (hpaSortBy === 'currentReplicas') {
                        setHpaSortOrder(hpaSortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setHpaSortBy('currentReplicas');
                        setHpaSortOrder('desc');
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      hpaSortBy === 'currentReplicas'
                        ? 'bg-blue-500 text-white'
                        : 'bg-bg-hover text-text-tertiary hover:bg-bg-hover/80'
                    }`}
                  >
                    Replicas {hpaSortBy === 'currentReplicas' && (hpaSortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => {
                      if (hpaSortBy === 'name') {
                        setHpaSortOrder(hpaSortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setHpaSortBy('name');
                        setHpaSortOrder('asc');
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      hpaSortBy === 'name'
                        ? 'bg-blue-500 text-white'
                        : 'bg-bg-hover text-text-tertiary hover:bg-bg-hover/80'
                    }`}
                  >
                    Name {hpaSortBy === 'name' && (hpaSortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => {
                      if (hpaSortBy === 'cpuUtilization') {
                        setHpaSortOrder(hpaSortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setHpaSortBy('cpuUtilization');
                        setHpaSortOrder('desc');
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      hpaSortBy === 'cpuUtilization'
                        ? 'bg-blue-500 text-white'
                        : 'bg-bg-hover text-text-tertiary hover:bg-bg-hover/80'
                    }`}
                  >
                    CPU % {hpaSortBy === 'cpuUtilization' && (hpaSortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                </div>
              </div>

              {/* HPA Cards */}
              <div className="space-y-4">
                {sortedHpa.map((hpa) => (
                  <div
                    key={hpa.name}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                      selectedHPA === hpa.name
                        ? 'border-blue-500 bg-blue-500/5'
                        : 'border-border-main hover:border-primary-500/30 bg-bg-hover/30'
                    }`}
                    onClick={() => setSelectedHPA(
                      selectedHPA === hpa.name ? null : hpa.name
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-text-primary">{hpa.name}</span>
                        <span className="text-[10px] text-text-tertiary">{hpa.namespace}</span>
                        {!hpa.isActive && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-semibold">
                            Inactive
                          </span>
                        )}
                        {hpa.scalingLimited && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-semibold">
                            Limited
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {hpa.isActive ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                          )}
                          <span className="text-sm font-bold text-text-primary">
                            {hpa.currentReplicas}/{hpa.maxReplicas}
                          </span>
                        </div>
                        {selectedHPA === hpa.name ? (
                          <ChevronUp className="w-4 h-4 text-text-tertiary" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-text-tertiary" />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-[10px] font-semibold  text-text-tertiary">Current</p>
                        <p className="text-lg font-bold text-text-primary">
                          {hpa.currentReplicas}
                        </p>
                        <p className="text-[10px] text-text-tertiary">
                          {hpa.minReplicas}-{hpa.maxReplicas}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold  text-text-tertiary">Desired</p>
                        <p className={`text-lg font-bold ${
                          hpa.desiredReplicas !== hpa.currentReplicas ? 'text-amber-500' : 'text-text-primary'
                        }`}>
                          {hpa.desiredReplicas}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold  text-text-tertiary">CPU Target</p>
                        <p className="text-lg font-bold text-text-primary">
                          {hpa.cpuUtilization?.targetUtilization || '-'}%
                        </p>
                        {hpa.cpuUtilization && (
                          <p className="text-[10px] text-text-tertiary">
                            {hpa.cpuUtilization.currentUtilization}%
                          </p>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold  text-text-tertiary">Memory Target</p>
                        <p className="text-lg font-bold text-text-primary">
                          {hpa.memoryUtilization?.targetUtilization || '-'}%
                        </p>
                        {hpa.memoryUtilization && (
                          <p className="text-[10px] text-text-tertiary">
                            {hpa.memoryUtilization.currentUtilization}%
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedHPA === hpa.name && (
                      <div className="mt-4 pt-4 border-t border-border-main space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-semibold  text-text-tertiary mb-2">Scale Target</p>
                            <div className="p-3 rounded-xl bg-bg-card/50 border border-border-main">
                              <p className="text-sm text-text-primary">
                                {hpa.scaleTargetRef.kind}: <span className="font-mono text-xs">{hpa.scaleTargetRef.name}</span>
                              </p>
                              <p className="text-[10px] text-text-tertiary">{hpa.scaleTargetRef.apiVersion}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold  text-text-tertiary mb-2">Status</p>
                            <div className="p-3 rounded-xl bg-bg-card/50 border border-border-main space-y-2">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${hpa.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span className="text-xs text-text-primary">Scaling Active</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${hpa.ableToScale ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span className="text-xs text-text-primary">Able to Scale</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {hpa.customMetrics && hpa.customMetrics.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold  text-text-tertiary mb-2">Custom Metrics</p>
                            <div className="space-y-2">
                              {hpa.customMetrics.map((metric, idx) => (
                                <div
                                  key={idx}
                                  className="p-3 rounded-xl bg-bg-card/50 border border-border-main flex items-center justify-between"
                                >
                                  <div>
                                    <p className="text-sm font-bold text-text-primary">{metric.name}</p>
                                    <p className="text-[10px] text-text-tertiary">Type: {metric.type}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-text-primary">
                                      {metric.currentValue.toFixed(2)}
                                    </p>
                                    <p className="text-[10px] text-text-tertiary">
                                      Target: {metric.targetValue.toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {hpa.misconfigurations && hpa.misconfigurations.length > 0 && (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-4 h-4 text-rose-500" />
                              <span className="text-sm font-bold text-rose-500">Configuration Issues</span>
                            </div>
                            <ul className="space-y-1">
                              {hpa.misconfigurations.map((m, i) => (
                                <li key={i} className="text-xs text-rose-400 flex items-start gap-2">
                                  <span className="mt-1">•</span>
                                  {m}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Node Claims */}
      <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
        <div className="p-6 border-b border-border-main bg-bg-hover/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600 rounded-xl shadow-lg shadow-purple-600/20">
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black   text-text-primary">
                Node Claims
              </h2>
              <p className="text-[10px] text-text-tertiary font-semibold">
                Karpenter and Azure NAP node provisioning progress
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {nodeClaims.length === 0 ? (
            <div className="text-center py-12">
              <Server className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
              <p className="text-text-tertiary">No node claims found</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              {nodeClaimsSummary && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                  {[
                    { label: 'Total', value: nodeClaimsSummary.total, color: 'text-text-primary' },
                    { label: 'Ready', value: nodeClaimsSummary.ready, color: 'text-emerald-500' },
                    { label: 'Pending', value: nodeClaimsSummary.pending, color: 'text-amber-500' },
                    { label: 'Drifted', value: nodeClaimsSummary.drifted, color: 'text-rose-500' },
                    { label: 'Expired', value: nodeClaimsSummary.expired, color: 'text-text-tertiary' },
                    { label: 'Stuck >5m', value: nodeClaimsSummary.stuckPendingCount, color: 'text-rose-500' },
                  ].map((s, i) => (
                    <div key={i} className="bg-bg-hover rounded-xl p-3 text-center">
                      <p className="text-[10px] font-semibold  text-text-tertiary mb-1">{s.label}</p>
                      <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Claims Table */}
              <div className="space-y-3">
                {nodeClaims.map(claim => (
                  <div
                    key={`${claim.provisionerType}-${claim.name}`}
                    className={`rounded-2xl border-2 transition-all ${
                      selectedNodeClaim === `${claim.provisionerType}-${claim.name}`
                        ? 'border-purple-500 bg-purple-500/5'
                        : 'border-border-main hover:border-purple-500/30 bg-bg-hover/30'
                    }`}
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setSelectedNodeClaim(
                        selectedNodeClaim === `${claim.provisionerType}-${claim.name}`
                          ? null
                          : `${claim.provisionerType}-${claim.name}`
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-text-primary">{claim.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold  ${
                            claim.provisionerType === 'karpenter'
                              ? 'bg-primary-500/10 text-primary-500'
                              : 'bg-cyan-500/10 text-cyan-500'
                          }`}>
                            {claim.provisionerType}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold  border ${
                            claim.status === 'Ready'
                              ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                              : claim.status === 'Pending'
                              ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                              : claim.status === 'Drifted'
                              ? 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                              : claim.status === 'Expired'
                              ? 'text-text-tertiary bg-bg-hover border-text-tertiary/20'
                              : 'text-text-tertiary bg-bg-hover border-text-tertiary/20'
                          }`}
                          >
                            {claim.status}
                          </span>
                          <span className="text-[10px] text-text-tertiary">{claim.nodePool}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-secondary">{Math.round(claim.age / 60)}m</span>
                          {selectedNodeClaim === `${claim.provisionerType}-${claim.name}` ? (
                            <ChevronUp className="w-4 h-4 text-text-tertiary" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-text-tertiary" />
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedNodeClaim === `${claim.provisionerType}-${claim.name}` && (
                      <div className="px-4 pb-4 pt-2 border-t border-border-main space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {claim.instanceType && (
                            <div className="p-2 rounded-lg bg-bg-hover">
                              <p className="text-[10px] font-semibold  text-text-tertiary">Instance Type</p>
                              <p className="text-sm font-bold text-text-primary">{claim.instanceType}</p>
                            </div>
                          )}
                          {claim.zone && (
                            <div className="p-2 rounded-lg bg-bg-hover">
                              <p className="text-[10px] font-semibold  text-text-tertiary">Zone</p>
                              <p className="text-sm font-bold text-text-primary">{claim.zone}</p>
                            </div>
                          )}
                          {claim.capacityType && (
                            <div className="p-2 rounded-lg bg-bg-hover">
                              <p className="text-[10px] font-semibold  text-text-tertiary">Capacity</p>
                              <p className="text-sm font-bold text-text-primary capitalize">{claim.capacityType}</p>
                            </div>
                          )}
                          {claim.nodeName && (
                            <div className="p-2 rounded-lg bg-bg-hover">
                              <p className="text-[10px] font-semibold  text-text-tertiary">Node</p>
                              <p className="text-sm font-bold text-text-primary">{claim.nodeName}</p>
                            </div>
                          )}
                        </div>

                        {claim.conditions && claim.conditions.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold  text-text-tertiary mb-2">Conditions</p>
                            <div className="space-y-2">
                              {claim.conditions.map((cond, idx) => (
                                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-bg-hover">
                                  <span className={`mt-0.5 ${cond.status === 'True' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {cond.status === 'True' ? (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    ) : (
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    )}
                                  </span>
                                  <div>
                                    <p className="text-xs font-bold text-text-primary">{cond.type}</p>
                                    {cond.reason && <p className="text-[10px] text-text-secondary">{cond.reason}</p>}
                                    {cond.message && <p className="text-[10px] text-text-secondary">{cond.message}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {claim.misconfigurations && claim.misconfigurations.length > 0 && (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-4 h-4 text-rose-500" />
                              <span className="text-sm font-bold text-rose-500">Issues</span>
                            </div>
                            <ul className="space-y-1">
                              {claim.misconfigurations.map((m, i) => (
                                <li key={i} className="text-xs text-rose-400 flex items-start gap-2">
                                  <span className="mt-1">•</span>
                                  {m}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cost Analysis */}
      {filteredNodePools.length > 0 && (
        <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
          <div className="p-6 border-b border-border-main bg-bg-hover/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-600 rounded-xl shadow-lg shadow-amber-600/20">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-black   text-text-primary">
                  Cost Analysis
                </h2>
                <p className="text-[10px] text-text-tertiary font-semibold">
                  Estimated monthly costs by node pool
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costAnalysisData}>
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
                    formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                  />
                  <Bar dataKey="costPerCPU" name="Cost per CPU/month" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="costPerMemory" name="Cost per GB Memory/month" fill={COLORS.info} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="flex items-center justify-center gap-2 text-text-tertiary text-xs">
        <Clock className="w-3 h-3" />
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};
