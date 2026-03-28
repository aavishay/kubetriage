
import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Clock, Shield, Search, Filter, Loader2, CheckCircle2, AlertCircle, FileCheck, Activity, Trash2, MessageSquare, Ticket, Share2 } from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';
import { usePresence } from '../contexts/PresenceContext';
import { useEscapeKey } from '../utils/useEscapeKey';

// Backend uses PascalCase by default for struct fields without json tags
interface TriageReport {
    ID: number;
    ClusterID: string;
    WorkloadName: string;
    Analysis: string; // The full markdown content
    Severity: string;
    IsRead: boolean;
    CreatedAt: string;
    AutoRemediationPayload?: string;
    ApprovalStatus?: string;
    IncidentType?: string;
}

import ReactMarkdown from 'react-markdown';

interface ReportsViewProps {
    isDarkMode?: boolean;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ isDarkMode = true }) => {
    const { selectedCluster } = useMonitoring();
    const { activeUsers, notifyView, notifyLeave } = usePresence();
    const [reports, setReports] = useState<TriageReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<TriageReport | null>(null); // For Modal
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

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

    return (
        <div className="space-y-8 pb-20 h-full overflow-y-auto custom-scrollbar">
            {/* Hero Header */}
            <div className="bg-dark-card border border-white/10 rounded-xl p-6 md:p-8">
                <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-medium mb-4">
                        <Shield className="w-3.5 h-3.5" /> Compliance & Audit
                    </div>
                    <h1 className="text-2xl font-semibold text-white mb-2">
                        Reporting Center
                    </h1>
                    <p className="text-sm text-zinc-500 mb-6">
                        Generate compliance artifacts and review historical AI triage reports.
                    </p>

                    <button
                        onClick={handleDownloadCompliance}
                        className="inline-flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
                    >
                        <Download className="w-4 h-4" /> Download SOC2 Report
                    </button>
                </div>
            </div>

            {/* Available Reports Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-lg font-medium text-white">Available Reports</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* SOC2 Card */}
                    <div className="bg-dark-card border border-white/10 rounded-xl p-6 flex flex-col hover:border-primary-500/30 transition-colors cursor-pointer group" onClick={handleDownloadCompliance}>
                        <div className="p-3 rounded-lg w-fit mb-4 bg-primary-500/10 text-primary-400">
                            <Shield className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">SOC 2 Compliance Audit</h3>
                        <p className="text-sm text-zinc-500 mb-4 flex-1">
                            Complete audit log of user actions, authentication events, and configuration changes.
                        </p>
                        <div className="flex items-center gap-2 text-xs text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ready for Download
                        </div>
                    </div>

                    {/* Workload Health Card */}
                    <div className="bg-dark-card border border-white/10 rounded-xl p-6 flex flex-col opacity-60">
                        <div className="p-3 rounded-lg w-fit mb-4 bg-purple-500/10 text-purple-400">
                            <Activity className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">Cluster Health Summary</h3>
                        <p className="text-sm text-zinc-500 mb-4 flex-1">
                            Monthly aggregated uptime, resource utilization, and incident frequency.
                        </p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> Coming Soon
                        </div>
                    </div>
                </div>
            </section>

            {/* History Section */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-lg font-medium text-white">Analysis History</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search reports..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-dark-bg border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500/50 transition-colors w-56 placeholder:text-zinc-600"
                            />
                        </div>
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={isDeleting || reports.length === 0}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${isDeleting || reports.length === 0 ? 'opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-500' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white'}`}
                            title="Delete all reports"
                        >
                            {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Clean
                        </button>
                    </div>
                </div>

                {/* Confirmation Modal */}
                {showConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-dark-card rounded-xl p-6 max-w-sm w-full border border-white/10 shadow-xl">
                            <div className="p-3 bg-rose-500/10 text-rose-500 rounded-lg w-fit mb-4">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Delete All Reports?</h3>
                            <p className="text-sm text-zinc-500 mb-6">
                                This will permanently delete all historical reports. This action <span className="text-rose-500 font-medium">cannot be undone</span>.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCleanArchive}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-500 transition-colors"
                                >
                                    Delete All
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detail View Modal */}
                {selectedReport && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => { notifyLeave(`report-${selectedReport.ID}`); setSelectedReport(null); }}>
                        <div className="bg-dark-card rounded-xl w-full max-w-3xl h-[80vh] flex flex-col border border-white/10 shadow-xl" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-5 border-b border-white/5">
                                <div className="flex-1">
                                    <h3 className="text-lg font-medium text-white mb-1">
                                        {selectedReport.WorkloadName}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedReport.Severity === 'Critical' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                            {selectedReport.Severity}
                                        </span>
                                        <span className="text-xs text-zinc-500">{formatDate(selectedReport.CreatedAt)}</span>

                                        {activeUsers[`report-${selectedReport.ID}`] && activeUsers[`report-${selectedReport.ID}`].length > 0 && (
                                            <div className="flex items-center gap-1 ml-3 border-l border-white/10 pl-3">
                                                <span className="text-xs text-zinc-500">Viewing:</span>
                                                <div className="flex -space-x-1.5">
                                                    {activeUsers[`report-${selectedReport.ID}`].map((u) => (
                                                        <img key={u.userId} src={u.avatarUrl} alt={u.userName} title={u.userName} className="w-5 h-5 rounded-full border border-dark-card" />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => { notifyLeave(`report-${selectedReport.ID}`); setSelectedReport(null); }} className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                                    <CheckCircle2 className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 prose prose-invert max-w-none prose-a:text-primary-400 custom-scrollbar">
                                <ReactMarkdown>{selectedReport.Analysis}</ReactMarkdown>

                                {selectedReport.AutoRemediationPayload && selectedReport.ApprovalStatus === 'Pending' && (
                                    <div className="mt-6 p-4 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                                        <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-primary-400" /> Auto-Fix Available
                                        </h4>
                                        <p className="text-sm text-zinc-400 mb-3">
                                            The AI has generated a patch to resolve this issue.
                                        </p>
                                        <div className="bg-dark-bg p-3 rounded-lg font-mono text-xs text-zinc-300 overflow-x-auto mb-4 border border-white/5">
                                            <pre>{selectedReport.AutoRemediationPayload}</pre>
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={() => handleApprove(selectedReport)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
                                                <CheckCircle2 className="w-4 h-4" /> Approve & Apply
                                            </button>
                                            <button onClick={() => handleReject(selectedReport)} className="bg-white/5 hover:bg-white/10 text-zinc-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {selectedReport.ApprovalStatus === 'Approved' && (
                                    <div className="mt-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-sm">
                                        <CheckCircle2 className="w-4 h-4" /> Auto-fix applied successfully.
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-white/5 flex justify-between items-center">
                                <div className="text-xs text-zinc-500 font-mono">
                                    ID: {selectedReport.ID} • Cluster: {selectedReport.ClusterID}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleExport(selectedReport, 'slack')}
                                        className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" /> Slack
                                    </button>
                                    <button
                                        onClick={() => handleExport(selectedReport, 'jira')}
                                        className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        <Ticket className="w-3.5 h-3.5" /> Jira
                                    </button>
                                    <button onClick={() => setSelectedReport(null)} className="bg-white text-black hover:bg-zinc-200 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ml-2">Close</button>
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
                    ) : filteredReports.length > 0 ? (
                        <div className="space-y-2">
                            {filteredReports.map((report) => {
                                const isSecurity = (report.IncidentType && (report.IncidentType.includes('Privileged') || report.IncidentType.includes('Root') || report.IncidentType.includes('Security'))) || (report.Analysis || '').includes('Security Violation');
                                return (
                                    <div key={report.ID} onClick={() => { setSelectedReport(report); notifyView(`report-${report.ID}`); }} className={`bg-dark-card border rounded-lg p-4 flex items-center gap-4 transition-all cursor-pointer group hover:bg-white/5 ${isSecurity ? 'border-rose-500/30' : 'border-white/10 hover:border-primary-500/30'}`}>
                                        <div className={`p-2.5 rounded-lg shrink-0 ${isSecurity ? 'bg-rose-500/10 text-rose-500' : report.Severity === 'Critical' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                            {isSecurity ? <Shield className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-sm font-medium text-white truncate">
                                                    {report.WorkloadName || 'Cluster Issue'}
                                                </h4>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500">
                                                    {formatDate(report.CreatedAt)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-500 truncate">
                                                {report.Analysis ? report.Analysis.substring(0, 120) + "..." : 'No content'}
                                            </p>
                                        </div>
                                        <div className="hidden sm:flex items-center gap-3 shrink-0">
                                            <span className={`text-[10px] px-2 py-1 rounded border ${report.Severity === 'Critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                {report.Severity}
                                            </span>

                                            {activeUsers[`report-${report.ID}`] && activeUsers[`report-${report.ID}`].length > 0 && (
                                                <div className="flex -space-x-1.5">
                                                    {activeUsers[`report-${report.ID}`].map((u) => (
                                                        <img key={u.userId} src={u.avatarUrl} className="w-5 h-5 rounded-full border border-dark-card" title={u.userName} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 border border-dashed border-white/10 rounded-xl bg-dark-card/50 flex flex-col items-center justify-center">
                            <div className="mb-4 p-4 bg-zinc-900 rounded-full border border-white/5">
                                <FileText className="w-8 h-8 text-zinc-600" />
                            </div>
                            <h3 className="text-white font-medium mb-1">No Reports Found</h3>
                            <p className="text-sm text-zinc-500">
                                No historical analysis records available.
                            </p>
                        </div>
                    )
                }
            </section>
        </div>
    );
};
