import React, { useState, useEffect, useMemo } from 'react';
import {
  Brain, Activity, TrendingUp, AlertTriangle, CheckCircle2, Zap,
  Clock, RefreshCw, BarChart3, Lightbulb, ShieldAlert, Info
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

interface Anomaly {
  id: string;
  workload: string;
  namespace: string;
  cluster: string;
  metric: string;
  detectedAt: string;
  severity: 'Critical' | 'Warning' | 'Info';
  confidence: number;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  description: string;
}

interface Pattern {
  id: string;
  name: string;
  description: string;
  incidentType: string;
  frequency: number;
  firstSeen: string;
  lastSeen: string;
  affectedWorkloads: string[];
  commonSymptoms: string[];
  suggestedFix: string;
  confidence: number;
}

interface MLInsight {
  type: 'anomaly' | 'pattern' | 'forecast' | 'summary' | 'system';
  title: string;
  description: string;
  severity?: string;
  confidence: number;
}

interface MLIntelligenceData {
  timestamp: string;
  anomalies: Anomaly[];
  patterns: Pattern[];
  stats: {
    modelsTrained: number;
    patternsFound: number;
    anomaliesActive: number;
    isTraining: boolean;
  };
  insights: MLInsight[];
}

const COLORS = {
  primary: '#f5a623',
  success: '#2ecc71',
  warning: '#f5a623',
  danger: '#e74c3c',
  info: '#4fc1ff'
};

const SEVERITY_BADGE = {
  Critical: 'kt-badge-danger',
  Warning: 'kt-badge-warning',
  Info: 'kt-badge-info'
};

const SEVERITY_COLORS = {
  Critical: 'text-danger',
  Warning: 'text-warning',
  Info: 'text-info'
};

const SEVERITY_BG = {
  Critical: 'bg-danger-light border-danger/25',
  Warning: 'bg-warning-light border-warning/25',
  Info: 'bg-info-light border-info/25'
};

const INSIGHT_COLORS: Record<string, string> = {
  anomaly: 'text-danger',
  pattern: 'text-success',
  forecast: 'text-primary-500',
  summary: 'text-warning',
  system: 'text-info'
};

const summaryCard = (
  label: string,
  value: React.ReactNode,
  sub: React.ReactNode,
  icon: React.ElementType,
  iconColor: string
) => (
  <div className="kt-panel p-4">
    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-[11px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-1">
          {label}
        </p>
        <p className="text-3xl font-mono font-bold text-text-primary">{value}</p>
        <p className="text-xs mt-1 font-mono">{sub}</p>
      </div>
      <div className={`p-2.5 bg-bg-main border border-border-main ${iconColor}`}>
        <icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

export const MLIntelligenceView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MLIntelligenceData | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'anomalies' | 'patterns'>('overview');
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ml/intelligence');
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch ML intelligence:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const criticalAnomalies = useMemo(() =>
    (data?.anomalies || []).filter(a => a.severity === 'Critical'),
    [data?.anomalies]
  );

  const warningAnomalies = useMemo(() =>
    (data?.anomalies || []).filter(a => a.severity === 'Warning'),
    [data?.anomalies]
  );

  const highConfidencePatterns = useMemo(() =>
    (data?.patterns || []).filter(p => p.confidence >= 0.7),
    [data?.patterns]
  );

  const anomalyChartData = useMemo(() => {
    if (!data?.anomalies) return [];
    const byMetric: Record<string, number> = {};
    data.anomalies.forEach(a => {
      byMetric[a.metric] = (byMetric[a.metric] || 0) + 1;
    });
    return Object.entries(byMetric).map(([name, value]) => ({ name, value }));
  }, [data?.anomalies]);

  const patternChartData = useMemo(() => {
    if (!data?.patterns) return [];
    return data.patterns.slice(0, 5).map(p => ({
      name: p.incidentType,
      frequency: p.frequency,
      confidence: p.confidence * 100
    }));
  }, [data?.patterns]);

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-6 p-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2">
            <div className="kt-skeleton kt-skeleton-heading w-48" />
            <div className="kt-skeleton kt-skeleton-text w-96" />
          </div>
          <div className="kt-skeleton w-28 h-9 rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="kt-panel p-5 space-y-3">
              <div className="flex justify-between">
                <div className="kt-skeleton kt-skeleton-text w-24" />
                <div className="kt-skeleton w-8 h-8 rounded-md" />
              </div>
              <div className="kt-skeleton kt-skeleton-heading w-20" />
              <div className="kt-skeleton kt-skeleton-text w-32" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="kt-panel p-6 space-y-4">
            <div className="kt-skeleton kt-skeleton-text w-40" />
            <div className="kt-skeleton w-full h-[200px] rounded-md" />
          </div>
          <div className="kt-panel p-6 space-y-4">
            <div className="kt-skeleton kt-skeleton-text w-40" />
            <div className="kt-skeleton w-full h-[200px] rounded-md" />
          </div>
        </div>
        <div className="kt-panel overflow-hidden">
          <div className="kt-panel-header">
            <span>Detected Anomalies</span>
          </div>
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="kt-panel-inset flex items-center gap-4 p-4">
                <div className="kt-skeleton w-8 h-8 rounded-sm shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="kt-skeleton kt-skeleton-text w-48" />
                  <div className="kt-skeleton kt-skeleton-text w-64" />
                </div>
                <div className="kt-skeleton w-16 h-6 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <AlertTriangle className="w-12 h-12 text-danger mb-4" />
        <h2 className="text-xl font-display font-bold text-text-primary mb-2 tracking-wider uppercase">
          Failed to Load ML Data
        </h2>
        <button onClick={fetchData} className="kt-button kt-button-primary">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 font-sans animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary flex items-center gap-3 tracking-wider uppercase">
            <Brain className="w-7 h-7 text-primary-500" />
            ML Intelligence
          </h1>
          <p className="text-text-tertiary text-sm mt-1 font-mono">
            Machine learning powered insights, anomaly detection, and pattern recognition
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {(data.stats || {}).isTraining && (
            <span className="kt-badge kt-badge-warning">
              <Activity className="w-3 h-3 animate-pulse" />
              Training Models...
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="kt-button kt-button-secondary kt-button-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCard(
          'Models Trained',
          (data.stats || {}).modelsTrained ?? 0,
          <span className="text-success">ML models active</span>,
          Brain,
          'text-primary-500'
        )}
        {summaryCard(
          'Patterns Found',
          (data.stats || {}).patternsFound ?? 0,
          <span className="text-success">{highConfidencePatterns.length} high confidence</span>,
          TrendingUp,
          'text-success'
        )}
        {summaryCard(
          'Active Anomalies',
          (data.stats || {}).anomaliesActive ?? 0,
          <span className={criticalAnomalies.length > 0 ? 'text-danger' : 'text-success'}>
            {criticalAnomalies.length} critical
          </span>,
          ShieldAlert,
          criticalAnomalies.length > 0 ? 'text-danger' : 'text-success'
        )}
        {summaryCard(
          'ML Insights',
          (data.insights || []).length,
          <span className="text-warning">Generated today</span>,
          Lightbulb,
          'text-warning'
        )}
      </div>

      {/* Insights Banner */}
      {(data.insights || []).length > 0 && (
        <div className="kt-panel overflow-hidden">
          <div className="kt-panel-header">
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-500" />
              ML-Generated Insights
            </span>
          </div>
          <div className="p-4 space-y-3 relative z-10">
            {data.insights.slice(0, 3).map((insight, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 border ${
                  insight.severity === 'Critical'
                    ? 'bg-danger-light border-danger/25'
                    : insight.severity === 'Warning'
                    ? 'bg-warning-light border-warning/25'
                    : 'bg-bg-hover border-border-main'
                }`}
              >
                {insight.type === 'anomaly' ? (
                  <ShieldAlert className={`w-5 h-5 text-danger shrink-0`} />
                ) : insight.type === 'pattern' ? (
                  <TrendingUp className="w-5 h-5 text-success shrink-0" />
                ) : insight.type === 'forecast' ? (
                  <BarChart3 className="w-5 h-5 text-primary-500 shrink-0" />
                ) : (
                  <Lightbulb className="w-5 h-5 text-warning shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-sans font-semibold text-text-primary text-sm tracking-wide uppercase">
                    {insight.title}
                  </h4>
                  <p className="text-xs text-text-secondary mt-0.5">{insight.description}</p>
                </div>
                <span className="text-xs font-mono font-bold text-text-tertiary shrink-0">
                  {(insight.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-bg-card border border-border-main p-0.5">
        {(['overview', 'anomalies', 'patterns'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`flex-1 px-4 py-2.5 text-xs font-sans font-semibold tracking-wider uppercase border transition-all ${
              selectedTab === tab
                ? 'bg-primary-500/10 text-primary-500 border-primary-500/30'
                : 'text-text-tertiary hover:text-text-primary border-transparent'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Anomaly Distribution */}
          <div className="kt-panel p-5">
            <div className="kt-panel-header mb-4 -mx-5 -mt-5">
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary-500" />
                Anomalies by Metric
              </span>
            </div>
            <div className="h-[250px] relative z-10">
              {anomalyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={anomalyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--kt-border-main)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--kt-fg-tertiary)', fontSize: 10 }} />
                    <YAxis tick={{ fill: 'var(--kt-fg-tertiary)', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--kt-bg-card)',
                        border: '1px solid var(--kt-border-main)',
                        borderRadius: '2px',
                        color: 'var(--kt-fg-primary)',
                        fontFamily: 'var(--kt-font-mono)',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                    />
                    <Bar dataKey="value" fill={COLORS.primary} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-tertiary font-mono uppercase tracking-wider">
                  <CheckCircle2 className="w-12 h-12 text-success mb-2" />
                  <p>No anomalies detected</p>
                </div>
              )}
            </div>
          </div>

          {/* Pattern Frequency */}
          <div className="kt-panel p-5">
            <div className="kt-panel-header mb-4 -mx-5 -mt-5">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                Recurring Patterns
              </span>
            </div>
            <div className="h-[250px] relative z-10">
              {patternChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={patternChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--kt-border-main)" />
                    <XAxis type="number" tick={{ fill: 'var(--kt-fg-tertiary)', fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fill: 'var(--kt-fg-tertiary)', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--kt-bg-card)',
                        border: '1px solid var(--kt-border-main)',
                        borderRadius: '2px',
                        color: 'var(--kt-fg-primary)',
                        fontFamily: 'var(--kt-font-mono)',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                    />
                    <Bar dataKey="frequency" fill={COLORS.success} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-tertiary font-mono uppercase tracking-wider">
                  <Info className="w-12 h-12 text-text-tertiary mb-2" />
                  <p>No patterns discovered yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Anomalies Tab */}
      {selectedTab === 'anomalies' && (
        <div className="kt-panel overflow-hidden">
          <div className="kt-panel-header">
            <span>Detected Anomalies ({(data.anomalies || []).length})</span>
          </div>
          <div className="p-4 space-y-3 relative z-10">
            {(data.anomalies || []).length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
                <h4 className="text-lg font-display font-bold text-text-primary mb-2 tracking-wider uppercase">
                  No Anomalies Detected
                </h4>
                <p className="text-text-tertiary font-mono">All metrics are within normal ranges</p>
              </div>
            ) : (
              data.anomalies.map((anomaly) => (
                <div
                  key={anomaly.id}
                  className={`p-4 border cursor-pointer transition-all ${
                    selectedAnomaly === anomaly.id
                      ? 'border-primary-500 bg-primary-500/5'
                      : 'border-border-main bg-bg-main hover:border-primary-500/30'
                  }`}
                  onClick={() => setSelectedAnomaly(selectedAnomaly === anomaly.id ? null : anomaly.id)}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 shrink-0 border ${SEVERITY_BG[anomaly.severity]}`}>
                        <ShieldAlert className={`w-4 h-4 ${SEVERITY_COLORS[anomaly.severity]}`} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-sans font-semibold text-text-primary truncate tracking-wide uppercase">
                          {anomaly.workload}
                        </h4>
                        <p className="text-xs text-text-tertiary font-mono uppercase tracking-wider truncate">
                          {anomaly.namespace} • {anomaly.cluster}
                        </p>
                      </div>
                    </div>
                    <span className={`kt-badge ${SEVERITY_BADGE[anomaly.severity]} shrink-0`}>
                      {anomaly.severity}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary mb-3 break-words">{anomaly.description}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-text-tertiary">
                    <span>Expected: {anomaly.expectedValue.toFixed(2)}</span>
                    <span>Actual: {anomaly.actualValue.toFixed(2)}</span>
                    <span>Deviation: {anomaly.deviation.toFixed(1)}σ</span>
                    <span>Confidence: {(anomaly.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Patterns Tab */}
      {selectedTab === 'patterns' && (
        <div className="kt-panel overflow-hidden">
          <div className="kt-panel-header">
            <span>Discovered Patterns ({(data.patterns || []).length})</span>
          </div>
          <div className="p-4 space-y-4 relative z-10">
            {(data.patterns || []).length === 0 ? (
              <div className="text-center py-12">
                <Info className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                <h4 className="text-lg font-display font-bold text-text-primary mb-2 tracking-wider uppercase">
                  No Patterns Discovered
                </h4>
                <p className="text-text-tertiary font-mono">ML is learning from your incident data...</p>
              </div>
            ) : (
              data.patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className={`p-5 border cursor-pointer transition-all ${
                    selectedPattern === pattern.id
                      ? 'border-success bg-success/5'
                      : 'border-border-main bg-bg-main hover:border-success/30'
                  }`}
                  onClick={() => setSelectedPattern(selectedPattern === pattern.id ? null : pattern.id)}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-success-light border border-success/25 shrink-0">
                        <TrendingUp className="w-4 h-4 text-success" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-sans font-semibold text-text-primary truncate tracking-wide uppercase">
                          {pattern.name}
                        </h4>
                        <p className="text-xs text-text-tertiary font-mono uppercase tracking-wider truncate">
                          {pattern.incidentType}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-text-tertiary shrink-0">
                      {(pattern.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary mb-3 break-words">{pattern.description}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-text-tertiary mb-3">
                    <span>Occurred: {pattern.frequency} times</span>
                    <span>First seen: {new Date(pattern.firstSeen).toLocaleDateString()}</span>
                    <span>Last seen: {new Date(pattern.lastSeen).toLocaleDateString()}</span>
                  </div>
                  {(pattern.affectedWorkloads || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(pattern.affectedWorkloads || []).slice(0, 5).map((workload) => (
                        <span
                          key={workload}
                          className="kt-badge kt-badge-info truncate max-w-[200px]"
                        >
                          {workload}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="kt-panel-inset p-3">
                    <p className="text-[11px] font-sans font-semibold text-text-tertiary tracking-wider uppercase mb-1">
                      Suggested Fix
                    </p>
                    <p className="text-sm text-text-secondary break-words">{pattern.suggestedFix}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 text-text-tertiary text-xs font-mono uppercase tracking-wider">
        <Clock className="w-3 h-3" />
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};
