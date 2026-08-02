
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Workload, ResourceMetrics, ViewPropsWithChat, OptimizationProfile, DiagnosticPlaybook } from '../types';
import { useMonitoring } from '../contexts/MonitoringContext';
import { generateRightSizingRecommendation, generateKubectlPatch } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { ComposedChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Scatter, Cell } from 'recharts';
import { Scale, Loader2, Sparkles, Activity, CheckCircle2, AlertCircle, RefreshCw, Gauge, Search, ChevronLeft, Layers, Clock, MapPin, Server, Globe, ExternalLink, Terminal, DollarSign, Target, TrendingUp, Cpu, MemoryStick, RotateCcw, Settings2, ShieldAlert, ZapOff, Info, Zap, AlertTriangle, ArrowUpRight, Radio, ArrowRight, Box, HardDrive } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Pod {
  id: string;
  name: string;
  status: 'Running' | 'Pending' | 'CrashLoopBackOff' | 'ContainerCreating' | 'Terminating' | 'Error';
  isReady: boolean;
  isLive: boolean;
  restarts: number;
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  gpuUsage?: number;
  node: string;
  instanceType: string;
  zone: string;
  schedulingInfo?: string;
}

interface SnapshotPoint {
  recordedAt: string;
  cpuUsage: number;
  cpuLimit: number;
  cpuLimitPerPod?: number;
  cpuMaxPodUsage?: number;
  cpuHotPodP99?: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryLimitPerPod?: number;
  memoryMaxPodUsage?: number;
  memoryHotPodP99?: number;
  storageUsage: number;
  storageLimit: number;
  storageLimitPerPod?: number;
  storageMaxPodUsage?: number;
  gpuUsage: number;
  gpuLimit: number;
  gpuLimitPerPod?: number;
  gpuMaxPodUsage?: number;
  podCount: number;
}

interface HistoryResponse {
  points: SnapshotPoint[];
}

// baselineUsage returns the P99 of the most overloaded pod for CPU and memory.
// If P99 is unavailable, it falls back to the current peak pod usage, then to
// aggregate workload usage, so the UI still renders when Prometheus is absent.
const baselineUsage = (workload: Workload) => ({
  cpu: workload.metrics.cpuHotPodP99 || workload.metrics.cpuMaxPodUsage || workload.metrics.cpuUsage,
  memory: workload.metrics.memoryHotPodP99 || workload.metrics.memoryMaxPodUsage || workload.metrics.memoryUsage,
  storage: workload.metrics.storageMaxPodUsage ?? workload.metrics.storageUsage ?? 0.1,
  gpu: workload.metrics.gpuMaxPodUsage ?? workload.metrics.gpuUsage ?? 0,
});

// perPodLimit returns the per-pod resource limit for right-sizing. Kubernetes
// container limits are per-container, so a Deployment's aggregate limit is not
// meaningful for sizing. We prefer the per-pod limit exposed by the backend and
// fall back to deriving it from the capped pod list, then to the aggregate limit.
// A limit of 0 means "not configured", so we treat it as missing and fall back.
const perPodLimit = (workload: Workload) => {
  const pods = workload.pods || [];
  const firstPodCpu = pods[0]?.metrics?.cpuLimit;
  const firstPodMem = pods[0]?.metrics?.memoryLimit;
  const firstPodStorage = pods[0]?.metrics?.storageLimit;
  const firstPodGpu = pods[0]?.metrics?.gpuLimit;
  return {
    cpu: workload.metrics.cpuLimitPerPod || firstPodCpu || workload.metrics.cpuLimit || 0.01,
    memory: workload.metrics.memoryLimitPerPod || firstPodMem || workload.metrics.memoryLimit || 128,
    storage: workload.metrics.storageLimitPerPod || firstPodStorage || workload.metrics.storageLimit || 0,
    gpu: workload.metrics.gpuLimitPerPod || firstPodGpu || workload.metrics.gpuLimit || 0,
  };
};

const fetchHistoricalMetrics = async (clusterId: string, namespace: string, workloadName: string): Promise<SnapshotPoint[]> => {
  const res = await fetch(`/api/cluster/workloads/${encodeURIComponent(namespace)}/${encodeURIComponent(workloadName)}/history?cluster=${encodeURIComponent(clusterId)}`);
  if (!res.ok) return [];
  const data: HistoryResponse = await res.json();
  return data.points || [];
};

