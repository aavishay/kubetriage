
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Workload, ResourceMetrics, ViewPropsWithChat, OptimizationProfile, DiagnosticPlaybook } from '../types';
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

const generateStaticHistory = (workload: Workload) => {
  const now = new Date();
  const data = [];
  for (let i = 25; i >= 0; i--) {
    const date = new Date(now);
    date.setMinutes(date.getMinutes() - i * 5);
    const base = workload.metrics;
    const noise = Math.sin(i * 0.5) * 0.1;
    const burst = i % 8 === 0 ? 0.4 : 0;

    const cpuUsage = Math.max(0.01, base.cpuUsage * (0.7 + noise + burst));
    const memoryUsage = Math.max(10, base.memoryUsage * (0.9 + (Math.cos(i) * 0.05)));
    const storageUsage = Math.max(0.1, (base.storageUsage || 1) * (0.8 + noise));
    // GPU usage simulation (0-100%)
    const gpuUsage = base.gpuUsage ? Math.max(0, Math.min(100, base.gpuUsage * (0.8 + noise + (burst * 0.5)))) : 0;

    data.push({
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: date.getTime(),
      cpuUsage,
      cpuLimit: base.cpuLimit,
      memoryUsage,
      memoryLimit: base.memoryLimit,
      storageUsage,
      storageLimit: base.storageLimit || 5,
      gpuUsage,
      gpuLimit: base.gpuLimit || 1,
    });
  }
  return data;
};

const fetchNextMockData = async (base: ResourceMetrics) => {
  const now = new Date();
  const randomCpu = 0.6 + (Math.random() * 0.6);
  const randomMem = 0.95 + (Math.random() * 0.1);
  const randomStorage = 0.98 + (Math.random() * 0.05);
  const randomGpu = 0.7 + (Math.random() * 0.5);

  return {
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    timestamp: now.getTime(),
    cpuUsage: Math.max(0.01, base.cpuUsage * randomCpu),
    cpuLimit: base.cpuLimit,
    memoryUsage: Math.max(10, base.memoryUsage * randomMem),
    memoryLimit: base.memoryLimit,
    storageUsage: Math.max(0.1, (base.storageUsage || 1) * randomStorage),
    storageLimit: base.storageLimit || 5,
    gpuUsage: Math.max(0, base.gpuUsage ? base.gpuUsage * randomGpu : 0),
    gpuLimit: base.gpuLimit || 1,
  };
};

const generateMockPods = (workload: Workload, currentMetrics: ResourceMetrics): Pod[] => {
  const pods: Pod[] = [];
  const nodes = ['node-us-east-1a-001', 'node-us-east-1b-002', 'node-us-east-1c-003'];
  const zones = ['us-east-1a', 'us-east-1b', 'us-east-1c'];
  const instanceTypes = ['n2-standard-4', 'e2-medium', 'n2-highmem-8'];

  for (let i = 0; i < workload.replicas; i++) {
    const variance = (Math.random() * 0.3) - 0.15;
    const isHealthy = i < workload.availableReplicas;

    let status: Pod['status'] = 'Running';
    if (!isHealthy) {
      status = 'Pending';
    }

    pods.push({
      id: `pod-${workload.id}-${i}`,
      name: `${workload.name}-${Math.random().toString(36).substring(7)}`,
      status,
      isReady: isHealthy,
      isLive: true,
      restarts: isHealthy ? Math.floor(Math.random() * 2) : 5,
      cpuUsage: Math.max(0, currentMetrics.cpuUsage * (1 + variance)),
      memoryUsage: Math.max(0, currentMetrics.memoryUsage * (1 + variance)),
      storageUsage: Math.max(0, (currentMetrics.storageUsage || 1) * (1 + variance)),
      node: nodes[i % nodes.length],
      instanceType: instanceTypes[i % instanceTypes.length],
      zone: zones[i % zones.length],
    });
  }
  return pods;
};

