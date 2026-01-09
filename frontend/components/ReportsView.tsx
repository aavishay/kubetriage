
import React, { useState, useEffect } from 'react';
import { FileText, Download, Clock, Shield, Search, Filter, Loader2, CheckCircle2, AlertCircle, FileCheck, Activity, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMonitoring } from '../contexts/MonitoringContext';

interface TriageReport {
    id: string;
    clusterId: string;
    workloadId: string;
    workloadName: string; // Enriched in frontend if needed, or expected from API if modified
    summary: string;
    severity: string;
    isRead: boolean;
    createdAt: string;
}

interface ReportsViewProps {
    isDarkMode?: boolean;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ isDarkMode = true }) => {
    const { user } = useAuth();
    const { selectedCluster } = useMonitoring();
    const [reports, setReports] = useState<TriageReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
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

    const filteredReports = reports.filter(r =>
        (r.summary || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.workloadName || 'Unknown').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-12 pb-20">
            {/* Hero Header */}
            <div className="bg-zinc-900 dark:bg-zinc-950 rounded-[2.5rem] p-10 md:p-14 text-white relative overflow-hidden shadow-2xl border border-zinc-800">
                <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-indigo-500/20">
                        <Shield className="w-3 h-3" /> Compliance & Audit
                    </div>
                    <h1 className="text-4xl font-black mb-4 tracking-tighter leading-tight">Reporting Center</h1>
                    <p className="text-zinc-400 text-lg mb-10 leading-relaxed font-medium">
                        Generate compliance artifacts and review historical AI triage analysis.
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={handleDownloadCompliance}
                            className="flex items-center gap-3 bg-white text-zinc-900 hover:bg-zinc-200 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg hover:scale-105 active:scale-95"
                        >
                            <Download className="w-4 h-4" /> Download SOC2 Report (PDF)
                        </button>
                    </div>
                </div>
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full -mr-48 -mt-48 blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/5 rounded-full -ml-48 -mb-48 blur-[100px]" />
            </div>

            {/* Available Reports Section */}
            <section>
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3 tracking-tighter uppercase">
                            <FileCheck className="w-6 h-6 text-emerald-500" /> Available Reports
                        </h2>
                        <p className="text-sm text-zinc-500 font-semibold mt-1">Ready-to-export compliance and operational documents</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* SOC2 Card */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 flex flex-col hover:shadow-xl transition-all group cursor-pointer" onClick={handleDownloadCompliance}>
                        <div className="p-4 rounded-2xl w-fit mb-6 bg-blue-500/10 text-blue-500">
                            <Shield className="w-7 h-7" />
                        </div>
                        <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-2 tracking-tight">SOC 2 Compliance Audit</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 flex-1 leading-relaxed font-medium">
                            Complete audit log of all sensitive user actions, authentication events, and configuration changes filtered by project.
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Ready for Download
                        </div>
                    </div>

                    {/* Workload Health Card (Placeholder for future) */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 flex flex-col hover:shadow-xl transition-all group opacity-60">
                        <div className="p-4 rounded-2xl w-fit mb-6 bg-purple-500/10 text-purple-500">
                            <Activity className="w-7 h-7" />
                        </div>
                        <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-2 tracking-tight">Cluster Health Summary</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 flex-1 leading-relaxed font-medium">
                            Monthly aggregated uptime, resource utilization, and incident frequency report.
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-400">
                            <span className="w-2 h-2 rounded-full bg-zinc-600" /> Coming Soon
                        </div>
                    </div>
                </div>
            </section>

            {/* History Section */}
            <section>
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3 tracking-tighter uppercase">
                            <Clock className="w-6 h-6 text-indigo-500" /> Analysis History
                        </h2>
                        <p className="text-sm text-zinc-500 font-semibold mt-1">Archive of AI-generated triage reports</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search reports..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors w-64"
                            />
                        </div>
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => setShowConfirm(true)}
                                disabled={isDeleting || reports.length === 0}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isDeleting || reports.length === 0 ? 'opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 text-zinc-400' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white ring-1 ring-rose-500/20'}`}
                                title="Permanently delete all reports"
                            >
                                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                Clean Archive
                            </button>
                        )}
                    </div>
                </div>

                {/* Modern Confirmation Modal */}
                {showConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200 text-left">
                            <div className="p-4 bg-rose-500/10 text-rose-500 rounded-2xl w-fit mb-6">
                                <Trash2 className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-4 tracking-tighter uppercase">Wipe Report Archive?</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 mb-8 font-medium leading-relaxed">
                                You are about to permanently delete all historical AI triage reports. This action <span className="text-rose-500 font-bold uppercase underline">cannot be undone</span>.
                            </p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-black text-xs uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
                                >
                                    Go Back
                                </button>
                                <button
                                    onClick={handleCleanArchive}
                                    className="flex-1 px-6 py-4 rounded-2xl bg-rose-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    Wipe Archive
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
                    </div>
                ) : filteredReports.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredReports.map((report) => (
                            <div key={report.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] p-6 flex items-start sm:items-center gap-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors shadow-sm hover:shadow-md">
                                <div className={`p-3 rounded-xl shrink-0 ${report.severity === 'Critical' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
                                            {report.workloadName || 'Cluster Issue'}
                                        </h4>
                                        <span className="text-[9px] px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-black uppercase tracking-wider">
                                            {formatDate(report.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium line-clamp-1">
                                        {report.summary}
                                    </p>
                                </div>
                                <div className="hidden sm:block text-right shrink-0">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${report.severity === 'Critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                                        {report.severity}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] bg-zinc-50/50 dark:bg-zinc-950/20">
                        <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                        <h3 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest mb-1">No Reports Found</h3>
                        <p className="text-xs text-zinc-400 font-bold">No historical analysis records available.</p>
                    </div>
                )}
            </section>
        </div>
    );
};
