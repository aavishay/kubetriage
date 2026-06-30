import React, { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  LineChart,
  Calendar,
  Cloud,
  Zap,
  Globe,
  ChevronRight
} from 'lucide-react';
import { PageTransition } from './PageTransition';
import { MetricsChart } from './MetricsChart';

interface ExternalMetricSource {
  id: string;
  name: string;
  clusterId?: string;
  provider: 'datadog' | 'newrelic' | 'cloudwatch' | 'prometheus' | 'custom' | 'victoriametrics';
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
        <p className="text-2xl font-mono font-bold text-text-primary">{value}</p>
        <p className="text-xs mt-1 font-mono">{sub}</p>
      </div>
      <div className={`p-2.5 bg-bg-main border border-border-main ${iconColor}`}>
        <icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

export const ExternalMetricsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sources' | 'metrics' | 'query'>('sources');
  const [sources, setSources] = useState<ExternalMetricSource[]>([]);
  const [metrics, setMetrics] = useState<MetricTimeSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClusterId, setSelectedClusterId] = useState<string>('');
  const [clusters, setClusters] = useState<Array<{ id: string; name: string }>>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState<ExternalMetricSource | null>(null);
  const [timeRange, setTimeRange] = useState('1h');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSources();
    fetchClusters();
  }, []);

  useEffect(() => {
    fetchSources();
  }, [selectedClusterId]);

  useEffect(() => {
    if (activeTab === 'metrics') {
      fetchMetrics();
    }
  }, [activeTab, timeRange]);

  const fetchClusters = async () => {
    try {
      const res = await fetch('/api/clusters');
      if (res.ok) {
        const data = await res.json();
        setClusters(data.map((c: any) => ({ id: c.id, name: c.name })));
      }
    } catch (error) {
      console.error('Failed to fetch clusters:', error);
    }
  };

  const fetchSources = async () => {
    setIsLoading(true);
    try {
      const url = selectedClusterId
        ? `/api/metrics/sources?cluster_id=${selectedClusterId}`
        : '/api/metrics/sources';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      } else {
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
      },
      {
        id: 'source-prom-001',
        name: 'Prometheus Production',
        provider: 'prometheus',
        endpoint: 'http://prometheus.monitoring.svc.cluster.local:9090',
        enabled: true,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        lastSyncAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        syncStatus: 'idle',
        labels: { env: 'production', cluster: 'main' }
      },
      {
        id: 'source-vm-001',
        name: 'VictoriaMetrics Production',
        provider: 'victoriametrics',
        endpoint: 'http://vmselect.monitoring.svc.cluster.local:8481',
        enabled: true,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        lastSyncAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        syncStatus: 'idle',
        labels: { env: 'production', cluster: 'main' }
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
      },
      {
        name: 'up',
        labels: { job: 'kubernetes-nodes', source: 'prometheus' },
        unit: '',
        values: values.map(v => ({ ...v, value: 1 }))
      },
      {
        name: 'node_cpu_seconds_total',
        labels: { cpu: '0', mode: 'user', source: 'prometheus' },
        unit: 'seconds',
        values: values.map(v => ({ ...v, value: 12345 + v.timestamp / 1000 }))
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
      case 'prometheus': return <Database className="w-5 h-5 text-orange-500" />;
      case 'victoriametrics': return <Database className="w-5 h-5 text-info" />;
      case 'custom': return <Globe className="w-5 h-5 text-text-tertiary" />;
      default: return <Database className="w-5 h-5 text-text-tertiary" />;
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'datadog': return 'Datadog';
      case 'newrelic': return 'New Relic';
      case 'cloudwatch': return 'AWS CloudWatch';
      case 'prometheus': return 'Prometheus';
      case 'victoriametrics': return 'VictoriaMetrics';
      case 'custom': return 'Custom Endpoint';
      default: return provider;
    }
  };

  const getStatusBadge = (status: string, error?: string) => {
    if (error) {
      return (
        <span className="kt-badge kt-badge-danger">
          <AlertCircle className="w-3 h-3" /> Error
        </span>
      );
    }
    if (status === 'syncing') {
      return (
        <span className="kt-badge kt-badge-info">
          <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
        </span>
      );
    }
    return (
      <span className="kt-badge kt-badge-success">
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

  if (isLoading && sources.length === 0) {
    return (
      <PageTransition>
        <div className="flex flex-col gap-6 p-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="kt-skeleton kt-skeleton-heading w-48" />
              <div className="kt-skeleton kt-skeleton-text w-96" />
            </div>
            <div className="flex gap-2">
              <div className="kt-skeleton w-32 h-9 rounded-md" />
              <div className="kt-skeleton w-28 h-9 rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="kt-panel p-4 space-y-2">
                <div className="kt-skeleton kt-skeleton-text w-24" />
                <div className="kt-skeleton kt-skeleton-heading w-12" />
              </div>
            ))}
          </div>
          <div className="kt-skeleton w-full h-10 rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="kt-panel p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="kt-skeleton w-10 h-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <div className="kt-skeleton kt-skeleton-text w-32" />
                    <div className="kt-skeleton kt-skeleton-text w-24" />
                  </div>
                </div>
                <div className="kt-skeleton w-full h-4 rounded-sm" />
                <div className="kt-skeleton w-3/4 h-4 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-display font-bold text-text-primary tracking-wider uppercase flex items-center gap-3">
              <Database className="w-7 h-7 text-primary-500" />
              External Metrics
            </h1>
            <p className="text-sm text-text-tertiary mt-1 font-mono">
              Ingest metrics from Prometheus, Datadog, New Relic, CloudWatch, VictoriaMetrics, and other sources
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <select
              value={selectedClusterId}
              onChange={(e) => setSelectedClusterId(e.target.value)}
              className="kt-select text-xs py-1.5 w-full sm:w-auto"
            >
              <option value="">All Clusters</option>
              {clusters.map(cluster => (
                <option key={cluster.id} value={cluster.id}>{cluster.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowAddModal(true)}
              className="kt-button kt-button-primary kt-button-sm shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Source
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCard('Metric Sources', sources.length, null, Database, 'text-primary-500')}
          {summaryCard(
            'Active',
            sources.filter(s => s.enabled).length,
            null,
            CheckCircle,
            'text-success'
          )}
          {summaryCard('Metrics Ingested', metrics.length, null, BarChart3, 'text-info')}
          {summaryCard(
            'Last Sync',
            sources.filter(s => s.lastSyncAt).length > 0 ? '5 min ago' : 'Never',
            null,
            Clock,
            'text-warning'
          )}
        </div>

        {/* Tabs */}
        <div className="flex bg-bg-card border border-border-main p-0.5">
          {(['sources', 'metrics', 'query'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2.5 text-xs font-sans font-semibold tracking-wider uppercase border transition-all ${
                activeTab === tab
                  ? 'bg-primary-500/10 text-primary-500 border-primary-500/30'
                  : 'text-text-tertiary hover:text-text-primary border-transparent'
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
                  className="kt-input pl-10 pr-3 py-2 text-xs"
                  aria-label="Search metric sources"
                />
                <Database className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <button
                onClick={fetchSources}
                className="kt-button kt-button-secondary kt-button-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSources.map((source) => (
                <div
                  key={source.id}
                  className={`kt-panel p-5 ${source.enabled ? '' : 'opacity-70'}`}
                >
                  <div className="flex items-start justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-bg-main border border-border-main shrink-0">
                        {getProviderIcon(source.provider)}
                      </div>
                      <div className="min-w-0">
                        <h3 className={`text-sm font-sans font-semibold break-words tracking-wide uppercase ${source.enabled ? 'text-text-primary' : 'text-text-secondary'}`}>
                          {source.name}
                        </h3>
                        <p className="text-xs text-text-secondary font-mono uppercase tracking-wider break-words">
                          {getProviderName(source.provider)}
                          {source.region && ` • ${source.region}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(source.syncStatus, source.errorMessage)}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border-main relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-text-tertiary">
                      <div className="flex items-center gap-4 flex-wrap">
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
                          className="kt-button kt-button-secondary kt-button-sm p-1.5"
                          title="Sync now"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleSource(source)}
                          className={`kt-button kt-button-sm ${source.enabled ? 'kt-button-primary' : 'kt-button-secondary'}`}
                        >
                          {source.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <button
                          onClick={() => handleDeleteSource(source.id)}
                          className="kt-button kt-button-danger kt-button-sm p-1.5"
                          title="Delete source"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {source.errorMessage && (
                    <div className="mt-3 p-3 kt-panel-inset border-danger/25 bg-danger-light flex items-start gap-2 relative z-10">
                      <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                      <p className="text-xs text-danger break-words font-mono">{source.errorMessage}</p>
                    </div>
                  )}
                </div>
              ))}
              {filteredSources.length === 0 && (
                <div className="col-span-full kt-panel flex flex-col items-center justify-center py-16">
                  <Database className="w-12 h-12 mb-4 text-text-muted" />
                  <h3 className="text-lg font-display font-bold text-text-primary tracking-wider uppercase">No Metric Sources</h3>
                  <p className="text-sm mt-2 text-text-secondary font-mono">Add a source to start ingesting external metrics.</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-4 kt-button kt-button-primary kt-button-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Source
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-text-tertiary" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="kt-select text-xs py-1.5"
                >
                  <option value="1h">Last 1 hour</option>
                  <option value="6h">Last 6 hours</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                </select>
              </div>
              <button
                onClick={fetchMetrics}
                className="kt-button kt-button-secondary kt-button-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {metrics.map((metric) => (
                <div key={metric.name} className="kt-panel p-5">
                  <div className="flex items-start justify-between gap-3 mb-4 relative z-10">
                    <div className="min-w-0">
                      <h3 className="text-sm font-mono font-bold text-text-primary break-words uppercase tracking-wide">
                        {metric.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {Object.entries(metric.labels).map(([key, value]) => (
                          <span key={key} className="kt-badge kt-badge-info">
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="kt-badge kt-badge-secondary text-text-tertiary shrink-0">{metric.unit}</span>
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
          <div className="kt-panel p-6">
            <div className="text-center py-12 relative z-10">
              <LineChart className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
              <h3 className="text-lg font-display font-bold text-text-primary tracking-wider uppercase">Metric Query Builder</h3>
              <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto font-mono">
                Build custom queries to analyze metrics across all your external sources.
                Use PromQL-compatible syntax for advanced filtering.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto">
                <input
                  type="text"
                  placeholder="sum(rate(requests_total[5m])) by (service)"
                  className="kt-input w-full max-w-md"
                />
                <button className="kt-button kt-button-primary kt-button-sm shrink-0">
                  Execute
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="kt-panel max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-xl">
            <div className="kt-panel-header">
              <span>Add External Metrics Source</span>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-text-tertiary hover:text-text-primary"
              >
                &times;
              </button>
            </div>
            <AddSourceForm
              onClose={() => setShowAddModal(false)}
              onSave={() => {
                fetchSources();
                setShowAddModal(false);
              }}
              clusters={clusters}
            />
          </div>
        </div>
      )}
    </PageTransition>
  );
};

// Add Source Form Component
interface AddSourceFormProps {
  onClose: () => void;
  onSave: () => void;
  clusters: Array<{ id: string; name: string }>;
}

const AddSourceForm: React.FC<AddSourceFormProps> = ({ onClose, onSave, clusters }) => {
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState<ExternalMetricSource['provider']>('prometheus');
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [region, setRegion] = useState('');
  const [namespace, setNamespace] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const providers: { id: ExternalMetricSource['provider']; name: string; icon: React.ReactNode; description: string }[] = [
    {
      id: 'prometheus',
      name: 'Prometheus',
      icon: <Database className="w-6 h-6 text-orange-500" />,
      description: 'Connect to Prometheus server for metrics querying via PromQL'
    },
    {
      id: 'victoriametrics',
      name: 'VictoriaMetrics',
      icon: <Database className="w-6 h-6 text-info" />,
      description: 'High-performance metrics storage with PromQL compatibility'
    },
    {
      id: 'datadog',
      name: 'Datadog',
      icon: <Zap className="w-6 h-6 text-[#632CA6]" />,
      description: 'Ingest metrics from Datadog monitoring platform'
    },
    {
      id: 'cloudwatch',
      name: 'AWS CloudWatch',
      icon: <Cloud className="w-6 h-6 text-[#FF9900]" />,
      description: 'Ingest metrics from AWS CloudWatch'
    },
    {
      id: 'newrelic',
      name: 'New Relic',
      icon: <BarChart3 className="w-6 h-6 text-[#00C74D]" />,
      description: 'Ingest metrics from New Relic observability platform'
    },
    {
      id: 'custom',
      name: 'Custom Endpoint',
      icon: <Globe className="w-6 h-6 text-text-tertiary" />,
      description: 'Any Prometheus-compatible metrics endpoint'
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const payload: any = {
        name,
        provider,
        clusterId: clusterId || undefined,
        endpoint: endpoint || undefined,
        apiKey: apiKey || undefined,
        region: region || undefined,
        namespace: namespace || undefined,
        labels: {}
      };

      const res = await fetch('/api/metrics/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create source');
      }

      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 1) {
    return (
      <div className="p-6 relative z-10">
        <p className="text-sm text-text-secondary mb-4 font-mono">Select a metrics provider to connect:</p>
        <div className="grid grid-cols-1 gap-3">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setProvider(p.id);
                setName(`${p.name} ${new Date().toLocaleDateString()}`);
                if (p.id === 'prometheus') {
                  setEndpoint('http://prometheus.monitoring.svc.cluster.local:9090');
                } else if (p.id === 'victoriametrics') {
                  setEndpoint('http://vmselect.monitoring.svc.cluster.local:8481');
                } else {
                  setEndpoint('');
                }
                setStep(2);
              }}
              className="kt-panel p-4 flex items-center gap-4 hover:border-primary-500/50 hover:bg-bg-hover/50 transition-all text-left"
            >
              <div className="p-2 bg-bg-main border border-border-main">{p.icon}</div>
              <div className="flex-1">
                <p className="font-sans font-semibold text-text-primary tracking-wide uppercase">{p.name}</p>
                <p className="text-xs text-text-secondary font-mono">{p.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary" />
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="kt-button kt-button-secondary kt-button-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4 relative z-10">
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="text-sm text-text-secondary hover:text-text-primary flex items-center gap-1 font-mono"
        >
          &larr; Back
        </button>
        <span className="text-text-secondary">|</span>
        <span className="text-sm font-sans font-semibold text-text-primary tracking-wide uppercase">
          Configure {providers.find(p => p.id === provider)?.name}
        </span>
      </div>

      {error && (
        <div className="p-3 kt-panel-inset border-danger/25 text-danger text-sm font-mono">
          {error}
        </div>
      )}

      <div>
        <label className="kt-text-label mb-1.5 block">Source Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Production Prometheus"
          required
          className="kt-input"
        />
      </div>

      {(provider === 'prometheus' || provider === 'victoriametrics' || provider === 'custom') && (
        <div>
          <label className="kt-text-label mb-1.5 block">Endpoint URL *</label>
          <input
            type="url"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder={provider === 'prometheus' ? 'http://prometheus:9090' : 'http://vmselect:8481'}
            required
            className="kt-input"
          />
          <p className="text-xs text-text-tertiary mt-1 font-mono">
            The URL must be accessible from the Kubetriage server
          </p>
        </div>
      )}

      {(provider === 'datadog' || provider === 'newrelic') && (
        <>
          <div>
            <label className="kt-text-label mb-1.5 block">API Key *</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your API key"
              required
              className="kt-input"
            />
          </div>
          {provider === 'datadog' && (
            <div>
              <label className="kt-text-label mb-1.5 block">Endpoint (optional)</label>
              <input
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://api.datadoghq.com"
                className="kt-input"
              />
            </div>
          )}
        </>
      )}

      {provider === 'cloudwatch' && (
        <>
          <div>
            <label className="kt-text-label mb-1.5 block">Region *</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
              className="kt-select"
            >
              <option value="">Select region...</option>
              <option value="us-east-1">US East (N. Virginia)</option>
              <option value="us-east-2">US East (Ohio)</option>
              <option value="us-west-1">US West (N. California)</option>
              <option value="us-west-2">US West (Oregon)</option>
              <option value="eu-west-1">Europe (Ireland)</option>
              <option value="eu-central-1">Europe (Frankfurt)</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
            </select>
          </div>
          <div>
            <label className="kt-text-label mb-1.5 block">Namespace (optional)</label>
            <input
              type="text"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="e.g., AWS/EKS"
              className="kt-input"
            />
          </div>
          <div>
            <label className="kt-text-label mb-1.5 block">API Key *</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AWS Access Key ID"
              required
              className="kt-input"
            />
          </div>
        </>
      )}

      <div>
        <label className="kt-text-label mb-1.5 block">Cluster (optional)</label>
        <select
          value={clusterId}
          onChange={(e) => setClusterId(e.target.value)}
          className="kt-select"
        >
          <option value="">All clusters</option>
          {clusters.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="kt-button kt-button-secondary kt-button-sm"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !name}
          className="kt-button kt-button-primary kt-button-sm disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Add Source'}
        </button>
      </div>
    </form>
  );
};
