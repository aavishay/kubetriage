
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Download, Clock, Shield, Search, Filter, Loader2, CheckCircle2, AlertCircle, FileCheck, Activity, Trash2, MessageSquare, Ticket, Share2, X, Sparkles, ChevronRight, ChevronDown, Layers } from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';
import { usePresence } from '../contexts/PresenceContext';
import { useEscapeKey } from '../utils/useEscapeKey';
import { TriageReport, isSecurityReport } from '../types';

// Backend uses PascalCase by default for struct fields without json tags

import ReactMarkdown from 'react-markdown';

export const ReportsView: React.FC = () => {
    const { selectedCluster } = useMonitoring();
    const { activeUsers, notifyView, notifyLeave } = usePresence();
    const [reports, setReports] = useState<TriageReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<TriageReport | null>(null); // For Modal
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

    const expandAll = useCallback(() => {
        const allNames = new Set(groupedReports.map(g => g.workloadName));
        setExpandedGroups(allNames);
    }, []);

    const collapseAll = useCallback(() => {
        setExpandedGroups(new Set());
    }, []);

    const closeConfirm = useCallback(() => setShowConfirm(false), []);
    const closeReport = useCallback(() => {
        if (selectedReport) notifyLeave(`report-${selectedReport.ID}`);
        setSelectedReport(null);
    }, [selectedReport, notifyLeave]);
    useEscapeKey(showConfirm, closeConfirm);
    useEscapeKey(!!selectedReport, closeReport);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
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
    };

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
                await fetchReports(); // Ensure sync with backend
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

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Just Now';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
            .map(([workloadName, reports]) => ({
                workloadName,
                reports: reports.sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime()),
                latestReport: reports[0],
                count: reports.length,
                criticalCount: reports.filter(r => r.Severity === 'Critical').length,
            }))
            .sort((a, b) => new Date(b.latestReport.CreatedAt).getTime() - new Date(a.latestReport.CreatedAt).getTime());
    }, [filteredReports]);

    const allExpanded = groupedReports.length > 0 && expandedGroups.size === groupedReports.length;

    return (
        <div className="space-y-8 pb-20 h-full overflow-y-auto custom-scrollbar bg-bg-main animate-fade-in pr-2">
            {/* Hero Header */}
            <div className="bg-bg-card border border-border-main rounded-2xl p-8 md:p-10 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary-500/10 transition-colors" />
                <div className="relative max-w-2xl">
                    <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-6 border border-emerald-500/20 shadow-sm">
                        <Shield className="w-3.5 h-3.5" /> Compliance & Audit
                    </div>
                    <h1 className="text-3xl font-black text-text-primary mb-3 tracking-tight">
                        Reporting Center
                    </h1>
                    <p className="text-base text-text-tertiary mb-8 font-medium leading-relaxed">
                        Generate compliance artifacts and review historical AI triage reports for your laboratory infrastructure.
                    </p>

                    <button
                        onClick={handleDownloadCompliance}
                        className="kt-button kt-button-primary"
                    >
                        <Download className="w-4 h-4" /> Download SOC2 Report
                    </button>
                </div>
            </div>

            {/* Available Reports Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <FileCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="text-xl font-bold text-text-primary tracking-tight">Available Reports</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* SOC2 Card */}
                    <div className="bg-bg-card border border-border-main rounded-2xl p-7 flex flex-col hover:border-primary-500/50 transition-all cursor-pointer group shadow-sm hover:shadow-lg hover:shadow-primary-500/5" onClick={handleDownloadCompliance}>
                        <div className="p-3.5 rounded-xl w-fit mb-5 bg-primary-500/10 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform">
                            <Shield className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-text-primary mb-2">SOC 2 Compliance Audit</h3>
                        <p className="text-sm text-text-tertiary mb-6 flex-1 font-medium leading-relaxed">
                            Complete audit log of user actions, authentication events, and configuration changes securely stored.
                        </p>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Ready for Download
                        </div>
                    </div>

                    {/* Workload Health Card */}
                    <div className="bg-bg-card border border-border-main rounded-2xl p-7 flex flex-col opacity-60 grayscale-[0.5]">
                        <div className="p-3.5 rounded-xl w-fit mb-5 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            <Activity className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-text-primary mb-2">Cluster Health Summary</h3>
                        <p className="text-sm text-text-tertiary mb-6 flex-1 font-medium leading-relaxed">
                            Monthly aggregated uptime, resource utilization, and incident frequency reports.
                        </p>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-border-main" /> Coming Soon
                        </div>
                    </div>
                </div>
            </section>

            {/* History Section */}
            <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 px-1">
                        <div className="p-2 bg-primary-500/10 rounded-lg">
                            <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <h2 className="text-xl font-bold text-text-primary tracking-tight">Analysis History</h2>
                        <span className="text-xs font-medium text-text-tertiary bg-bg-hover px-2 py-1 rounded-full border border-border-main">
                            {groupedReports.length} workloads
                        </span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {groupedReports.length > 0 && (
                            <button
                                onClick={allExpanded ? collapseAll : expandAll}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm bg-bg-card text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border-main"
                                title={allExpanded ? "Collapse all groups" : "Expand all groups"}
                            >
                                {allExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                {allExpanded ? 'Collapse All' : 'Expand All'}
                            </button>
                        )}
                        <div className="relative group flex-1 sm:flex-none">
                            <Search className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-primary-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search reports..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="kt-input pl-9 pr-4 py-2.5 w-full sm:w-64 text-sm font-medium"
                            />
                        </div>
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={isDeleting || reports.length === 0}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm kt-button-danger ${isDeleting || reports.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
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
                        <div className="bg-bg-card rounded-2xl p-8 max-w-sm w-full border border-border-main shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="p-4 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl w-fit mb-6 border border-rose-500/10 shadow-inner">
                                <Trash2 className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-text-primary mb-3 tracking-tight">Delete All Reports?</h3>
                            <p className="text-sm text-text-tertiary mb-8 font-medium leading-relaxed">
                                This will permanently delete all historical reports in your laboratory. This action <span className="text-rose-500 font-bold uppercase tracking-tight">cannot be undone</span>.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 px-4 py-3 rounded-xl bg-bg-hover text-text-secondary text-sm font-bold uppercase tracking-wider hover:bg-bg-hover/80 transition-all border border-border-main"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCleanArchive}
                                    className="flex-1 px-4 py-3 rounded-xl bg-rose-600 text-white text-sm font-bold uppercase tracking-wider hover:bg-rose-500 transition-all shadow-lg shadow-rose-500/20"
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
                        <div className="bg-bg-card rounded-[2rem] w-full max-w-4xl h-[85vh] flex flex-col border border-border-main shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-6 md:p-8 border-b border-border-main bg-bg-hover/30">
                                <div className="flex-1">
                                    <h3 className="text-2xl font-black text-text-primary mb-2 tracking-tight">
                                        {selectedReport.WorkloadName}
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${selectedReport.Severity === 'Critical' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'}`}>
                                            {selectedReport.Severity}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-xs text-text-tertiary font-medium">
                                            <Clock className="w-3.5 h-3.5 opacity-60" />
                                            {formatDate(selectedReport.CreatedAt)}
                                        </div>

                                        {activeUsers[`report-${selectedReport.ID}`] && activeUsers[`report-${selectedReport.ID}`].length > 0 && (
                                            <div className="flex items-center gap-1.5 ml-4 border-l border-border-main pl-4">
                                                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-tight opacity-70">Collaborating:</span>
                                                <div className="flex -space-x-2">
                                                    {activeUsers[`report-${selectedReport.ID}`].map((u) => (
                                                        <img key={u.userId} src={u.avatarUrl} alt={u.userName} title={u.userName} className="w-6 h-6 rounded-full border-2 border-bg-card shadow-sm" />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => { notifyLeave(`report-${selectedReport.ID}`); setSelectedReport(null); }} className="p-3 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-xl transition-all active:scale-95 border border-transparent hover:border-border-main shadow-sm">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 md:p-10 prose prose-zinc dark:prose-invert max-w-none prose-pre:bg-bg-hover/50 prose-pre:border prose-pre:border-border-main prose-a:text-primary-600 dark:prose-a:text-primary-400 custom-scrollbar selection:bg-primary-500/20">
                                <ReactMarkdown>{selectedReport.Analysis}</ReactMarkdown>

                                {selectedReport.AutoRemediationPayload && selectedReport.ApprovalStatus === 'Pending' && (
                                    <div className="mt-10 p-6 bg-primary-500/5 dark:bg-primary-500/10 border border-primary-500/20 rounded-2xl shadow-inner relative overflow-hidden group/fix">
                                        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/fix:opacity-40 transition-opacity">
                                            <Sparkles className="w-12 h-12 text-primary-500" />
                                        </div>
                                        <h4 className="text-base font-bold text-text-primary mb-3 flex items-center gap-2 relative z-10">
                                            <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" /> AI Remediation Protocol
                                        </h4>
                                        <p className="text-sm text-text-tertiary mb-5 font-medium leading-relaxed relative z-10">
                                            The laboratory intelligence has synthesized a corrective patch for this discrepancy.
                                        </p>
                                        <div className="bg-bg-main/80 backdrop-blur-sm p-4 rounded-xl font-mono text-xs text-text-primary overflow-x-auto mb-6 border border-border-main shadow-inner relative z-10 group-hover/fix:border-primary-500/30 transition-colors">
                                            <pre className="m-0">{selectedReport.AutoRemediationPayload}</pre>
                                        </div>
                                        <div className="flex flex-wrap gap-3 relative z-10">
                                            <button onClick={() => handleApprove(selectedReport)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0">
                                                <CheckCircle2 className="w-4 h-4" /> Execute & Apply
                                            </button>
                                            <button onClick={() => handleReject(selectedReport)} className="bg-bg-card hover:bg-bg-hover text-text-tertiary border border-border-main px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all active:scale-95">
                                                Dismiss Patch
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {selectedReport.ApprovalStatus === 'Approved' && (
                                    <div className="mt-8 p-4 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400 text-sm font-bold shadow-sm animate-fade-in shadow-inner">
                                        <CheckCircle2 className="w-5 h-5" /> Remediation protocol successfully deployed.
                                    </div>
                                )}
                            </div>
                            <div className="p-6 border-t border-border-main bg-bg-hover/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="text-[10px] text-text-tertiary font-bold font-mono tracking-tighter opacity-60 uppercase">
                                    RECORD_UID: {selectedReport.ID} • SEGMENT: {selectedCluster?.name || 'LAB_INFRA'} • AGENT: CLUSTER_SENTINEL_V4
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleExport(selectedReport, 'slack')}
                                        className="flex items-center gap-1.5 bg-primary-500/5 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all border border-primary-500/10 hover:shadow-lg hover:shadow-primary-500/10"
                                    >
                                        <MessageSquare className="w-4 h-4" /> Slack Notify
                                    </button>
                                    <button
                                        onClick={() => handleExport(selectedReport, 'jira')}
                                        className="flex items-center gap-1.5 bg-sky-500/5 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all border border-sky-500/10 hover:shadow-lg hover:shadow-sky-500/10"
                                    >
                                        <Ticket className="w-4 h-4" /> Jira Issue
                                    </button>
                                    <button onClick={() => { notifyLeave(`report-${selectedReport.ID}`); setSelectedReport(null); }} className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all shadow-lg shadow-primary-500/20 active:scale-95 ml-2">Finalize</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {
                    isLoading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                        </div>
                    ) : groupedReports.length > 0 ? (
                        <div className="space-y-3">
                            {groupedReports.map((group) => {
                                const isExpanded = expandedGroups.has(group.workloadName);
                                const isSecurity = isSecurityReport(group.latestReport);
                                return (
                                    <div key={group.workloadName} className="bg-bg-card border border-border-main rounded-2xl overflow-hidden transition-all hover:border-primary-500/30 shadow-sm">
                                        {/* Group Header */}
                                        <div
                                            onClick={() => toggleGroup(group.workloadName)}
                                            className="p-5 flex items-center gap-4 cursor-pointer group hover:bg-bg-hover/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2 shrink-0">
                                                {isExpanded ? (
                                                    <ChevronDown className="w-5 h-5 text-text-tertiary group-hover:text-text-primary transition-colors" />
                                                ) : (
                                                    <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-text-primary transition-colors" />
                                                )}
                                            </div>

                                            <div className={`p-3 rounded-xl shrink-0 shadow-sm ${isSecurity ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : group.criticalCount > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                                                {isSecurity ? <Shield className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="text-sm font-bold text-text-primary group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                                                        {group.workloadName}
                                                    </h4>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-tighter ${group.criticalCount > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>
                                                        {group.count} report{group.count !== 1 ? 's' : ''}
                                                    </span>
                                                    {group.criticalCount > 0 && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase tracking-tighter">
                                                            {group.criticalCount} critical
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-text-tertiary truncate font-medium">
                                                    Latest: {formatDate(group.latestReport.CreatedAt)}
                                                    {group.latestReport.Severity && (
                                                        <span className="ml-2">• Severity: {group.latestReport.Severity}</span>
                                                    )}
                                                </p>
                                            </div>

                                            <div className="hidden sm:flex items-center gap-3 shrink-0">
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${group.latestReport.Severity === 'Critical' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>
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

                                                            <div className={`p-2 rounded-lg shrink-0 ${reportIsSecurity ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : report.Severity === 'Critical' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                                                                {reportIsSecurity ? <Shield className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-bg-card text-text-tertiary border border-border-main uppercase tracking-tighter">
                                                                        {formatDate(report.CreatedAt)}
                                                                    </span>
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wider ${report.Severity === 'Critical' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>
                                                                        {report.Severity}
                                                                    </span>
                                                                    {report.IncidentType && (
                                                                        <span className="text-[10px] text-text-tertiary truncate">
                                                                            {report.IncidentType}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-text-tertiary truncate font-medium mt-1">
                                                                    {report.Analysis ? report.Analysis.replace(/[#*`]/g, '').substring(0, 100) + "..." : 'No content'}
                                                                </p>
                                                            </div>

                                                            <div className="hidden sm:flex items-center gap-3 shrink-0">
                                                                {activeUsers[`report-${report.ID}`] && activeUsers[`report-${report.ID}`].length > 0 && (
                                                                    <div className="flex -space-x-2">
                                                                        {activeUsers[`report-${report.ID}`].map((u) => (
                                                                            <img key={u.userId} src={u.avatarUrl} className="w-5 h-5 rounded-full border-2 border-bg-card shadow-sm" title={u.userName} />
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
                        <div className="text-center py-20 border-2 border-dashed border-border-main rounded-[2rem] bg-bg-card/30 flex flex-col items-center justify-center animate-fade-in group">
                            <div className="mb-6 p-6 bg-bg-hover rounded-full border border-border-main shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <FileText className="w-12 h-12 text-text-tertiary opacity-40" />
                            </div>
                            <h3 className="text-xl font-bold text-text-primary mb-2 tracking-tight">No Reports Found</h3>
                            <p className="text-sm text-text-tertiary max-w-xs mx-auto font-medium leading-relaxed">
                                No historical analysis records available in your current laboratory segment.
                            </p>
                        </div>
                    )
                }
            </section>
        </div>
    );
};
