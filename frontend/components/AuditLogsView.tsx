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
    <div className="flex flex-col gap-5 p-0 font-sans kt-page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-sans text-2xl font-bold text-text-primary flex items-center gap-3">
            <Shield className="w-7 h-7 text-primary-500" />
            Audit Logs
          </h1>
          <p className="text-text-tertiary text-sm mt-1 font-sans">
            Track every action performed in KubeTriage for compliance and accountability.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-text-tertiary hidden sm:block" />
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setOffset(0); }}
          className="kt-select text-sm flex-1 sm:flex-initial sm:w-56"
          aria-label="Filter by action"
        >
          {actionOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={filterResource}
          onChange={(e) => { setFilterResource(e.target.value); setOffset(0); }}
          className="kt-select text-sm flex-1 sm:flex-initial sm:w-56"
          aria-label="Filter by resource type"
        >
          {resourceOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="ml-auto text-sm text-text-tertiary font-sans">
          Showing {logs.length} of {total} logs
        </div>
      </div>

      {/* Logs Table */}
      <div className="kt-panel overflow-hidden">
        <div className="kt-panel-header">
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary-500" /> Activity Log
          </span>
          <span className="text-[10px] text-text-tertiary font-sans">{total} total entries</span>
        </div>

        <div className="p-4 relative z-10 space-y-4">
          {loading ? (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <div className="kt-skeleton kt-skeleton-text w-24" />
                <div className="kt-skeleton kt-skeleton-text w-16 ml-auto" />
              </div>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 border border-border-main bg-bg-main">
                  <div className="kt-skeleton w-8 h-8 rounded-sm shrink-0" />
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
              <p className="text-text-tertiary font-sans">No audit logs found.</p>
              <p className="text-xs text-text-tertiary mt-1 font-sans">Actions will be logged as they occur.</p>
            </div>
          ) : (
            logs.map(log => (
              <div
                key={log.ID}
                className={`border transition-all ${
                  selectedLog === log.ID
                    ? 'border-primary-500 kt-amber-glow bg-bg-card'
                    : 'border-border-main hover:border-primary-500/30 bg-bg-main'
                }`}
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setSelectedLog(selectedLog === log.ID ? null : log.ID)}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-bold text-text-primary truncate">{log.Action}</span>
                      <span className="kt-badge kt-badge-info">
                        {log.Resource}
                      </span>
                      {log.Success ? (
                        <span className="kt-badge kt-badge-success flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Success
                        </span>
                      ) : (
                        <span className="kt-badge kt-badge-danger flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-text-tertiary font-mono">{new Date(log.CreatedAt).toLocaleString()}</span>
                      {selectedLog === log.ID ? (
                        <ChevronUp className="w-4 h-4 text-text-tertiary" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-text-tertiary" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    {log.ClusterID && (
                      <div className="text-text-secondary min-w-0">
                        <span className="text-text-tertiary">Cluster: </span>
                        <span className="break-all font-mono">{log.ClusterID}</span>
                      </div>
                    )}
                    {log.Namespace && (
                      <div className="text-text-secondary min-w-0">
                        <span className="text-text-tertiary">Namespace: </span>
                        <span className="break-all font-mono">{log.Namespace}</span>
                      </div>
                    )}
                    {log.ResourceID && (
                      <div className="text-text-secondary min-w-0">
                        <span className="text-text-tertiary">Resource ID: </span>
                        <span className="break-all font-mono">{log.ResourceID}</span>
                      </div>
                    )}
                    {log.IPAddress && (
                      <div className="text-text-secondary min-w-0">
                        <span className="text-text-tertiary">IP: </span>
                        <span className="break-all font-mono">{log.IPAddress}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedLog === log.ID && (
                  <div className="px-4 pb-4 pt-2 border-t border-border-main space-y-4 animate-in fade-in slide-in-from-top-2">
                    {log.Details && (
                      <div className="kt-panel-inset p-3">
                        <p className="kt-text-label mb-1">Details</p>
                        <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono overflow-x-auto">{log.Details}</pre>
                      </div>
                    )}
                    {!log.Success && log.ErrorMsg && (
                      <div className="p-3 bg-danger/10 border border-danger/20">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-4 h-4 text-danger" />
                          <span className="text-sm font-bold text-danger">Error</span>
                        </div>
                        <p className="text-xs text-danger font-sans">{log.ErrorMsg}</p>
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
          <div className="p-4 border-t border-border-main flex items-center justify-between">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="kt-button kt-button-secondary kt-button-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-text-tertiary font-sans">
              Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="kt-button kt-button-secondary kt-button-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
