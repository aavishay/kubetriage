import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle2, XCircle, Clock, Filter, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface AuditLog {
  ID: string;
  Action: string;
  Resource: string;
  ResourceID: string;
  UserID: string;
  ClusterID: string;
  Namespace: string;
  Details: string;
  IPAddress: string;
  Success: boolean;
  ErrorMsg: string;
  CreatedAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      if (filterAction) params.append('action', filterAction);
      if (filterResource) params.append('resource', filterResource);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data: AuditLogsResponse = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [offset, filterAction, filterResource]);

  const actionOptions = [
    { value: '', label: 'All Actions' },
    { value: 'remediation_apply', label: 'Remediation Apply' },
    { value: 'remediation_approve', label: 'Remediation Approve' },
    { value: 'cluster_register', label: 'Cluster Register' },
    { value: 'cluster_delete', label: 'Cluster Delete' },
    { value: 'runbook_execute', label: 'Runbook Execute' },
    { value: 'comment_create', label: 'Comment Create' },
    { value: 'settings_update_ai', label: 'Settings Update' },
  ];

  const resourceOptions = [
    { value: '', label: 'All Resources' },
    { value: 'workload', label: 'Workload' },
    { value: 'cluster', label: 'Cluster' },
    { value: 'report', label: 'Report' },
    { value: 'runbook', label: 'Runbook' },
    { value: 'comment', label: 'Comment' },
    { value: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-primary uppercase tracking-tighter flex items-center gap-3">
            <Shield className="w-7 h-7 text-primary-500" />
            Audit Logs
          </h1>
          <p className="text-text-tertiary text-sm mt-1">
            Track every action performed in KubeTriage for compliance and accountability.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-bg-card rounded-xl border border-border-main px-3 py-2">
          <Filter className="w-4 h-4 text-text-tertiary" />
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setOffset(0); }}
            className="bg-transparent text-sm text-text-primary outline-none cursor-pointer"
          >
            {actionOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-bg-card rounded-xl border border-border-main px-3 py-2">
          <Filter className="w-4 h-4 text-text-tertiary" />
          <select
            value={filterResource}
            onChange={(e) => { setFilterResource(e.target.value); setOffset(0); }}
            className="bg-transparent text-sm text-text-primary outline-none cursor-pointer"
          >
            {resourceOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-sm text-text-tertiary">
          Showing {logs.length} of {total} logs
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-bg-card rounded-3xl border border-border-main overflow-hidden">
        <div className="p-6 border-b border-border-main bg-bg-hover/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-600 rounded-xl shadow-lg shadow-primary-600/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-text-primary">Activity Log</h2>
              <p className="text-[10px] text-text-tertiary font-semibold">{total} total entries</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <div className="kt-skeleton kt-skeleton-text w-24" />
                <div className="kt-skeleton kt-skeleton-text w-16 ml-auto" />
              </div>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-bg-hover/30 border border-border-main">
                  <div className="kt-skeleton w-8 h-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-4">
                      <div className="kt-skeleton kt-skeleton-text w-20" />
                      <div className="kt-skeleton kt-skeleton-text w-32" />
                      <div className="kt-skeleton kt-skeleton-text w-24" />
                    </div>
                    <div className="kt-skeleton kt-skeleton-text w-full max-w-md" />
                  </div>
                  <div className="kt-skeleton w-24 h-5 rounded-full" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
              <p className="text-text-tertiary">No audit logs found.</p>
              <p className="text-xs text-text-tertiary mt-1">Actions will be logged as they occur.</p>
            </div>
          ) : (
            logs.map(log => (
              <div
                key={log.ID}
                className={`rounded-2xl border-2 transition-all ${
                  selectedLog === log.ID
                    ? 'border-primary-500 bg-primary-500/5'
                    : 'border-border-main hover:border-primary-500/30 bg-bg-hover/30'
                }`}
              >
                <div
                  className="p-5 cursor-pointer"
                  onClick={() => setSelectedLog(selectedLog === log.ID ? null : log.ID)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-text-primary">{log.Action}</span>
                      <span className="px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-500 text-[10px] font-black uppercase">
                        {log.Resource}
                      </span>
                      {log.Success ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Success
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 text-[10px] font-bold flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-tertiary">{new Date(log.CreatedAt).toLocaleString()}</span>
                      {selectedLog === log.ID ? (
                        <ChevronUp className="w-4 h-4 text-text-tertiary" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-text-tertiary" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    {log.ClusterID && (
                      <div className="text-text-secondary">
                        <span className="text-text-tertiary">Cluster: </span>{log.ClusterID}
                      </div>
                    )}
                    {log.Namespace && (
                      <div className="text-text-secondary">
                        <span className="text-text-tertiary">Namespace: </span>{log.Namespace}
                      </div>
                    )}
                    {log.ResourceID && (
                      <div className="text-text-secondary">
                        <span className="text-text-tertiary">Resource ID: </span>{log.ResourceID}
                      </div>
                    )}
                    {log.IPAddress && (
                      <div className="text-text-secondary">
                        <span className="text-text-tertiary">IP: </span>{log.IPAddress}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedLog === log.ID && (
                  <div className="px-5 pb-5 pt-2 border-t border-border-main space-y-4 animate-in fade-in slide-in-from-top-2">
                    {log.Details && (
                      <div className="p-3 rounded-xl bg-bg-card border border-border-main">
                        <p className="text-[10px] font-black uppercase text-text-tertiary mb-1">Details</p>
                        <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono overflow-x-auto">{log.Details}</pre>
                      </div>
                    )}
                    {!log.Success && log.ErrorMsg && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                          <span className="text-sm font-bold text-rose-500">Error</span>
                        </div>
                        <p className="text-xs text-rose-400">{log.ErrorMsg}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="p-6 border-t border-border-main flex items-center justify-between">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-bg-card border border-border-main text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <span className="text-sm text-text-tertiary">
              Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-bg-card border border-border-main text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
