import React, { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  LineChart,
  Calendar,
  Filter,
  Cloud,
  Zap,
  Globe,
  ExternalLink,
  MoreHorizontal
} from 'lucide-react';
import { PageTransition } from './PageTransition';
import { MetricsChart } from './MetricsChart';

interface ExternalMetricSource {
  id: string;
  name: string;
  provider: 'datadog' | 'newrelic' | 'cloudwatch' | 'custom';
  region?: string;
  namespace?: string;
  endpoint?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  syncStatus: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
  labels: Record<string, string>;
}

interface MetricTimeSeries {
  name: string;
  labels: Record<string, string>;
  unit: string;
  values: { timestamp: string; value: number }[];
}

export const ExternalMetricsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sources' | 'metrics' | 'query'>('sources');
  const [sources, setSources] = useState<ExternalMetricSource[]>([]);
  const [metrics, setMetrics] = useState<MetricTimeSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState<ExternalMetricSource | null>(null);
  const [timeRange, setTimeRange] = useState('1h');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    if (activeTab === 'metrics') {
      fetchMetrics();
    }
  }, [activeTab, timeRange]);

  const fetchSources = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/metrics/sources');
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      } else {
        // Demo data
        setDemoSources();
      }
    } catch (error) {
      console.error('Failed to fetch sources:', error);
      setDemoSources();
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoSources = () => {
    setSources([
      {
        id: 'source-datadog-001',
        name: 'Production Datadog',
        provider: 'datadog',
        enabled: true,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        lastSyncAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        syncStatus: 'idle',
        labels: { env: 'production', team: 'platform' }
      },
      {
        id: 'source-cw-001',
        name: 'AWS CloudWatch',
        provider: 'cloudwatch',
        region: 'us-east-1',
        namespace: 'AWS/EKS',
        enabled: true,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        lastSyncAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        syncStatus: 'idle',
        labels: { env: 'production', provider: 'aws' }
      },
      {
        id: 'source-nr-001',
        name: 'New Relic Staging',
        provider: 'newrelic',
        enabled: false,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        syncStatus: 'idle',
        errorMessage: 'API key expired',
        labels: { env: 'staging' }
      }
    ]);
  };

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - parseTimeRange(timeRange)).toISOString();

      const res = await fetch(`/api/metrics/query?startTime=${startTime}&endTime=${endTime}`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.series || []);
      } else {
        setDemoMetrics();
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setDemoMetrics();
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoMetrics = () => {
    const now = Date.now();
    const values = [];
    for (let i = 100; i >= 0; i--) {
      values.push({
        timestamp: new Date(now - i * 60000).toISOString(),
        value: 100 + Math.sin(i * 0.1) * 20 + Math.random() * 10
      });
    }

    setMetrics([
      {
        name: 'requests_per_second',
        labels: { service: 'api-gateway', source: 'datadog' },
        unit: 'req/s',
        values
      },
      {
        name: 'cpu_utilization',
        labels: { cluster: 'prod-eks', source: 'cloudwatch' },
        unit: 'percent',
        values: values.map(v => ({ ...v, value: 45 + Math.sin(v.timestamp) * 15 + Math.random() * 5 }))
      },
      {
        name: 'memory_usage',
        labels: { service: 'cache-service', source: 'datadog' },
        unit: 'bytes',
        values: values.map(v => ({ ...v, value: 1024 * 1024 * 1024 * (0.6 + Math.sin(v.timestamp) * 0.2) }))
      }
    ]);
  };

  const parseTimeRange = (range: string): number => {
    switch (range) {
      case '1h': return 60 * 60 * 1000;
      case '6h': return 6 * 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'datadog': return <Zap className="w-5 h-5 text-[#632CA6]" />;
      case 'newrelic': return <BarChart3 className="w-5 h-5 text-[#00C74D]" />;
      case 'cloudwatch': return <Cloud className="w-5 h-5 text-[#FF9900]" />;
      case 'custom': return <Globe className="w-5 h-5 text-zinc-500" />;
      default: return <Database className="w-5 h-5 text-zinc-500" />;
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'datadog': return 'Datadog';
      case 'newrelic': return 'New Relic';
      case 'cloudwatch': return 'AWS CloudWatch';
      case 'custom': return 'Custom Endpoint';
      default: return provider;
    }
  };

  const getStatusBadge = (status: string, error?: string) => {
    if (error) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-rose-500/10 text-rose-600">
          <AlertCircle className="w-3 h-3" /> Error
        </span>
      );
    }
    if (status === 'syncing') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/10 text-blue-600">
          <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-600">
        <CheckCircle className="w-3 h-3" /> Ready
      </span>
    );
  };

  const handleToggleSource = async (source: ExternalMetricSource) => {
    try {
      const res = await fetch(`/api/metrics/sources/${source.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...source, enabled: !source.enabled })
      });
      if (res.ok) {
        fetchSources();
      }
    } catch (error) {
      console.error('Failed to toggle source:', error);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this metric source?')) return;
    try {
      const res = await fetch(`/api/metrics/sources/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSources();
      }
    } catch (error) {
      console.error('Failed to delete source:', error);
    }
  };

  const handleSync = async (sourceId: string) => {
    try {
      await fetch(`/api/metrics/sources/${sourceId}/sync`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  const filteredSources = sources.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">External Metrics</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Ingest metrics from Datadog, New Relic, CloudWatch, and other sources
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Source
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Metric Sources</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{sources.length}</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Active</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {sources.filter(s => s.enabled).length}
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Metrics Ingested</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{metrics.length}</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Last Sync</div>
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mt-2">
              {sources.filter(s => s.lastSyncAt).length > 0 ? '5 min ago' : 'Never'}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700">
          {(['sources', 'metrics', 'query'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Sources Tab */}
        {activeTab === 'sources' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Database className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              </div>
              <button
                onClick={fetchSources}
                className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSources.map((source) => (
                <div
                  key={source.id}
                  className={`bg-white dark:bg-zinc-900 rounded-xl border ${source.enabled ? 'border-zinc-200 dark:border-zinc-700' : 'border-zinc-200/50 dark:border-zinc-700/50'} p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                        {getProviderIcon(source.provider)}
                      </div>
                      <div>
                        <h3 className={`text-sm font-semibold ${source.enabled ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                          {source.name}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {getProviderName(source.provider)}
                          {source.region && ` • ${source.region}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(source.syncStatus, source.errorMessage)}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Created {new Date(source.createdAt).toLocaleDateString()}
                        </span>
                        {source.lastSyncAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last sync {new Date(source.lastSyncAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSync(source.id)}
                          className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                          title="Sync now"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleSource(source)}
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            source.enabled
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {source.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <button
                          onClick={() => handleDeleteSource(source.id)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {source.errorMessage && (
                    <div className="mt-3 p-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-rose-700 dark:text-rose-300">{source.errorMessage}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-500" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 bg-white dark:bg-zinc-900"
                >
                  <option value="1h">Last 1 hour</option>
                  <option value="6h">Last 6 hours</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                </select>
              </div>
              <button
                onClick={fetchMetrics}
                className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {metrics.map((metric) => (
                <div key={metric.name} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{metric.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {Object.entries(metric.labels).map(([key, value]) => (
                          <span key={key} className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">{metric.unit}</span>
                  </div>
                  <MetricsChart
                    data={metric.values.map(v => ({
                      timestamp: new Date(v.timestamp).getTime(),
                      value: v.value
                    }))}
                    unit={metric.unit}
                    height={200}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Query Tab */}
        {activeTab === 'query' && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="text-center py-12">
              <LineChart className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Metric Query Builder</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-md mx-auto">
                Build custom queries to analyze metrics across all your external sources.
                Use PromQL-compatible syntax for advanced filtering.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <input
                  type="text"
                  placeholder="sum(rate(requests_total[5m])) by (service)"
                  className="w-96 px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                  Execute
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};