const buildChartData = (snapshots: SnapshotPoint[], workload: Workload) => {
  const perPod = perPodLimit(workload);

  return snapshots.map(s => {
    const date = new Date(s.recordedAt);
    return {
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: date.getTime(),
      cpuUsage: s.cpuHotPodP99 || s.cpuMaxPodUsage || s.cpuUsage,
      cpuLimit: s.cpuLimitPerPod || perPod.cpu,
      memoryUsage: s.memoryHotPodP99 || s.memoryMaxPodUsage || s.memoryUsage,
      memoryLimit: s.memoryLimitPerPod || perPod.memory,
      storageUsage: s.storageMaxPodUsage ?? s.storageUsage,
      storageLimit: s.storageLimitPerPod || perPod.storage,
      gpuUsage: s.gpuMaxPodUsage ?? s.gpuUsage,
      gpuLimit: s.gpuLimitPerPod || perPod.gpu,
    };
  });
};

const generateSyntheticHistory = (workload: Workload) => {
  const now = Date.now();
  const baseline = baselineUsage(workload);
  const perPod = perPodLimit(workload);
  const points = [];
  for (let i = 6; i >= 0; i--) {
    const ts = now - i * 5 * 60 * 1000;
    points.push({
      time: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: ts,
      cpuUsage: baseline.cpu,
      cpuLimit: perPod.cpu,
      memoryUsage: baseline.memory,
      memoryLimit: perPod.memory,
      storageUsage: baseline.storage,
      storageLimit: perPod.storage,
      gpuUsage: baseline.gpu,
      gpuLimit: perPod.gpu,
    });
  }
  return points;
};

const buildPodsFromWorkload = (workload: Workload): Pod[] => {
  if (workload.pods && workload.pods.length > 0) {
    return workload.pods.map(pod => ({
      id: `${workload.clusterId}-${pod.namespace}-${pod.name}`,
      name: pod.name,
      status: pod.phase === 'Failed' ? 'Error' : pod.phase === 'Pending' ? 'Pending' : 'Running',
      isReady: pod.phase === 'Running' && pod.status !== 'Critical',
      isLive: pod.phase === 'Running',
      restarts: pod.restartCount,
      cpuUsage: pod.metrics.cpuUsage,
      memoryUsage: pod.metrics.memoryUsage,
      storageUsage: pod.metrics.storageUsage || 0,
      gpuUsage: pod.metrics.gpuUsage,
      node: pod.node || 'Unknown',
      instanceType: 'Unknown',
      zone: 'Unknown',
      schedulingInfo: pod.waitingReason || pod.terminatedReason,
    }));
  }

  // Fallback: one representative pod built from aggregate metrics.
  return [{
    id: `${workload.id}-aggregate`,
    name: `${workload.name} (aggregate)`,
    status: workload.availableReplicas === workload.replicas ? 'Running' : 'Pending',
    isReady: workload.availableReplicas > 0,
    isLive: workload.availableReplicas > 0,
    restarts: 0,
    cpuUsage: workload.metrics.cpuUsage,
    memoryUsage: workload.metrics.memoryUsage,
    storageUsage: workload.metrics.storageUsage || 0,
    gpuUsage: workload.metrics.gpuUsage,
    node: 'Unknown',
    instanceType: 'Unknown',
    zone: 'Unknown',
  }];
};

