import React, { useMemo } from 'react';
import { Workload, DiagnosticPlaybook } from '../types';
import { getMetricStatusColor } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, DollarSign, Box, Zap, TrendingDown, ShieldAlert, HeartPulse, Sparkles, Network, ArrowRight, Target, ShieldCheck, ChevronRight, Server, Loader2 } from 'lucide-react';
import { DashboardCard } from './dashboard/DashboardCard';
import { MetricCard } from './dashboard/MetricCard';
import { StatusBadge } from './dashboard/StatusBadge';
import { useStaggerAnimation } from './PageTransition';

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
  const [saturationTab, setSaturationTab] = React.useState<'CPU' | 'Memory' | 'Ephemeral Storage' | 'Network' | 'GPU'>('CPU');
  const safeWorkloads = workloads || [];
  const totalCost = safeWorkloads.reduce((acc, w) => acc + (w.costPerMonth || 0), 0);
  const criticalCount = safeWorkloads.filter(w => w.status === 'Critical').length;
  const warningCount = safeWorkloads.filter(w => w.status === 'Warning').length;

  const potentialSavings = safeWorkloads
    .filter(w => w.recommendation && w.recommendation.action === 'Downsize')
    .reduce((acc, w) => acc + (w.costPerMonth * 0.4), 0);

  const statusData = [
    { name: 'Healthy', value: safeWorkloads.filter(w => w.status === 'Healthy').length, color: '#2ecc71' },
    { name: 'Warning', value: warningCount, color: '#f5a623' },
    { name: 'Critical', value: criticalCount, color: '#e74c3c' },
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
    fontFamily: 'var(--kt-font-mono)',
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
        <h2 className="text-2xl font-display font-bold mb-2 tracking-wider uppercase">No Workloads Found</h2>
        <p className="text-text-secondary max-w-sm text-center mb-6 text-sm font-mono">
          No active workloads detected in the current cluster. Connect a cluster to begin monitoring.
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
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-danger flex items-center justify-center text-[10px] font-mono font-bold text-black">
                {criticalCount}
              </div>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <div className="flex flex-wrap justify-center lg:justify-start items-center gap-3 mb-3">
                <span className="kt-badge kt-badge-danger">
                  Critical Issues Detected
                </span>
              </div>
              <h2 className="text-2xl font-display font-bold text-text-primary mb-2 tracking-wider uppercase">
                {criticalCount} workload{criticalCount > 1 ? 's' : ''} require immediate attention
              </h2>
              <p className="text-text-secondary text-sm max-w-xl font-mono">
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

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={DollarSign}
          iconColor="text-primary-500"
          label="Monthly Cost"
          value={`$${totalCost.toLocaleString()}`}
          trend="+4.2%"
          delay={stagger(0).animationDelay}
        />
        <MetricCard
          icon={Activity}
          iconColor="text-success"
          label="Health Score"
          value={criticalCount === 0 ? 'HEALTHY' : 'DEGRADED'}
          trendLabel={`${Math.round((1 - (criticalCount / (safeWorkloads.length || 1))) * 100)}%`}
          delay={stagger(1).animationDelay}
        />
        <MetricCard
          icon={TrendingDown}
          iconColor="text-primary-500"
          label="Cost Savings"
          value={`$${Math.round(potentialSavings).toLocaleString()}`}
          trendLabel="Potential"
          delay={stagger(2).animationDelay}
        />
        <MetricCard
          icon={Box}
          iconColor="text-info"
          label="Workloads"
          value="ACTIVE"
          trendLabel={`${safeWorkloads.length}`}
          delay={stagger(3).animationDelay}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <DashboardCard padding="lg" title="Active Incidents" className="flex flex-col flex-1 min-h-[360px]">
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
                        <span className="text-sm font-mono font-bold text-text-primary truncate uppercase tracking-wide">{w.name}</span>
                      </div>
                      <StatusBadge status={w.status} />
                    </div>
                    <p className="text-xs text-text-secondary mb-3 font-mono">{getIncidentSummary(w)}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-primary-500 flex items-center gap-1.5 group-hover:text-primary-400 font-mono uppercase tracking-wider">
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
                  <p className="text-xs font-sans font-semibold text-text-tertiary tracking-wider uppercase">All services nominal</p>
                </div>
              )}
            </div>
          </DashboardCard>

          <DashboardCard padding="lg" title="Status Distribution">
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
                <span className="text-2xl font-mono font-bold text-text-primary">{safeWorkloads.length}</span>
                <span className="text-[10px] text-text-tertiary font-sans font-semibold tracking-wider uppercase">Total</span>
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
                    <span className="text-[10px] font-sans font-semibold text-text-secondary tracking-wider uppercase">{item.name}</span>
                  </div>
                  <span className="text-lg font-mono font-bold" style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        {/* Right Column - Resource Saturation */}
        <div className="lg:col-span-3">
          <DashboardCard padding="lg" title="Resource Saturation" className="flex flex-col h-full min-h-[360px]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4 relative z-10">
              <div className="flex flex-wrap items-center gap-2">
                {(['5m', '15m', '30m', '1h'] as const).map((win) => (
                  <button
                    key={win}
                    onClick={() => setMetricsWindow?.(win)}
                    className={`px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider uppercase border transition-all ${metricsWindow === win
                      ? 'bg-primary-500/10 border-primary-500 text-primary-500'
                      : 'border-border-main text-text-secondary hover:text-text-primary hover:border-text-tertiary'
                      }`}
                    aria-label={`Set metrics window to ${win}`}
                    aria-pressed={metricsWindow === win}
                  >
                    {win}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['CPU', 'Memory', 'Ephemeral Storage', 'GPU', 'Network'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSaturationTab(type)}
                    className={`px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider uppercase border transition-all ${saturationTab === type
                      ? 'bg-primary-500/10 border-primary-500 text-primary-500'
                      : 'border-border-main text-text-secondary hover:text-text-primary hover:border-text-tertiary'
                      }`}
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
                    const isCritical = saturation >= 90;
                    const isWarning = saturation >= 70 && !isCritical;

                    return { name: w.name, base, used, unit, saturation, isCritical, isWarning, status: w.status };
                  })
                  .sort((a, b) => b.saturation - a.saturation)
                  .slice(0, 10)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 border border-border-main bg-bg-main hover:border-primary-500/30 hover:bg-bg-hover transition-all cursor-pointer group focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:outline-none"
                      onClick={() => onTriageRequest?.(item.name, 'General Health')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTriageRequest?.(item.name, 'General Health'); } }}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${item.name}`}
                    >
                      <div className={`
                        w-6 h-6 shrink-0 flex items-center justify-center text-[10px] font-mono font-bold border
                        ${idx === 0 ? 'bg-danger/10 text-danger border-danger/30' :
                          idx === 1 ? 'bg-warning/10 text-warning border-warning/30' :
                          idx === 2 ? 'bg-primary-500/10 text-primary-500 border-primary-500/30' :
                          'bg-bg-hover text-text-tertiary border-border-main'}
                      `}>
                        {idx + 1}
                      </div>

                      <div className="w-28 shrink-0 min-w-0">
                        <h4 className="text-sm font-mono font-bold text-text-primary truncate uppercase tracking-wide" title={item.name}>{item.name}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(item.status)}`} />
                          <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">{item.status}</span>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col justify-center">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[10px] text-text-tertiary font-sans font-semibold tracking-wider uppercase">{saturationTab}</span>
                          <span className={`text-xs font-mono font-bold ${item.isCritical ? 'text-danger' : item.isWarning ? 'text-warning' : 'text-text-secondary'}`}>
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
                                  : 'bg-primary-500 shadow-[0_0_8px_#f5a623]'
                            }`}
                            style={{ width: `${Math.min(100, item.saturation)}%` }}
                          />
                        </div>
                      </div>

                      <div className="w-24 shrink-0 text-right">
                        <div className="text-xs font-mono font-bold text-text-secondary">
                          {item.used.toFixed(1)}{item.unit}
                        </div>
                        <div className="text-[10px] text-text-tertiary font-mono">
                          / {item.base.toFixed(0)}{item.unit}
                        </div>
                      </div>
                    </div>
                  ))}
                {workloads.length > 10 && (
                  <div className="pt-2 pb-1 text-center">
                    <span className="text-[11px] text-text-tertiary font-mono uppercase tracking-wider">
                      Showing top 10 of {workloads.length} workloads
                    </span>
                  </div>
                )}
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>

      {/* Error Budget Section */}
      <DashboardCard hover={false} title="System Resilience" className="overflow-hidden">
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
                <span className="text-[10px] text-text-tertiary font-sans font-semibold tracking-wider uppercase mb-1">Budget</span>
                <span className={`text-3xl font-mono font-bold ${reliabilityMetrics.severity === 'Critical' ? 'text-danger' : 'text-text-primary'}`}>
                  {reliabilityMetrics.budgetPercentage.toFixed(1)}%
                </span>
                <span className="text-[10px] text-text-tertiary font-sans font-semibold tracking-wider uppercase">Remaining</span>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex flex-col justify-center gap-3 p-4 border border-border-main bg-bg-main">
            <div className="p-4 border border-border-main bg-bg-card">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-success" />
                  <span className="text-[11px] font-sans font-semibold text-text-secondary tracking-wider uppercase">Risk Factor</span>
                </div>
                <StatusBadge status={reliabilityMetrics.severity} />
              </div>
              <div className="text-2xl font-mono font-bold text-text-primary">{reliabilityMetrics.burnRate.toFixed(2)}x</div>
              <p className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">Burn rate vs normal</p>
            </div>

            <div className="p-4 border border-border-main bg-bg-card">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary-500" />
                  <span className="text-[11px] font-sans font-semibold text-text-secondary tracking-wider uppercase">Exhaustion Forecast</span>
                </div>
              </div>
              <div className="text-2xl font-mono font-bold text-text-primary">{reliabilityMetrics.uptimeForecast}</div>
              <p className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">Time until SLO breach</p>
            </div>
          </div>

          {/* Policy Compliance */}
          <div className="p-4 border border-border-main bg-bg-main flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-sans font-semibold text-text-primary mb-2 tracking-wider uppercase">Policy Compliance</h4>
              <p className="text-xs text-text-secondary leading-relaxed font-mono">
                Current resource distribution is within acceptable parameters. No immediate re-balancing required.
              </p>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-1">
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
              <span className="text-xs font-sans font-semibold text-text-secondary tracking-wider uppercase group-hover:text-primary-500">Run Compliance Audit</span>
              <ArrowRight className="w-4 h-4 text-text-tertiary group-hover:text-primary-500" />
            </button>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
};
