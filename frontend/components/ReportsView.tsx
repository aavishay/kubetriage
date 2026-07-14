
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Clock, Shield, Search, Loader2, CheckCircle2, AlertCircle, FileCheck, Activity, Trash2, MessageSquare, Ticket, X, Sparkles, ChevronRight, ChevronDown, Layers, Plus } from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';
import { usePresence } from '../contexts/PresenceContext';
import { useEscapeKey } from '../utils/useEscapeKey';
import { TriageReport, isSecurityReport } from '../types';

// Backend uses PascalCase by default for struct fields without json tags

import ReactMarkdown from 'react-markdown';

export const ReportsView: React.FC = () => {
    const navigate = useNavigate();
    const { selectedCluster } = useMonitoring();
    const { activeUsers, notifyView, notifyLeave } = usePresence();
    const [reports, setReports] = useState<TriageReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<TriageReport | null>(null); // For Modal
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const historySectionRef = useRef<HTMLElement>(null);

    const toggleGroup = useCallback((workloadName: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(workloadName)) {
                newSet.delete(workloadName);
            } else {
                newSet.add(workloadName);
            }
            return newSet;
        });
    }, []);

    const closeConfirm = useCallback(() => setShowConfirm(false), []);
    const closeReport = useCallback(() => {
        if (selectedReport) notifyLeave(`report-${selectedReport.ID}`);
        setSelectedReport(null);
    }, [selectedReport, notifyLeave]);
    useEscapeKey(showConfirm, closeConfirm);
    useEscapeKey(!!selectedReport, closeReport);

    const fetchReports = useCallback(async () => {
        try {
            const res = await fetch('/api/reports?all=true'); // Fetch all reports history
            if (res.ok) {
                const data = await res.json();
                setReports(data);
            }
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial data fetch on mount. Async data fetching in useEffect is the app's established pattern.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchReports();
    }, [fetchReports]);

    const handleDownloadCompliance = () => {
        window.open('/api/reports/compliance', '_blank');
    };

    const handleCleanArchive = async () => {
        setShowConfirm(false);
        setIsDeleting(true);
        try {
            const res = await fetch('/api/reports', {
                method: 'DELETE',
            });
            if (res.ok) {
                setReports([]); // Clear local state immediately for fast feedback
                setExpandedGroups(new Set());
                setSearchTerm('');
                setSelectedReport(null);
                await fetchReports(); // Ensure sync with backend
                // Scroll the (now empty) Analysis History section into view so the
                // user isn't left staring at blank background after the list shrinks.
                historySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                console.error('Failed to clean archive');
                alert('Failed to clean reports archive.');
            }
        } catch (error) {
            console.error('Error cleaning archive:', error);
            alert('An error occurred while cleaning the archive.');
        } finally {
            setIsDeleting(false);
        }
    };

    const formatDateTime = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Just Now';
        return d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    const handleApprove = async (report: TriageReport) => {
        try {
            const res = await fetch(`/api/reports/${report.ID}/approve`, { method: 'POST' });
            if (res.ok) {
                alert('Fix applied successfully!');
                fetchReports(); // Refresh
                setSelectedReport(null);
            } else {
                const err = await res.json();
                alert(`Failed to apply fix: ${err.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.error(e);
            alert('Network error approving fix');
        }
    };

    const handleReject = async (report: TriageReport) => {
        try {
            const res = await fetch(`/api/reports/${report.ID}/reject`, { method: 'POST' });
            if (res.ok) {
                fetchReports();
                setSelectedReport(null);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleExport = async (report: TriageReport, target: 'slack' | 'jira') => {
        try {
            const res = await fetch(`/api/reports/${report.ID}/export?target=${target}`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                alert(data.message || `Exported to ${target} successfully!`);
            } else {
                const err = await res.json();
                alert(`Failed to export: ${err.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.error(e);
            alert('Network error during export');
        }
    };

    const filteredReports = reports.filter(r =>
        (r.Analysis || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.WorkloadName || 'Unknown').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Deduplicate reports that share the same incident signature (type + severity + normalized analysis)
    // Keeps the most recent occurrence of each recurring event.
    const dedupeReports = (reports: TriageReport[]): TriageReport[] => {
        const seen = new Map<string, TriageReport>();
        reports
            .slice()
            .sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime())
            .forEach(report => {
                const normalizedAnalysis = (report.Analysis || '').replace(/[#*`\s]/g, '').substring(0, 120).toLowerCase();
                const key = `${report.IncidentType || 'Unknown'}|${report.Severity || 'Unknown'}|${normalizedAnalysis}`;
                if (!seen.has(key)) {
                    seen.set(key, report);
                }
            });
        return Array.from(seen.values()).sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime());
    };

    // Group reports by WorkloadName (pod name)
    const groupedReports = useMemo(() => {
        const groups = new Map<string, TriageReport[]>();
        filteredReports.forEach(report => {
            const name = report.WorkloadName || 'Unknown';
            if (!groups.has(name)) {
                groups.set(name, []);
            }
            groups.get(name)!.push(report);
        });
        return Array.from(groups.entries())
            .map(([workloadName, reports]) => {
                const uniqueReports = dedupeReports(reports);
                return {
                    workloadName,
                    reports: uniqueReports,
                    latestReport: uniqueReports[0],
                    count: uniqueReports.length,
                    criticalCount: uniqueReports.filter(r => r.Severity === 'Critical').length,
                };
            })
            .sort((a, b) => new Date(b.latestReport.CreatedAt).getTime() - new Date(a.latestReport.CreatedAt).getTime());
    }, [filteredReports]);

    const allExpanded = groupedReports.length > 0 && expandedGroups.size === groupedReports.length;

    const expandAll = useCallback(() => {
        const allNames = new Set(groupedReports.map(g => g.workloadName));
        setExpandedGroups(allNames);
    }, [groupedReports]);

    const collapseAll = useCallback(() => {
        setExpandedGroups(new Set());
    }, []);

    const severityBadge = (severity: string | undefined, isSecurity: boolean) => {
        if (isSecurity || severity === 'Critical') {
            return 'kt-badge-danger';
        }
        return 'kt-badge-warning';
    };

    return (
        <div className="space-y-6 pb-20 bg-bg-main animate-fade-in pr-2">
            {/* Hero Header */}
            <div className="kt-panel p-6 md:p-8 relative overflow-hidden">
                <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 kt-badge kt-badge-success mb-6">
                        <Shield className="w-3.5 h-3.5" /> Compliance & audit
                    </div>
                    <h1 className="font-sans text-3xl font-bold text-text-primary mb-3">
                        Reporting center
                    </h1>
                    <p className="text-base text-text-tertiary mb-8 leading-relaxed">
                        Generate compliance artifacts and review historical AI triage reports for your laboratory infrastructure.
                    </p>

                    <button
                        onClick={handleDownloadCompliance}
                        className="kt-button kt-button-primary"
                    >
                        <Download className="w-4 h-4" /> Download SOC2 report
                    </button>
                </div>
            </div>

            {/* Available Reports Section */}
            <section className="kt-panel overflow-hidden">
                <div className="kt-panel-header">
                    <span className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-primary-500" /> Available reports
                    </span>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                    {/* SOC2 Card */}
                    <div className="kt-panel p-5 flex flex-col cursor-pointer group hover:border-primary-500/50 transition-all" onClick={handleDownloadCompliance}>
                        <div className="p-3 w-fit mb-5 bg-bg-main border border-border-main text-primary-500 group-hover:kt-cyan-glow transition-all">
                            <Shield className="w-6 h-6" />
                        </div>
                        <h3 className="font-sans text-lg font-bold text-text-primary mb-2">SOC 2 compliance audit</h3>
                        <p className="text-sm text-text-tertiary mb-6 flex-1 leading-relaxed">
                            Complete audit log of user actions, authentication events, and configuration changes securely stored.
                        </p>
                        <div className="kt-badge kt-badge-success">
                            <span className="kt-led kt-led-success kt-led-pulse" /> Ready for Download
                        </div>
                    </div>

                    {/* Workload Health Card */}
                    <div className="kt-panel p-5 flex flex-col opacity-60">
                        <div className="p-3 w-fit mb-5 bg-bg-main border border-border-main text-info">
                            <Activity className="w-6 h-6" />
                        </div>
                        <h3 className="font-sans text-lg font-bold text-text-primary mb-2">Cluster health summary</h3>
                        <p className="text-sm text-text-tertiary mb-6 flex-1 leading-relaxed">
                            Monthly aggregated uptime, resource utilization, and incident frequency reports.
                        </p>
                        <div className="kt-text-label flex items-center gap-2">
                            <span className="kt-led" /> Coming Soon
                        </div>
                    </div>
                </div>
            </section>

            {/* History Section */}
            <section ref={historySectionRef} className="kt-panel overflow-hidden scroll-mt-6">
                <div className="kt-panel-header">
                    <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary-500" /> Analysis history
                    </span>
                    <span className="kt-badge kt-badge-info">{groupedReports.length} workloads</span>
                </div>

                <div className="p-4 relative z-10 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            {groupedReports.length > 0 && (
                                <button
                                    onClick={allExpanded ? collapseAll : expandAll}
                                    className="kt-button kt-button-secondary kt-button-sm"
                                    title={allExpanded ? "Collapse all groups" : "Expand all groups"}
                                >
                                    {allExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    {allExpanded ? 'Collapse all' : 'Expand all'}
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative flex-1 sm:flex-none">
                                <Search className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search reports..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="kt-input pl-9 pr-4 py-2 w-full sm:w-64 text-sm"
                                />
                            </div>
                            <button
                                onClick={() => setShowConfirm(true)}
                                disabled={isDeleting || reports.length === 0}
                                className={`kt-button kt-button-danger kt-button-sm ${isDeleting || reports.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                                title="Delete all reports"
                            >
                                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                Clean
                            </button>
                        </div>
                    </div>

                    {/* Confirmation Modal */}
                    {showConfirm && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={() => setShowConfirm(false)}>
                            <div className="kt-panel p-6 max-w-sm w-full animate-fade-in" onClick={e => e.stopPropagation()}>
                                <div className="p-3 bg-danger-light text-danger border border-danger/20 w-fit mb-6">
                                    <Trash2 className="w-8 h-8" />
                                </div>
                                <h3 className="font-sans text-xl font-bold text-text-primary mb-3">Delete all reports?</h3>
                                <p className="text-sm text-text-tertiary mb-8 leading-relaxed">
                                    This will permanently delete all historical reports in your laboratory. This action <span className="text-danger font-bold">cannot be undone</span>.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowConfirm(false)}
                                        className="kt-button kt-button-secondary flex-1"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCleanArchive}
                                        className="kt-button kt-button-danger flex-1"
                                    >
                                        Delete All
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Detail View Modal */}
                    {selectedReport && (
                        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={() => { notifyLeave(`report-${selectedReport.ID}`); setSelectedReport(null); }}>
                            <div className="kt-panel w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
                                <div className="kt-panel-header shrink-0">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-sans text-xl md:text-2xl font-bold text-text-primary truncate">
                                            {selectedReport.WorkloadName}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-3 mt-2">
                                            <span className={`kt-badge ${severityBadge(selectedReport.Severity, isSecurityReport(selectedReport))}`}>
                                                {selectedReport.Severity}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-xs text-text-tertiary font-sans">
                                                <Clock className="w-3.5 h-3.5" />
                                                {formatDateTime(selectedReport.CreatedAt)}
                                            </div>

                                            {activeUsers[`report-${selectedReport.ID}`] && activeUsers[`report-${selectedReport.ID}`].length > 0 && (
                                                <div className="flex items-center gap-1.5 ml-0 sm:ml-4 border-0 sm:border-l border-border-main sm:pl-4">
                                                    <span className="kt-text-label">Collaborating:</span>
                                                    <div className="flex -space-x-2">
                                                        {activeUsers[`report-${selectedReport.ID}`].slice(0, 5).map((u) => (
                                                            <img key={u.userId} src={u.avatarUrl} alt={u.userName} title={u.userName} className="w-6 h-6 rounded-full border-2 border-bg-card" />
                                                        ))}
                                                        {activeUsers[`report-${selectedReport.ID}`].length > 5 && (
                                                            <span className="w-6 h-6 rounded-full border-2 border-bg-card bg-bg-hover flex items-center justify-center text-[8px] font-semibold text-text-tertiary font-sans">+{activeUsers[`report-${selectedReport.ID}`].length - 5}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={() => { notifyLeave(`report-${selectedReport.ID}`); setSelectedReport(null); }} className="kt-button kt-button-ghost kt-button-sm">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                                    <ReactMarkdown className="text-text-primary">{selectedReport.Analysis}</ReactMarkdown>

                                    {selectedReport.AutoRemediationPayload && selectedReport.ApprovalStatus === 'Pending' && (
                                        <div className="mt-8 p-5 border border-primary-500/20 bg-bg-card relative overflow-hidden group/fix">
                                            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/fix:opacity-40 transition-opacity">
                                                <Sparkles className="w-12 h-12 text-primary-500" />
                                            </div>
                                            <h4 className="font-sans text-base font-bold text-text-primary mb-3 flex items-center gap-2 relative z-10">
                                                <Shield className="w-5 h-5 text-primary-500" /> AI Remediation Protocol
                                            </h4>
                                            <p className="text-sm text-text-tertiary mb-5 leading-relaxed relative z-10">
                                                The laboratory intelligence has synthesized a corrective patch for this discrepancy.
                                            </p>
                                            <div className="bg-bg-main p-4 text-xs text-text-primary overflow-x-auto mb-5 border border-border-main relative z-10 font-sans">
                                                <pre className="m-0">{selectedReport.AutoRemediationPayload}</pre>
                                            </div>
                                            <div className="flex flex-wrap gap-3 relative z-10">
                                                <button onClick={() => handleApprove(selectedReport)} className="kt-button kt-button-primary">
                                                    <CheckCircle2 className="w-4 h-4" /> Execute & apply
                                                </button>
                                                <button onClick={() => handleReject(selectedReport)} className="kt-button kt-button-secondary">
                                                    Dismiss patch
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {selectedReport.ApprovalStatus === 'Approved' && (
                                        <div className="mt-6 p-4 border border-success/20 bg-success-light flex items-center gap-3 text-success text-sm font-bold">
                                            <CheckCircle2 className="w-5 h-5" /> Remediation protocol successfully deployed.
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 border-t border-border-main bg-bg-hover/30 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                                    <div className="text-[10px] text-text-tertiary opacity-60 font-sans">
                                        Record UID: <span className="text-text-secondary">{selectedReport.ID}</span> • Segment: <span className="text-text-secondary">{selectedCluster?.name || 'Lab infra'}</span> • Agent: Cluster sentinel v4
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleExport(selectedReport, 'slack')}
                                            className="kt-button kt-button-secondary kt-button-sm text-primary-500"
                                        >
                                            <MessageSquare className="w-4 h-4" /> Slack notify
                                        </button>
                                        <button
                                            onClick={() => handleExport(selectedReport, 'jira')}
                                            className="kt-button kt-button-secondary kt-button-sm text-info"
                                        >
                                            <Ticket className="w-4 h-4" /> Jira issue
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {
                        isLoading ? (
                            <div className="space-y-4 animate-fade-in">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="kt-skeleton kt-skeleton-text w-32" />
                                    <div className="kt-skeleton w-24 h-8" />
                                </div>
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="kt-panel p-4 space-y-3">
                                        <div className="flex items-center gap-4">
                                            <div className="kt-skeleton w-10 h-10 shrink-0" />
                                            <div className="flex-1 space-y-2">
                                                <div className="kt-skeleton kt-skeleton-text w-48" />
                                                <div className="kt-skeleton kt-skeleton-text w-32" />
                                            </div>
                                            <div className="kt-skeleton w-16 h-6" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : groupedReports.length > 0 ? (
                            <div className="space-y-3">
                                {groupedReports.map((group) => {
                                    const isExpanded = expandedGroups.has(group.workloadName);
                                    const isSecurity = isSecurityReport(group.latestReport);
                                    const groupHasCritical = group.criticalCount > 0;
                                    return (
                                        <div key={group.workloadName} className="kt-panel overflow-hidden transition-all hover:border-primary-500/30">
                                            {/* Group Header */}
                                            <div
                                                onClick={() => toggleGroup(group.workloadName)}
                                                className="p-4 flex items-center gap-4 cursor-pointer group hover:bg-bg-hover/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-5 h-5 text-text-tertiary group-hover:text-text-primary transition-colors" />
                                                    ) : (
                                                        <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-text-primary transition-colors" />
                                                    )}
                                                </div>

                                                <div className={`p-2.5 shrink-0 border ${isSecurity || groupHasCritical ? 'bg-danger-light border-danger/20 text-danger' : 'bg-warning-light border-warning/20 text-warning'}`}>
                                                    {isSecurity ? <Shield className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1 min-w-0">
                                                        <h4 className="font-sans text-sm font-bold text-text-primary group-hover:text-primary-500 transition-colors truncate">
                                                            {group.workloadName}
                                                        </h4>
                                                        <span className={`kt-badge ${groupHasCritical ? 'kt-badge-danger' : 'kt-badge-warning'}`}>
                                                            {group.count} report{group.count !== 1 ? 's' : ''}
                                                        </span>
                                                        {groupHasCritical && (
                                                            <span className="kt-badge kt-badge-danger">
                                                                {group.criticalCount} critical
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-text-tertiary truncate">
                                                        Latest: {formatDateTime(group.latestReport.CreatedAt)}
                                                        {group.latestReport.Severity && (
                                                            <span className="ml-2">• Severity: {group.latestReport.Severity}</span>
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="hidden sm:flex items-center gap-3 shrink-0">
                                                    <span className={`kt-badge ${severityBadge(group.latestReport.Severity, isSecurity)}`}>
                                                        {group.latestReport.Severity}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Expanded Group Content */}
                                            {isExpanded && (
                                                <div className="border-t border-border-main bg-bg-hover/20">
                                                    {group.reports.map((report, index) => {
                                                        const reportIsSecurity = isSecurityReport(report);
                                                        return (
                                                            <div
                                                                key={report.ID}
                                                                onClick={() => { setSelectedReport(report); notifyView(`report-${report.ID}`); }}
                                                                className={`p-4 flex items-center gap-4 cursor-pointer group transition-all hover:bg-bg-hover ${index !== group.reports.length - 1 ? 'border-b border-border-main/50' : ''}`}
                                                            >
                                                                <div className="w-5 flex justify-center shrink-0">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-border-main group-hover:bg-primary-500 transition-colors" />
                                                                </div>

                                                                <div className={`p-2 shrink-0 ${reportIsSecurity || report.Severity === 'Critical' ? 'bg-danger-light border border-danger/20 text-danger' : 'bg-warning-light border border-warning/20 text-warning'}`}>
                                                                    {reportIsSecurity ? <Shield className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span className="kt-badge kt-badge-info" title={formatDateTime(report.CreatedAt)}>
                                                                            {formatDateTime(report.CreatedAt)}
                                                                        </span>
                                                                        <span className={`kt-badge ${severityBadge(report.Severity, reportIsSecurity)}`}>
                                                                            {report.Severity}
                                                                        </span>
                                                                        {report.IncidentType && (
                                                                            <span className="text-[10px] text-text-tertiary truncate min-w-0">
                                                                                {report.IncidentType}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-text-tertiary font-medium mt-1 min-w-0 truncate">
                                                                        {report.Analysis ? report.Analysis.replace(/[#*`]/g, '').substring(0, 100) + "..." : 'No content'}
                                                                    </p>
                                                                </div>

                                                                <div className="hidden sm:flex items-center gap-3 shrink-0">
                                                                    {activeUsers[`report-${report.ID}`] && activeUsers[`report-${report.ID}`].length > 0 && (
                                                                        <div className="flex -space-x-2">
                                                                            {activeUsers[`report-${report.ID}`].map((u) => (
                                                                                <img key={u.userId} src={u.avatarUrl} className="w-5 h-5 rounded-full border-2 border-bg-card" title={u.userName} />
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-text-primary transition-colors" />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-20 border-2 border-dashed border-border-main bg-bg-card/30 flex flex-col items-center justify-center animate-fade-in group">
                                <div className="mb-6 p-6 bg-bg-hover border border-border-main group-hover:scale-110 transition-transform duration-500">
                                    <FileText className="w-12 h-12 text-text-tertiary opacity-40" />
                                </div>
                                <h3 className="font-sans text-xl font-bold text-text-primary mb-2">No reports found</h3>
                                <p className="text-sm text-text-tertiary max-w-xs mx-auto leading-relaxed mb-6">
                                    No historical analysis records available in your current laboratory segment.
                                </p>
                                <button
                                    onClick={() => navigate('/triage')}
                                    className="kt-button kt-button-primary"
                                >
                                    <Plus className="w-4 h-4" /> Run new triage
                                </button>
                            </div>
                        )
                    }
                </div>
            </section>
        </div>
    );
};
