import React, { useState, useEffect, useMemo } from 'react';
import {
  Brain, Activity, TrendingUp, AlertTriangle, CheckCircle2, Zap,
  Clock, ChevronDown, ChevronUp, RefreshCw, BarChart3, Target,
  Lightbulb, ShieldAlert, Info, ArrowUpRight, Filter, Download
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell
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
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#f43f5e',
  info: '#3b82f6'
};

const SEVERITY_COLORS = {
  Critical: 'text-rose-500',
  Warning: 'text-amber-500',
  Info: 'text-blue-500'
};

const SEVERITY_BG = {
  Critical: 'bg-rose-500/10',
  Warning: 'bg-amber-500/10',
  Info: 'bg-blue-500/10'
};

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
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <div className="p-6 bg-bg-hover rounded-full mb-6 animate-pulse">
          <Brain className="w-12 h-12 text-primary-500" />
        </div>
        <h2 className="text-2xl font-black text-text-primary uppercase tracking-tighter mb-2">
          Loading ML Intelligence
        </h2>
        <p className="text-text-tertiary">Analyzing patterns and detecting anomalies...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-black text-text-primary mb-2">Failed to Load ML Data</h2>
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
            <Brain className="w-7 h-7 text-primary-500" />
            ML Intelligence
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            Machine learning powered insights, anomaly detection, and pattern recognition
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(data.stats || {}).isTraining && (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-500/10 text-primary-500 text-xs font-bold">
              <Activity className="w-3 h-3 animate-pulse" />
              Training Models...
            </span>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">Models Trained</p>
              <p className="text-3xl font-black text-text-primary">{(data.stats || {}).modelsTrained ?? 0}</p>
              <p className="text-xs text-emerald-500 font-semibold mt-1">ML models active</p>
            </div>
            <div className="p-3 rounded-xl bg-primary-500/10">
              <Brain className="w-5 h-5 text-primary-500" />
            </div>
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">Patterns Found</p>
              <p className="text-3xl font-black text-text-primary">{(data.stats || {}).patternsFound ?? 0}</p>
              <p className="text-xs text-emerald-500 font-semibold mt-1">{highConfidencePatterns.length} high confidence</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">Active Anomalies</p>
              <p className="text-3xl font-black text-text-primary">{(data.stats || {}).anomaliesActive ?? 0}</p>
              <p className={`text-xs font-semibold mt-1 ${criticalAnomalies.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {criticalAnomalies.length} critical
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            </div>
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">ML Insights</p>
              <p className="text-3xl font-black text-text-primary">{(data.insights || []).length}</p>
              <p className="text-xs text-amber-500 font-semibold mt-1">Generated today</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10">
              <Lightbulb className="w-5 h-5 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Insights Banner */}
      {(data.insights || []).length > 0 && (
        <div className="bg-bg-card rounded-2xl border border-border-main overflow-hidden">
          <div className="p-4 border-b border-border-main bg-bg-hover/50">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-500" />
              ML-Generated Insights
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {data.insights.slice(0, 3).map((insight, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-xl ${
                  insight.severity === 'Critical' ? 'bg-rose-500/10 border border-rose-500/20' :
                  insight.severity === 'Warning' ? 'bg-amber-500/10 border border-amber-500/20' :
                  'bg-bg-hover'
                }`}
              >
                {insight.type === 'anomaly' ? <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" /> :
                 insight.type === 'pattern' ? <TrendingUp className="w-5 h-5 text-emerald-500 shrink-0" /> :
                 insight.type === 'forecast' ? <BarChart3 className="w-5 h-5 text-primary-500 shrink-0" /> :
                 <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-text-primary text-sm">{insight.title}</h4>
                  <p className="text-xs text-text-secondary mt-0.5">{insight.description}</p>
                </div>
                <span className="text-xs font-bold text-text-tertiary">
                  {(insight.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-bg-card rounded-xl border border-border-main p-1">
        {(['overview', 'anomalies', 'patterns'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${
              selectedTab === tab
                ? 'bg-primary-600 text-white'
                : 'text-text-tertiary hover:text-text-primary'
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
          <div className="bg-bg-card rounded-3xl border border-border-main p-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary-500" />
              Anomalies by Metric
            </h3>
            <div className="h-[250px]">
              {anomalyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={anomalyChartData}>
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
                    <Bar dataKey="value" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2" />
                  <p>No anomalies detected</p>
                </div>
              )}
            </div>
          </div>

          {/* Pattern Frequency */}
          <div className="bg-bg-card rounded-3xl border border-border-main p-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Recurring Patterns
            </h3>
            <div className="h-[250px]">
              {patternChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={patternChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '12px'
                      }}
                    />
                    <Bar dataKey="frequency" fill={COLORS.success} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
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
        <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
          <div className="p-6 border-b border-border-main bg-bg-hover/50">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">
              Detected Anomalies ({(data.anomalies || []).length})
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {(data.anomalies || []).length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-text-primary mb-2">No Anomalies Detected</h4>
                <p className="text-text-tertiary">All metrics are within normal ranges</p>
              </div>
            ) : (
              data.anomalies.map((anomaly) => (
                <div
                  key={anomaly.id}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedAnomaly === anomaly.id
                      ? 'border-primary-500 bg-primary-500/5'
                      : 'border-border-main hover:border-primary-500/30'
                  }`}
                  onClick={() => setSelectedAnomaly(selectedAnomaly === anomaly.id ? null : anomaly.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${SEVERITY_BG[anomaly.severity]}`}>
                        <ShieldAlert className={`w-4 h-4 ${SEVERITY_COLORS[anomaly.severity]}`} />
                      </div>
                      <div>
                        <h4 className="font-bold text-text-primary">{anomaly.workload}</h4>
                        <p className="text-xs text-text-tertiary">{anomaly.namespace} • {anomaly.cluster}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${SEVERITY_BG[anomaly.severity]} ${SEVERITY_COLORS[anomaly.severity]}`}>
                      {anomaly.severity}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary mb-3">{anomaly.description}</p>
                  <div className="flex items-center gap-4 text-xs text-text-tertiary">
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
        <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
          <div className="p-6 border-b border-border-main bg-bg-hover/50">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">
              Discovered Patterns ({(data.patterns || []).length})
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {(data.patterns || []).length === 0 ? (
              <div className="text-center py-12">
                <Info className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                <h4 className="text-lg font-bold text-text-primary mb-2">No Patterns Discovered</h4>
                <p className="text-text-tertiary">ML is learning from your incident data...</p>
              </div>
            ) : (
              data.patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedPattern === pattern.id
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : 'border-border-main hover:border-emerald-500/30'
                  }`}
                  onClick={() => setSelectedPattern(selectedPattern === pattern.id ? null : pattern.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-text-primary">{pattern.name}</h4>
                        <p className="text-xs text-text-tertiary">{pattern.incidentType}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-text-tertiary">
                      {(pattern.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary mb-3">{pattern.description}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-text-tertiary mb-3">
                    <span>Occurred: {pattern.frequency} times</span>
                    <span>First seen: {new Date(pattern.firstSeen).toLocaleDateString()}</span>
                    <span>Last seen: {new Date(pattern.lastSeen).toLocaleDateString()}</span>
                  </div>
                  {(pattern.affectedWorkloads || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(pattern.affectedWorkloads || []).slice(0, 5).map((workload) => (
                        <span
                          key={workload}
                          className="px-2 py-1 rounded-lg bg-bg-hover text-text-secondary text-xs"
                        >
                          {workload}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-bg-hover border border-border-main">
                    <p className="text-xs font-bold text-text-tertiary uppercase mb-1">Suggested Fix</p>
                    <p className="text-sm text-text-secondary">{pattern.suggestedFix}</p>
                  </div>
                </div>
              ))
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
