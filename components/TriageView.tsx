
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Workload, ViewPropsWithChat, DiagnosticPlaybook } from '../types';
import { analyzeWorkloadLogs } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { Terminal, Loader2, Sparkles, Activity, Search, Clock, Globe, ChevronLeft, MessageSquareShare, ArrowRight, PanelLeftClose, PanelLeft, AlertCircle, CheckCircle2, ChevronRight, Layers, ArrowDown, Server, Zap, Globe2, WifiOff, MoreHorizontal, Info, ActivitySquare, Radio, ShieldCheck, HardDrive } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface TriageViewProps extends ViewPropsWithChat {
  initialWorkloadId?: string; // Kept for backward compatibility or direct usage if needed
  defaultTemplate?: string;
}

const TrafficPathExplorer = ({ workload }: { workload: Workload }) => {
  return (
    <div className="bg-zinc-900 rounded-[2.5rem] p-10 border border-indigo-500/20 shadow-2xl relative overflow-hidden group mb-10 transition-all hover:border-indigo-500/40">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.1),transparent)] pointer-events-none" />
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-2xl ring-1 ring-indigo-500/50"><Radio className="w-6 h-6 text-indigo-400 animate-pulse" /></div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.25em] text-indigo-400">Network Topology Analyzer</h4>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Real-time Traffic Trace: L7 Ingress</p>
            </div>
          </div>
          <div className="flex items-center gap-4 px-5 py-2.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl">
            <span className="text-[10px] font-black uppercase text-rose-500 tracking-[0.1em]">Degradation Detected: 5xx Spike</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 max-w-3xl mx-auto py-8 relative">
          <div className="absolute top-1/2 left-0 w-full h-px bg-zinc-800 -translate-y-1/2" />
          <div className="flex flex-col items-center gap-4 relative z-10"><div className="w-16 h-16 rounded-[1.5rem] bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shadow-xl"><Globe className="w-7 h-7" /></div><span className="text-[9px] font-black uppercase text-zinc-500 tracking-tighter">Public Traffic</span></div>
          <div className="flex-1 h-px bg-gradient-to-r from-zinc-800 via-indigo-500 to-zinc-800" />
          <div className="flex flex-col items-center gap-4 relative z-10"><div className="w-20 h-20 rounded-[2rem] bg-indigo-600 border-2 border-indigo-400 flex items-center justify-center text-white shadow-2xl"><Zap className="w-9 h-9" /></div><span className="text-[10px] font-black uppercase text-white tracking-widest">NGINX Ingress</span></div>
          <div className="flex-1 h-px bg-gradient-to-r from-zinc-800 via-rose-500 to-zinc-800" />
          <div className="flex flex-col items-center gap-4 relative z-10"><div className="w-16 h-16 rounded-[1.5rem] bg-zinc-800 border border-rose-500/50 flex items-center justify-center text-rose-400 animate-pulse shadow-xl"><Server className="w-7 h-7" /></div><span className="text-[9px] font-black uppercase text-rose-500 tracking-tighter">Target Backend</span></div>
        </div>
      </div>
    </div>
  );
};