const CustomTooltip = ({ active, payload, isDarkMode, type }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const unit = type === 'cpu' ? 'c' : type === 'memory' ? 'Mi' : type === 'gpu' ? '%' : 'Gi';
    const valKey = type === 'cpu' ? 'cpuUsage' : type === 'memory' ? 'memoryUsage' : type === 'gpu' ? 'gpuUsage' : 'storageUsage';
    const limitKey = type === 'cpu' ? 'cpuLimit' : type === 'memory' ? 'memoryLimit' : type === 'gpu' ? 'gpuLimit' : 'storageLimit';
    const color = type === 'cpu' ? 'text-primary-500' : type === 'memory' ? 'text-emerald-500' : type === 'gpu' ? 'text-violet-500' : 'text-primary-500';

    return (
      <div className={`p-4 rounded-2xl border shadow-2xl text-xs min-w-[220px] backdrop-blur-md bg-bg-card border-border-main text-text-secondary font-sans`}>
        <div className="font-semibold border-b border-border-main pb-2 mb-3 text-[10px] text-text-tertiary">
          Frame: {data.time}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between gap-4 items-center">
            <span className="font-medium text-text-tertiary text-[10px]">Demand</span>
            <span className={`font-bold ${color}`}>{data[valKey].toFixed(2)}{unit}</span>
          </div>
          <div className="flex justify-between gap-4 items-center">
            <span className="font-medium text-text-tertiary text-[10px]">Current limit</span>
            <span className="font-bold text-text-muted">{data[limitKey].toFixed(2)}{unit}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface RightSizingViewProps extends ViewPropsWithChat {
  onTriageRequest?: (workloadId: string, playbook: DiagnosticPlaybook, podName?: string) => void;
  onRefresh?: () => void;
  initialWorkloadId?: string;
  defaultTemplate?: string;
}

export const RightSizingView: React.FC<RightSizingViewProps> = ({ workloads, isDarkMode = true, onOpenChat, defaultTemplate: propTemplate, onTriageRequest, initialWorkloadId: propId, onRefresh }) => {
  const location = useLocation();
  const { aiConfig } = useMonitoring();
  const { workloadId: stateId, template: stateTemplate } = location.state || {}; // Read from router state

  if (!workloads || workloads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] animate-in fade-in duration-500">
        <div className="p-6 bg-bg-hover rounded-full mb-6 relative">
          <Server className="w-12 h-12 text-text-tertiary" />
          <div className="absolute top-0 right-0 w-3 h-3 bg-amber-500 rounded-full animate-ping" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">No optimization candidates</h2>
        <p className="text-text-tertiary max-w-md text-center mb-8 text-sm">
          We couldn't detect any workloads to analyze. Please ensure your cluster is connected and has active deployments.
        </p>
        <button
          onClick={() => onRefresh?.()}
          className="kt-button kt-button-primary"
        >
          <Activity className="w-4 h-4" /> Refresh data
        </button>
      </div>
    );
  }

  const initialWorkloadId = stateId || propId;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [adjustedCpuLimit, setAdjustedCpuLimit] = useState<number>(0.1);
  const [adjustedMemoryLimit, setAdjustedMemoryLimit] = useState<number>(128);
  const [adjustedStorageLimit, setAdjustedStorageLimit] = useState<number>(5);
  const [adjustedGpuLimit, setAdjustedGpuLimit] = useState<number>(1);
  const [selectedProfile, setSelectedProfile] = useState<OptimizationProfile>('Balanced');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const safeWorkloads = workloads || [];
  const selectedWorkload = safeWorkloads.find(w => w.id === selectedId);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    if (initialWorkloadId) {
      const workload = safeWorkloads.find(w => w.id === initialWorkloadId || w.name === initialWorkloadId);
      if (workload) {
        setSelectedId(workload.id);
        setIsSidebarOpen(false);
      }
    }
  }, [initialWorkloadId, safeWorkloads]);

  const loadMetrics = useCallback(async (workload: Workload) => {
    setMetricsLoading(true);
    try {
      const snapshots = await fetchHistoricalMetrics(workload.clusterId, workload.namespace, workload.name);
      if (snapshots.length > 1) {
        setChartData(buildChartData(snapshots, workload));
      } else {
        // Not enough history yet: show a synthetic line from current metrics so the UI isn't empty.
        setChartData(generateSyntheticHistory(workload));
      }
    } catch (err) {
      console.error('Failed to load historical metrics', err);
      setChartData(generateSyntheticHistory(workload));
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedWorkload) {
      const perPod = perPodLimit(selectedWorkload);
      setAdjustedCpuLimit(perPod.cpu);
      setAdjustedMemoryLimit(perPod.memory);
      setAdjustedStorageLimit(perPod.storage);
      setAdjustedGpuLimit(perPod.gpu);
      setRecommendation(null);
      setIsAutoRefresh(true);
      loadMetrics(selectedWorkload);
    }
  }, [selectedId, selectedWorkload, loadMetrics]);

  useEffect(() => {
    let intervalId: any;
    if (isAutoRefresh && selectedWorkload) {
      intervalId = setInterval(() => {
        loadMetrics(selectedWorkload);
      }, 30000);
    }
    return () => clearInterval(intervalId);
  }, [isAutoRefresh, selectedWorkload, loadMetrics]);

  const handleToggleLive = () => {
    setIsAutoRefresh(prev => !prev);
  };

  const analysis = useMemo(() => {
    if (!chartData.length || !selectedWorkload) return null;

    const peakCpu = Math.max(...chartData.map(d => d.cpuUsage));
    const peakMem = Math.max(...chartData.map(d => d.memoryUsage));
    const peakStorage = Math.max(...chartData.map(d => d.storageUsage));
    const peakGpu = Math.max(...chartData.map(d => d.gpuUsage || 0));

    const cpuEfficiency = (peakCpu / adjustedCpuLimit) * 100;
    const memEfficiency = (peakMem / adjustedMemoryLimit) * 100;
    const storageEfficiency = (peakStorage / adjustedStorageLimit) * 100;
    const gpuEfficiency = adjustedGpuLimit > 0 ? (peakGpu / adjustedGpuLimit) * 100 : 0;

    const cpuRisky = adjustedCpuLimit < peakCpu;
    const memRisky = adjustedMemoryLimit < peakMem;
    const storageRisky = adjustedStorageLimit < peakStorage;
    const gpuRisky = adjustedGpuLimit > 0 && peakGpu > adjustedGpuLimit;

    const throttledPoints = chartData.filter(d => d.cpuUsage > adjustedCpuLimit);
    const memOomPoints = chartData.filter(d => d.memoryUsage > adjustedMemoryLimit);
    const storagePressurePoints = chartData.filter(d => d.storageUsage > adjustedStorageLimit);
    const gpuPressurePoints = chartData.filter(d => (d.gpuUsage || 0) > adjustedGpuLimit);

    return {
      cpuEfficiency: cpuEfficiency.toFixed(1),
      memEfficiency: memEfficiency.toFixed(1),
      storageEfficiency: storageEfficiency.toFixed(1),
      gpuEfficiency: gpuEfficiency.toFixed(1),
      isRisky: cpuRisky || memRisky || storageRisky || gpuRisky,
      cpuRisky,
      memRisky,
      storageRisky,
      gpuRisky,
      throttledPoints,
      memOomPoints,
      storagePressurePoints,
      gpuPressurePoints
    };
  }, [chartData, adjustedCpuLimit, adjustedMemoryLimit, adjustedStorageLimit, adjustedGpuLimit, selectedWorkload]);

  const pods = useMemo(() => {
    if (!selectedWorkload) return [];
    return buildPodsFromWorkload(selectedWorkload);
  }, [selectedWorkload]);

  const handleOptimize = async () => {
    if (loading) return;
    const targetWorkload = safeWorkloads.find(w => w.id === selectedId);
    if (!targetWorkload) return;

    setLoading(true);
    setRecommendation(null);
    const report = await generateRightSizingRecommendation(
      targetWorkload,
      `Efficiency: CPU ${analysis?.cpuEfficiency}%, RAM ${analysis?.memEfficiency}%, Storage ${analysis?.storageEfficiency}%`,
      selectedProfile,
      aiConfig.provider,
      aiConfig.model
    );
    setRecommendation(report);
    setLoading(false);
  };

  const getStatusMeta = (status: Pod['status']) => {
    switch (status) {
      case 'Running': return { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
      case 'Pending': return { icon: <Clock className="w-4 h-4 animate-pulse" />, color: 'text-amber-500', bg: 'bg-amber-500/10' };
      default: return { icon: <Activity className="w-4 h-4" />, color: 'text-text-tertiary', bg: 'bg-text-tertiary/10' };
    }
  };

  const filteredWorkloads = (workloads || []).filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col h-full w-full bg-bg-main text-text-primary font-sans selection:bg-primary-500/30">
      {/* Page Header */}
      <div className="shrink-0 p-6 border-b border-border-main bg-bg-card/50 backdrop-blur-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="min-w-0">
          <h2 className="text-3xl font-black text-text-primary flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-primary-600 to-primary-500 rounded-xl shadow-lg shadow-primary-500/20 border border-transparent shrink-0">
              <Scale className="w-6 h-6 text-white" />
            </div>
            Right-sizing
          </h2>
          <p className="text-sm text-text-tertiary mt-2 font-medium pl-1">
            Analyze real resource utilization and tune CPU, memory, and storage limits.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row gap-6 p-6 relative w-full">

      <aside className={`
        ${selectedId && !isSidebarOpen ? 'hidden' : 'flex'}
        lg:flex w-full lg:w-80 h-auto lg:h-full shrink-0 bg-bg-card rounded-2xl overflow-hidden flex flex-col border border-border-main shadow-sm
      `}>
        <div className="p-4 border-b border-border-main bg-bg-hover/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-600 rounded-lg shadow-sm shadow-primary-500/20">
              <Scale className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-text-primary text-sm">Infrastructure fleet</h3>
          </div>
        </div>
        <div className="p-3 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="kt-input pl-11 pr-4 text-xs font-medium"
            />
          </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 bg-bg-hover/30">
          {filteredWorkloads.map(w => (
            <div
              key={w.id}
              onClick={() => { setSelectedId(w.id); setRecommendation(null); setIsSidebarOpen(false); }}
              className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedId === w.id ? 'bg-primary-500/10 border-primary-500/30' : 'bg-bg-card border-transparent hover:bg-bg-hover'}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-sm font-medium truncate ${selectedId === w.id ? 'text-text-primary' : 'text-text-secondary'}`}>{w.name}</span>
                <div className={`w-2 h-2 rounded-full ${w.status === 'Healthy' ? 'bg-emerald-500' : w.status === 'Warning' ? 'bg-amber-500' : 'bg-red-500'}`} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-tertiary font-medium">{w.kind}</span>
                <span className="text-[10px] text-text-tertiary/70 select-none">•</span>
                <span className="text-[10px] text-text-tertiary">{w.namespace}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className={`
        ${!selectedId || isSidebarOpen ? 'hidden' : 'flex'}
        lg:flex flex-1 min-w-0 bg-bg-card rounded-2xl overflow-hidden flex flex-col border border-border-main shadow-sm
      `}>
        {selectedWorkload ? (
          <div className="flex flex-col h-full min-h-0">
            <header className="p-5 md:p-6 border-b border-border-main bg-bg-hover/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 relative z-20">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2.5 rounded-xl bg-bg-card border border-border-main">
                  <ChevronLeft className="w-5 h-5 text-primary-500" />
                </button>
                <div className="p-2.5 bg-gradient-to-br from-primary-600 to-primary-500 rounded-xl shadow-lg shadow-primary-500/20 border border-transparent shrink-0">
                  <Gauge className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl md:text-3xl font-black text-text-primary leading-none">{selectedWorkload.name}</h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-text-tertiary">{selectedWorkload.namespace}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium border border-primary-500/20">{selectedWorkload.kind}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleOptimize}
                  disabled={loading}
                  className="kt-button kt-button-primary flex items-center gap-2 shadow-sm shadow-primary-500/20"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Analyze capacity
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-10 bg-bg-hover/20 pb-20">
              {/* Simulation Cockpit */}
              <section className="bg-bg-card rounded-2xl border border-border-main shadow-xl overflow-hidden">
                <div className="p-6 md:p-8 border-b border-border-main bg-bg-hover/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary-500/10 rounded-xl"><Settings2 className="w-5 h-5 text-primary-500 dark:text-primary-400" /></div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">Right-sizing Cockpit</h3>
                      <p className="text-xs text-text-tertiary">Adjust limits and compare against real historical demand.</p>
                    </div>
                  </div>
                  {metricsLoading && (
                    <div className="flex items-center gap-2 text-text-tertiary">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-sans">Loading metrics…</span>
                    </div>
                  )}
                </div>

                <div className="p-8 space-y-8">
                  {/* CPU Slider */}
                  <div className="flex flex-col lg:flex-row gap-6 items-center bg-bg-hover/50 p-5 rounded-xl border border-border-main">
                    <div className="flex-[3] w-full space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-primary-500" /><label className="text-[10px] font-semibold text-text-tertiary">CPU limit</label></div>
                        <span className="text-xl font-bold text-primary-500">{adjustedCpuLimit.toFixed(2)}c</span>
                      </div>
                      <input type="range" min="0.01" max={perPodLimit(selectedWorkload).cpu * 2} step="0.01" value={adjustedCpuLimit} onChange={(e) => setAdjustedCpuLimit(parseFloat(e.target.value))} className="w-full h-3 bg-bg-hover rounded-full appearance-none cursor-pointer accent-primary-600" />
                    </div>
                    <div className="flex-[1] w-full min-w-0 p-4 rounded-xl bg-bg-card border border-border-main text-center">
                      <p className="text-[8px] font-semibold text-text-tertiary mb-1">CPU load</p>
                      <div className={`text-lg font-bold ${parseFloat(analysis?.cpuEfficiency || '0') > 90 ? 'text-rose-500' : 'text-primary-500'}`}>{analysis?.cpuEfficiency}%</div>
                    </div>
                  </div>

                  {/* Memory Slider */}
                  <div className="flex flex-col lg:flex-row gap-6 items-center bg-bg-hover/50 p-5 rounded-xl border border-border-main">
                    <div className="flex-[3] w-full space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-2"><MemoryStick className="w-4 h-4 text-emerald-500" /><label className="text-[10px] font-semibold text-text-tertiary">Memory limit</label></div>
                        <span className="text-xl font-bold text-emerald-500">{adjustedMemoryLimit.toFixed(0)}Mi</span>
                      </div>
                      <input type="range" min="10" max={perPodLimit(selectedWorkload).memory * 2} step="10" value={adjustedMemoryLimit} onChange={(e) => setAdjustedMemoryLimit(parseFloat(e.target.value))} className="w-full h-3 bg-bg-hover rounded-full appearance-none cursor-pointer accent-emerald-500" />
                    </div>
                    <div className="flex-[1] w-full min-w-0 p-4 rounded-xl bg-bg-card border border-border-main text-center">
                      <p className="text-[8px] font-semibold text-text-tertiary mb-1">RAM load</p>
                      <div className={`text-lg font-bold ${parseFloat(analysis?.memEfficiency || '0') > 90 ? 'text-rose-500' : 'text-emerald-500'}`}>{analysis?.memEfficiency}%</div>
                    </div>
                  </div>

                  {/* Storage Slider - only show when a storage limit is configured */}
                  {(perPodLimit(selectedWorkload).storage || 0) > 0 && (
                    <div className="flex flex-col lg:flex-row gap-6 items-center bg-bg-hover/50 p-5 rounded-xl border border-border-main">
                      <div className="flex-[3] w-full space-y-4">
                        <div className="flex justify-between items-end">
                          <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-amber-500" /><label className="text-[10px] font-semibold text-text-tertiary">Ephemeral storage limit</label></div>
                          <span className="text-xl font-bold text-amber-500">{adjustedStorageLimit.toFixed(1)}Gi</span>
                        </div>
                        <input type="range" min="0.1" max={perPodLimit(selectedWorkload).storage * 2} step="0.1" value={adjustedStorageLimit} onChange={(e) => setAdjustedStorageLimit(parseFloat(e.target.value))} className="w-full h-3 bg-bg-hover rounded-full appearance-none cursor-pointer accent-amber-500" />
                      </div>
                      <div className="flex-[1] w-full min-w-0 p-4 rounded-xl bg-bg-card border border-border-main text-center">
                        <p className="text-[8px] font-semibold text-text-tertiary mb-1">Disk load</p>
                        <div className={`text-lg font-bold ${parseFloat(analysis?.storageEfficiency || '0') > 90 ? 'text-rose-500' : 'text-amber-500'}`}>{analysis?.storageEfficiency}%</div>
                      </div>
                    </div>
                  )}

                  {/* GPU Slider - Only show if workload has GPU resources */}
                  {(perPodLimit(selectedWorkload).gpu || 0) > 0 && (
                    <div className="flex flex-col lg:flex-row gap-6 items-center bg-bg-hover/50 p-5 rounded-xl border border-border-main">
                      <div className="flex-[3] w-full space-y-4">
                        <div className="flex justify-between items-end">
                          <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-violet-500" /><label className="text-[10px] font-semibold text-text-tertiary">GPU limit</label></div>
                          <span className="text-xl font-bold text-violet-500">{adjustedGpuLimit.toFixed(0)} GPU</span>
                        </div>
                        <input type="range" min="1" max={perPodLimit(selectedWorkload).gpu * 2} step="1" value={adjustedGpuLimit} onChange={(e) => setAdjustedGpuLimit(parseFloat(e.target.value))} className="w-full h-3 bg-bg-hover rounded-full appearance-none cursor-pointer accent-violet-500" />
                      </div>
                      <div className="flex-[1] w-full min-w-0 p-4 rounded-xl bg-bg-card border border-border-main text-center">
                        <p className="text-[8px] font-semibold text-text-tertiary mb-1">GPU Util</p>
                        <div className={`text-lg font-bold ${parseFloat(analysis?.gpuEfficiency || '0') > 90 ? 'text-rose-500' : 'text-violet-500'}`}>{analysis?.gpuEfficiency}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Telemetry Grid */}
              <div className="grid grid-cols-1 gap-8">
                {/* CPU Chart */}
                <div className="bg-bg-card rounded-2xl border border-border-main p-6 shadow-sm min-w-0">
                  <h3 className="text-xs font-medium text-text-tertiary mb-6 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-primary-500" /> CPU P99 peak pod demand
                  </h3>
                  <div className="h-[240px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <XAxis dataKey="time" hide />
                        <YAxis
                          domain={[0, 'auto']}
                          tick={{ fill: 'var(--kt-text-tertiary)', fontSize: 10 }}
                          tickFormatter={(v: number) => `${v.toFixed(2)}c`}
                          axisLine={{ stroke: 'var(--kt-border-main)' }}
                          tickLine={{ stroke: 'var(--kt-border-main)' }}
                          width={55}
                        />
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} type="cpu" />} />
                        <Area type="monotone" dataKey="cpuUsage" stroke="var(--kt-primary-500)" strokeWidth={4} fillOpacity={0.1} fill="var(--kt-primary-500)" isAnimationActive={false} />
                        <ReferenceLine y={adjustedCpuLimit} stroke={analysis?.cpuRisky ? 'var(--kt-danger)' : 'var(--kt-success)'} strokeDasharray="8 8" strokeWidth={3} />
                        <Scatter data={analysis?.throttledPoints || []} fill="var(--kt-danger)" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* RAM Chart */}
                <div className="bg-bg-card rounded-2xl border border-border-main p-6 shadow-sm min-w-0">
                  <h3 className="text-xs font-medium text-text-tertiary mb-6 flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-emerald-500" /> Memory P99 peak pod pressure
                  </h3>
                  <div className="h-[240px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <XAxis dataKey="time" hide />
                        <YAxis
                          domain={[0, 'auto']}
                          tick={{ fill: 'var(--kt-text-tertiary)', fontSize: 10 }}
                          tickFormatter={(v: number) => `${Math.round(v)}Mi`}
                          axisLine={{ stroke: 'var(--kt-border-main)' }}
                          tickLine={{ stroke: 'var(--kt-border-main)' }}
                          width={55}
                        />
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} type="memory" />} />
                        <Area type="monotone" dataKey="memoryUsage" stroke="var(--kt-success)" strokeWidth={4} fillOpacity={0.1} fill="var(--kt-success)" isAnimationActive={false} />
                        <ReferenceLine y={adjustedMemoryLimit} stroke={analysis?.memRisky ? 'var(--kt-danger)' : 'var(--kt-success)'} strokeDasharray="8 8" strokeWidth={3} />
                        <Scatter data={analysis?.memOomPoints || []} fill="var(--kt-danger)" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Storage Chart */}
                <div className="bg-bg-card rounded-2xl border border-border-main p-6 shadow-sm min-w-0">
                  <h3 className="text-xs font-medium text-text-tertiary mb-6 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-amber-500" /> Ephemeral storage peak pod demand
                  </h3>
                  <div className="h-[240px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <XAxis dataKey="time" hide />
                        <YAxis
                          domain={[0, 'auto']}
                          tick={{ fill: 'var(--kt-text-tertiary)', fontSize: 10 }}
                          tickFormatter={(v: number) => `${v.toFixed(1)}Gi`}
                          axisLine={{ stroke: 'var(--kt-border-main)' }}
                          tickLine={{ stroke: 'var(--kt-border-main)' }}
                          width={55}
                        />
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} type="storage" />} />
                        <Area type="monotone" dataKey="storageUsage" stroke="var(--kt-warning)" strokeWidth={4} fillOpacity={0.1} fill="var(--kt-warning)" isAnimationActive={false} />
                        <ReferenceLine y={adjustedStorageLimit} stroke={analysis?.storageRisky ? 'var(--kt-danger)' : 'var(--kt-warning)'} strokeDasharray="8 8" strokeWidth={3} />
                        <Scatter data={analysis?.storagePressurePoints || []} fill="var(--kt-danger)" />
                      </ComposedChart>
                    </ResponsiveContainer>
                    {analysis?.storageRisky && (
                      <div className="absolute inset-x-0 bottom-0 py-2 bg-rose-500/10 flex items-center justify-center gap-2 rounded-lg">
                        <ShieldAlert className="w-4 h-4 text-rose-500 animate-bounce" />
                        <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">Active DiskPressure region - eviction imminent</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* GPU Chart - Only show if workload has GPU resources */}
                {(selectedWorkload.metrics.gpuLimit || 0) > 0 && (
                  <div className="bg-bg-card rounded-2xl border border-border-main p-6 shadow-sm">
                    <h3 className="text-xs font-medium text-text-tertiary mb-6 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-violet-500" /> GPU peak pod utilization
                    </h3>
                    <div className="h-[240px] w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                          <XAxis dataKey="time" hide />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fill: 'var(--kt-text-tertiary)', fontSize: 10 }}
                            tickFormatter={(v: number) => `${v}%`}
                            axisLine={{ stroke: 'var(--kt-border-main)' }}
                            tickLine={{ stroke: 'var(--kt-border-main)' }}
                            width={55}
                          />
                          <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} type="gpu" />} />
                          <Area type="monotone" dataKey="gpuUsage" stroke="var(--kt-info)" strokeWidth={4} fillOpacity={0.1} fill="var(--kt-info)" isAnimationActive={false} />
                          <ReferenceLine y={adjustedGpuLimit * 100} stroke={analysis?.gpuRisky ? 'var(--kt-danger)' : 'var(--kt-info)'} strokeDasharray="8 8" strokeWidth={3} />
                          <Scatter data={analysis?.gpuPressurePoints || []} fill="var(--kt-danger)" />
                        </ComposedChart>
                      </ResponsiveContainer>
                      {analysis?.gpuRisky && (
                        <div className="absolute inset-x-0 bottom-0 py-2 bg-rose-500/10 flex items-center justify-center gap-2 rounded-lg">
                          <ShieldAlert className="w-4 h-4 text-rose-500 animate-bounce" />
                          <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">GPU throttling risk - consider GPU limit increase</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-[10px] text-text-tertiary font-sans px-1">
                <Info className="w-3.5 h-3.5" />
                <span>Charts show the P99 of the most overloaded pod for CPU and memory. When Prometheus is unavailable, the current peak pod usage is used instead. Recommendations size limits for the heaviest pod.</span>
              </div>

              {/* Recommendation Section */}
              {recommendation && (
                <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
                  <div className="bg-bg-card border border-primary-500/30 rounded-2xl overflow-hidden shadow-xl relative">
                    <div className="p-8 border-b border-border-main bg-bg-hover/80 backdrop-blur-md flex justify-between items-center sticky top-0 z-10">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-primary-600 to-primary-500 rounded-xl shadow-lg shadow-primary-500/20 border border-transparent">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-text-primary">AI capacity intelligence</h3>
                        </div>
                      </div>
                    </div>
                    <div className="p-10 md:p-14 prose prose-primary max-w-none prose-invert overflow-x-auto custom-scrollbar">
                      <ReactMarkdown
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '')
                            return !inline && match ? (
                              <div className="my-8 rounded-xl overflow-hidden shadow-lg">
                                <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" customStyle={{ margin: 0, padding: '2.5rem' }} {...props}>
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <code className="bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-lg font-mono text-xs" {...props}>{children}</code>
                            )
                          }
                        }}
                      >
                        {recommendation}
                      </ReactMarkdown>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center h-full animate-fade-in">
            <div className="p-6 bg-primary-500/10 rounded-full mb-4 shadow-xl shadow-primary-500/5">
              <Scale className="w-10 h-10 text-primary-500 dark:text-primary-400" />
            </div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">Capacity simulation workspace</h3>
            <p className="text-sm text-text-tertiary max-w-sm">Select a workload from the infrastructure fleet to initiate multi-dimensional capacity simulation.</p>
          </div>
        )}
      </main>
    </div>
  </div>
  );
};
