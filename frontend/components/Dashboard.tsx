import React, { useMemo } from 'react';
import { Workload, DiagnosticPlaybook } from '../types';
import { getMetricStatusColor } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, DollarSign, Box, Zap, TrendingDown, ShieldAlert, HeartPulse, Sparkles, Network, ArrowRight, Target, ShieldCheck, Wifi, ChevronRight, Server, Loader2 } from 'lucide-react';

interface DashboardProps {
  workloads: Workload[];
  isDarkMode?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  onTriageRequest?: (workloadId: string, playbook: DiagnosticPlaybook) => void;
  metricsWindow?: string;
  setMetricsWindow?: (window: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ workloads, isDarkMode = true, isLoading = false, onTriageRequest, onRefresh, metricsWindow = '1h', setMetricsWindow }) => {
  const [saturationTab, setSaturationTab] = React.useState<'CPU' | 'Memory' | 'Storage' | 'Network' | 'GPU'>('CPU');
  const [saturationSort, setSaturationSort] = React.useState<'Live' | 'Avg' | 'P95' | 'P99'>('Live');
  const safeWorkloads = workloads || [];
  const totalCost = safeWorkloads.reduce((acc, w) => acc + (w.costPerMonth || 0), 0);
  const criticalCount = safeWorkloads.filter(w => w.status === 'Critical').length;
  const warningCount = safeWorkloads.filter(w => w.status === 'Warning').length;

  const potentialSavings = safeWorkloads
    .filter(w => w.recommendation && w.recommendation.action === 'Downsize')
    .reduce((acc, w) => acc + (w.costPerMonth * 0.4), 0);

  const statusData = [
    { name: 'Healthy', value: safeWorkloads.filter(w => w.status === 'Healthy').length, color: '#10b981' },
    { name: 'Warning', value: warningCount, color: '#f59e0b' },
    { name: 'Critical', value: criticalCount, color: '#ef4444' },
  ];

  const incidents = useMemo(() => {
    return safeWorkloads.filter(w => w.status !== 'Healthy').sort((a, b) => {
      if (a.status === 'Critical' && b.status !== 'Critical') return -1;
      if (a.status !== 'Critical' && b.status === 'Critical') return 1;
      return 0;
    });
  }, [safeWorkloads]);

  const reliabilityMetrics = useMemo(() => {
    const slo = 99.9;
    const totalPossibleBudget = 0.1;
    const criticalWeight = 0.015;
    const warningWeight = 0.004;
    const healthyWeight = 0.0005;

    const dailyConsumption = (
      (criticalCount * criticalWeight) +
      (warningCount * warningWeight) +
      ((safeWorkloads.length - criticalCount - warningCount) * healthyWeight)
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
  }, [safeWorkloads, criticalCount, warningCount]);

  const budgetGaugeData = [
    { name: 'Consumed', value: Math.max(0, isFinite(reliabilityMetrics.budgetPercentage) ? 100 - reliabilityMetrics.budgetPercentage : 100), color: reliabilityMetrics.severity === 'Critical' ? '#ef4444' : '#6366f1' },
    { name: 'Remaining', value: Math.max(0, isFinite(reliabilityMetrics.budgetPercentage) ? reliabilityMetrics.budgetPercentage : 0), color: isDarkMode ? 'var(--kt-bg-hover)' : '#f3f4f6' },
  ];

  // Standardized card styles
  const cardBase = "bg-bg-card border border-border-main rounded-2xl transition-all duration-200";
  const cardHover = "hover:border-primary-500/30 hover:shadow-lg dark:hover:shadow-black/20";
  const cardPadding = "p-5";
  const cardPaddingLg = "p-6";

  // Status colors
  const getStatusColor = (status: string) => {
    return getMetricStatusColor(status === 'Healthy' ? 0 : status === 'Warning' ? 80 : 100);
  };

  const tooltipStyle = {
    backgroundColor: 'var(--kt-bg-card)',
    borderColor: 'var(--kt-border-main)',
    color: 'var(--kt-fg-primary)',
    borderRadius: '12px',
    border: '1px solid var(--kt-border-main)',
    fontSize: '12px',
    fontWeight: '500',
    padding: '10px 14px',
    boxShadow: 'var(--kt-shadow-lg)'
  };

  // Loading State
  if (isLoading && safeWorkloads.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Hero skeleton */}
        <div className="bg-bg-card border border-border-main rounded-2xl p-6">
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div className="kt-skeleton w-16 h-16 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-3 text-center lg:text-left">
              <div className="kt-skeleton kt-skeleton-text w-40 mx-auto lg:mx-0" />
              <div className="kt-skeleton kt-skeleton-heading w-72 mx-auto lg:mx-0" />
              <div className="kt-skeleton kt-skeleton-text w-56 mx-auto lg:mx-0" />
            </div>
          </div>
        </div>
        {/* Metric cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-bg-card border border-border-main rounded-2xl p-5 space-y-3">
              <div className="kt-skeleton w-8 h-8 rounded-xl" />
              <div className="kt-skeleton kt-skeleton-text w-24" />
              <div className="kt-skeleton kt-skeleton-heading w-16" />
            </div>
          ))}
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 bg-bg-card border border-border-main rounded-2xl p-6 space-y-3">
            <div className="kt-skeleton kt-skeleton-text w-32" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="kt-skeleton w-full h-20 rounded-xl" />
            ))}
          </div>
          <div className="lg:col-span-3 bg-bg-card border border-border-main rounded-2xl p-6 space-y-3">
            <div className="kt-skeleton kt-skeleton-text w-40" />
            <div className="kt-skeleton w-full h-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Empty State
  if (safeWorkloads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] animate-fade-in text-text-primary">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary-500 rounded-full blur-3xl opacity-10"></div>
          <div className="p-10 bg-bg-card rounded-full border border-border-main relative z-10 shadow-sm">
            <Server className="w-12 h-12 text-text-secondary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">No Workloads Found</h2>
        <p className="text-text-secondary max-w-sm text-center mb-6 text-sm">
          No active workloads detected in the current cluster. Connect a cluster to begin monitoring.
        </p>
        <button
          onClick={() => onRefresh?.()}
          className="px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white font-medium text-sm rounded-xl transition-all flex items-center gap-2"
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
    <div className="space-y-6 animate-fade-in">

      {/* Hero Section - Simplified */}
      {criticalCount > 0 && (
        <section className={`${cardBase} ${cardPaddingLg} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 to-transparent pointer-events-none"></div>
          <div className="flex flex-col lg:flex-row items-center gap-6 relative z-10">
            <div className="relative shrink-0">
              <div className="p-6 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <Network className="w-10 h-10 text-rose-500 dark:text-rose-400" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-xl flex items-center justify-center text-[10px] font-bold text-white">
                {criticalCount}
              </div>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <div className="flex flex-wrap justify-center lg:justify-start items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-medium">
                  Critical Issues Detected
                </span>
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                {criticalCount} workload{criticalCount > 1 ? 's' : ''} require immediate attention
              </h2>
              <p className="text-text-secondary text-sm max-w-xl">
                Review the active incidents below and run AI triage to identify root causes.
              </p>
            </div>

            <div className="shrink-0">
              <button
                onClick={() => onTriageRequest?.(incidents[0]?.id, 'Resource Constraints')}
                className="bg-primary-600 text-white hover:bg-primary-500 px-6 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-white" />
                Run AI Triage
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cost Card */}
        <div className={`${cardBase} ${cardHover} ${cardPadding}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-primary-500/10 rounded-xl text-primary-500 dark:text-primary-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-full">
              +4.2%
            </span>
          </div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Monthly Cost</p>
          <h3 className="text-2xl font-bold text-text-primary">${totalCost.toLocaleString()}</h3>
        </div>

        {/* Health Card */}
        <div className={`${cardBase} ${cardHover} ${cardPadding}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {Math.round((1 - (criticalCount / (safeWorkloads.length || 1))) * 100)}%
            </span>
          </div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Health Score</p>
          <h3 className="text-2xl font-bold text-text-primary">
            {criticalCount === 0 ? 'Healthy' : 'Degraded'}
          </h3>
        </div>

        {/* Savings Card */}
        <div className={`${cardBase} ${cardHover} ${cardPadding}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-primary-500/10 rounded-xl text-primary-600 dark:text-primary-400">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-full">
              Potential
            </span>
          </div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Cost Savings</p>
          <h3 className="text-2xl font-bold text-text-primary">${Math.round(potentialSavings).toLocaleString()}</h3>
        </div>

        {/* Workloads Card */}
        <div className={`${cardBase} ${cardHover} ${cardPadding}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-600 dark:text-cyan-400">
              <Box className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">
              {safeWorkloads.length}
            </span>
          </div>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Workloads</p>
          <h3 className="text-2xl font-bold text-text-primary">Active</h3>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left Column - Incidents & Status */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Active Incidents */}
          <div className={`${cardBase} ${cardPaddingLg} flex flex-col flex-1`}>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
              Active Incidents
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-2 custom-scrollbar">
              {incidents.length > 0 ? (
                incidents.slice(0, 5).map((w, idx) => (
                  <div
                    key={w.id}
                    className="p-4 rounded-xl border border-border-main bg-bg-hover/30 hover:bg-bg-hover hover:border-primary-500/30 transition-all cursor-pointer group"
                    onClick={() => onTriageRequest?.(w.id, 'Resource Constraints')}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(w.status)}`} />
                        <span className="text-sm font-semibold text-text-primary">{w.name}</span>
                      </div>
                      <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full ${
                        w.status === 'Critical'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {w.status}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mb-3">{getIncidentSummary(w)}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1.5 group-hover:text-primary-500">
                        <Sparkles className="w-3.5 h-3.5" />
                        Investigate with AI
                      </span>
                      <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-text-secondary transition-colors" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center flex flex-col items-center">
                  <div className="p-3 bg-emerald-500/10 rounded-full mb-3">
                    <HeartPulse className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">All services nominal</p>
                </div>
              )}
            </div>
          </div>

          {/* Status Distribution */}
          <div className={`${cardBase} ${cardPaddingLg}`}>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary-500 dark:text-primary-400" />
              Status Distribution
            </h3>
            <div className="h-44 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value" stroke="none">
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
                <span className="text-2xl font-bold text-text-primary">{safeWorkloads.length}</span>
                <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Total</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {statusData.map((item) => (
                <div
                  key={item.name}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-bg-hover/50 border border-border-main hover:border-primary-500/20 transition-all cursor-default"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">{item.name}</span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Resource Saturation */}
        <div className={`lg:col-span-3 ${cardBase} ${cardPaddingLg} flex flex-col`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-500 dark:text-primary-400" />
              Resource Saturation
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {/* Timeframe Selector */}
              <div className="flex p-1 bg-bg-hover/50 rounded-lg border border-border-main">
                {(['5m', '15m', '30m', '1h'] as const).map((win) => (
                  <button
                    key={win}
                    onClick={() => setMetricsWindow?.(win)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${metricsWindow === win
                      ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                      : 'text-text-secondary hover:text-text-primary'
                      }`}
                  >
                    {win}
                  </button>
                ))}
              </div>
              {/* Resource Tab Selector */}
              <div className="flex p-1 bg-bg-hover/50 rounded-lg border border-border-main">
                {(['CPU', 'Memory', 'Storage', 'GPU', 'Network'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSaturationTab(type)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${saturationTab === type
                      ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                      : 'text-text-secondary hover:text-text-primary'
                      }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-3">
              {workloads
                .map((w) => {
                  const metrics = w.metrics || {} as any;
                  let base = 0, used = 0, unit = '';

                  if (saturationTab === 'CPU') {
                    base = (Number(metrics.cpuLimit) || 0) * 1000;
                    used = (Number(metrics.cpuUsage) || 0) * 1000;
                    unit = 'mCPU';
                  } else if (saturationTab === 'Memory') {
                    base = Number(metrics.memoryLimit) || 0;
                    used = Number(metrics.memoryUsage) || 0;
                    unit = 'MiB';
                  } else if (saturationTab === 'Storage') {
                    base = Number(metrics.storageLimit) || 0;
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
                  const isCritical = saturation >= 90;
                  const isWarning = saturation >= 70 && !isCritical;

                  return { name: w.name, base, used, unit, saturation, isCritical, isWarning, status: w.status };
                })
                .sort((a, b) => b.saturation - a.saturation)
                .slice(0, 10)
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-bg-hover transition-colors cursor-pointer group"
                    onClick={() => onTriageRequest?.(item.name, 'General Health')}
                  >
                    {/* Rank Badge */}
                    <div className={`
                      w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-bold
                      ${idx === 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                        idx === 1 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                        idx === 2 ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20' :
                        'bg-bg-hover text-text-tertiary border border-border-main'}
                    `}>
                      {idx + 1}
                    </div>

                    <div className="w-28 shrink-0">
                      <h4 className="text-sm font-medium text-text-primary truncate" title={item.name}>{item.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(item.status)}`} />
                        <span className="text-[10px] text-text-tertiary uppercase">{item.status}</span>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] text-text-tertiary uppercase tracking-wider">{saturationTab}</span>
                        <span className={`text-xs font-bold ${item.isCritical ? 'text-rose-500' : item.isWarning ? 'text-amber-500' : 'text-text-secondary'}`}>
                          {item.saturation}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-bg-hover/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.isCritical
                              ? 'bg-gradient-to-r from-rose-600 to-rose-400'
                              : item.isWarning
                                ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                                : 'bg-gradient-to-r from-primary-600 to-primary-400'
                          }`}
                          style={{ width: `${Math.min(100, item.saturation)}%` }}
                        />
                      </div>
                    </div>

                    <div className="w-24 shrink-0 text-right">
                      <div className="text-xs font-mono font-medium text-text-secondary">
                        {item.used.toFixed(1)}{item.unit}
                      </div>
                      {item.base > 0 && (
                        <div className="text-[10px] text-text-tertiary">
                          / {item.base.toFixed(0)}{item.unit}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              {workloads.length > 10 && (
                <div className="pt-2 pb-1 text-center">
                  <span className="text-[11px] text-text-tertiary">
                    Showing top 10 of {workloads.length} workloads
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Budget Section */}
      <div className={`${cardBase} overflow-hidden shadow-sm`}>
        <div className="p-5 border-b border-border-main flex flex-col md:flex-row justify-between items-center gap-4 bg-bg-hover/30">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-500/10 rounded-xl text-primary-600 dark:text-primary-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">System Resilience</h3>
              <p className="text-xs text-text-secondary uppercase tracking-wider">30-Day Error Budget</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Operational SLO</p>
            <p className="text-2xl font-bold text-primary-500 dark:text-primary-400 font-mono">{reliabilityMetrics.slo}%</p>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Budget Gauge */}
          <div className="flex flex-col items-center justify-center">
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
                <span className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Budget</span>
                <span className={`text-3xl font-bold ${reliabilityMetrics.severity === 'Critical' ? 'text-rose-500' : 'text-text-primary'}`}>
                  {reliabilityMetrics.budgetPercentage.toFixed(1)}%
                </span>
                <span className="text-[10px] text-text-tertiary uppercase">Remaining</span>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex flex-col justify-center space-y-4">
            <div className="bg-bg-hover/30 p-4 rounded-xl border border-border-main">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Risk Factor</span>
                </div>
                <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full ${
                  reliabilityMetrics.severity === 'Healthy' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                  reliabilityMetrics.severity === 'Warning' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                  'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}>
                  {reliabilityMetrics.severity}
                </span>
              </div>
              <div className="text-2xl font-bold text-text-primary">{reliabilityMetrics.burnRate.toFixed(2)}x</div>
              <p className="text-xs text-text-tertiary">Burn rate vs normal</p>
            </div>

            <div className="bg-bg-hover/30 p-4 rounded-xl border border-border-main">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary-500 dark:text-primary-400" />
                  <span className="text-xs text-text-secondary uppercase tracking-wider">Exhaustion Forecast</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-text-primary">{reliabilityMetrics.uptimeForecast}</div>
              <p className="text-xs text-text-tertiary">Time until SLO breach</p>
            </div>
          </div>

          {/* Policy Compliance */}
          <div className="bg-bg-hover/30 p-4 rounded-xl border border-border-main flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2">Policy Compliance</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Current resource distribution is within acceptable parameters. No immediate re-balancing required.
              </p>
            </div>
            <button
              onClick={() => onTriageRequest?.('policy', 'General Health')}
              className="mt-4 w-full flex items-center justify-between p-3 bg-bg-card rounded-lg border border-border-main hover:border-primary-500/50 transition-all group shadow-sm"
            >
              <span className="text-xs font-medium text-text-secondary group-hover:text-primary-500">Run Compliance Audit</span>
              <ArrowRight className="w-4 h-4 text-text-tertiary group-hover:text-primary-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