export const TriageView: React.FC<TriageViewProps> = ({ workloads, isDarkMode = true, onOpenChat, defaultTemplate: propTemplate, initialWorkloadId: propId }) => {
  const location = useLocation();
  const { workloadId: stateId, playbook: stateTemplate } = location.state || {}; // Read from router state

  const targetWorkloadId = stateId || propId;
  const targetTemplate = stateTemplate || propTemplate;

  const [selectedWorkload, setSelectedWorkload] = useState<Workload | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<DiagnosticPlaybook>('General Health');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workloadSearchTerm, setWorkloadSearchTerm] = useState<string>('');

  useEffect(() => { if (targetTemplate) setSelectedPlaybook(targetTemplate as DiagnosticPlaybook); }, [targetTemplate]);

  useEffect(() => {
    if (targetWorkloadId) {
      const workload = workloads.find(w => w.id === targetWorkloadId || w.name === targetWorkloadId);
      if (workload) { setSelectedWorkload(workload); setIsSidebarOpen(false); triggerAutoAnalysis(workload, (targetTemplate as DiagnosticPlaybook) || 'General Health'); }
    }
  }, [targetWorkloadId, workloads, targetTemplate]);

  const triggerAutoAnalysis = async (workload: Workload, playbook: DiagnosticPlaybook) => {
    setIsAnalyzing(true); setAnalysis(null);
    try { const result = await analyzeWorkloadLogs(workload, playbook); setAnalysis(result); }
    catch (e) { setAnalysis("Diagnostic interrupted. Gemini API error."); }
    finally { setIsAnalyzing(false); }
  };

  const filteredWorkloads = useMemo(() => {
    return workloads.filter(w => {
      if (namespaceFilter !== 'all' && w.namespace !== namespaceFilter) return false;
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      if (workloadSearchTerm && !w.name.toLowerCase().includes(workloadSearchTerm.toLowerCase())) return false;
      return true;
    });
  }, [workloads, namespaceFilter, statusFilter, workloadSearchTerm]);

  const handleAnalyzeLogs = async () => {
    if (!selectedWorkload) return;
    setIsAnalyzing(true); setAnalysis(null);
    try { const result = await analyzeWorkloadLogs(selectedWorkload, selectedPlaybook); setAnalysis(result); }
    catch (e) { setAnalysis("Error generating analysis."); }
    finally { setIsAnalyzing(false); }
  };

  const handleDeepDive = () => {
    if (!selectedWorkload || !analysis) return;
    onOpenChat(`Workload: ${selectedWorkload.name}\nNS: ${selectedWorkload.namespace}\nReport: ${analysis}`);
  };

  const saturation = useMemo(() => {
    if (!selectedWorkload) return { cpu: 0, mem: 0, storage: 0 };
    return {
      cpu: Math.round((selectedWorkload.metrics.cpuUsage / selectedWorkload.metrics.cpuLimit) * 100),
      mem: Math.round((selectedWorkload.metrics.memoryUsage / selectedWorkload.metrics.memoryLimit) * 100),
      storage: selectedWorkload.metrics.storageLimit ? Math.round((selectedWorkload.metrics.storageUsage! / selectedWorkload.metrics.storageLimit) * 100) : 0
    };
  }, [selectedWorkload]);

  const highlightLog = (log: string) => {
    const keywords = ['504', 'timeout', 'DiskPressure', 'failed', 'No space left', 'CRITICAL', 'ERROR'];
    let highlighted = log;
    keywords.forEach(kw => {
      const regex = new RegExp(`(${kw})`, 'gi');
      highlighted = highlighted.replace(regex, '<span class="text-rose-400 font-black">$1</span>');
    });
    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[calc(100vh-160px)] relative w-full overflow-hidden font-sans">
      <aside className={`${selectedWorkload && !isSidebarOpen ? 'hidden' : 'flex'} lg:flex transition-all duration-500 flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-[2.5rem] overflow-hidden shrink-0 ${isDesktopCollapsed ? 'lg:w-24' : 'w-full lg:w-96'}`}>
        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20"><ActivitySquare className="w-5 h-5 text-white" /></div><h3 className="font-black text-zinc-900 dark:text-white uppercase tracking-tighter text-sm hidden sm:block">Fleet Triage</h3></div>
          <button onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)} className="hidden lg:flex p-2.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-2xl text-zinc-500 transition-all active:scale-90">{isDesktopCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/30 dark:bg-black/10">
          {filteredWorkloads.map(w => (
            <div key={w.id} onClick={() => { setSelectedWorkload(w); setAnalysis(null); setIsSidebarOpen(false); }} className={`group relative p-6 rounded-[2.25rem] cursor-pointer transition-all border-2 ${selectedWorkload?.id === w.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white dark:bg-zinc-900 border-transparent shadow-sm'}`}>
              <span className="text-sm font-black truncate leading-none uppercase tracking-tighter block mb-1.5">{w.name}</span>
              <div className="flex items-center justify-between mt-1"><span className={`text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-1.5 ${selectedWorkload?.id === w.id ? 'text-white/70' : 'text-indigo-500 dark:text-indigo-400'}`}><Layers className="w-3.5 h-3.5" /> {w.kind}</span><div className={`w-2.5 h-2.5 rounded-full ${w.status === 'Healthy' ? 'bg-emerald-500' : w.status === 'Warning' ? 'bg-amber-500' : 'bg-rose-500'}`} /></div>
            </div>
          ))}
        </div>
      </aside>

      <main className={`${!selectedWorkload || isSidebarOpen ? 'hidden' : 'flex'} lg:flex flex-1 min-w-0 bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-sm`}>
        {selectedWorkload ? (
          <div className="flex flex-col h-full overflow-hidden">
            <header className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 bg-zinc-50/50 dark:bg-zinc-950/50">
              <div className="flex items-center gap-6">
                <div className="p-5 bg-zinc-900 dark:bg-zinc-800 rounded-[1.75rem] shadow-2xl border border-zinc-700/50 flex items-center justify-center"><Terminal className="w-7 h-7 text-indigo-400" /></div>
                <div className="min-w-0"><h2 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase leading-none">{selectedWorkload.name}</h2><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-2">{selectedWorkload.namespace} • {selectedWorkload.kind}</p></div>
              </div>
              <div className="flex flex-wrap items-center gap-5 w-full xl:w-auto">
                <div className="flex items-center gap-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-5 py-3 rounded-2xl shadow-sm">
                  <div className="p-2 bg-indigo-500/10 rounded-xl"><ActivitySquare className="w-4.5 h-4.5 text-indigo-500" /></div>
                  <div className="flex flex-col"><span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Playbook</span><select value={selectedPlaybook} onChange={(e) => { setSelectedPlaybook(e.target.value as DiagnosticPlaybook); setAnalysis(null); }} className="bg-transparent text-[11px] font-black uppercase text-zinc-900 dark:text-white cursor-pointer pr-6"><option value="General Health">General Health</option><option value="Network Connectivity">Network Connectivity</option><option value="Resource Constraints">Resource Constraints</option></select></div>
                </div>
                <button onClick={handleAnalyzeLogs} disabled={isAnalyzing} className="flex-1 xl:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30"> {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Initialize Diagnosis</button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-zinc-50/20 dark:bg-black/20 pb-32">
              {/* Metrics Ribbon */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-7 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
                  <p className="text-[10px] font-black text-zinc-400 uppercase mb-4 tracking-widest">Availability</p>
                  <span className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter">{selectedWorkload.availableReplicas}<span className="text-lg opacity-40 ml-1">/{selectedWorkload.replicas}</span></span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-7 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
                  <p className="text-[10px] font-black text-zinc-400 uppercase mb-4 tracking-widest">CPU Pressure</p>
                  <span className={`text-4xl font-black tracking-tighter ${saturation.cpu > 90 ? 'text-rose-500' : 'text-zinc-900 dark:text-white'}`}>{saturation.cpu}%</span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-7 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
                  <p className="text-[10px] font-black text-zinc-400 uppercase mb-4 tracking-widest">RAM Pressure</p>
                  <span className={`text-4xl font-black tracking-tighter ${saturation.mem > 90 ? 'text-rose-500' : 'text-zinc-900 dark:text-white'}`}>{saturation.mem}%</span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-7 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
                  <p className="text-[10px] font-black text-zinc-400 uppercase mb-4 tracking-widest">Storage Load</p>
                  <span className={`text-4xl font-black tracking-tighter ${saturation.storage > 85 ? 'text-rose-500 animate-pulse' : 'text-amber-500'}`}>{saturation.storage}%</span>
                </div>
              </div>

              {selectedPlaybook === 'Network Connectivity' && <TrafficPathExplorer workload={selectedWorkload} />}

              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-10 items-stretch">
                <section className="bg-zinc-950 rounded-[3rem] border border-zinc-800 shadow-2xl overflow-hidden flex flex-col min-h-[500px]">
                  <div className="px-8 py-6 border-b border-zinc-800/50 bg-black/40 flex items-center gap-3"><Terminal className="w-4 h-4 text-emerald-400" /><h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Live Logs</h3></div>
                  <div className="p-8 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-3 flex-1 bg-black">
                    {selectedWorkload.recentLogs.map((log, i) => (
                      <div key={i} className="flex gap-6 group hover:bg-white/5 py-1 px-2 rounded-lg">
                        <span className="text-zinc-700 select-none text-[9px] w-8 font-black">{String(i + 1).padStart(2, '0')}</span>
                        <div className="text-zinc-400 break-all">{highlightLog(log)}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
                  <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50">
                    <div className="flex items-center gap-4"><Sparkles className="w-5 h-5 text-indigo-500" /><h3 className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-[0.15em]">SRE Intelligence Report</h3></div>
                  </div>
                  <div className="p-10 flex-1 overflow-y-auto">
                    {isAnalyzing ? <div className="h-full flex flex-col items-center justify-center text-center gap-6"><Loader2 className="w-12 h-12 text-indigo-500 animate-spin" /><h4 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Gemini SRE Analysis...</h4></div> : analysis ? <div className="animate-in fade-in slide-in-from-bottom-6 duration-700"><div className="prose prose-indigo max-w-none dark:prose-invert"><ReactMarkdown components={{ code({ node, inline, className, children, ...props }: any) { const match = /language-(\w+)/.exec(className || ''); return !inline && match ? <div className="my-6 rounded-2xl overflow-hidden shadow-2xl"><SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" customStyle={{ margin: 0, padding: '2rem' }} {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter></div> : <code className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg font-mono text-xs font-black" {...props}>{children}</code>; } }}>{analysis}</ReactMarkdown></div><div className="mt-10 pt-10 border-t border-zinc-100 dark:border-zinc-800 flex justify-center"><button onClick={handleDeepDive} className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl hover:scale-[1.03] transition-all">Initialize Copilot Deep Dive <MessageSquareShare className="w-4 h-4 ml-2 inline" /></button></div></div> : <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30 grayscale"><Info className="w-16 h-16 text-zinc-400 mb-6" /><p className="text-xs font-black uppercase text-zinc-500 tracking-[0.3em]">Awaiting SRE Diagnostic Input</p></div>}
                  </div>
                </section>
              </div>

              {/* Events Timeline */}
              <section className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center gap-3"><AlertCircle className="w-5 h-5 text-amber-500" /><h3 className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-[0.15em]">Control Plane Events</h3></div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {selectedWorkload.events.map(event => (
                    <div key={event.id} className="p-7 flex items-center gap-8 group hover:bg-zinc-50 dark:hover:bg-zinc-950/50 transition-colors">
                      <div className={`p-3 rounded-2xl shrink-0 ${event.type === 'Warning' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>{event.type === 'Warning' ? <AlertCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}</div>
                      <div className="flex-1 min-w-0"><div className="flex items-center gap-4 mb-1.5"><span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tighter">{event.reason}</span><span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{event.lastSeen}</span></div><p className="text-sm text-zinc-500 dark:text-zinc-400 font-bold leading-relaxed truncate">{event.message}</p></div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center h-full"><ActivitySquare className="w-12 h-12 text-indigo-500 mb-8 animate-bounce" /><h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter mb-4 uppercase">Select Target Workspace</h3><p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm font-semibold leading-relaxed">Pick a service from the triage queue on the left to initialize a high-fidelity diagnostic session.</p></div>
        )}
      </main>
    </div>
  );
};