const CustomTooltip = ({ active, payload, isDarkMode, type }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const unit = type === 'cpu' ? 'c' : type === 'memory' ? 'Mi' : type === 'gpu' ? '%' : 'Gi';
    const valKey = type === 'cpu' ? 'cpuUsage' : type === 'memory' ? 'memoryUsage' : type === 'gpu' ? 'gpuUsage' : 'storageUsage';
    const limitKey = type === 'cpu' ? 'cpuLimit' : type === 'memory' ? 'memoryLimit' : type === 'gpu' ? 'gpuLimit' : 'storageLimit';
    const color = type === 'cpu' ? 'text-primary-500' : type === 'memory' ? 'text-emerald-500' : type === 'gpu' ? 'text-violet-500' : 'text-amber-500';

    return (
      <div className={`p-4 rounded-2xl border shadow-2xl text-xs min-w-[220px] backdrop-blur-md bg-bg-card border-border-main text-text-secondary font-sans`}>
        <div className="font-semibold border-b border-border-main pb-2 mb-3 uppercase tracking-widest text-[10px] text-text-tertiary">
          Frame: {data.time}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between gap-4 items-center">
            <span className="font-medium text-text-tertiary uppercase tracking-tight text-[10px]">Demand</span>
            <span className={`font-bold ${color}`}>{data[valKey].toFixed(2)}{unit}</span>
          </div>
          <div className="flex justify-between gap-4 items-center">
            <span className="font-medium text-text-tertiary uppercase tracking-tight text-[10px]">Sim Limit</span>
            <span className="font-bold text-text-muted">{data[limitKey].toFixed(2)}{unit}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface RightSizingViewProps extends ViewPropsWithChat {
  onTriageRequest?: (workloadId: string, playbook: DiagnosticPlaybook) => void;
  onRefresh?: () => void;
  initialWorkloadId?: string;
  defaultTemplate?: string;
}

export const RightSizingView: React.FC<RightSizingViewProps> = ({ workloads, isDarkMode = true, onOpenChat, defaultTemplate: propTemplate, onTriageRequest, initialWorkloadId: propId, onRefresh }) => {
  const location = useLocation();
  const { workloadId: stateId, template: stateTemplate } = location.state || {}; // Read from router state

  if (!workloads || workloads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] animate-in fade-in duration-500">
        <div className="p-6 bg-bg-hover rounded-full mb-6 relative">
          <Server className="w-12 h-12 text-text-tertiary" />
          <div className="absolute top-0 right-0 w-4 h-4 bg-amber-500 rounded-full animate-ping" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">No Optimization Candidates</h2>
        <p className="text-text-tertiary max-w-md text-center mb-8 text-sm">
          We couldn't detect any workloads to analyze. Please ensure your cluster is connected and has active deployments.
        </p>
        <button
          onClick={() => onRefresh?.()}
          className="kt-button kt-button-primary"
        >
          <Activity className="w-4 h-4" /> Refresh Data
        </button>
      </div>
    );
  }

  const initialWorkloadId = stateId || propId;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
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

  useEffect(() => {
    if (selectedWorkload) {
      setChartData(generateStaticHistory(selectedWorkload));
      setAdjustedCpuLimit(selectedWorkload.metrics.cpuLimit);
      setAdjustedMemoryLimit(selectedWorkload.metrics.memoryLimit);
      setAdjustedStorageLimit(selectedWorkload.metrics.storageLimit || 5);
      setAdjustedGpuLimit(selectedWorkload.metrics.gpuLimit || 1);
      setRecommendation(null);
      setIsAutoRefresh(true);
    }
  }, [selectedId]);

  useEffect(() => {
    let intervalId: any;
    if (isAutoRefresh && !isConnecting && selectedWorkload) {
      intervalId = setInterval(async () => {
        const nextPoint = await fetchNextMockData(selectedWorkload.metrics);
        setChartData(prev => {
          const newData = [...prev, { ...nextPoint, cpuLimit: adjustedCpuLimit, memoryLimit: adjustedMemoryLimit, storageLimit: adjustedStorageLimit, gpuLimit: adjustedGpuLimit }];
          return newData.length > 30 ? newData.slice(1) : newData;
        });
      }, 3000);
    }
    return () => clearInterval(intervalId);
  }, [isAutoRefresh, isConnecting, selectedId, selectedWorkload, adjustedCpuLimit, adjustedMemoryLimit, adjustedStorageLimit, adjustedGpuLimit]);

  const handleToggleLive = () => {
    if (!isAutoRefresh) {
      setIsConnecting(true);
      setTimeout(() => {
        setIsConnecting(false);
        setIsAutoRefresh(true);
      }, 1200);
    } else {
      setIsAutoRefresh(false);
    }
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
    const latestMetrics = chartData[chartData.length - 1] || selectedWorkload.metrics;
    return generateMockPods(selectedWorkload, { ...selectedWorkload.metrics, cpuUsage: latestMetrics.cpuUsage, memoryUsage: latestMetrics.memoryUsage, storageUsage: latestMetrics.storageUsage });
  }, [selectedId, chartData, selectedWorkload]);

  const handleOptimize = async () => {
    if (loading) return;
    const targetWorkload = safeWorkloads.find(w => w.id === selectedId);
    if (!targetWorkload) return;

    setLoading(true);
    setRecommendation(null);
    const report = await generateRightSizingRecommendation(targetWorkload, `Efficiency: CPU ${analysis?.cpuEfficiency}%, RAM ${analysis?.memEfficiency}%, Storage ${analysis?.storageEfficiency}%`, selectedProfile);
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
    <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[calc(100vh-160px)] relative w-full overflow-hidden font-sans">

      <aside className={`
        ${selectedId && !isSidebarOpen ? 'hidden' : 'flex'}
        lg:flex w-full lg:w-80 h-auto lg:h-full shrink-0 bg-bg-card rounded-2xl overflow-hidden flex flex-col border border-border-main shadow-sm
      `}>
        <div className="p-5 md:p-6 border-b border-border-main bg-bg-hover/50">
          <h3 className="font-semibold text-text-primary flex items-center gap-2 text-base">
            <Scale className="w-5 h-5 text-primary-500" /> Infrastructure Fleet
          </h3>
          <div className="mt-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="kt-input pl-11 pr-4 text-xs font-medium"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 bg-bg-hover/30">
          {filteredWorkloads.map(w => (
            <div
              key={w.id}
              onClick={() => { setSelectedId(w.id); setRecommendation(null); setIsSidebarOpen(false); }}
              className={`p-5 rounded-xl cursor-pointer transition-all border-2 ${selectedId === w.id ? 'bg-primary-600 text-white border-primary-500 shadow-xl shadow-primary-600/20' : 'bg-bg-card border-border-main hover:bg-bg-hover'}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold truncate">{w.name}</span>
                <div className={`w-2 h-2 rounded-full ${w.status === 'Healthy' ? 'bg-emerald-500' : w.status === 'Warning' ? 'bg-amber-500' : 'bg-red-500'}`} />
              </div>
              <div className="text-xs text-text-tertiary">
                {w.namespace} • {w.kind}
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
                <div className="p-4 bg-primary-600 rounded-xl shadow-xl shadow-primary-600/20 shrink-0">
                  <Gauge className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl md:text-3xl font-black text-text-primary tracking-tighter leading-none">{selectedWorkload.name}</h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-text-tertiary">{selectedWorkload.namespace}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-primary-100 text-primary-600 font-medium">{selectedWorkload.kind}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={handleOptimize} disabled={loading} className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white text-xs font-medium rounded-xl hover:bg-primary-700 transition-all shadow-lg disabled:opacity-50 active:scale-95">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Analyze Capacity
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
                      <h3 className="text-sm font-semibold text-text-primary">Right-Sizing Simulation Cockpit</h3>
                      <p className="text-xs text-text-tertiary">Simulate resource caps to detect potential DiskPressure or OOM evictions</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  {/* CPU Slider */}
                  <div className="flex flex-col xl:flex-row gap-6 items-center bg-bg-hover/50 p-5 rounded-xl border border-border-main">
                    <div className="flex-[3] w-full space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-primary-500" /><label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">CPU Limit (Simulated)</label></div>
                        <span className="text-xl font-bold font-mono text-primary-500">{adjustedCpuLimit.toFixed(2)}c</span>
                      </div>
                      <input type="range" min="0.01" max={selectedWorkload.metrics.cpuLimit * 2} step="0.01" value={adjustedCpuLimit} onChange={(e) => setAdjustedCpuLimit(parseFloat(e.target.value))} className="w-full h-3 bg-bg-hover rounded-full appearance-none cursor-pointer accent-primary-600" />
                    </div>
                    <div className="flex-[1] w-full p-4 rounded-xl bg-bg-card border border-border-main text-center">
                      <p className="text-[8px] font-black uppercase text-text-tertiary mb-1">CPU Load</p>
                      <div className={`text-lg font-bold ${parseFloat(analysis?.cpuEfficiency || '0') > 90 ? 'text-rose-500' : 'text-primary-500'}`}>{analysis?.cpuEfficiency}%</div>
                    </div>
                  </div>

                  {/* Memory Slider */}
                  <div className="flex flex-col xl:flex-row gap-6 items-center bg-bg-hover/50 p-5 rounded-xl border border-border-main">
                    <div className="flex-[3] w-full space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-2"><MemoryStick className="w-4 h-4 text-emerald-500" /><label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Memory Limit (Simulated)</label></div>
                        <span className="text-xl font-bold font-mono text-emerald-500">{adjustedMemoryLimit.toFixed(0)}Mi</span>
                      </div>
                      <input type="range" min="10" max={selectedWorkload.metrics.memoryLimit * 2} step="10" value={adjustedMemoryLimit} onChange={(e) => setAdjustedMemoryLimit(parseFloat(e.target.value))} className="w-full h-3 bg-bg-hover rounded-full appearance-none cursor-pointer accent-emerald-500" />
                    </div>
                    <div className="flex-[1] w-full p-4 rounded-xl bg-bg-card border border-border-main text-center">
                      <p className="text-[8px] font-black uppercase text-text-tertiary mb-1">RAM Load</p>
                      <div className={`text-lg font-bold ${parseFloat(analysis?.memEfficiency || '0') > 90 ? 'text-rose-500' : 'text-emerald-500'}`}>{analysis?.memEfficiency}%</div>
                    </div>
                  </div>

                  {/* Storage Slider */}
                  <div className="flex flex-col xl:flex-row gap-6 items-center bg-bg-hover/50 p-5 rounded-xl border border-border-main">
                    <div className="flex-[3] w-full space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-amber-500" /><label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Ephemeral Storage Limit</label></div>
                        <span className="text-xl font-bold font-mono text-amber-500">{adjustedStorageLimit.toFixed(1)}Gi</span>
                      </div>
                      <input type="range" min="0.1" max={(selectedWorkload.metrics.storageLimit || 5) * 2} step="0.1" value={adjustedStorageLimit} onChange={(e) => setAdjustedStorageLimit(parseFloat(e.target.value))} className="w-full h-3 bg-bg-hover rounded-full appearance-none cursor-pointer accent-amber-500" />
                    </div>
                    <div className="flex-[1] w-full p-4 rounded-xl bg-bg-card border border-border-main text-center">
                      <p className="text-[8px] font-black uppercase text-zinc-400 mb-1">Disk Load</p>
                      <div className={`text-lg font-bold ${parseFloat(analysis?.storageEfficiency || '0') > 90 ? 'text-rose-500' : 'text-amber-500'}`}>{analysis?.storageEfficiency}%</div>
                    </div>
                  </div>

                  {/* GPU Slider - Only show if workload has GPU resources */}
                  {(selectedWorkload.metrics.gpuLimit || 0) > 0 && (
                    <div className="flex flex-col xl:flex-row gap-6 items-center bg-bg-hover/50 p-5 rounded-xl border border-border-main">
                      <div className="flex-[3] w-full space-y-4">
                        <div className="flex justify-between items-end">
                          <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-violet-500" /><label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">GPU Limit (Simulated)</label></div>
                          <span className="text-xl font-bold font-mono text-violet-500">{adjustedGpuLimit.toFixed(0)} GPU</span>
                        </div>
                        <input type="range" min="1" max={(selectedWorkload.metrics.gpuLimit || 1) * 2} step="1" value={adjustedGpuLimit} onChange={(e) => setAdjustedGpuLimit(parseFloat(e.target.value))} className="w-full h-3 bg-bg-hover rounded-full appearance-none cursor-pointer accent-violet-500" />
                      </div>
                      <div className="flex-[1] w-full p-4 rounded-xl bg-bg-card border border-border-main text-center">
                        <p className="text-[8px] font-black uppercase text-text-tertiary mb-1">GPU Util</p>
                        <div className={`text-lg font-bold ${parseFloat(analysis?.gpuEfficiency || '0') > 90 ? 'text-rose-500' : 'text-violet-500'}`}>{analysis?.gpuEfficiency}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Telemetry Grid */}
              <div className="grid grid-cols-1 gap-8">
                {/* CPU Chart */}
                <div className="bg-bg-card rounded-xl border border-border-main p-6 shadow-sm">
                  <h3 className="text-xs font-medium text-text-tertiary mb-6 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-primary-500" /> CPU Demand Simulation
                  </h3>
                  <div className="h-[240px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 'auto']} hide />
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} type="cpu" />} />
                        <Area type="monotone" dataKey="cpuUsage" stroke="#6366f1" strokeWidth={4} fillOpacity={0.1} fill="#6366f1" isAnimationActive={false} />
                        <ReferenceLine y={adjustedCpuLimit} stroke={analysis?.cpuRisky ? '#f43f5e' : '#10b981'} strokeDasharray="8 8" strokeWidth={3} />
                        <Scatter data={analysis?.throttledPoints || []} fill="#ef4444" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* RAM Chart */}
                <div className="bg-bg-card rounded-xl border border-border-main p-6 shadow-sm">
                  <h3 className="text-xs font-medium text-text-tertiary mb-6 flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-emerald-500" /> Memory Pressure Simulation
                  </h3>
                  <div className="h-[240px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 'auto']} hide />
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} type="memory" />} />
                        <Area type="monotone" dataKey="memoryUsage" stroke="#10b981" strokeWidth={4} fillOpacity={0.1} fill="#10b981" isAnimationActive={false} />
                        <ReferenceLine y={adjustedMemoryLimit} stroke={analysis?.memRisky ? '#f43f5e' : '#10b981'} strokeDasharray="8 8" strokeWidth={3} />
                        <Scatter data={analysis?.memOomPoints || []} fill="#ef4444" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Storage Chart */}
                <div className="bg-bg-card rounded-xl border border-border-main p-6 shadow-sm">
                  <h3 className="text-xs font-medium text-text-tertiary mb-6 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-amber-500" /> Ephemeral Storage Demand
                  </h3>
                  <div className="h-[240px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 'auto']} hide />
                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} type="storage" />} />
                        <Area type="monotone" dataKey="storageUsage" stroke="#f59e0b" strokeWidth={4} fillOpacity={0.1} fill="#f59e0b" isAnimationActive={false} />
                        <ReferenceLine y={adjustedStorageLimit} stroke={analysis?.storageRisky ? '#f43f5e' : '#f59e0b'} strokeDasharray="8 8" strokeWidth={3} />
                        <Scatter data={analysis?.storagePressurePoints || []} fill="#ef4444" />
                      </ComposedChart>
                    </ResponsiveContainer>
                    {analysis?.storageRisky && (
                      <div className="absolute inset-x-0 bottom-0 py-2 bg-rose-500/10 flex items-center justify-center gap-2 rounded-lg">
                        <ShieldAlert className="w-4 h-4 text-rose-500 animate-bounce" />
                        <span className="text-[10px] font-black uppercase text-rose-600 tracking-widest">Active DiskPressure Region - Eviction Imminent</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* GPU Chart - Only show if workload has GPU resources */}
                {(selectedWorkload.metrics.gpuLimit || 0) > 0 && (
                  <div className="bg-bg-card rounded-xl border border-border-main p-6 shadow-sm">
                    <h3 className="text-xs font-medium text-text-tertiary mb-6 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-violet-500" /> GPU Utilization Simulation
                    </h3>
                    <div className="h-[240px] w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                          <XAxis dataKey="time" hide />
                          <YAxis domain={[0, 100]} hide />
                          <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} type="gpu" />} />
                          <Area type="monotone" dataKey="gpuUsage" stroke="#8b5cf6" strokeWidth={4} fillOpacity={0.1} fill="#8b5cf6" isAnimationActive={false} />
                          <ReferenceLine y={adjustedGpuLimit * 100} stroke={analysis?.gpuRisky ? '#f43f5e' : '#8b5cf6'} strokeDasharray="8 8" strokeWidth={3} />
                          <Scatter data={analysis?.gpuPressurePoints || []} fill="#ef4444" />
                        </ComposedChart>
                      </ResponsiveContainer>
                      {analysis?.gpuRisky && (
                        <div className="absolute inset-x-0 bottom-0 py-2 bg-rose-500/10 flex items-center justify-center gap-2 rounded-lg">
                          <ShieldAlert className="w-4 h-4 text-rose-500 animate-bounce" />
                          <span className="text-[10px] font-black uppercase text-rose-600 tracking-widest">GPU Throttling Risk - Consider GPU Limit Increase</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Recommendation Section */}
              {recommendation && (
                <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
                  <div className="bg-bg-card border border-primary-500/30 rounded-2xl overflow-hidden shadow-xl relative">
                    <div className="p-8 border-b border-border-main bg-bg-hover/80 backdrop-blur-md flex justify-between items-center sticky top-0 z-10">
                      <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-primary-500" /> AI Capacity Intelligence
                      </h3>
                    </div>
                    <div className="p-10 md:p-14 prose prose-primary max-w-none prose-invert">
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
                              <code className="bg-primary-500/10 text-primary-600 px-2 py-0.5 rounded-lg font-mono text-xs font-bold" {...props}>{children}</code>
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
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center h-full">
            <Scale className="w-12 h-12 text-primary-500 mb-8 animate-bounce" />
            <h3 className="text-xl font-semibold text-text-primary mb-4">Capacity Simulation Workspace</h3>
            <p className="text-sm text-text-tertiary max-w-sm font-semibold">Select a workload from the infrastructure fleet to initiate multi-dimensional capacity simulation.</p>
          </div>
        )}
      </main>
    </div>
  );
};
