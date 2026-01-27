
import React, { useState, useEffect } from 'react';
import { FileText, Download, Clock, Shield, Search, Filter, Loader2, CheckCircle2, AlertCircle, FileCheck, Activity, Trash2, MessageSquare, Ticket, Share2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMonitoring } from '../contexts/MonitoringContext';
import { usePresence } from '../contexts/PresenceContext';

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
    const { user } = useAuth();
    const { selectedCluster } = useMonitoring();
    const { activeUsers, notifyView, notifyLeave } = usePresence();
    const [reports, setReports] = useState<TriageReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<TriageReport | null>(null); // For Modal
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

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
        <div className="space-y-12 pb-20 font-sans custom-scrollbar h-full overflow-y-auto px-4">
            {/* Hero Header */}
            <div className="relative rounded-[3rem] p-10 md:p-14 overflow-hidden shadow-2xl border border-white/5 group">
                {/* Dynamic Background */}
                <div className="absolute inset-0 bg-dark-card/80 backdrop-blur-xl z-0"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-black/50 to-indigo-900/20 z-0"></div>

                {/* Animated Orbs */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/10 rounded-full -mr-48 -mt-48 blur-[120px] animate-pulse pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full -ml-48 -mb-48 blur-[100px] pointer-events-none" />

                <div className="relative z-10 max-w-3xl">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                        <Shield className="w-3.5 h-3.5" /> Compliance & Neural Audit
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tight leading-none text-white font-display uppercase drop-shadow-xl">
                        Reporting Center
                    </h1>
                    <p className="text-zinc-400 text-lg mb-10 leading-relaxed font-light tracking-wide max-w-2xl border-l-2 border-primary-500 pl-6">
                        Generate compliance artifacts and review historical AI triage correlations. Access your SOC 2 audit logs and past incident analyses.
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={handleDownloadCompliance}
                            className="flex items-center gap-3 bg-white text-black hover:bg-zinc-200 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] hover:-translate-y-1 active:scale-95 active:translate-y-0"
                        >
                            <Download className="w-4 h-4" /> Download SOC2 Report
                        </button>
                    </div>
                </div>
            </div>

            {/* Available Reports Section */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3 tracking-wide font-display uppercase">
                            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg shadow-emerald-500/20">
                                <FileCheck className="w-5 h-5 text-white" />
                            </div>
                            Available Artifacts
                        </h2>
                        <p className="text-sm text-zinc-500 font-medium mt-2 pl-12">Ready-to-export compliance documents</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* SOC2 Card */}
                    <div className="bg-dark-card/50 backdrop-blur-md border border-white/5 rounded-[2rem] p-8 flex flex-col hover:border-primary-500/30 hover:bg-white/5 transition-all cursor-pointer group relative overflow-hidden" onClick={handleDownloadCompliance}>
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                        <div className="relative z-10">
                            <div className="p-4 rounded-2xl w-fit mb-6 bg-primary-500/10 text-primary-400 border border-primary-500/20 group-hover:scale-110 transition-transform duration-500">
                                <Shield className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-3 tracking-wide font-display uppercase">SOC 2 Compliance Audit</h3>
                            <p className="text-sm text-zinc-400 mb-8 flex-1 leading-relaxed font-light">
                                Complete audit log of all sensitive user actions, authentication events, and configuration changes filtered by project scope.
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-emerald-400 tracking-widest">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_currentColor] animate-pulse" /> Ready for Download
                            </div>
                        </div>
                    </div>

                    {/* Workload Health Card */}
                    <div className="bg-dark-card/30 backdrop-blur-sm border border-white/5 rounded-[2rem] p-8 flex flex-col opacity-75 hover:opacity-100 transition-all group relative overflow-hidden grayscale hover:grayscale-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative z-10">
                            <div className="p-4 rounded-2xl w-fit mb-6 bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                <Activity className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-3 tracking-wide font-display uppercase">Cluster Health Summary</h3>
                            <p className="text-sm text-zinc-400 mb-8 flex-1 leading-relaxed font-light">
                                Monthly aggregated uptime, resource utilization signals, and incident frequency matrices.
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-zinc-500 tracking-widest">
                                <span className="w-2 h-2 rounded-full bg-zinc-600" /> Coming Soon
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* History Section */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3 tracking-wide font-display uppercase">
                            <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg shadow-lg shadow-indigo-500/20">
                                <Clock className="w-5 h-5 text-white" />
                            </div>
                            Neural Analysis History
                        </h2>
                        <p className="text-sm text-zinc-500 font-medium mt-2 pl-12">Archive of AI-generated triage reports</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="w-4 h-4 text-zinc-500 group-focus-within:text-white absolute left-4 top-1/2 -translate-y-1/2 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search archives..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all w-64 placeholder:text-zinc-600 hover:bg-black/30"
                            />
                        </div>
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => setShowConfirm(true)}
                                disabled={isDeleting || reports.length === 0}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-transparent ${isDeleting || reports.length === 0 ? 'opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-500' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white hover:shadow-[0_0_20px_rgba(244,63,94,0.3)] border-rose-500/20'}`}
                                title="Permanently delete all reports"
                            >
                                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                Clean Archive
                            </button>
                        )}
                    </div>
                </div>

                {/* Modern Confirmation Modal */}
                {showConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-zinc-900 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200 text-left relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent"></div>

                            <div className="p-4 bg-rose-500/10 text-rose-500 rounded-2xl w-fit mb-6 border border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
                                <Trash2 className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-4 tracking-wide font-display uppercase">Wipe Report Archive?</h3>
                            <p className="text-zinc-400 mb-8 font-medium leading-relaxed border-l-2 border-rose-500/30 pl-4">
                                You are about to permanently delete all historical AI triage reports. This action <span className="text-rose-500 font-bold uppercase">cannot be undone</span>.
                            </p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 px-6 py-4 rounded-xl bg-zinc-800 text-zinc-300 font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-all border border-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCleanArchive}
                                    className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:shadow-rose-600/40 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    Wipe Archive
                                </button>
                            </div>
                        </div>
                    </div>

                )
                }

                {/* Detail View Modal */}
                {
                    selectedReport && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg animate-in fade-in duration-200" onClick={() => { notifyLeave(`report-${selectedReport.ID}`); setSelectedReport(null); }}>
                            <div className="bg-dark-bg/95 backdrop-blur-2xl rounded-[2rem] w-full max-w-4xl h-[85vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between p-8 border-b border-white/5 bg-white/5">
                                    <div className="flex-1">
                                        <h3 className="text-2xl font-black text-white tracking-wide font-display uppercase mb-3 flex items-center gap-3">
                                            {selectedReport.WorkloadName} <span className="text-zinc-500 font-light">Analysis</span>
                                        </h3>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${selectedReport.Severity === 'Critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                                                {selectedReport.Severity} Severity
                                            </span>
                                            <span className="text-xs text-zinc-500 font-mono">{formatDate(selectedReport.CreatedAt)}</span>

                                            {/* Presence Indicators in Header */}
                                            {activeUsers[`report-${selectedReport.ID}`] && activeUsers[`report-${selectedReport.ID}`].length > 0 && (
                                                <div className="flex items-center gap-1 ml-4 border-l border-white/10 pl-4">
                                                    <span className="text-[9px] uppercase tracking-widest text-zinc-500 mr-2">Viewing:</span>
                                                    <div className="flex -space-x-2">
                                                        {activeUsers[`report-${selectedReport.ID}`].map((u) => (
                                                            <img key={u.userId} src={u.avatarUrl} alt={u.userName} title={u.userName} className="w-6 h-6 rounded-full border border-black" />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={() => { notifyLeave(`report-${selectedReport.ID}`); setSelectedReport(null); }} className="p-3 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-10 prose prose-invert max-w-none prose-headings:font-display prose-headings:uppercase prose-headings:tracking-wide custom-scrollbar prose-a:text-primary-400 prose-code:bg-black/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-primary-300">
                                    <ReactMarkdown>{selectedReport.Analysis}</ReactMarkdown>

                                    {selectedReport.AutoRemediationPayload && selectedReport.ApprovalStatus === 'Pending' && (
                                        <div className="mt-8 p-6 bg-primary-500/10 border border-primary-500/30 rounded-3xl">
                                            <h4 className="text-lg font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Shield className="w-5 h-5 text-primary-400" /> Auto-Fix Available
                                            </h4>
                                            <p className="text-sm text-gray-300 mb-4">
                                                The AI has generated a patch to resolve this issue. Please review and approve.
                                            </p>
                                            <div className="bg-black/50 p-4 rounded-xl font-mono text-xs text-gray-300 overflow-x-auto mb-6 border border-white/5">
                                                <pre>{selectedReport.AutoRemediationPayload}</pre>
                                            </div>
                                            <div className="flex gap-4">
                                                <button onClick={() => handleApprove(selectedReport)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4" /> Approve & Apply
                                                </button>
                                                <button onClick={() => handleReject(selectedReport)} className="bg-white/5 hover:bg-white/10 text-gray-300 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {selectedReport.ApprovalStatus === 'Approved' && (
                                        <div className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 font-bold text-sm">
                                            <CheckCircle2 className="w-5 h-5" /> Auto-Fix Applied successfully.
                                        </div>
                                    )}
                                </div>
                                <div className="p-6 border-t border-white/5 bg-black/40 flex justify-between items-center">
                                    <div className="text-xs text-zinc-500 font-mono">
                                        RID: {selectedReport.ID} • CLUSTER: {selectedReport.ClusterID}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleExport(selectedReport, 'slack')}
                                            className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-500/20"
                                            title="Export to Slack"
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" /> Slack
                                        </button>
                                        <button
                                            onClick={() => handleExport(selectedReport, 'jira')}
                                            className="flex items-center gap-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-blue-500/20"
                                            title="Create Jira Ticket"
                                        >
                                            <Ticket className="w-3.5 h-3.5" /> Jira
                                        </button>
                                        <div className="w-px h-6 bg-white/10 mx-2" />
                                        <button onClick={() => setSelectedReport(null)} className="bg-white text-black hover:bg-zinc-200 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">Close Report</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    isLoading ? (
                        <div className="flex justify-center py-20">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary-500 blur-xl opacity-20 animate-pulse"></div>
                                <Loader2 className="w-10 h-10 animate-spin text-primary-500 relative z-10" />
                            </div>
                        </div>
                    ) : filteredReports.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredReports.map((report) => {
                                const isSecurity = (report.IncidentType && (report.IncidentType.includes('Privileged') || report.IncidentType.includes('Root') || report.IncidentType.includes('Security'))) || (report.Analysis || '').includes('Security Violation');
                                return (
                                    <div key={report.ID} onClick={() => { setSelectedReport(report); notifyView(`report-${report.ID}`); }} className={`bg-dark-card/40 backdrop-blur-sm border rounded-3xl p-6 flex items-start sm:items-center gap-6 transition-all shadow-sm hover:shadow-[0_0_30px_rgba(0,0,0,0.3)] cursor-pointer group relative overflow-hidden ${isSecurity ? 'border-rose-500/30 hover:bg-rose-500/5' : 'border-white/5 hover:bg-white/5 hover:border-primary-500/30'}`}>
                                        <div className={`absolute inset-y-0 left-0 w-1 scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-bottom ${isSecurity ? 'bg-rose-500' : 'bg-primary-500'}`}></div>

                                        <div className={`p-3 rounded-2xl shrink-0 border transition-colors ${isSecurity ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : report.Severity === 'Critical' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 group-hover:bg-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20 group-hover:bg-amber-500/20'}`}>
                                            {isSecurity ? <Shield className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1.5">
                                                <h4 className="text-sm font-bold text-white tracking-wide group-hover:text-primary-400 transition-colors">
                                                    {report.WorkloadName || 'Cluster Issue'}
                                                </h4>
                                                <span className="text-[9px] px-2 py-0.5 rounded-full border border-white/10 bg-black/20 text-zinc-500 font-mono">
                                                    {formatDate(report.CreatedAt)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-400 font-medium line-clamp-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                {report.Analysis ? report.Analysis.substring(0, 150) + "..." : 'No content'}
                                            </p>
                                        </div>
                                        <div className="hidden sm:block text-right shrink-0">
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${report.Severity === 'Critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                {report.Severity}
                                            </span>

                                            {/* Avatar Stack on Card */}
                                            {activeUsers[`report-${report.ID}`] && activeUsers[`report-${report.ID}`].length > 0 && (
                                                <div className="flex -space-x-2 justify-end mt-2">
                                                    {activeUsers[`report-${report.ID}`].map((u) => (
                                                        <img key={u.userId} src={u.avatarUrl} className="w-5 h-5 rounded-full border border-black" title={u.userName} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-24 border border-dashed border-white/10 rounded-[3rem] bg-black/20 flex flex-col items-center justify-center group hover:bg-black/30 transition-colors">
                            <div className="mb-6 p-6 bg-zinc-900 rounded-full border border-white/5 group-hover:scale-110 transition-transform duration-500 shadow-2xl">
                                <FileText className="w-10 h-10 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                            </div>
                            <h3 className="text-white font-black uppercase tracking-widest mb-2 font-display text-lg">No Archives Found</h3>
                            <p className="text-xs text-zinc-500 font-medium max-w-xs mx-auto leading-relaxed">
                                No historical analysis records are currently available in the neural database.
                            </p>
                        </div>
                    )
                }
            </section >
        </div >
    );
};
