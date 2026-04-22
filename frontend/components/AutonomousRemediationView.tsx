import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  ChevronRight,
  Calendar,
  User,
  FileText,
  GitPullRequest,
  Timer,
  RefreshCw
} from 'lucide-react';
import { PageTransition } from './PageTransition';
import { TriageReport } from '../types';

interface AutoFixProposal {
  id: string;
  reportId: number;
  workloadId: string;
  namespace: string;
  name: string;
  kind: string;
  issue: string;
  proposedFix: {
    type: string;
    description: string;
    patch?: string;
    reasoning: string;
  };
  riskLevel: 'low' | 'medium' | 'high';
  estimatedImpact: string;
  rollbackPlan: {
    strategy: string;
    backupPatch?: string;
    timeout: number;
  };
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'rolled_back' | 'failed';
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  appliedAt?: string;
  rollbackAt?: string;
  result?: {
    success: boolean;
    message: string;
    error?: string;
    timestamp: string;
  };
}

interface ExecutableRunbook {
  id: string;
  name: string;
  description: string;
  source: string;
  steps: RunbookStep[];
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  usageCount: number;
  successRate: number;
}

interface RunbookStep {
  id: string;
  name: string;
  description: string;
  action: string;
  command?: string;
  target?: string;
  timeout: number;
  requiresApproval: boolean;
  retryCount: number;
}

interface ScheduledFix {
  id: string;
  name: string;
  description: string;
  scheduledTime: string;
  timezone: string;
  recurrence?: string;
  status: 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  targetWorkload: string;
  targetNamespace: string;
  requiresApproval: boolean;
}

