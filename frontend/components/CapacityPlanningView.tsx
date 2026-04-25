import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, AlertTriangle, CheckCircle2, Clock,
  RefreshCw, BarChart3, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { CapacityPlan, CapacityPlansResponse } from '../types';

interface ChartPoint {
  time: string;
  historical?: number;
  forecast?: number;
}

const COLORS = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#f43f5e',
  info: '#3b82f6'
};

const SEVERITY_CONFIG = {
  Critical: {
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    icon: AlertTriangle,
    chartColor: COLORS.danger
  },
  Warning: {
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: Clock,
    chartColor: COLORS.warning
  },
  Healthy: {
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: CheckCircle2,
    chartColor: COLORS.success
  }
};

export const CapacityPlanningView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CapacityPlansResponse | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ml/capacity-plans');
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch capacity plans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    if (!data) return { total: 0, critical: 0, warning: 0, healthy: 0 };
    return {
      total: data.count,
      critical: data.criticalCount,
      warning: data.warningCount,
      healthy: data.count - data.criticalCount - data.warningCount
    };
  }, [data]);

  const sortedPlans = useMemo(() => {
    if (!data?.plans) return [];
    const severityOrder = { Critical: 0, Warning: 1, Healthy: 2 };
    return [...data.plans].sort((a, b) => {
      const orderDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (orderDiff !== 0) return orderDiff;
      return (b.timeToExhaustionHours ?? Infinity) - (a.timeToExhaustionHours ?? Infinity);
    });
  }, [data?.plans]);

  const buildChartData = (plan: CapacityPlan): ChartPoint[] => {
    const historical = (plan.historicalPoints || []).map(p => ({
      time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      historical: p.value,
      forecast: undefined as number | undefined
    }));

    const forecast = (plan.forecastPoints || []).map(p => ({
      time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      historical: undefined as number | undefined,
      forecast: p.value
    }));

    return [...historical, ...forecast];
  };

  const formatWorkloadName = (key: string) => {
    const parts = key.split('/');
    if (parts.length >= 3) {
      return `${parts[2]} (${parts[1]})`;
    }
    return key;
  };

  const getTrendIcon = (slope: number) => {
    if (slope > 0.001) return <ArrowUpRight className="w-4 h-4" />;
    if (slope < -0.001) return <ArrowDownRight className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = (slope: number) => {
    if (slope > 0.001) return 'text-rose-500';
    if (slope < -0.001) return 'text-emerald-500';
    return 'text-text-tertiary';
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-6 p-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2">
            <div className="kt-skeleton kt-skeleton-heading w-48" />
            <div className="kt-skeleton kt-skeleton-text w-96" />
          </div>
          <div className="kt-skeleton w-24 h-9 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm space-y-3">
              <div className="flex justify-between">
                <div className="kt-skeleton kt-skeleton-text w-24" />
                <div className="kt-skeleton w-8 h-8 rounded-xl" />
              </div>
              <div className="kt-skeleton kt-skeleton-heading w-20" />
              <div className="kt-skeleton kt-skeleton-text w-32" />
            </div>
          ))}
        </div>
        <div className="bg-bg-card rounded-3xl border border-border-main p-6 space-y-4">
          <div className="kt-skeleton kt-skeleton-text w-40" />
          <div className="kt-skeleton w-full h-[200px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-black text-text-primary mb-2">Failed to Load Capacity Plans</h2>
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
          <h1 className="text-2xl font-black text-text-primary   flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-primary-500" />
            Capacity Planning
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            Predictive resource analysis and capacity recommendations based on usage trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold   text-text-tertiary mb-1">Total Workloads</p>
              <p className="text-3xl font-black text-text-primary">{stats.total}</p>
              <p className="text-xs text-text-secondary font-semibold mt-1">Tracked for capacity</p>
            </div>
            <div className="p-3 rounded-xl bg-primary-500/10">
              <BarChart3 className="w-5 h-5 text-primary-500" />
            </div>
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold   text-text-tertiary mb-1">Critical</p>
              <p className="text-3xl font-black text-rose-500">{stats.critical}</p>
              <p className="text-xs text-rose-500 font-semibold mt-1">Immediate action needed</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold   text-text-tertiary mb-1">Warning</p>
              <p className="text-3xl font-black text-amber-500">{stats.warning}</p>
              <p className="text-xs text-amber-500 font-semibold mt-1">Action within 48-72h</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold   text-text-tertiary mb-1">Healthy</p>
              <p className="text-3xl font-black text-emerald-500">{stats.healthy}</p>
              <p className="text-xs text-emerald-500 font-semibold mt-1">No action needed</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Plans List */}
      <div className="flex flex-col gap-4">
        {sortedPlans.length === 0 && (
          <div className="bg-bg-card rounded-2xl border border-border-main p-12 text-center">
            <TrendingUp className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
            <h3 className="text-lg font-bold text-text-primary mb-2">No Capacity Data Yet</h3>
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              Capacity planning requires at least 3 data points per workload. Metrics are ingested automatically as workloads are monitored.
            </p>
          </div>
        )}

        {sortedPlans.map((plan) => {
          const config = SEVERITY_CONFIG[plan.severity];
          const Icon = config.icon;
          const isExpanded = expandedPlan === plan.workloadKey;
          const chartData = isExpanded ? buildChartData(plan) : [];

          return (
            <div
              key={plan.workloadKey}
              className={`bg-bg-card rounded-2xl border transition-all duration-200 overflow-hidden ${
                plan.severity === 'Critical'
                  ? 'border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
                  : plan.severity === 'Warning'
                  ? 'border-amber-500/30'
                  : 'border-border-main'
              }`}
            >
              {/* Summary Row */}
              <button
                onClick={() => setExpandedPlan(isExpanded ? null : plan.workloadKey)}
                className="w-full p-5 flex items-center gap-4 hover:bg-bg-hover/50 transition-colors text-left"
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${config.bg}`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-text-primary text-sm truncate">
                      {formatWorkloadName(plan.workloadKey)}
                    </h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                      {plan.severity}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-bg-hover text-text-tertiary">
                      {plan.metric}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-1">
                    {plan.recommendation}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-semibold   text-text-tertiary">Confidence</p>
                    <p className="text-sm font-bold text-text-primary">{(plan.confidence * 100).toFixed(0)}%</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-semibold   text-text-tertiary">Trend</p>
                    <p className={`text-sm font-bold flex items-center justify-end gap-1 ${getTrendColor(plan.trendSlope)}`}>
                      {getTrendIcon(plan.trendSlope)}
                      {plan.trendSlope > 0 ? '+' : ''}{plan.trendSlope.toFixed(4)}/hr
                    </p>
                  </div>
                  {plan.timeToExhaustionHours !== null && plan.timeToExhaustionHours !== undefined && (
                    <div className="text-right hidden md:block">
                      <p className="text-[10px] font-semibold   text-text-tertiary">Exhaustion</p>
                      <p className={`text-sm font-bold ${plan.timeToExhaustionHours < 24 ? 'text-rose-500' : plan.timeToExhaustionHours < 72 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {plan.timeToExhaustionHours.toFixed(1)}h
                      </p>
                    </div>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-text-tertiary" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-text-tertiary" />
                  )}
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-border-main">
                  <div className="pt-4 space-y-4">
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-bg-hover/50 rounded-xl p-3">
                        <p className="text-[10px] font-semibold   text-text-tertiary">Metric</p>
                        <p className="text-sm font-bold text-text-primary mt-1">{plan.metric}</p>
                      </div>
                      <div className="bg-bg-hover/50 rounded-xl p-3">
                        <p className="text-[10px] font-semibold   text-text-tertiary">Namespace</p>
                        <p className="text-sm font-bold text-text-primary mt-1">{plan.namespace || 'default'}</p>
                      </div>
                      <div className="bg-bg-hover/50 rounded-xl p-3">
                        <p className="text-[10px] font-semibold   text-text-tertiary">Confidence</p>
                        <p className="text-sm font-bold text-text-primary mt-1">{(plan.confidence * 100).toFixed(1)}%</p>
                      </div>
                      <div className="bg-bg-hover/50 rounded-xl p-3">
                        <p className="text-[10px] font-semibold   text-text-tertiary">Trend Slope</p>
                        <p className={`text-sm font-bold mt-1 ${getTrendColor(plan.trendSlope)}`}>
                          {plan.trendSlope > 0 ? '+' : ''}{plan.trendSlope.toFixed(6)}/hr
                        </p>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className={`rounded-xl p-4 ${config.bg} ${config.border} border`}>
                      <p className="text-xs font-bold text-text-primary">Recommendation</p>
                      <p className="text-sm text-text-secondary mt-1">{plan.recommendation}</p>
                    </div>

                    {/* Chart */}
                    {chartData.length > 0 && (
                      <div className="bg-bg-hover/30 rounded-xl p-4 border border-border-main">
                        <p className="text-xs font-bold text-text-primary mb-3 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-primary-500" />
                          Usage Trend & 72h Forecast
                        </p>
                        <div className="h-[240px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id={`grad-hist-${plan.workloadKey}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id={`grad-fcast-${plan.workloadKey}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={config.chartColor} stopOpacity={0.2} />
                                  <stop offset="95%" stopColor={config.chartColor} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--kt-border-main)" opacity={0.3} />
                              <XAxis
                                dataKey="time"
                                tick={{ fontSize: 10, fill: 'var(--kt-text-tertiary)' }}
                                axisLine={false}
                                tickLine={false}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: 'var(--kt-text-tertiary)' }}
                                axisLine={false}
                                tickLine={false}
                                width={50}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'var(--kt-bg-card)',
                                  border: '1px solid var(--kt-border-main)',
                                  borderRadius: '12px',
                                  fontSize: '12px'
                                }}
                                labelStyle={{ color: 'var(--kt-text-primary)', fontWeight: 'bold' }}
                              />
                              <Area
                                type="monotone"
                                dataKey="historical"
                                stroke={COLORS.primary}
                                strokeWidth={2}
                                fill={`url(#grad-hist-${plan.workloadKey})`}
                                dot={false}
                                connectNulls={false}
                                name="Historical"
                              />
                              <Area
                                type="monotone"
                                dataKey="forecast"
                                stroke={config.chartColor}
                                strokeWidth={2}
                                strokeDasharray="6 4"
                                fill={`url(#grad-fcast-${plan.workloadKey})`}
                                dot={false}
                                connectNulls={false}
                                name="Forecast"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex items-center justify-center gap-4 mt-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-0.5 bg-primary-500" />
                            <span className="text-[10px] text-text-tertiary">Historical</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-0.5 border-t-2 border-dashed" style={{ borderColor: config.chartColor }} />
                            <span className="text-[10px] text-text-tertiary">Forecast</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
