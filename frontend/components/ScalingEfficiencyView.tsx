import React, { useState, useEffect, useMemo, memo } from 'react';
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
  primary: '#f5a623',
  success: '#2ecc71',
  warning: '#f5a623',
  danger: '#e74c3c',
  info: '#4fc1ff',
  gray: '#6b6e75'
};

const CHART_COLORS = ['#f5a623', '#2ecc71', '#f5a623', '#e74c3c', '#8b5cf6', '#ec4899'];

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

const ScalingEfficiencyViewComponent: React.FC<ScalingEfficiencyViewProps> = ({ clusterId }) => {
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
        color: 'text-success',
        bgColor: 'bg-success/10'
      },
      {
        title: 'HPA Scalers',
        value: data.summary.totalHpaScalers,
        subtext: 'Native K8s scaling',
        icon: Scale,
        color: 'text-info',
        bgColor: 'bg-info/10'
      },
      {
        title: 'Avg Utilization',
        value: `${data.summary.avgNodeUtilization.toFixed(1)}%`,
        subtext: data.summary.avgNodeUtilization > 70 ? 'Healthy' : 'Underutilized',
        icon: Activity,
        color: data.summary.avgNodeUtilization > 70 ? 'text-success' : 'text-warning',
        bgColor: data.summary.avgNodeUtilization > 70 ? 'bg-success/10' : 'bg-warning/10'
      },
      {
        title: 'Bin Packing',
        value: `${data.summary.avgBinPackingEfficiency.toFixed(1)}%`,
        subtext: 'Efficiency score',
        icon: Box,
        color: data.summary.avgBinPackingEfficiency > 80 ? 'text-success' : 'text-warning',
        bgColor: data.summary.avgBinPackingEfficiency > 80 ? 'bg-success/10' : 'bg-warning/10'
      },
      {
        title: 'Issues',
        value: data.summary.issuesFound,
        subtext: data.summary.issuesFound > 0 ? 'Requires attention' : 'All systems healthy',
        icon: AlertTriangle,
        color: data.summary.issuesFound > 0 ? 'text-danger' : 'text-success',
        bgColor: data.summary.issuesFound > 0 ? 'bg-danger/10' : 'bg-success/10'
      }
    ];
  }, [data.summary]);

  const SummaryCard = ({
    label,
    value,
    sub,
    icon: Icon,
    iconColor,
    iconBg
  }: {
    label: string;
    value: React.ReactNode;
    sub: React.ReactNode;
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
  }) => (
    <div className="kt-panel p-4">
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[11px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-1">{label}</p>
          <p className="text-2xl font-mono font-bold text-text-primary">{value}</p>
          <p className={`text-xs mt-1 font-mono ${iconColor}`}>{sub}</p>
        </div>
        <div className={`p-2.5 bg-bg-main border border-border-main ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );

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
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="kt-panel p-4 space-y-3">
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
          <div className="kt-panel p-6 space-y-4">
            <div className="kt-skeleton kt-skeleton-text w-40" />
            <div className="kt-skeleton w-full h-[250px] rounded-xl" />
          </div>
          <div className="kt-panel p-6 space-y-4">
            <div className="kt-skeleton kt-skeleton-text w-40" />
            <div className="kt-skeleton w-full h-[250px] rounded-xl" />
          </div>
        </div>
        {/* Node pool cards skeleton */}
        <div className="space-y-3">
          <div className="kt-skeleton kt-skeleton-text w-32" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="kt-panel p-4 flex items-center gap-4">
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
          <h1 className="text-2xl font-display font-bold text-text-primary flex items-center gap-3 tracking-wider uppercase">
            <Zap className="w-7 h-7 text-primary-500" />
            Scaling Efficiency
          </h1>
          <p className="text-text-tertiary text-sm mt-1 font-mono">
            Unified node provisioning & KEDA event-driven scaling analytics
          </p>
          {data.detectedProvisioners.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              {data.detectedProvisioners.map(provisioner => (
                <span
                  key={provisioner}
                  className="kt-badge kt-badge-info"
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
            className="kt-button kt-button-secondary kt-button-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryCards.map((card, idx) => (
          <SummaryCard
            key={idx}
            label={card.title}
            value={card.value}
            sub={card.subtext}
            icon={card.icon}
            iconColor={card.color}
            iconBg={card.bgColor}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Unified Node Pools (Karpenter + Azure NAP) */}
        <div className="kt-panel overflow-hidden">
          <div className="kt-panel-header">
            <div className="flex items-center gap-3">
              <Server className="w-4 h-4 text-primary-500" />
              <div>
                <h2 className="text-sm font-display font-bold tracking-wide uppercase text-text-primary">
                  Node Pools
                </h2>
                <p className="text-[10px] text-text-tertiary font-mono">
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
                className="kt-button kt-button-secondary kt-button-sm p-1.5"
                title={nodePoolSortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
              >
                {nodePoolSortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {filteredNodePools.length === 0 ? (
              <div className="text-center py-12">
                <Server className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                <p className="text-text-tertiary font-mono uppercase tracking-wider">No node pools found</p>
              </div>
            ) : (
              <>
                {/* Sort Controls */}
                <div className="flex items-center gap-4 p-3 kt-panel-inset">
                  <span className="text-xs font-sans font-semibold text-text-tertiary tracking-wider uppercase">Sort by:</span>
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
                      className={`kt-button kt-button-sm ${nodePoolSortBy === 'name' ? 'kt-button-primary' : 'kt-button-secondary'}`}
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
                      className={`kt-button kt-button-sm ${nodePoolSortBy === 'utilization' ? 'kt-button-primary' : 'kt-button-secondary'}`}
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
                      className={`kt-button kt-button-sm ${nodePoolSortBy === 'totalCost' ? 'kt-button-primary' : 'kt-button-secondary'}`}
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
                      className={`p-5 rounded-xl border cursor-pointer transition-all ${
                        selectedNodePool === `${np.provisionerType}-${np.name}`
                          ? 'border-primary-500 bg-primary-500/5 kt-amber-glow'
                          : 'border-border-main hover:border-primary-500/30 bg-bg-hover/30'
                      }`}
                      onClick={() => setSelectedNodePool(
                        selectedNodePool === `${np.provisionerType}-${np.name}` ? null : `${np.provisionerType}-${np.name}`
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-display font-bold text-text-primary truncate tracking-wide uppercase">{np.name}</span>
                          <span className={`kt-badge ${
                            np.provisionerType === 'karpenter'
                              ? 'kt-badge-info'
                              : 'kt-badge-warning'
                          } shrink-0`}>
                            {np.provisionerType === 'azure-nap' ? 'Azure NAP' : np.provisionerType === 'karpenter' ? 'Karpenter' : np.provisionerType}
                          </span>
                          {np.nodeClass && (
                            <span className="kt-badge kt-badge-info shrink-0">
                              {np.nodeClass}
                            </span>
                          )}
                          {np.readyNodes !== np.totalNodes && (
                            <span className="kt-badge kt-badge-warning shrink-0">
                              {np.totalNodes - np.readyNodes} Not Ready
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-11 sm:ml-0">
                          <span className="text-sm font-mono font-bold text-text-primary">
                            {np.readyNodes}/{np.totalNodes}
                          </span>
                          {selectedNodePool === `${np.provisionerType}-${np.name}` ? (
                            <ChevronUp className="w-4 h-4 text-text-tertiary" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-text-tertiary" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        <div className="kt-panel-inset text-center p-3">
                          <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Nodes</p>
                          <p className="text-lg font-mono font-bold text-text-primary">{np.totalNodes}</p>
                          <p className="text-[10px] text-text-tertiary font-mono">{np.readyNodes} ready</p>
                        </div>
                        <div className="kt-panel-inset text-center p-3">
                          <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Utilization</p>
                          <p className={`text-lg font-mono font-bold ${
                            np.utilizationPercent > 70 ? 'text-success' :
                            np.utilizationPercent > 40 ? 'text-warning' : 'text-danger'
                          }`}>
                            {np.utilizationPercent.toFixed(0)}%
                          </p>
                        </div>
                        <div className="kt-panel-inset text-center p-3">
                          <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Bin Packing</p>
                          <p className="text-lg font-mono font-bold text-text-primary">{np.binPackingEfficiency.toFixed(0)}%</p>
                        </div>
                        <div className="kt-panel-inset text-center p-3">
                          <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Cost/Month</p>
                          <p className="text-lg font-mono font-bold text-text-primary">${(np.totalMonthlyCost || 0).toFixed(0)}</p>
                        </div>
                      </div>

                      {/* Instance Types Preview */}
                      {((np.instanceTypes?.length || 0) > 0 || (np.vmSizeNames?.length || 0) > 0) && (
                        <div className="flex flex-wrap gap-2">
                          {np.instanceTypes?.slice(0, 3).map(it => (
                            <span key={it} className="px-2 py-1 bg-bg-main border border-border-main text-xs font-mono text-text-secondary">{it}</span>
                          ))}
                          {np.vmSizeNames?.slice(0, 3).map(vs => (
                            <span key={vs} className="px-2 py-1 bg-bg-main border border-border-main text-xs font-mono text-text-secondary">{vs}</span>
                          ))}
                          {((np.instanceTypes?.length || 0) + (np.vmSizeNames?.length || 0)) > 3 && (
                            <span className="px-2 py-1 bg-bg-main border border-border-main text-xs font-mono text-text-tertiary">
                              +{((np.instanceTypes?.length || 0) + (np.vmSizeNames?.length || 0)) - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Expanded Details */}
                      {selectedNodePool === `${np.provisionerType}-${np.name}` && (
                        <div className="mt-4 pt-4 border-t border-border-main space-y-3 animate-in fade-in slide-in-from-top-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div className="kt-panel-inset p-2">
                              <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">CPUs</p>
                              <p className="font-mono font-bold text-text-primary">{np.totalCPUs || 0}</p>
                            </div>
                            <div className="kt-panel-inset p-2">
                              <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Memory</p>
                              <p className="font-mono font-bold text-text-primary">{np.totalMemoryGB || 0} GB</p>
                            </div>
                            <div className="kt-panel-inset p-2">
                              <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Cost/CPU</p>
                              <p className="font-mono font-bold text-text-primary">${np.costPerCPU?.toFixed(2) || '-'}</p>
                            </div>
                            <div className="kt-panel-inset p-2">
                              <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Age</p>
                              <p className="font-mono font-bold text-text-primary">{formatAge(np.creationTimestamp)}</p>
                            </div>
                          </div>
                          {(np.instanceTypes?.length || 0) > 0 && (
                            <div>
                              <span className="text-text-tertiary text-sm font-sans font-semibold tracking-wider uppercase">Instance Types:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {np.instanceTypes?.map(it => (
                                  <span key={it} className="px-2 py-1 bg-bg-main border border-border-main text-xs font-mono text-text-secondary">{it}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {(np.vmSizeNames?.length || 0) > 0 && (
                            <div>
                              <span className="text-text-tertiary text-sm font-sans font-semibold tracking-wider uppercase">VM Sizes:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {np.vmSizeNames?.map(vs => (
                                  <span key={vs} className="px-2 py-1 bg-bg-main border border-border-main text-xs font-mono text-text-secondary">{vs}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {np.misconfigurations && np.misconfigurations.length > 0 && (
                            <div className="p-3 rounded-xl bg-danger/10 border border-danger/20">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-danger" />
                                <span className="text-sm font-display font-bold text-danger tracking-wide uppercase">Configuration Issues</span>
                              </div>
                              <ul className="space-y-1">
                                {np.misconfigurations.map((m, i) => (
                                  <li key={i} className="text-xs text-danger/80 font-mono flex items-start gap-2">
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
                    <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-4">
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
                            borderRadius: '2px',
                            color: 'var(--kt-fg-primary)',
                            fontFamily: 'var(--kt-font-mono)'
                          }}
                        />
                        <Bar dataKey="utilization" name="Utilization %" fill={COLORS.primary} radius={[2, 2, 0, 0]} />
                        <Bar dataKey="binPacking" name="Bin Packing %" fill={COLORS.success} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* KEDA Scalers */}
        <div className="kt-panel overflow-hidden">
          <div className="kt-panel-header">
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-success" />
              <div>
                <h2 className="text-sm font-display font-bold tracking-wide uppercase text-text-primary">
                  KEDA Event Scalers
                </h2>
                <p className="text-[10px] text-text-tertiary font-mono">
                  Event-driven scaling efficiency & trigger performance
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {data.keda.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                <p className="text-text-tertiary font-mono uppercase tracking-wider">No KEDA ScaledObjects found</p>
              </div>
            ) : (
              <>
                {/* Sort Controls */}
                <div className="flex items-center gap-4 p-3 kt-panel-inset">
                  <span className="text-xs font-sans font-semibold text-text-tertiary tracking-wider uppercase">Sort by:</span>
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
                      className={`kt-button kt-button-sm ${kedaSortBy === 'currentReplicas' ? 'kt-button-primary' : 'kt-button-secondary'}`}
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
                      className={`kt-button kt-button-sm ${kedaSortBy === 'name' ? 'kt-button-primary' : 'kt-button-secondary'}`}
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
                      className={`kt-button kt-button-sm ${kedaSortBy === 'efficiency' ? 'kt-button-primary' : 'kt-button-secondary'}`}
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
                      className={`p-5 rounded-xl border cursor-pointer transition-all ${
                        selectedKEDAWorkload === keda.workloadName
                          ? 'border-success bg-success/5 kt-success-glow'
                          : 'border-border-main hover:border-success/30 bg-bg-hover/30'
                      }`}
                      onClick={() => setSelectedKEDAWorkload(
                        selectedKEDAWorkload === keda.workloadName ? null : keda.workloadName
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-display font-bold text-text-primary truncate tracking-wide uppercase">{keda.workloadName}</span>
                          <span className="text-[10px] text-text-tertiary font-mono shrink-0">{keda.namespace}</span>
                          {!keda.isReady && (
                            <span className="kt-badge kt-badge-danger shrink-0">
                              Not Ready
                            </span>
                          )}
                          {keda.isFallback && (
                            <span className="kt-badge kt-badge-warning shrink-0">
                              Fallback
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-11 sm:ml-0">
                          <div className="flex items-center gap-1">
                            {keda.efficiencyScore >= 80 ? (
                              <CheckCircle2 className="w-4 h-4 text-success" />
                            ) : keda.efficiencyScore >= 60 ? (
                              <Minus className="w-4 h-4 text-warning" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-danger" />
                            )}
                            <span
                              className="text-sm font-mono font-bold"
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

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        <div className="kt-panel-inset text-center p-3">
                          <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Replicas</p>
                          <p className="text-lg font-mono font-bold text-text-primary">
                            {keda.currentReplicas}
                          </p>
                          <p className="text-[10px] text-text-tertiary font-mono">
                            {keda.minReplicas}-{keda.maxReplicas}
                          </p>
                        </div>
                        <div className="kt-panel-inset text-center p-3">
                          <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Efficiency</p>
                          <p className={`text-lg font-mono font-bold ${
                            keda.efficiencyScore >= 80 ? 'text-success' :
                            keda.efficiencyScore >= 60 ? 'text-warning' : 'text-danger'
                          }`}>
                            {getEfficiencyLabel(keda.efficiencyScore)}
                          </p>
                        </div>
                        <div className="kt-panel-inset text-center p-3">
                          <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">At Min</p>
                          <p className="text-lg font-mono font-bold text-text-primary">
                            {keda.timeAtMinPercent.toFixed(0)}%
                          </p>
                        </div>
                        <div className="kt-panel-inset text-center p-3">
                          <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">At Max</p>
                          <p className={`text-lg font-mono font-bold ${
                            keda.timeAtMaxPercent > 20 ? 'text-danger' : 'text-text-primary'
                          }`}>
                            {keda.timeAtMaxPercent.toFixed(0)}%
                          </p>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {selectedKEDAWorkload === keda.workloadName && (
                        <div className="mt-4 pt-4 border-t border-border-main space-y-4 animate-in fade-in slide-in-from-top-2">
                          <div>
                            <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-2">Triggers</p>
                            <div className="space-y-2">
                              {keda.triggerTypes.map((trigger, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-3 kt-panel-inset"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="kt-badge kt-badge-info">
                                      {trigger.type}
                                    </span>
                                    <span className="text-sm font-mono text-text-secondary">{trigger.metricName}</span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-mono font-bold text-text-primary">
                                      {trigger.currentValue.toFixed(2)} / {trigger.targetValue}
                                    </p>
                                    <p className="text-[10px] text-text-tertiary font-mono">
                                      Latency: {trigger.triggerLatency.toFixed(0)}ms
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="kt-panel-inset p-3">
                              <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-1">Cooldown Efficiency</p>
                              <p className="text-xl font-mono font-bold text-text-primary">
                                {keda.cooldownEfficiency.toFixed(0)}%
                              </p>
                            </div>
                            <div className="kt-panel-inset p-3">
                              <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-1">Scale-up Latency</p>
                              <p className="text-xl font-mono font-bold text-text-primary">
                                {(keda.scaleUpLatency / 1000).toFixed(1)}s
                              </p>
                            </div>
                          </div>

                          {keda.misconfigurations && keda.misconfigurations.length > 0 && (
                            <div className="p-3 rounded-xl bg-danger/10 border border-danger/20">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-danger" />
                                <span className="text-sm font-display font-bold text-danger tracking-wide uppercase">Configuration Issues</span>
                              </div>
                              <ul className="space-y-1">
                                {keda.misconfigurations.map((m, i) => (
                                  <li key={i} className="text-xs text-danger/80 font-mono flex items-start gap-2">
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
                    <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-4">
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
                            borderRadius: '2px',
                            color: 'var(--kt-fg-primary)',
                            fontFamily: 'var(--kt-font-mono)'
                          }}
                        />
                        <Bar dataKey="efficiency" name="Efficiency %" radius={[0, 2, 2, 0]}>
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
      <div className="kt-panel overflow-hidden">
        <div className="kt-panel-header">
          <div className="flex items-center gap-3">
            <Scale className="w-4 h-4 text-info" />
            <div>
              <h2 className="text-sm font-display font-bold tracking-wide uppercase text-text-primary">
                HPA Horizontal Pod Autoscalers
              </h2>
              <p className="text-[10px] text-text-tertiary font-mono">
                Native Kubernetes HPA scaling metrics
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {data.hpa.length === 0 ? (
            <div className="text-center py-12">
              <Scale className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
              <p className="text-text-tertiary font-mono uppercase tracking-wider">No HPA resources found</p>
            </div>
          ) : (
            <>
              {/* Sort Controls */}
              <div className="flex items-center gap-4 p-3 kt-panel-inset">
                <span className="text-xs font-sans font-semibold text-text-tertiary tracking-wider uppercase">Sort by:</span>
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
                    className={`kt-button kt-button-sm ${hpaSortBy === 'currentReplicas' ? 'kt-button-primary' : 'kt-button-secondary'}`}
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
                    className={`kt-button kt-button-sm ${hpaSortBy === 'name' ? 'kt-button-primary' : 'kt-button-secondary'}`}
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
                    className={`kt-button kt-button-sm ${hpaSortBy === 'cpuUtilization' ? 'kt-button-primary' : 'kt-button-secondary'}`}
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
                    className={`p-5 rounded-xl border cursor-pointer transition-all ${
                      selectedHPA === hpa.name
                        ? 'border-info bg-info/5'
                        : 'border-border-main hover:border-info/30 bg-bg-hover/30'
                    }`}
                    onClick={() => setSelectedHPA(
                      selectedHPA === hpa.name ? null : hpa.name
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-display font-bold text-text-primary truncate tracking-wide uppercase">{hpa.name}</span>
                        <span className="text-[10px] text-text-tertiary font-mono shrink-0">{hpa.namespace}</span>
                        {!hpa.isActive && (
                          <span className="kt-badge kt-badge-danger shrink-0">
                            Inactive
                          </span>
                        )}
                        {hpa.scalingLimited && (
                          <span className="kt-badge kt-badge-warning shrink-0">
                            Limited
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-11 sm:ml-0">
                        <div className="flex items-center gap-1">
                          {hpa.isActive ? (
                            <CheckCircle2 className="w-4 h-4 text-success" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-danger" />
                          )}
                          <span className="text-sm font-mono font-bold text-text-primary">
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

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div className="kt-panel-inset text-center p-3">
                        <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Current</p>
                        <p className="text-lg font-mono font-bold text-text-primary">
                          {hpa.currentReplicas}
                        </p>
                        <p className="text-[10px] text-text-tertiary font-mono">
                          {hpa.minReplicas}-{hpa.maxReplicas}
                        </p>
                      </div>
                      <div className="kt-panel-inset text-center p-3">
                        <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Desired</p>
                        <p className={`text-lg font-mono font-bold ${
                          hpa.desiredReplicas !== hpa.currentReplicas ? 'text-warning' : 'text-text-primary'
                        }`}>
                          {hpa.desiredReplicas}
                        </p>
                      </div>
                      <div className="kt-panel-inset text-center p-3">
                        <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">CPU Target</p>
                        <p className="text-lg font-mono font-bold text-text-primary">
                          {hpa.cpuUtilization?.targetUtilization || '-'}%
                        </p>
                        {hpa.cpuUtilization && (
                          <p className="text-[10px] text-text-tertiary font-mono">
                            {hpa.cpuUtilization.currentUtilization}%
                          </p>
                        )}
                      </div>
                      <div className="kt-panel-inset text-center p-3">
                        <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Memory Target</p>
                        <p className="text-lg font-mono font-bold text-text-primary">
                          {hpa.memoryUtilization?.targetUtilization || '-'}%
                        </p>
                        {hpa.memoryUtilization && (
                          <p className="text-[10px] text-text-tertiary font-mono">
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
                            <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-2">Scale Target</p>
                            <div className="kt-panel-inset p-3">
                              <p className="text-sm font-mono text-text-primary">
                                {hpa.scaleTargetRef.kind}: <span className="font-mono text-xs text-info">{hpa.scaleTargetRef.name}</span>
                              </p>
                              <p className="text-[10px] text-text-tertiary font-mono">{hpa.scaleTargetRef.apiVersion}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-2">Status</p>
                            <div className="kt-panel-inset p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${hpa.isActive ? 'bg-success' : 'bg-danger'}`} />
                                <span className="text-xs font-mono text-text-primary">Scaling Active</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${hpa.ableToScale ? 'bg-success' : 'bg-danger'}`} />
                                <span className="text-xs font-mono text-text-primary">Able to Scale</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {hpa.customMetrics && hpa.customMetrics.length > 0 && (
                          <div>
                            <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-2">Custom Metrics</p>
                            <div className="space-y-2">
                              {hpa.customMetrics.map((metric, idx) => (
                                <div
                                  key={idx}
                                  className="kt-panel-inset p-3 flex items-center justify-between"
                                >
                                  <div>
                                    <p className="text-sm font-mono font-bold text-text-primary">{metric.name}</p>
                                    <p className="text-[10px] text-text-tertiary font-mono">Type: {metric.type}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-mono font-bold text-text-primary">
                                      {metric.currentValue.toFixed(2)}
                                    </p>
                                    <p className="text-[10px] text-text-tertiary font-mono">
                                      Target: {metric.targetValue.toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {hpa.misconfigurations && hpa.misconfigurations.length > 0 && (
                          <div className="p-3 rounded-xl bg-danger/10 border border-danger/20">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-4 h-4 text-danger" />
                              <span className="text-sm font-display font-bold text-danger tracking-wide uppercase">Configuration Issues</span>
                            </div>
                            <ul className="space-y-1">
                              {hpa.misconfigurations.map((m, i) => (
                                <li key={i} className="text-xs text-danger/80 font-mono flex items-start gap-2">
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
      <div className="kt-panel overflow-hidden">
        <div className="kt-panel-header">
          <div className="flex items-center gap-3">
            <Server className="w-4 h-4 text-primary-500" />
            <div>
              <h2 className="text-sm font-display font-bold tracking-wide uppercase text-text-primary">
                Node Claims
              </h2>
              <p className="text-[10px] text-text-tertiary font-mono">
                Karpenter and Azure NAP node provisioning progress
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {nodeClaims.length === 0 ? (
            <div className="text-center py-12">
              <Server className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
              <p className="text-text-tertiary font-mono uppercase tracking-wider">No node claims found</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              {nodeClaimsSummary && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                  {[
                    { label: 'Total', value: nodeClaimsSummary.total, color: 'text-text-primary' },
                    { label: 'Ready', value: nodeClaimsSummary.ready, color: 'text-success' },
                    { label: 'Pending', value: nodeClaimsSummary.pending, color: 'text-warning' },
                    { label: 'Drifted', value: nodeClaimsSummary.drifted, color: 'text-danger' },
                    { label: 'Expired', value: nodeClaimsSummary.expired, color: 'text-text-tertiary' },
                    { label: 'Stuck >5m', value: nodeClaimsSummary.stuckPendingCount, color: 'text-danger' },
                  ].map((s, i) => (
                    <div key={i} className="kt-panel-inset p-3 text-center">
                      <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-1">{s.label}</p>
                      <p className={`text-xl font-mono font-black ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Claims Table */}
              <div className="space-y-3">
                {nodeClaims.map(claim => (
                  <div
                    key={`${claim.provisionerType}-${claim.name}`}
                    className={`rounded-xl border-2 transition-all ${
                      selectedNodeClaim === `${claim.provisionerType}-${claim.name}`
                        ? 'border-primary-500 bg-primary-500/5 kt-amber-glow'
                        : 'border-border-main hover:border-primary-500/30 bg-bg-hover/30'
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
                          <span className="font-display font-bold text-text-primary tracking-wide uppercase">{claim.name}</span>
                          <span className={`kt-badge ${
                            claim.provisionerType === 'karpenter'
                              ? 'kt-badge-info'
                              : 'kt-badge-warning'
                          } shrink-0`}>
                            {claim.provisionerType}
                          </span>
                          <span className={`kt-badge shrink-0 ${
                            claim.status === 'Ready'
                              ? 'kt-badge-success'
                              : claim.status === 'Pending'
                              ? 'kt-badge-warning'
                              : claim.status === 'Drifted'
                              ? 'kt-badge-danger'
                              : 'kt-badge-info'
                          }`}
                          >
                            {claim.status}
                          </span>
                          <span className="text-[10px] text-text-tertiary font-mono">{claim.nodePool}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-text-secondary">{Math.round(claim.age / 60)}m</span>
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
                            <div className="kt-panel-inset p-2">
                              <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Instance Type</p>
                              <p className="text-sm font-mono font-bold text-text-primary">{claim.instanceType}</p>
                            </div>
                          )}
                          {claim.zone && (
                            <div className="kt-panel-inset p-2">
                              <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Zone</p>
                              <p className="text-sm font-mono font-bold text-text-primary">{claim.zone}</p>
                            </div>
                          )}
                          {claim.capacityType && (
                            <div className="kt-panel-inset p-2">
                              <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Capacity</p>
                              <p className="text-sm font-mono font-bold text-text-primary capitalize">{claim.capacityType}</p>
                            </div>
                          )}
                          {claim.nodeName && (
                            <div className="kt-panel-inset p-2">
                              <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase">Node</p>
                              <p className="text-sm font-mono font-bold text-text-primary">{claim.nodeName}</p>
                            </div>
                          )}
                        </div>

                        {claim.conditions && claim.conditions.length > 0 && (
                          <div>
                            <p className="text-[10px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-2">Conditions</p>
                            <div className="space-y-2">
                              {claim.conditions.map((cond, idx) => (
                                <div key={idx} className="flex items-start gap-2 p-2 kt-panel-inset">
                                  <span className={`mt-0.5 ${cond.status === 'True' ? 'text-success' : 'text-danger'}`}>
                                    {cond.status === 'True' ? (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    ) : (
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    )}
                                  </span>
                                  <div>
                                    <p className="text-xs font-mono font-bold text-text-primary">{cond.type}</p>
                                    {cond.reason && <p className="text-[10px] text-text-secondary font-mono">{cond.reason}</p>}
                                    {cond.message && <p className="text-[10px] text-text-secondary font-mono">{cond.message}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {claim.misconfigurations && claim.misconfigurations.length > 0 && (
                          <div className="p-3 rounded-xl bg-danger/10 border border-danger/20">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-4 h-4 text-danger" />
                              <span className="text-sm font-display font-bold text-danger tracking-wide uppercase">Issues</span>
                            </div>
                            <ul className="space-y-1">
                              {claim.misconfigurations.map((m, i) => (
                                <li key={i} className="text-xs text-danger/80 font-mono flex items-start gap-2">
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
        <div className="kt-panel overflow-hidden">
          <div className="kt-panel-header">
            <div className="flex items-center gap-3">
              <DollarSign className="w-4 h-4 text-warning" />
              <div>
                <h2 className="text-sm font-display font-bold tracking-wide uppercase text-text-primary">
                  Cost Analysis
                </h2>
                <p className="text-[10px] text-text-tertiary font-mono">
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
                      borderRadius: '2px',
                      color: 'var(--kt-fg-primary)',
                      fontFamily: 'var(--kt-font-mono)'
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                  />
                  <Bar dataKey="costPerCPU" name="Cost per CPU/month" fill={COLORS.primary} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="costPerMemory" name="Cost per GB Memory/month" fill={COLORS.info} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="flex items-center justify-center gap-2 text-text-tertiary text-xs font-mono uppercase tracking-wider">
        <Clock className="w-3 h-3" />
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};

export const ScalingEfficiencyView = memo(ScalingEfficiencyViewComponent);
