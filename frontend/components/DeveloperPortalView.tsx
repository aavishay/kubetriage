import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Server, DollarSign, AlertCircle, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, RefreshCw, Activity, Code, Shield,
  TrendingUp, TrendingDown, Minus, Play, Pause, RotateCw,
  GitBranch, FileText, Search, Filter, Wallet, Gauge,
  ArrowRight, Clock, Info, AlertTriangle, CheckCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { useMonitoring } from '../contexts/MonitoringContext';

interface DeveloperWorkload {
  id: string;
  name: string;
  namespace: string;
  kind: string;
  clusterId: string;
  clusterName: string;
  status: 'Healthy' | 'Warning' | 'Critical';
  team: string;
  owner: string;
  email: string;
  slackChannel: string;
  replicas: number;
  availableReplicas: number;
  images: string[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
  hasOpenIncidents: boolean;
  costPerMonth: number;
}

interface TriageReport {
  id: number;
  clusterId: string;
  namespace: string;
  workloadName: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  incidentType: string;
  analysis: string;
  createdAt: string;
}

interface CostSummary {
  monthlyCost: number;
  budgetLimit: number;
  budgetUsedPercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface DeveloperPortalData {
  timestamp: string;
  team: string;
  workloads: DeveloperWorkload[];
  openIncidents: TriageReport[];
  costSummary: CostSummary;
  allowedActions: string[];
}

const COLORS = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#f43f5e',
  info: '#3b82f6'
};

const STATUS_COLORS = {
  Healthy: 'text-emerald-500',
  Warning: 'text-amber-500',
  Critical: 'text-rose-500'
};

const STATUS_BG = {
  Healthy: 'bg-emerald-500/10',
  Warning: 'bg-amber-500/10',
  Critical: 'bg-rose-500/10'
};

export const DeveloperPortalView: React.FC = () => {
  const { selectedCluster } = useMonitoring();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DeveloperPortalData | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('default');
  const [teams, setTeams] = useState<string[]>(['default']);
  const [selectedTab, setSelectedTab] = useState<'workloads' | 'incidents' | 'costs'>('workloads');
  const [selectedWorkload, setSelectedWorkload] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreDeploy, setShowPreDeploy] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchTeams = async () => {
    try {
      // Fetch teams from selected cluster
      const clusterId = selectedCluster?.id || '';
      const response = await fetch(`/api/developer/teams?clusterId=${clusterId}`);
      if (response.ok) {
        const result = await response.json();
        setTeams(result.teams || ['default']);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Always fetch from selected cluster
      const clusterId = selectedCluster?.id || '';
      const response = await fetch(`/api/developer/portal?team=${selectedTeam}&clusterId=${clusterId}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch developer portal data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [selectedCluster?.id]);

  useEffect(() => {
    fetchData();
  }, [selectedTeam, selectedCluster?.id]);

  const filteredWorkloads = useMemo(() => {
    if (!data?.workloads) return [];
    return data.workloads.filter(w =>
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.namespace.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data?.workloads, searchTerm]);

  const statusDistribution = useMemo(() => {
    if (!data?.workloads) return [];
    const counts = { Healthy: 0, Warning: 0, Critical: 0 };
    data.workloads.forEach(w => counts[w.status]++);
    return [
      { name: 'Healthy', value: counts.Healthy, color: COLORS.success },
      { name: 'Warning', value: counts.Warning, color: COLORS.warning },
      { name: 'Critical', value: counts.Critical, color: COLORS.danger }
    ].filter(s => s.value > 0);
  }, [data?.workloads]);

  const costBreakdown = useMemo(() => {
    if (!data?.workloads) return [];
    const byNamespace: Record<string, number> = {};
    data.workloads.forEach(w => {
      byNamespace[w.namespace] = (byNamespace[w.namespace] || 0) + w.costPerMonth;
    });
    return Object.entries(byNamespace)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [data?.workloads]);

  const handleResolveIncident = async (incidentId: number) => {
    try {
      const response = await fetch(`/api/developer/resolve/${incidentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: selectedTeam, resolution: 'Resolved by developer' })
      });
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to resolve incident:', error);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-6 p-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2">
            <div className="kt-skeleton kt-skeleton-heading w-56" />
            <div className="kt-skeleton kt-skeleton-text w-72" />
          </div>
          <div className="flex gap-2">
            <div className="kt-skeleton w-32 h-9 rounded-xl" />
            <div className="kt-skeleton w-10 h-9 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm space-y-3">
              <div className="flex justify-between">
                <div className="kt-skeleton kt-skeleton-text w-20" />
                <div className="kt-skeleton w-8 h-8 rounded-xl" />
              </div>
              <div className="kt-skeleton kt-skeleton-heading w-16" />
              <div className="kt-skeleton kt-skeleton-text w-28" />
            </div>
          ))}
        </div>
        <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
          <div className="p-6 border-b border-border-main bg-bg-hover/50 space-y-2">
            <div className="kt-skeleton kt-skeleton-text w-32" />
            <div className="kt-skeleton kt-skeleton-text w-48" />
          </div>
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border-main bg-bg-hover/30">
                <div className="kt-skeleton w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="kt-skeleton kt-skeleton-text w-40" />
                  <div className="kt-skeleton kt-skeleton-text w-56" />
                </div>
                <div className="kt-skeleton w-20 h-8 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-primary uppercase tracking-tighter flex items-center gap-3">
            <Users className="w-7 h-7 text-primary-500" />
            Developer Portal
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            Self-service management for your team's workloads
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="kt-select"
          >
            {teams.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
          <button
            onClick={() => setShowPreDeploy(true)}
            className="kt-button kt-button-primary flex items-center gap-2"
          >
            <Code className="w-4 h-4" />
            Pre-Deploy Check
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="kt-button kt-button-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">Workloads</p>
                <p className="text-3xl font-black text-text-primary">{(data.workloads || []).length}</p>
                <p className="text-xs text-emerald-500 font-semibold mt-1">
                  {(data.workloads || []).filter(w => w.status === 'Healthy').length} healthy
                </p>
              </div>
              <div className="p-3 rounded-xl bg-primary-500/10">
                <Server className="w-5 h-5 text-primary-500" />
              </div>
            </div>
          </div>

          <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">Open Incidents</p>
                <p className="text-3xl font-black text-text-primary">{data.openIncidents.length}</p>
                <p className={`text-xs font-semibold mt-1 ${data.openIncidents.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {data.openIncidents.filter(i => i.severity === 'Critical').length} critical
                </p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10">
                <AlertCircle className="w-5 h-5 text-rose-500" />
              </div>
            </div>
          </div>

          <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">Monthly Cost</p>
                <p className="text-3xl font-black text-text-primary">${data.costSummary.monthlyCost.toFixed(0)}</p>
                <p className={`text-xs font-semibold mt-1 ${
                  data.costSummary.budgetUsedPercent > 90 ? 'text-rose-500' :
                  data.costSummary.budgetUsedPercent > 70 ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {data.costSummary.budgetUsedPercent.toFixed(1)}% of budget
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10">
                <DollarSign className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </div>

          <div className="bg-bg-card rounded-2xl p-5 border border-border-main shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">Allowed Actions</p>
                <p className="text-3xl font-black text-text-primary">{data.allowedActions.length}</p>
                <p className="text-xs text-primary-500 font-semibold mt-1">
                  Self-service enabled
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <Shield className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-bg-card rounded-xl border border-border-main p-1">
        {(['workloads', 'incidents', 'costs'] as const).map((tab) => (
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

      {/* Workloads Tab */}
      {selectedTab === 'workloads' && data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-bg-card rounded-3xl border border-border-main overflow-hidden">
            <div className="p-6 border-b border-border-main bg-bg-hover/50">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">
                  Your Workloads ({filteredWorkloads.length})
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="kt-input pl-10 pr-4 text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {filteredWorkloads.length === 0 ? (
                <div className="text-center py-12">
                  <Server className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                  <h4 className="text-lg font-bold text-text-primary mb-2">No Workloads Found</h4>
                  <p className="text-text-tertiary">No workloads found for team {selectedTeam}</p>
                </div>
              ) : (
                filteredWorkloads.map((workload) => (
                  <div
                    key={workload.id}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedWorkload === workload.id
                        ? 'border-primary-500 bg-primary-500/5'
                        : 'border-border-main hover:border-primary-500/30'
                    }`}
                    onClick={() => setSelectedWorkload(selectedWorkload === workload.id ? null : workload.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${STATUS_BG[workload.status]}`}>
                          <Server className={`w-4 h-4 ${STATUS_COLORS[workload.status]}`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-text-primary">{workload.name}</h4>
                          <p className="text-xs text-text-tertiary">{workload.namespace} • {workload.clusterName}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${STATUS_BG[workload.status]} ${STATUS_COLORS[workload.status]}`}>
                        {workload.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-tertiary">
                      <span>Replicas: {workload.availableReplicas}/{workload.replicas}</span>
                      <span>Cost: ${workload.costPerMonth.toFixed(2)}/mo</span>
                      {workload.hasOpenIncidents && (
                        <span className="text-rose-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Has open incidents
                        </span>
                      )}
                    </div>
                    {selectedWorkload === workload.id && (
                      <div className="mt-4 pt-4 border-t border-border-main space-y-3">
                        {workload.owner && (
                          <div className="text-sm">
                            <span className="text-text-tertiary">Owner: </span>
                            <span className="text-text-primary">{workload.owner}</span>
                          </div>
                        )}
                        {workload.images.length > 0 && (
                          <div className="text-xs text-text-tertiary">
                            Image: {workload.images[0]}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button className="kt-button kt-button-secondary text-xs py-2">
                            <RotateCw className="w-3 h-3 mr-1" />
                            Restart
                          </button>
                          <button className="kt-button kt-button-secondary text-xs py-2">
                            <Gauge className="w-3 h-3 mr-1" />
                            Scale
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-bg-card rounded-3xl border border-border-main p-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-text-primary mb-4">
                Status Distribution
              </h3>
              <div className="h-[200px]">
                {statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-text-tertiary">
                    No data
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incidents Tab */}
      {selectedTab === 'incidents' && data && (
        <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
          <div className="p-6 border-b border-border-main bg-bg-hover/50">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">
              Open Incidents ({data.openIncidents.length})
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {data.openIncidents.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-text-primary mb-2">All Clear!</h4>
                <p className="text-text-tertiary">No open incidents for your team's workloads</p>
              </div>
            ) : (
              data.openIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="p-4 rounded-xl border border-border-main bg-bg-hover/30"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-text-primary">{incident.workloadName}</h4>
                      <p className="text-xs text-text-tertiary">{incident.incidentType}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                      incident.severity === 'Critical' ? 'bg-rose-500/10 text-rose-500' :
                      incident.severity === 'High' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-blue-500/10 text-blue-500'
                    }`}>
                      {incident.severity}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary mb-3">{incident.analysis}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-tertiary">
                      {new Date(incident.createdAt).toLocaleString()}
                    </span>
                    <button
                      onClick={() => handleResolveIncident(incident.id)}
                      className="kt-button kt-button-primary text-xs py-2"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Resolve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Costs Tab */}
      {selectedTab === 'costs' && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-bg-card rounded-3xl border border-border-main p-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary mb-4">
              Cost by Namespace
            </h3>
            <div className="h-[300px]">
              {costBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--kt-border-main)" />
                    <XAxis type="number" tick={{ fill: 'var(--kt-fg-tertiary)', fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fill: 'var(--kt-fg-tertiary)', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--kt-bg-card)',
                        border: '1px solid var(--kt-border-main)',
                        borderRadius: '12px'
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Monthly Cost']}
                    />
                    <Bar dataKey="value" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-text-tertiary">
                  No cost data available
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-bg-card rounded-2xl p-6 border border-border-main">
              <h3 className="text-sm font-black uppercase tracking-widest text-text-primary mb-4">
                Budget Overview
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-tertiary">Used</span>
                    <span className="text-text-primary">${data.costSummary.monthlyCost.toFixed(0)} / ${data.costSummary.budgetLimit.toFixed(0)}</span>
                  </div>
                  <div className="h-2 bg-bg-hover rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        data.costSummary.budgetUsedPercent > 90 ? 'bg-rose-500' :
                        data.costSummary.budgetUsedPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(data.costSummary.budgetUsedPercent, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-text-tertiary">Trend:</span>
                  {data.costSummary.trend === 'up' ? (
                    <span className="text-rose-500 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" /> Increasing
                    </span>
                  ) : data.costSummary.trend === 'down' ? (
                    <span className="text-emerald-500 flex items-center gap-1">
                      <TrendingDown className="w-4 h-4" /> Decreasing
                    </span>
                  ) : (
                    <span className="text-text-secondary flex items-center gap-1">
                      <Minus className="w-4 h-4" /> Stable
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-bg-card rounded-2xl p-6 border border-border-main">
              <h3 className="text-sm font-black uppercase tracking-widest text-text-primary mb-4">
                Cost Optimization Tips
              </h3>
              <ul className="space-y-3 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                  Scale down dev environments outside business hours
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                  Right-size resource requests based on actual usage
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                  Use spot instances for non-critical workloads
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Deploy Modal */}
      {showPreDeploy && (
        <PreDeployModal
          team={selectedTeam}
          onClose={() => setShowPreDeploy(false)}
        />
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 text-text-tertiary text-xs">
        <Clock className="w-3 h-3" />
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};

// Pre-Deploy Check Modal Component
const PreDeployModal: React.FC<{ team: string; onClose: () => void }> = ({ team, onClose }) => {
  const [formData, setFormData] = useState({
    workload: '',
    namespace: '',
    image: '',
    replicas: 2,
    cpuRequest: '',
    cpuLimit: '',
    memoryRequest: '',
    memoryLimit: ''
  });
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/developer/pre-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workload: formData.workload,
          namespace: formData.namespace,
          image: formData.image,
          replicas: formData.replicas,
          resources: {
            'cpu-request': formData.cpuRequest,
            'cpu-limit': formData.cpuLimit,
            'memory-request': formData.memoryRequest,
            'memory-limit': formData.memoryLimit
          }
        })
      });
      if (response.ok) {
        const data = await response.json();
        setResult(data);
      }
    } catch (error) {
      console.error('Pre-deploy check failed:', error);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-bg-card rounded-3xl border border-border-main shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border-main flex items-center justify-between">
          <h2 className="text-lg font-black text-text-primary flex items-center gap-2">
            <Code className="w-5 h-5 text-primary-500" />
            Pre-Deploy Validation
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-bg-hover rounded-lg">
            <XCircle className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!result ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-tertiary uppercase">Workload Name</label>
                  <input
                    type="text"
                    value={formData.workload}
                    onChange={(e) => setFormData({ ...formData, workload: e.target.value })}
                    className="kt-input w-full mt-1"
                    placeholder="my-service"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-tertiary uppercase">Namespace</label>
                  <input
                    type="text"
                    value={formData.namespace}
                    onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                    className="kt-input w-full mt-1"
                    placeholder="production"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-tertiary uppercase">Container Image</label>
                <input
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="kt-input w-full mt-1"
                  placeholder="nginx:1.21"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-tertiary uppercase">Replicas</label>
                <input
                  type="number"
                  value={formData.replicas}
                  onChange={(e) => setFormData({ ...formData, replicas: parseInt(e.target.value) })}
                  className="kt-input w-full mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-tertiary uppercase">CPU Request</label>
                  <input
                    type="text"
                    value={formData.cpuRequest}
                    onChange={(e) => setFormData({ ...formData, cpuRequest: e.target.value })}
                    className="kt-input w-full mt-1"
                    placeholder="100m"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-tertiary uppercase">CPU Limit</label>
                  <input
                    type="text"
                    value={formData.cpuLimit}
                    onChange={(e) => setFormData({ ...formData, cpuLimit: e.target.value })}
                    className="kt-input w-full mt-1"
                    placeholder="500m"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-tertiary uppercase">Memory Request</label>
                  <input
                    type="text"
                    value={formData.memoryRequest}
                    onChange={(e) => setFormData({ ...formData, memoryRequest: e.target.value })}
                    className="kt-input w-full mt-1"
                    placeholder="128Mi"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-tertiary uppercase">Memory Limit</label>
                  <input
                    type="text"
                    value={formData.memoryLimit}
                    onChange={(e) => setFormData({ ...formData, memoryLimit: e.target.value })}
                    className="kt-input w-full mt-1"
                    placeholder="512Mi"
                  />
                </div>
              </div>

              <button
                onClick={handleCheck}
                disabled={checking || !formData.workload || !formData.image}
                className="kt-button kt-button-primary w-full"
              >
                {checking ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Run Pre-Deploy Checks
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border-2 ${
                result.canDeploy ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'
              }`}>
                <div className="flex items-center gap-3">
                  {result.canDeploy ? (
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  ) : (
                    <XCircle className="w-8 h-8 text-rose-500" />
                  )}
                  <div>
                    <h3 className="font-bold text-text-primary">
                      {result.canDeploy ? 'Ready to Deploy' : 'Issues Found'}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      Score: {result.score}/100 • {result.checks.filter((c: any) => c.passed).length}/{result.checks.length} checks passed
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {result.checks.map((check: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      check.passed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {check.passed ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium text-text-primary text-sm">{check.name}</h4>
                        <p className="text-xs text-text-secondary mt-0.5">{check.message}</p>
                        {!check.passed && check.remediation && (
                          <p className="text-xs text-primary-500 mt-1">
                            Fix: {check.remediation}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                        check.severity === 'error' ? 'bg-rose-500/10 text-rose-500' :
                        check.severity === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {check.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setResult(null)}
                className="kt-button kt-button-secondary w-full"
              >
                Check Another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
