import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Workload, DiagnosticPlaybook, ResourceMetrics } from '../types';
import { getMetricStatusColor } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, DollarSign, Box, TrendingDown, HeartPulse, Sparkles, Network, ArrowRight, Target, ShieldCheck, ChevronRight, Server, Globe, Wand2 } from 'lucide-react';
import { DashboardCard } from './dashboard/DashboardCard';
import { MetricCard } from './dashboard/MetricCard';
import { StatusBadge } from './dashboard/StatusBadge';
import { useStaggerAnimation } from './PageTransition';
import { useMonitoring } from '../contexts/MonitoringContext';

interface DashboardProps {
  workloads: Workload[];
  isDarkMode?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  onTriageRequest?: (workloadId: string, playbook: DiagnosticPlaybook, podName?: string) => void;
  metricsWindow?: string;
  setMetricsWindow?: (window: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ workloads, isDarkMode: _isDarkMode = true, isLoading = false, onTriageRequest, onRefresh, metricsWindow = '1h', setMetricsWindow }) => {
  const { selectedClusterIds, selectedCluster, clusters } = useMonitoring();
  const [saturationTab, setSaturationTab] = useState<'CPU' | 'Memory' | 'Ephemeral Storage' | 'Network' | 'GPU'>('CPU');
  const [namespaceFilter, setNamespaceFilter] = useState<string[]>(() => {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem) {
        const saved = localStorage.getItem('kt_dashboard_namespaces');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
        const legacy = localStorage.getItem('kt_dashboard_namespace');
        if (legacy && legacy !== 'all') return [legacy];
      }
    } catch (e) {
      console.warn('Failed to load namespace filter:', e);
    }
    return ['all'];
  });

  const safeWorkloads = useMemo(() => workloads || [], [workloads]);
  const activeNamespaces = useMemo(() => {
    const all = namespaceFilter.includes('all') || namespaceFilter.length === 0;
    return { all, selected: namespaceFilter.filter(n => n !== 'all') };
  }, [namespaceFilter]);

  const filteredWorkloads = useMemo(() => {
    if (activeNamespaces.all) return safeWorkloads;
    return safeWorkloads.filter(w => activeNamespaces.selected.includes(w.namespace));
  }, [safeWorkloads, activeNamespaces]);

  const namespaces = useMemo(() => {
    const seen = new Set<string>();
    safeWorkloads.forEach(w => seen.add(w.namespace));
    return Array.from(seen).sort();
  }, [safeWorkloads]);

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.setItem) {
        localStorage.setItem('kt_dashboard_namespaces', JSON.stringify(namespaceFilter));
      }
    } catch (e) {
      console.warn('Failed to save namespace filter:', e);
    }
  }, [namespaceFilter]);

  const namespaceSummary = useMemo(() => {
    if (activeNamespaces.all) return 'All namespaces';
    if (activeNamespaces.selected.length === 1) return activeNamespaces.selected[0];
    return `${activeNamespaces.selected.length} namespaces`;
  }, [activeNamespaces]);

  const applyNamespaces = (next: string[]) => {
    setNamespaceFilter(next.length === 0 ? ['all'] : next);
  };

  const isNsPending = (ns: string) => pendingNs.includes(ns);

  // ---- Namespace scope menu (command-palette style) ----
  interface NsMenuPosition { top: number; left: number; width: number; }
  const nsButtonRef = useRef<HTMLButtonElement>(null);
  const nsSearchRef = useRef<HTMLInputElement>(null);
  const [nsMenuOpen, setNsMenuOpen] = useState(false);
  const [nsMenuPos, setNsMenuPos] = useState<NsMenuPosition | null>(null);
  const [nsSearch, setNsSearch] = useState('');
  const [pendingNs, setPendingNs] = useState<string[]>([]);
  const [focusIndex, setFocusIndex] = useState<number>(-1);

  const showNsSearch = namespaces.length >= 8;
  const filteredNsItems = useMemo(() => {
    const term = nsSearch.trim().toLowerCase();
    const items = namespaces.map(ns => ({ id: ns, label: ns }));
    if (!term) return items;
    return items.filter(item => item.label.toLowerCase().includes(term));
  }, [namespaces, nsSearch]);

  const pendingHasChanges = useMemo(() => {
    const current = activeNamespaces.all ? [] : activeNamespaces.selected.slice().sort();
    const next = pendingNs.slice().sort();
    return JSON.stringify(current) !== JSON.stringify(next);
  }, [activeNamespaces, pendingNs]);

  const openNsMenu = useCallback(() => {
    const seed = activeNamespaces.all ? [] : activeNamespaces.selected;
    setPendingNs(seed);
    setNsSearch('');
    setFocusIndex(-1);
    if (nsButtonRef.current) {
      const rect = nsButtonRef.current.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 220), 320);
      setNsMenuPos({ top: rect.bottom + 4, left: rect.left, width });
    }
    setNsMenuOpen(true);
  }, [activeNamespaces]);

  const closeNsMenu = useCallback(() => {
    setNsMenuOpen(false);
    setNsSearch('');
    setFocusIndex(-1);
  }, []);

  const commitPendingNs = useCallback(() => {
    applyNamespaces(pendingNs);
    closeNsMenu();
  }, [pendingNs, closeNsMenu]);

  const togglePendingNs = useCallback((ns: string) => {
    setPendingNs(prev => {
      if (prev.includes(ns)) {
        const next = prev.filter(n => n !== ns);
        return next;
      }
      return [...prev, ns];
    });
  }, []);

  const selectAllPending = useCallback(() => {
    setPendingNs([]);
  }, []);

  const clearPending = useCallback(() => {
    setPendingNs([]);
  }, []);

  useEffect(() => {
    if (!nsMenuOpen) return;
    if (showNsSearch && nsSearchRef.current) {
      nsSearchRef.current.focus();
    }
    const handleClickOutside = (e: MouseEvent) => {
      const portal = document.getElementById('ns-dropdown-portal');
      const target = e.target as Node;
      if (nsButtonRef.current && !nsButtonRef.current.contains(target) && portal && !portal.contains(target)) {
        closeNsMenu();
      }
    };
    const handleResize = () => closeNsMenu();
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, [nsMenuOpen, showNsSearch, closeNsMenu]);

  useEffect(() => {
    if (!nsMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeNsMenu();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex(prev => {
          const max = filteredNsItems.length - 1;
          if (max < 0) return -1;
          if (e.key === 'ArrowDown') return prev >= max ? 0 : prev + 1;
          return prev <= 0 ? max : prev - 1;
        });
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        if (focusIndex >= 0 && focusIndex < filteredNsItems.length) {
          e.preventDefault();
          togglePendingNs(filteredNsItems[focusIndex].id);
        }
        return;
      }
      if (e.key === 'Tab' && !e.shiftKey) {
        if (focusIndex === filteredNsItems.length - 1) {
          e.preventDefault();
          setFocusIndex(-1);
          nsSearchRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [nsMenuOpen, filteredNsItems, focusIndex, togglePendingNs, closeNsMenu]);

  const totalCost = filteredWorkloads.reduce((acc, w) => acc + (w.costPerMonth || 0), 0);
  const criticalCount = filteredWorkloads.filter(w => w.status === 'Critical').length;
  const warningCount = filteredWorkloads.filter(w => w.status === 'Warning').length;

  const clusterNameById = useMemo(() => {
    const map = new Map<string, string>();
    clusters.forEach(c => map.set(c.id, c.displayName || c.name));
    return map;
  }, [clusters]);

  const selectedClusterCount = selectedClusterIds.length > 0 ? selectedClusterIds.length : clusters.length;

  const potentialSavings = filteredWorkloads
    .filter(w => w.recommendation && w.recommendation.action === 'Downsize')
    .reduce((acc, w) => acc + (w.costPerMonth * 0.4), 0);

  const statusData = [
    { name: 'Healthy', value: filteredWorkloads.filter(w => w.status === 'Healthy').length, color: '#2ecc71' },
    { name: 'Warning', value: warningCount, color: '#f5a623' },
    { name: 'Critical', value: criticalCount, color: '#e74c3c' },
  ];

  const incidents = useMemo(() => {
    return filteredWorkloads.filter(w => w.status !== 'Healthy').sort((a, b) => {
      if (a.status === 'Critical' && b.status !== 'Critical') return -1;
      if (a.status !== 'Critical' && b.status === 'Critical') return 1;
      return 0;
    });
  }, [filteredWorkloads]);

  // Per-pod resource saturation rows for the right-hand panel.
  const saturationPods = useMemo(() => {
    const severityOrder: Record<string, number> = { Critical: 0, Warning: 1, Healthy: 2 };

    const pods = filteredWorkloads.flatMap(w =>
      (w.pods ?? []).map(pod => {
        const metrics = pod.metrics ?? {} as ResourceMetrics;
        let base = 0, used = 0, unit = '';

        if (saturationTab === 'CPU') {
          base = (Number(metrics.cpuLimit) || 0) * 1000;
          used = (Number(metrics.cpuUsage) || 0) * 1000;
          unit = 'mCPU';
        } else if (saturationTab === 'Memory') {
          base = Number(metrics.memoryLimit) || 0;
          used = Number(metrics.memoryUsage) || 0;
          unit = 'MiB';
        } else if (saturationTab === 'Ephemeral Storage') {
          base = Number(metrics.storageLimit) || 5;
          used = Number(metrics.storageUsage) || 0;
          unit = 'GiB';
        } else if (saturationTab === 'GPU') {
          base = Number(metrics.gpuLimit) || 0;
          used = Number(metrics.gpuUsage) || 0;
          unit = '%';
        } else {
          used = (Number(metrics.networkIn) || 0) + (Number(metrics.networkOut) || 0);
          unit = 'MB/s';
        }

        const rawSaturation = base > 0 ? Math.round((used / base) * 100) : 0;
        const saturation = Math.min(100, rawSaturation);
        const isCritical = saturation >= 90 || pod.status === 'Critical';
        const isWarning = (saturation >= 70 && !isCritical) || pod.status === 'Warning';

        return {
          ...pod,
          workloadName: w.name,
          workloadId: w.id,
          clusterId: w.clusterId,
          base,
          used,
          unit,
          saturation,
          isCritical,
          isWarning,
        };
      })
    );

    return pods
      .sort((a, b) => {
        const aSev = severityOrder[a.status] ?? 2;
        const bSev = severityOrder[b.status] ?? 2;
        if (aSev !== bSev) return aSev - bSev;
        if (a.saturation !== b.saturation) return b.saturation - a.saturation;
        return b.restartCount - a.restartCount;
      })
      .slice(0, 10);
  }, [filteredWorkloads, saturationTab]);

  const reliabilityMetrics = useMemo(() => {
    const slo = 99.9;
    const totalPossibleBudget = 0.1;
    const criticalWeight = 0.015;
    const warningWeight = 0.004;
    const healthyWeight = 0.0005;

    const dailyConsumption = (
      (criticalCount * criticalWeight) +
      (warningCount * warningWeight) +
      ((filteredWorkloads.length - criticalCount - warningCount) * healthyWeight)
    );

    const baselineConsumed = 0.042;
    const remainingBudget = Math.max(0, totalPossibleBudget - baselineConsumed - dailyConsumption);
    const budgetPercentage = (remainingBudget / totalPossibleBudget) * 100;
    const idealDailyBurn = totalPossibleBudget / 30;
    const burnRate = dailyConsumption / idealDailyBurn;
    const hoursRemaining = burnRate > 0 ? (remainingBudget / (dailyConsumption / 24)) : 720;
    const days = Math.floor(hoursRemaining / 24);
    const hours = Math.floor(hoursRemaining % 24);

    return {
      slo, remainingBudget, budgetPercentage: isFinite(budgetPercentage) ? budgetPercentage : 0, burnRate: isFinite(burnRate) ? burnRate : 0,
      uptimeForecast: `${days}d ${hours}h`,
      severity: burnRate > 2.0 ? 'Critical' : burnRate > 1.2 ? 'Warning' : 'Healthy'
    };
  }, [filteredWorkloads, criticalCount, warningCount]);

  const budgetGaugeData = [
    { name: 'Consumed', value: Math.max(0, isFinite(reliabilityMetrics.budgetPercentage) ? 100 - reliabilityMetrics.budgetPercentage : 100), color: reliabilityMetrics.severity === 'Critical' ? '#e74c3c' : '#f5a623' },
    { name: 'Remaining', value: Math.max(0, isFinite(reliabilityMetrics.budgetPercentage) ? reliabilityMetrics.budgetPercentage : 0), color: 'var(--kt-panel-inset)' },
  ];

  const getStatusColor = (status: string) => {
    return getMetricStatusColor(status === 'Healthy' ? 0 : status === 'Warning' ? 80 : 100);
  };

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

  const stagger = useStaggerAnimation(10, 60);

  if (isLoading && safeWorkloads.length === 0) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="kt-panel p-5">
          <div className="flex flex-col lg:flex-row items-center gap-5">
            <div className="kt-skeleton w-16 h-16 shrink-0 relative z-10" />
            <div className="flex-1 space-y-3 text-center lg:text-left relative z-10">
              <div className="kt-skeleton kt-skeleton-text w-40 mx-auto lg:mx-0" />
              <div className="kt-skeleton kt-skeleton-heading w-72 mx-auto lg:mx-0" />
              <div className="kt-skeleton kt-skeleton-text w-56 mx-auto lg:mx-0" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="kt-panel p-4 space-y-3">
              <div className="kt-skeleton w-8 h-8 relative z-10" />
              <div className="kt-skeleton kt-skeleton-text w-24 relative z-10" />
              <div className="kt-skeleton kt-skeleton-heading w-16 relative z-10" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 kt-panel p-5 space-y-3">
            <div className="kt-skeleton kt-skeleton-text w-32 relative z-10" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="kt-skeleton w-full h-20 relative z-10" />
            ))}
          </div>
          <div className="lg:col-span-3 kt-panel p-5 space-y-3">
            <div className="kt-skeleton kt-skeleton-text w-40 relative z-10" />
            <div className="kt-skeleton w-full h-48 relative z-10" />
          </div>
        </div>
      </div>
    );
  }

  if (safeWorkloads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] animate-fade-in text-text-primary">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary-500 opacity-10 blur-3xl"></div>
          <div className="p-10 kt-panel relative z-10">
            <Server className="w-12 h-12 text-text-secondary" />
          </div>
        </div>
        <h2 className="font-sans text-2xl font-bold mb-2">No workloads found</h2>
        <p className="text-text-secondary max-w-sm text-center mb-6 text-sm font-sans">
          No active workloads detected in the selected clusters. Connect or select a cluster to begin monitoring.
        </p>
        <button
          onClick={() => onRefresh?.()}
          className="kt-button kt-button-primary"
          aria-label="Refresh workloads"
        >
          <Activity className="w-4 h-4" /> Refresh
        </button>
      </div>
    );
  }

  const getIncidentSummary = (w: Workload) => {
    if (w.availableReplicas === 0 && w.replicas > 0) return `Resource failure: 0/${w.replicas} available`;
    if (w.availableReplicas < w.replicas) return `Degraded: ${w.availableReplicas}/${w.replicas} ready`;

    const cpuLimit = Number(w.metrics?.cpuLimit) || 0;
    const cpuUsage = Number(w.metrics?.cpuUsage) || 0;
    const memLimit = Number(w.metrics?.memoryLimit) || 0;
    const memUsage = Number(w.metrics?.memoryUsage) || 0;

    const cpuSat = cpuLimit > 0 ? (cpuUsage / cpuLimit) * 100 : 0;
    const memSat = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

    if (cpuSat > 90) return `Critical CPU: ${Math.round(cpuSat)}% limit`;
    if (memSat > 95) return `Critical Memory: ${Math.round(memSat)}% usage`;
    if (cpuSat > 70) return `High CPU: ${Math.round(cpuSat)}% of limit`;
    if (memSat > 80) return `High Memory: ${Math.round(memSat)}% of limit`;

    const events = w.events || [];
    const recentWarning = events.find(e => e.type === 'Warning');
    if (recentWarning) return `Warning: ${recentWarning.reason}`;

    return w.status === 'Critical' ? "Critical degradation" : "Reliability warning";
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Hero Alert Panel */}
      {criticalCount > 0 && (
        <DashboardCard padding="lg" hover={false} className="kt-danger-glow">
          <div className="flex flex-col lg:flex-row items-center gap-5 relative z-10">
            <div className="relative shrink-0">
              <div className="p-5 bg-danger/10 border border-danger/30">
                <Network className="w-10 h-10 text-danger" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-danger flex items-center justify-center text-[10px] font-bold text-black">
                {criticalCount}
              </div>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <div className="flex flex-wrap justify-center lg:justify-start items-center gap-3 mb-3">
                <span className="kt-badge kt-badge-danger">
                  Critical issues detected
                </span>
              </div>
              <h2 className="font-sans text-2xl font-bold text-text-primary mb-2">
                {criticalCount} workload{criticalCount > 1 ? 's' : ''} require immediate attention
              </h2>
              <p className="text-text-secondary text-sm max-w-xl font-sans">
                Review the active incidents below and run AI triage to identify root causes.
              </p>
            </div>

            <div className="shrink-0">
              <button
                onClick={() => onTriageRequest?.(incidents[0]?.id, 'Resource Constraints')}
                className="kt-button kt-button-primary"
                aria-label="Run AI triage on first incident"
              >
                <Sparkles className="w-4 h-4" />
                Run AI Triage
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </DashboardCard>
      )}

      {/* Context summary strip */}
      <div className="flex items-center gap-2 px-3 py-2 border border-border-main bg-bg-card/50 text-text-tertiary text-xs font-sans">
        {selectedClusterCount > 1 ? (
          <>
            <Globe className="w-3.5 h-3.5 text-primary-500" />
            <span className="font-semibold text-text-secondary">Multi-cluster view:</span>
            <span>Aggregating {filteredWorkloads.length} workloads across {selectedClusterCount} selected clusters{!activeNamespaces.all && ` (${namespaceSummary})`}.</span>
          </>
        ) : (
          <>
            <Server className="w-3.5 h-3.5 text-primary-500" />
            <span className="font-semibold text-text-secondary">Cluster view:</span>
            <span>{filteredWorkloads.length} workloads in {selectedCluster?.displayName || selectedCluster?.name || 'selected cluster'}{!activeNamespaces.all && ` (${namespaceSummary})`}.</span>
          </>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={DollarSign}
          iconColor="text-primary-500"
          label="Monthly cost"
          value={`$${totalCost.toLocaleString()}`}
          trend={selectedClusterCount > 1 ? `Across ${selectedClusterCount} clusters` : '+4.2%'}
          delay={stagger(0).animationDelay}
        />
        <MetricCard
          icon={Activity}
          iconColor="text-success"
          label="Health score"
          value={criticalCount === 0 ? 'Healthy' : 'Degraded'}
          trendLabel={`${Math.round((1 - (criticalCount / (filteredWorkloads.length || 1))) * 100)}%`}
          delay={stagger(1).animationDelay}
        />
        <MetricCard
          icon={TrendingDown}
          iconColor="text-primary-500"
          label="Cost savings"
          value={`$${Math.round(potentialSavings).toLocaleString()}`}
          trendLabel={selectedClusterCount > 1 ? 'Potential across selection' : 'Potential'}
          delay={stagger(2).animationDelay}
        />
        <MetricCard
          icon={Box}
          iconColor="text-info"
          label="Workloads"
          value="Active"
          trendLabel={`${filteredWorkloads.length}`}
          delay={stagger(3).animationDelay}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <DashboardCard
            padding="lg"
            title={activeNamespaces.all
              ? (selectedClusterCount > 1 ? `Active incidents across ${selectedClusterCount} clusters` : 'Active incidents')
              : `Active incidents in ${namespaceSummary}`}
            className="flex flex-col flex-1 min-h-[360px]"
          >
            <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1 custom-scrollbar relative z-10">
              {incidents.length > 0 ? (
                incidents.slice(0, 5).map((w, idx) => (
                  <div
                    key={w.id}
                    className="p-3 border border-border-main bg-bg-main hover:border-primary-500/30 hover:bg-bg-hover transition-all cursor-pointer group focus-visible:ring-2 focus-visible:ring-primary-500/50 outline-none animate-slide-up"
                    style={{ animationDelay: `${idx * 60}ms` }}
                    onClick={() => onTriageRequest?.(w.id, 'Resource Constraints')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTriageRequest?.(w.id, 'Resource Constraints'); } }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Investigate ${w.name} incident`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusColor(w.status)}`} />
                        <span className="text-sm font-bold text-text-primary truncate">{w.name}</span>
                        {selectedClusterCount > 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 border border-border-main bg-bg-hover text-text-tertiary font-sans truncate max-w-[120px]">
                            {clusterNameById.get(w.clusterId) || w.clusterId}
                          </span>
                        )}
                      </div>
                      <StatusBadge status={w.status} />
                    </div>
                    <p className="text-xs text-text-secondary mb-3 font-sans">{getIncidentSummary(w)}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-primary-500 flex items-center gap-1.5 group-hover:text-primary-400 font-sans">
                        <Sparkles className="w-3.5 h-3.5" />
                        Investigate with AI
                      </span>
                      <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-text-secondary transition-colors" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center flex flex-col items-center">
                  <div className="p-3 bg-success/10 border border-success/30 mb-3">
                    <HeartPulse className="w-8 h-8 text-success" />
                  </div>
                  <p className="text-xs text-text-tertiary font-sans font-medium">All services nominal</p>
                </div>
              )}
            </div>
          </DashboardCard>

          <DashboardCard padding="lg" title={activeNamespaces.all
            ? (selectedClusterCount > 1 ? 'Status distribution (all clusters)' : 'Status distribution')
            : `Status distribution in ${namespaceSummary}`}
          >
            <div className="h-44 w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name: string) => [`${value} workloads`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-text-primary">{filteredWorkloads.length}</span>
                <span className="text-[10px] text-text-tertiary font-sans font-medium">{activeNamespaces.all ? 'Total' : 'Filtered'}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 relative z-10">
              {statusData.map((item) => (
                <div
                  key={item.name}
                  className="flex flex-col items-center gap-1 p-2 border border-border-main bg-bg-main hover:border-primary-500/20 transition-all cursor-default"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] font-sans font-semibold text-text-secondary">{item.name}</span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        {/* Right Column - Resource Saturation */}
        <div className="lg:col-span-3">
          <DashboardCard padding="lg" title={activeNamespaces.all
            ? (selectedClusterCount > 1 ? 'Resource saturation (all clusters)' : 'Resource saturation')
            : `Resource saturation in ${namespaceSummary}`} className="flex flex-col h-full min-h-[360px]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4 relative z-10">
              <div className="flex flex-wrap items-center gap-2">
                {(['5m', '15m', '30m', '1h'] as const).map((win) => (
                  <button
                    key={win}
                    onClick={() => setMetricsWindow?.(win)}
                    className={`px-2.5 py-1 text-[10px] font-sans font-bold border transition-all ${metricsWindow === win ? 'bg-primary-500/10 border-primary-500 text-primary-500' : 'border-border-main text-text-secondary hover:text-text-primary hover:border-text-tertiary' }`}
                    aria-label={`Set metrics window to ${win}`}
                    aria-pressed={metricsWindow === win}
                  >
                    {win}
                  </button>
                ))}
                <div className="relative">
                  <button
                    ref={nsButtonRef}
                    className="kt-select text-[10px] py-1 px-2 h-[26px] min-w-[110px] flex items-center gap-2 text-left aria-expanded:border-primary-500 aria-expanded:shadow-[0_0_0_1px_rgba(0,200,240,0.25)]"
                    aria-label="Filter by namespace"
                    aria-haspopup="listbox"
                    aria-expanded={nsMenuOpen}
                    onClick={() => {
                      if (nsMenuOpen) {
                        closeNsMenu();
                      } else {
                        openNsMenu();
                      }
                    }}
                  >
                    <span className="truncate">{namespaceSummary}</span>
                  </button>
                  {nsMenuOpen && nsMenuPos && typeof document !== 'undefined' && document.getElementById('ns-dropdown-portal') && createPortal(
                    <div
                      className="custom-scrollbar bg-bg-card border border-border-main shadow-lg overflow-hidden animate-fade-in"
                      style={{ position: 'fixed', top: nsMenuPos.top, left: nsMenuPos.left, minWidth: nsMenuPos.width, maxWidth: 320, zIndex: 2147483647 }}
                      role="listbox"
                      aria-label="Select namespaces"
                      aria-multiselectable="true"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Active scope indicator line — the signature "console feed" detail */}
                      <div className="h-[2px] w-full bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 animate-pulse dark:from-primary-500 dark:via-primary-300 dark:to-primary-500" />

                      {showNsSearch && (
                        <div className="p-2 border-b border-border-main">
                          <input
                            ref={nsSearchRef}
                            type="text"
                            value={nsSearch}
                            onChange={(e) => { setNsSearch(e.target.value); setFocusIndex(-1); }}
                            placeholder="Search namespaces…"
                            className="kt-input w-full text-xs py-1.5 px-2"
                            aria-label="Search namespaces"
                          />
                        </div>
                      )}

                      {/* All namespaces — radio-style mutual exclusion */}
                      <div
                        role="option"
                        aria-selected={pendingNs.length === 0}
                        className={`flex items-center gap-2 px-3 py-2 text-[13px] font-sans cursor-pointer border-b border-border-main transition-colors ${pendingNs.length === 0 ? 'bg-primary-500/10 dark:bg-primary-500/[0.08] text-primary-700 dark:text-text-primary font-semibold' : 'hover:bg-bg-hover text-text-primary'}`}
                        onClick={selectAllPending}
                        onMouseEnter={() => setFocusIndex(-1)}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${pendingNs.length === 0 ? 'border-primary-600 bg-primary-600 dark:border-primary-500 dark:bg-primary-500' : 'border-border-main bg-bg-main'}`}>
                          {pendingNs.length === 0 && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-bg-card" />}
                        </div>
                        <span className="truncate">All namespaces</span>
                      </div>

                      {/* Namespace list */}
                      <div className="max-h-[240px] overflow-y-auto custom-scrollbar" role="presentation">
                        {filteredNsItems.length === 0 && (
                          <div className="px-3 py-4 text-xs text-text-tertiary text-center font-sans">No namespaces match</div>
                        )}
                        {filteredNsItems.map((item, idx) => {
                          const pendingSelected = isNsPending(item.id);
                          return (
                            <div
                              key={item.id}
                              role="option"
                              aria-selected={pendingSelected}
                              className={`flex items-center gap-2 px-3 py-2 text-[13px] font-sans cursor-pointer transition-colors ${idx === focusIndex ? 'bg-bg-hover' : ''} ${pendingSelected ? 'bg-primary-500/10 dark:bg-primary-500/[0.08] text-primary-700 dark:text-text-primary font-semibold' : 'hover:bg-bg-hover text-text-primary'}`}
                              onClick={() => togglePendingNs(item.id)}
                              onMouseEnter={() => setFocusIndex(idx)}
                            >
                              <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${pendingSelected ? 'border-primary-600 bg-primary-600 dark:border-primary-500 dark:bg-primary-500' : 'border-border-main bg-bg-main'}`}>
                                {pendingSelected && <span className="text-[10px] text-white">✓</span>}
                              </div>
                              <span className="truncate" title={item.label}>{item.label}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer actions */}
                      <div className="flex items-center justify-between px-2 py-2 border-t border-border-main bg-bg-main/50">
                        <button
                          className="kt-button kt-button-ghost kt-button-sm text-text-tertiary hover:text-text-primary"
                          onClick={clearPending}
                        >
                          Clear
                        </button>
                        <button
                          className="kt-button kt-button-primary kt-button-sm disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={!pendingHasChanges}
                          onClick={commitPendingNs}
                        >
                          Apply{pendingNs.length > 0 && ` (${pendingNs.length})`}
                        </button>
                      </div>
                    </div>,
                    document.getElementById('ns-dropdown-portal')!
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['CPU', 'Memory', 'Ephemeral Storage', 'GPU', 'Network'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSaturationTab(type)}
                    className={`px-2.5 py-1 text-[10px] font-sans font-bold border transition-all ${saturationTab === type ? 'bg-primary-500/10 border-primary-500 text-primary-500' : 'border-border-main text-text-secondary hover:text-text-primary hover:border-text-tertiary' }`}
                    aria-label={`View ${type} saturation`}
                    aria-pressed={saturationTab === type}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar relative z-10">
              <div className="space-y-2">
                {saturationPods.map((item, idx) => (
                  <div
                    key={`${item.clusterId}-${item.namespace}-${item.name}`}
                    className="flex items-center gap-3 p-3 border border-border-main bg-bg-main hover:border-primary-500/30 hover:bg-bg-hover transition-all cursor-pointer group focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:outline-none"
                    onClick={() => onTriageRequest?.(item.workloadId, 'General Health', item.name)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTriageRequest?.(item.workloadId, 'General Health', item.name); } }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for pod ${item.name} of ${item.workloadName}`}
                  >
                    <div className={`w-6 h-6 shrink-0 flex items-center justify-center text-[10px] font-sans font-bold border ${idx === 0 ? 'bg-danger/10 text-danger border-danger/30' : idx === 1 ? 'bg-warning/10 text-warning border-warning/30' : idx === 2 ? 'bg-primary-500/10 text-primary-500 border-primary-500/30' : 'bg-bg-hover text-text-tertiary border-border-main'}`}>
                      {idx + 1}
                    </div>

                    <div className="w-36 shrink-0 min-w-0">
                      <h4 className="text-sm font-bold text-text-primary truncate" title={item.name}>{item.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(item.status)}`} />
                        <span className="text-[10px] text-text-tertiary font-sans">{item.status}</span>
                        {(item.terminatedReason || item.waitingReason) && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-danger/10 text-danger border border-danger/30 font-sans">
                            {item.terminatedReason || item.waitingReason}
                          </span>
                        )}
                        {item.cpuThrottled && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-warning/10 text-warning border border-warning/30 font-sans">
                            CPU throttled
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-text-tertiary font-sans truncate mt-0.5" title={`${item.ownerKind}/${item.workloadName}`}>
                        {item.ownerKind}/{item.workloadName}
                      </div>
                      {selectedClusterCount > 1 && (
                        <div className="text-[10px] text-text-tertiary font-sans truncate mt-0.5">
                          {clusterNameById.get(item.clusterId) || item.clusterId}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                      {item.base > 0 && item.used > 0 ? (
                        <>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] text-text-tertiary font-sans font-semibold">{saturationTab}</span>
                            <span className={`text-xs font-bold ${item.isCritical ? 'text-danger' : item.isWarning ? 'text-warning' : 'text-text-secondary'}`}>
                              {item.saturation}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-bg-hover/50 rounded-sm overflow-hidden border border-border-main">
                            <div
                              className={`h-full rounded-sm transition-all duration-500 ${
                                item.isCritical
                                  ? 'bg-danger shadow-[0_0_8px_#e74c3c]'
                                  : item.isWarning
                                    ? 'bg-warning shadow-[0_0_8px_#f5a623]'
                                    : 'bg-primary-500 shadow-[0_0_8px_#00c8f0]'
                              }`}
                              style={{ width: `${Math.min(100, item.saturation)}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between h-6">
                          <span className="text-[10px] text-text-tertiary font-sans font-semibold">{saturationTab}</span>
                          <span className="text-[10px] text-text-tertiary font-sans italic">No live metrics</span>
                        </div>
                      )}
                    </div>

                    <div className="w-24 shrink-0 text-right">
                      {item.base > 0 && item.used > 0 ? (
                        <>
                          <div className="text-xs font-bold text-text-secondary">
                            {item.used.toFixed(1)}{item.unit}
                          </div>
                          <div className="text-[10px] text-text-tertiary font-sans">
                            / {item.base.toFixed(0)}{item.unit}
                          </div>
                        </>
                      ) : item.base > 0 ? (
                        <div className="text-[10px] text-text-tertiary font-sans">
                          Limit {item.base.toFixed(0)}{item.unit}
                        </div>
                      ) : null}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTriageRequest?.(item.workloadId, 'Resource Constraints', item.name);
                      }}
                      className="shrink-0 p-2 border border-border-main bg-bg-card text-text-tertiary hover:text-primary-500 hover:border-primary-500/50 hover:bg-primary-500/10 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:outline-none"
                      aria-label={`Run AI triage on pod ${item.name}`}
                      title="Run AI triage"
                    >
                      <Wand2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {saturationPods.length === 0 && (
                  <div className="p-8 text-center flex flex-col items-center">
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mb-2" />
                        <p className="text-xs text-text-tertiary font-sans font-medium">Loading pod metrics…</p>
                      </>
                    ) : (
                      <p className="text-xs text-text-tertiary font-sans font-medium">No pod data available</p>
                    )}
                  </div>
                )}
                {filteredWorkloads.reduce((acc, w) => acc + (w.pods?.length ?? 0), 0) > 10 && (
                  <div className="pt-2 pb-1 text-center">
                    <span className="text-[11px] text-text-tertiary font-sans font-medium">
                      Showing top 10 of {filteredWorkloads.reduce((acc, w) => acc + (w.pods?.length ?? 0), 0)} pods{selectedClusterCount > 1 && ` across ${selectedClusterCount} clusters`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>

      {/* Error Budget Section */}
      <DashboardCard hover={false} title="System resilience" className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
          {/* Budget Gauge */}
          <div className="flex flex-col items-center justify-center p-4 border border-border-main bg-bg-main">
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={budgetGaugeData}
                    cx="50%"
                    cy="50%"
                    startAngle={210}
                    endAngle={-30}
                    innerRadius={60}
                    outerRadius={70}
                    dataKey="value"
                    stroke="none"
                  >
                    {budgetGaugeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-text-tertiary mb-1 font-sans font-medium">Budget</span>
                <span className={`text-3xl font-bold ${reliabilityMetrics.severity === 'Critical' ? 'text-danger' : 'text-text-primary'}`}>
                  {reliabilityMetrics.budgetPercentage.toFixed(1)}%
                </span>
                <span className="text-[10px] text-text-tertiary font-sans font-medium">Remaining</span>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex flex-col justify-center gap-3 p-4 border border-border-main bg-bg-main">
            <div className="p-4 border border-border-main bg-bg-card">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-success" />
                  <span className="text-[11px] font-sans font-semibold text-text-secondary">Risk factor</span>
                </div>
                <StatusBadge status={reliabilityMetrics.severity} />
              </div>
              <div className="text-2xl font-bold text-text-primary">{reliabilityMetrics.burnRate.toFixed(2)}x</div>
              <p className="text-[10px] text-text-tertiary font-sans font-medium">Burn rate vs normal</p>
            </div>

            <div className="p-4 border border-border-main bg-bg-card">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary-500" />
                  <span className="text-[11px] font-sans font-semibold text-text-secondary">Exhaustion forecast</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-text-primary">{reliabilityMetrics.uptimeForecast}</div>
              <p className="text-[10px] text-text-tertiary font-sans font-medium">Time until SLO breach</p>
            </div>
          </div>

          {/* Policy Compliance */}
          <div className="p-4 border border-border-main bg-bg-main flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-sans font-semibold text-text-primary mb-2">Policy compliance</h4>
              <p className="text-xs text-text-secondary leading-relaxed font-sans">
                Current resource distribution is within acceptable parameters. No immediate re-balancing required.
              </p>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-[10px] text-text-tertiary mb-1 font-sans">
                <span>SLO Target</span>
                <span className="text-primary-500">{reliabilityMetrics.slo}%</span>
              </div>
              <div className="h-1.5 w-full bg-bg-hover border border-border-main rounded-sm overflow-hidden">
                <div className="h-full bg-primary-500" style={{ width: `${reliabilityMetrics.slo}%` }} />
              </div>
            </div>
            <button
              onClick={() => onTriageRequest?.('policy', 'General Health')}
              className="mt-4 w-full flex items-center justify-between p-3 bg-bg-card border border-border-main hover:border-primary-500/50 transition-all group"
            >
              <span className="text-xs font-sans font-semibold text-text-secondary group-hover:text-primary-500">Run compliance audit</span>
              <ArrowRight className="w-4 h-4 text-text-tertiary group-hover:text-primary-500" />
            </button>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
};