export const AutonomousRemediationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'proposals' | 'runbooks' | 'scheduled'>('proposals');
  const [proposals, setProposals] = useState<AutoFixProposal[]>([]);
  const [runbooks, setRunbooks] = useState<ExecutableRunbook[]>([]);
  const [scheduledFixes, setScheduledFixes] = useState<ScheduledFix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<AutoFixProposal | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'proposals') {
        const res = await fetch('/api/autofix/proposals');
        if (res.ok) {
          const data = await res.json();
          setProposals(data.proposals || []);
        }
      } else if (activeTab === 'runbooks') {
        const res = await fetch('/api/runbooks');
        if (res.ok) {
          const data = await res.json();
          setRunbooks(data.runbooks || []);
        }
      } else {
        const res = await fetch('/api/scheduled-fixes');
        if (res.ok) {
          const data = await res.json();
          setScheduledFixes(data.fixes || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // Use demo data
      setDemoData();
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoData = () => {
    // Demo proposals
    setProposals([
      {
        id: 'af-001',
        reportId: 123,
        workloadId: 'prod-1/default/payment-service',
        namespace: 'default',
        name: 'payment-service',
        kind: 'Deployment',
        issue: 'CrashLoopBackOff due to memory limit exceeded',
        proposedFix: {
          type: 'patch',
          description: 'Increase memory limit from 256Mi to 512Mi',
          patch: '{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"limits":{"memory":"512Mi"}}}]}}}}',
          reasoning: 'Pod is consistently OOMKilled. Current limit is too low for actual usage pattern.',
        },
        riskLevel: 'low',
        estimatedImpact: 'Rolling update with zero downtime',
        rollbackPlan: {
          strategy: 'revert_patch',
          timeout: 300,
        },
        status: 'pending',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'af-002',
        reportId: 124,
        workloadId: 'prod-1/api-gateway',
        name: 'api-gateway',
        namespace: 'api-gateway',
        kind: 'Deployment',
        issue: 'High latency due to insufficient replicas',
        proposedFix: {
          type: 'scale',
          description: 'Scale from 2 to 5 replicas',
          reasoning: 'Current CPU usage exceeds 80% threshold during peak hours.',
        },
        riskLevel: 'medium',
        estimatedImpact: 'Increased capacity, cost increase of ~$45/month',
        rollbackPlan: {
          strategy: 'revert_patch',
          timeout: 180,
        },
        status: 'approved',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        approvedBy: 'sarah@example.com',
        approvedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'af-003',
        reportId: 125,
        workloadId: 'prod-1/cache/redis',
        name: 'redis',
        namespace: 'cache',
        kind: 'StatefulSet',
        issue: 'Connection pool exhaustion',
        proposedFix: {
          type: 'restart',
          description: 'Rolling restart of Redis pods',
          reasoning: 'Clear connection pool state and allow fresh connections.',
        },
        riskLevel: 'low',
        estimatedImpact: 'Brief service interruption (30-60s)',
        rollbackPlan: {
          strategy: 'revert_patch',
          timeout: 300,
        },
        status: 'applied',
        createdAt: new Date(Date.now() - 14400000).toISOString(),
        approvedBy: 'admin@example.com',
        approvedAt: new Date(Date.now() - 10800000).toISOString(),
        appliedAt: new Date(Date.now() - 10000000).toISOString(),
        result: {
          success: true,
          message: 'Deployment restarted successfully',
          timestamp: new Date(Date.now() - 10000000).toISOString(),
        },
      },
    ]);

    // Demo runbooks
    setRunbooks([
      {
        id: 'rb-001',
        name: 'Restart Service with Health Check',
        description: 'Safely restart a deployment and verify health',
        source: 'ai_generated',
        status: 'active',
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        createdBy: 'system',
        usageCount: 12,
        successRate: 91.7,
        steps: [
          { id: 's1', name: 'Pre-Health Check', description: 'Verify current health status', action: 'command', command: 'kubectl get pods', timeout: 30, requiresApproval: false, retryCount: 0 },
          { id: 's2', name: 'Execute Restart', description: 'Trigger rolling restart', action: 'command', command: 'kubectl rollout restart', timeout: 60, requiresApproval: true, retryCount: 0 },
          { id: 's3', name: 'Wait for Ready', description: 'Wait for pods to be ready', action: 'command', command: 'kubectl rollout status', timeout: 300, requiresApproval: false, retryCount: 3 },
          { id: 's4', name: 'Post-Health Check', description: 'Verify service health', action: 'command', command: 'curl /health', timeout: 30, requiresApproval: false, retryCount: 0 },
        ],
      },
      {
        id: 'rb-002',
        name: 'Scale Up High Traffic Service',
        description: 'Automatically scale based on traffic patterns',
        source: 'manual',
        status: 'active',
        createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        createdBy: 'ops-team',
        usageCount: 8,
        successRate: 100,
        steps: [
          { id: 's1', name: 'Check Current Scale', description: 'Verify current replica count', action: 'command', timeout: 30, requiresApproval: false, retryCount: 0 },
          { id: 's2', name: 'Scale Deployment', description: 'Apply new replica count', action: 'api_call', timeout: 60, requiresApproval: true, retryCount: 0 },
          { id: 's3', name: 'Verify Scale', description: 'Confirm new pods are running', action: 'command', timeout: 120, requiresApproval: false, retryCount: 0 },
        ],
      },
    ]);

    // Demo scheduled fixes
    setScheduledFixes([
      {
        id: 'sf-001',
        name: 'Nightly Log Rotation',
        description: 'Restart log aggregators to clear file handles',
        scheduledTime: new Date(Date.now() + 3600000 * 4).toISOString(),
        timezone: 'UTC',
        recurrence: '0 2 * * *',
        status: 'pending_approval',
        createdBy: 'system',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        targetWorkload: 'log-aggregator',
        targetNamespace: 'observability',
        requiresApproval: true,
      },
      {
        id: 'sf-002',
        name: 'Weekly Cache Warmup',
        description: 'Pre-warm cache for frequently accessed data',
        scheduledTime: new Date(Date.now() + 86400000).toISOString(),
        timezone: 'UTC',
        recurrence: '0 6 * * 1',
        status: 'approved',
        createdBy: 'cache-team@example.com',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        approvedBy: 'admin@example.com',
        approvedAt: new Date(Date.now() - 3600000).toISOString(),
        targetWorkload: 'redis-cache',
        targetNamespace: 'cache',
        requiresApproval: true,
      },
      {
        id: 'sf-003',
        name: 'Certificate Renewal Check',
        description: 'Check and renew TLS certificates if needed',
        scheduledTime: new Date(Date.now() - 3600000 * 2).toISOString(),
        timezone: 'UTC',
        status: 'completed',
        createdBy: 'security@example.com',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        targetWorkload: 'ingress-controller',
        targetNamespace: 'ingress-nginx',
        requiresApproval: true,
      },
    ]);
  };

  const handleApprove = async (proposal: AutoFixProposal, approved: boolean) => {
    try {
      const res = await fetch(`/api/autofix/proposals/${proposal.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, user: 'current-user@example.com', comment: approvalComment }),
      });
      if (res.ok) {
        fetchData();
        setShowApprovalModal(false);
        setApprovalComment('');
        setSelectedProposal(null);
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleApply = async (proposal: AutoFixProposal) => {
    try {
      const res = await fetch(`/api/autofix/proposals/${proposal.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: 'current-user@example.com' }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to apply:', error);
    }
  };

  const handleRollback = async (proposal: AutoFixProposal) => {
    try {
      const res = await fetch(`/api/autofix/proposals/${proposal.id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to rollback:', error);
    }
  };

  const handleApproveScheduled = async (fix: ScheduledFix) => {
    try {
      const res = await fetch(`/api/scheduled-fixes/${fix.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true, user: 'current-user@example.com' }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to approve scheduled fix:', error);
    }
  };

  const handleCancelScheduled = async (fix: ScheduledFix) => {
    try {
      const res = await fetch(`/api/scheduled-fixes/${fix.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to cancel scheduled fix:', error);
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-600"><Shield className="w-3 h-3" /> Low Risk</span>;
      case 'medium':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/10 text-amber-600"><ShieldAlert className="w-3 h-3" /> Medium Risk</span>;
      case 'high':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-rose-500/10 text-rose-600"><AlertCircle className="w-3 h-3" /> High Risk</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-text-tertiary/10 text-text-secondary',
      pending_approval: 'bg-amber-500/10 text-amber-600',
      approved: 'bg-blue-500/10 text-blue-600',
      rejected: 'bg-rose-500/10 text-rose-600',
      applied: 'bg-emerald-500/10 text-emerald-600',
      rolled_back: 'bg-orange-500/10 text-orange-600',
      failed: 'bg-rose-500/10 text-rose-600',
      running: 'bg-blue-500/10 text-blue-600 animate-pulse',
      completed: 'bg-emerald-500/10 text-emerald-600',
      cancelled: 'bg-text-tertiary/10 text-text-secondary',
    };

    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] || 'bg-text-tertiary/10'}`}>{status.replace('_', ' ')}</span>;
  };

  if (isLoading) {
    return (
      <PageTransition>
        <div className="flex flex-col gap-6 p-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="kt-skeleton kt-skeleton-heading w-64" />
              <div className="kt-skeleton kt-skeleton-text w-96" />
            </div>
            <div className="kt-skeleton w-10 h-10 rounded-lg" />
          </div>
          <div className="kt-skeleton w-full h-16 rounded-xl" />
          <div className="kt-skeleton w-full h-10 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-bg-card rounded-xl border border-border-main p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="kt-skeleton kt-skeleton-text w-32" />
                    <div className="kt-skeleton kt-skeleton-text w-48" />
                  </div>
                  <div className="kt-skeleton w-16 h-6 rounded-full" />
                </div>
                <div className="space-y-2">
                  <div className="kt-skeleton w-24 h-5 rounded-full" />
                  <div className="kt-skeleton w-3/4 h-3 rounded" />
                </div>
                <div className="flex gap-2 pt-2">
                  <div className="kt-skeleton w-full h-8 rounded-lg" />
                  <div className="kt-skeleton w-full h-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Autonomous Remediation</h1>
            <p className="text-sm text-text-secondary mt-1">
              AI-generated fixes with human approval and automatic rollback safety
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-hover transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Safety Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">Safety First</h3>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              All autonomous actions require human approval before execution. The system automatically monitors fix health and rolls back if issues are detected.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-border-main">
          {(['proposals', 'runbooks', 'scheduled'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab === 'proposals' && 'Auto-Fix Proposals'}
              {tab === 'runbooks' && 'Executable Runbooks'}
              {tab === 'scheduled' && 'Scheduled Remediation'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Auto-Fix Proposals Tab */}
          {activeTab === 'proposals' && (
            <>
              {proposals.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-text-primary">No Fix Proposals</h3>
                  <p className="text-sm text-text-secondary mt-2">AI will generate fix proposals as issues are detected</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {proposals.map((proposal) => (
                    <div key={proposal.id} className="bg-bg-card rounded-xl border border-border-main p-5 hover:border-primary-500/30 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                            {proposal.name}
                            <span className="text-xs text-text-tertiary font-normal">{proposal.namespace}</span>
                          </h3>
                          <p className="text-xs text-text-secondary mt-1">{proposal.issue}</p>
                        </div>
                        {getStatusBadge(proposal.status)}
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-2">
                          {getRiskBadge(proposal.riskLevel)}
                          <span className="text-xs text-text-secondary">•</span>
                          <span className="text-xs text-text-secondary">{proposal.proposedFix.type}</span>
                        </div>

                        <div className="bg-bg-hover/50 rounded-lg p-3">
                          <p className="text-xs font-medium text-text-secondary mb-1">Proposed Fix</p>
                          <p className="text-sm text-text-primary">{proposal.proposedFix.description}</p>
                          <p className="text-xs text-text-secondary mt-2 italic">"{proposal.proposedFix.reasoning}"</p>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Rollback timeout: {proposal.rollbackPlan.timeout}s</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-border-main">
                        {proposal.status === 'pending' && (
                          <>
                            <button
                              onClick={() => { setSelectedProposal(proposal); setShowApprovalModal(true); }}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Review & Approve
                            </button>
                            <button
                              onClick={() => handleApprove(proposal, false)}
                              className="px-3 py-2 text-xs font-medium text-text-secondary hover:text-rose-600 dark:hover:text-rose-400 border border-border-main rounded-lg transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {proposal.status === 'approved' && (
                          <button
                            onClick={() => handleApply(proposal)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5" /> Apply Fix
                          </button>
                        )}

                        {proposal.status === 'applied' && (
                          <button
                            onClick={() => handleRollback(proposal)}
                            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Rollback
                          </button>
                        )}

                        {proposal.status === 'failed' && (
                          <div className="flex-1 flex items-center gap-2 text-xs text-rose-600">
                            <XCircle className="w-4 h-4" />
                            <span>{proposal.result?.error || 'Fix failed'}</span>
                          </div>
                        )}

                        {proposal.result && (
                          <div className="flex items-center gap-2 text-xs text-text-tertiary">
                            {proposal.result.success ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Applied {new Date(proposal.result.timestamp).toLocaleTimeString()}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                <span>Failed</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Runbooks Tab */}
          {activeTab === 'runbooks' && (
            <>
              {runbooks.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-text-primary">No Runbooks</h3>
                  <p className="text-sm text-text-secondary mt-2">Convert triage reports to executable runbooks</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {runbooks.map((runbook) => (
                    <div key={runbook.id} className="bg-bg-card rounded-xl border border-border-main overflow-hidden">
                      <div className="p-5 border-b border-border-main">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-text-primary">{runbook.name}</h3>
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-600">
                                {runbook.successRate.toFixed(1)}% success
                              </span>
                            </div>
                            <p className="text-xs text-text-secondary mt-1">{runbook.description}</p>
                          </div>
                          <button className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                            <Play className="w-3.5 h-3.5" /> Execute
                          </button>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="space-y-3">
                          {runbook.steps.map((step, index) => (
                            <div key={step.id} className="flex items-start gap-4">
                              <div className="flex flex-col items-center">
                                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400">
                                  {index + 1}
                                </div>
                                {index < runbook.steps.length - 1 && (
                                  <div className="w-0.5 h-8 bg-border-main mt-1" />
                                )}
                              </div>
                              <div className="flex-1 pb-6">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                                      {step.name}
                                      {step.requiresApproval && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/10 text-amber-600">
                                          <User className="w-3 h-3" /> Requires Approval
                                        </span>
                                      )}
                                    </h4>
                                    <p className="text-xs text-text-secondary mt-1">{step.description}</p>
                                    {step.command && (
                                      <code className="mt-2 block text-xs bg-bg-hover text-text-secondary p-2 rounded font-mono">
                                        {step.command}
                                      </code>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                                    <Timer className="w-3.5 h-3.5" />
                                    <span>{step.timeout}s</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="px-5 py-3 bg-bg-hover/50 border-t border-border-main flex items-center justify-between text-xs text-text-tertiary">
                        <div className="flex items-center gap-4">
                          <span>Source: {runbook.source}</span>
                          <span>Used {runbook.usageCount} times</span>
                        </div>
                        <span>Created by {runbook.createdBy}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Scheduled Tab */}
          {activeTab === 'scheduled' && (
            <>
              {scheduledFixes.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-text-primary">No Scheduled Fixes</h3>
                  <p className="text-sm text-text-secondary mt-2">Schedule recurring remediation actions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scheduledFixes.map((fix) => (
                    <div key={fix.id} className="bg-bg-card rounded-xl border border-border-main p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-text-primary">{fix.name}</h3>
                            {getStatusBadge(fix.status)}
                            {fix.requiresApproval && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/10 text-amber-600">
                                <Shield className="w-3 h-3" /> Approval Required
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mb-3">{fix.description}</p>

                          <div className="flex flex-wrap items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5 text-text-secondary">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{new Date(fix.scheduledTime).toLocaleString()}</span>
                              {fix.recurrence && <span className="text-text-tertiary">({fix.recurrence})</span>}
                            </div>
                            <div className="flex items-center gap-1.5 text-text-secondary">
                              <GitPullRequest className="w-3.5 h-3.5" />
                              <span>{fix.targetNamespace}/{fix.targetWorkload}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-text-secondary">
                              <User className="w-3.5 h-3.5" />
                              <span>{fix.createdBy}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          {fix.status === 'pending_approval' && (
                            <button
                              onClick={() => handleApproveScheduled(fix)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 px-4 rounded-lg transition-colors"
                            >
                              Approve
                            </button>
                          )}

                          {(fix.status === 'pending' || fix.status === 'approved' || fix.status === 'pending_approval') && (
                            <button
                              onClick={() => handleCancelScheduled(fix)}
                              className="text-text-secondary hover:text-rose-600 dark:text-text-secondary dark:hover:text-rose-400 text-xs font-medium py-2 px-3 transition-colors"
                            >
                              Cancel
                            </button>
                          )}

                          {fix.status === 'completed' && (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          )}
                        </div>
                      </div>

                      {fix.approvedBy && (
                        <div className="mt-4 pt-3 border-t border-border-main">
                          <div className="flex items-center gap-2 text-xs text-text-tertiary">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Approved by {fix.approvedBy} {fix.approvedAt && new Date(fix.approvedAt).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Approval Modal */}
        {showApprovalModal && selectedProposal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-bg-card rounded-xl border border-border-main max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Review Fix Proposal</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase">Workload</p>
                  <p className="text-sm text-text-primary">{selectedProposal.name} ({selectedProposal.namespace})</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase">Issue</p>
                  <p className="text-sm text-text-primary">{selectedProposal.issue}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase">Proposed Fix</p>
                  <p className="text-sm text-text-primary">{selectedProposal.proposedFix.description}</p>
                  <p className="text-xs text-text-secondary mt-1 italic">{selectedProposal.proposedFix.reasoning}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase">Impact</p>
                  <p className="text-sm text-text-primary">{selectedProposal.estimatedImpact}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase">Rollback Plan</p>
                  <p className="text-sm text-text-primary">
                    Automatic rollback if fix fails within {selectedProposal.rollbackPlan.timeout} seconds
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Comment (optional)
                </label>
                <textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  className="w-full px-3 py-2 border border-border-main rounded-lg text-sm bg-bg-card text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Add a note about this approval decision..."
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleApprove(selectedProposal, true)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> Approve Fix
                </button>
                <button
                  onClick={() => handleApprove(selectedProposal, false)}
                  className="flex-1 bg-bg-card hover:bg-bg-hover text-text-secondary border border-border-main text-sm font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>

              <button
                onClick={() => { setShowApprovalModal(false); setSelectedProposal(null); setApprovalComment(''); }}
                className="w-full mt-3 text-sm text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};
