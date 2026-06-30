import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Workload, TriageReport, ViewPropsWithChat, DiagnosticPlaybook, getMetricStatusColor } from '../types';
import { useMonitoring } from '../contexts/MonitoringContext';
import { usePresence } from '../contexts/PresenceContext';
import { analyzeWorkload } from '../services/geminiService';
import { generateRemediation, applyRemediation } from '../services/remediationService';
import ReactMarkdown from 'react-markdown';
import { Terminal, Loader2, Sparkles, Activity, Search, Globe, ChevronLeft, MessageSquareShare, PanelLeftClose, PanelLeft, AlertCircle, CheckCircle2, Zap, Info, ShieldCheck, HardDrive, WrapText, Bot, Copy, Check, FileCheck, Hash, Share2, TrendingDown, Radio, X } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { MetricsChart } from './MetricsChart';
import { LogStreamViewer } from './LogStreamViewer';
import { CommentsThread } from './CommentsThread';
import { StatusBadge } from './dashboard/StatusBadge';

interface TriageViewProps extends ViewPropsWithChat {
  initialWorkloadId?: string;
  defaultTemplate?: string;
}

const CopyButton = ({ text, className = "" }: { text: string, className?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-sm hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const CodeBlock = ({ language, children, className = "" }: { language: string, children: React.ReactNode, className?: string }) => {
  const [isWrapped, setIsWrapped] = useState(false);
  const code = String(children).replace(/\n$/, '');
  return (
    <div className={`${className} overflow-hidden relative group kt-panel-inset`}>
      <div className="absolute right-3 top-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={() => setIsWrapped(!isWrapped)}
          className={`p-1.5 rounded-sm border text-xs transition-all ${
            isWrapped ? 'bg-primary-500/20 text-primary-500 border-primary-500/30' : 'bg-bg-card text-text-tertiary hover:text-text-primary border-border-main'
          }`}
          title={isWrapped ? "Disable Wrapping" : "Enable Wrapping"}
        >
          <WrapText className="w-3.5 h-3.5" />
        </button>
        <CopyButton text={code} className="bg-bg-card border border-border-main" />
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        wrapLongLines={isWrapped}
        customStyle={{ margin: 0, padding: '1.25rem', fontSize: '12px', lineHeight: '1.6', background: 'transparent' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

const TrafficPathExplorer = ({ workload }: { workload: Workload }) => {
  return (
    <div className="kt-panel p-4 mb-4 overflow-hidden">
      <div className="kt-panel-header mb-4 -mx-4 -mt-4">
        <span>Network Path Trace</span>
        <span className="kt-badge kt-badge-danger">Degradation Detected</span>
      </div>
      <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto py-4 relative z-10">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 bg-bg-main border border-border-main flex items-center justify-center text-text-tertiary">
            <Globe className="w-6 h-6" />
          </div>
          <span className="text-[10px] text-text-tertiary font-sans font-medium">Ingress</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent"></div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 bg-primary-600 flex items-center justify-center text-white kt-amber-glow">
            <Zap className="w-7 h-7" />
          </div>
          <span className="text-xs font-sans font-bold text-text-primary">Gateway</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-danger/50 to-transparent"></div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 bg-bg-main border border-danger/30 flex items-center justify-center text-danger">
            <Terminal className="w-6 h-6" />
          </div>
          <span className="text-[10px] text-danger font-sans">Backend</span>
        </div>
      </div>
    </div>
  );
};

export const TriageView: React.FC<TriageViewProps> = ({ workloads, isDarkMode = true, onOpenChat, defaultTemplate: propTemplate, initialWorkloadId: propId }) => {
  const location = useLocation();
  const searchParams = new URL(window.location.href).searchParams;
  const urlWorkload = searchParams.get('workload');
  const urlPlaybook = searchParams.get('playbook');
  const { activeUsers, notifyView, notifyLeave, broadcastLogState, logStateEvents } = usePresence();
  const targetWorkloadId = urlWorkload || location.state?.workloadId || propId;
  const targetTemplate = urlPlaybook || location.state?.playbook || propTemplate;
  const [selectedWorkload, setSelectedWorkload] = useState<Workload | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [currentReport, setCurrentReport] = useState<TriageReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { aiConfig, selectedCluster } = useMonitoring();
  const [selectedPlaybook, setSelectedPlaybook] = useState<DiagnosticPlaybook>((targetTemplate as DiagnosticPlaybook) || 'General Health');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('ui_sidebar_open');
    return saved !== null ? JSON.parse(saved) : true;
  });
  useEffect(() => { localStorage.setItem('ui_sidebar_open', JSON.stringify(isSidebarOpen)); }, [isSidebarOpen]);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workloadSearchTerm, setWorkloadSearchTerm] = useState<string>('');
  const [logSearchTerm, setLogSearchTerm] = useState<string>('');
  const [isLogWrapEnabled, setIsLogWrapEnabled] = useState(false);
  const [isLogSyncEnabled, setIsLogSyncEnabled] = useState(false);

  useEffect(() => {
    if (!selectedWorkload || !isLogSyncEnabled) return;
    const event = logStateEvents[`workload-${selectedWorkload.id}`];
    if (event?.payload) {
      if (event.payload.searchTerm !== logSearchTerm) setLogSearchTerm(event.payload.searchTerm);
      if (event.payload.isWrapEnabled !== isLogWrapEnabled) setIsLogWrapEnabled(event.payload.isWrapEnabled);
    }
  }, [logStateEvents, selectedWorkload, isLogSyncEnabled]);

  const handleLogSearchChange = (val: string) => {
    setLogSearchTerm(val);
    if (selectedWorkload && isLogSyncEnabled) {
      broadcastLogState(`workload-${selectedWorkload.id}`, { searchTerm: val, isWrapEnabled: isLogWrapEnabled });
    }
  };
  const handleLogWrapToggle = () => {
    const newVal = !isLogWrapEnabled;
    setIsLogWrapEnabled(newVal);
    if (selectedWorkload && isLogSyncEnabled) {
      broadcastLogState(`workload-${selectedWorkload.id}`, { searchTerm: logSearchTerm, isWrapEnabled: newVal });
    }
  };
  const handleHandover = () => {
    if (!selectedWorkload || !analysis) return;
    const summary = `
🚨 **INCIDENT HANDOVER: ${selectedWorkload.name}**
**Severity**: ${selectedWorkload.status === 'Critical' ? 'CRITICAL' : 'WARNING'}
**Target**: \`${selectedWorkload.namespace}/${selectedWorkload.kind}/${selectedWorkload.name}\`
**Time**: ${new Date().toLocaleString()}

🔍 **AI Summary**:
> ${analysis.split('\n').find(l => l.length > 50) || 'See full report.'}

🔗 **Triage Console**: ${window.location.origin}/triage?workload=${selectedWorkload.name}
    `.trim();
    navigator.clipboard.writeText(summary);
    alert("Incident Summary copied to clipboard!");
  };

  const [patchSuggestion, setPatchSuggestion] = useState<import('../services/remediationService').PatchSuggestion | null>(null);
  const [isGeneratingFix, setIsGeneratingFix] = useState(false);
  const [isApplyingFix, setIsApplyingFix] = useState(false);
  const [fixStatus, setFixStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [enrichedContext, setEnrichedContext] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedWorkload) params.set('workload', selectedWorkload.name);
    if (selectedPlaybook) params.set('playbook', selectedPlaybook);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [selectedWorkload, selectedPlaybook]);

  const selectedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedWorkload && selectedRef.current) selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedWorkload]);

  useEffect(() => {
    if (selectedWorkload && selectedPlaybook && !analysis && !isAnalyzing) {
      const cacheKey = `analysis_${selectedWorkload.id}_${selectedPlaybook}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) setAnalysis(cached);
    }
  }, [selectedWorkload, selectedPlaybook]);

  useEffect(() => {
    if (selectedWorkload) {
      fetch(`/api/reports?all=true&workloadName=${encodeURIComponent(selectedWorkload.name)}`)
        .then(res => res.json())
        .then(data => { if (data && data.length > 0) setCurrentReport(data[0]); else setCurrentReport(null); })
        .catch(err => { console.error("Failed to fetch workload report", err); setCurrentReport(null); });
    } else setCurrentReport(null);
  }, [selectedWorkload, analysis]);

  const safeWorkloads = workloads || [];

  useEffect(() => {
    if (targetWorkloadId) {
      const workload = safeWorkloads.find(w => w.id === targetWorkloadId || w.name === targetWorkloadId);
      if (workload) {
        if (selectedWorkload?.id !== workload.id) {
          if (selectedWorkload) notifyLeave(`workload-${selectedWorkload.id}`);
          setSelectedWorkload(workload);
          notifyView(`workload-${workload.id}`);
          setIsSidebarOpen(false);
          const cacheKey = `analysis_${workload.id}_${selectedPlaybook}`;
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) { setAnalysis(cached); }
          else {
            fetch(`/api/reports?all=true&workloadName=${encodeURIComponent(workload.name)}`)
              .then(res => res.json())
              .then(data => {
                if (data && data.length > 0 && data[0].Analysis && data[0].Analysis !== "No analysis generated.") {
                  setAnalysis(data[0].Analysis);
                  setCurrentReport(data[0]);
                  sessionStorage.setItem(cacheKey, data[0].Analysis);
                } else triggerAutoAnalysis(workload, selectedPlaybook);
              })
              .catch(() => triggerAutoAnalysis(workload, selectedPlaybook));
          }
        } else if (selectedWorkload !== workload) setSelectedWorkload(workload);
      }
    }
  }, [targetWorkloadId, safeWorkloads, targetTemplate]);

  useEffect(() => { return () => { if (selectedWorkload) notifyLeave(`workload-${selectedWorkload.id}`); }; }, [selectedWorkload]);
  useEffect(() => {
    if (selectedWorkload && !safeWorkloads.some(w => w.id === selectedWorkload.id)) {
      setSelectedWorkload(null); setAnalysis(null);
    }
  }, [workloads, selectedWorkload]);

  const triggerAutoAnalysis = async (workload: Workload, playbook: DiagnosticPlaybook) => {
    setIsAnalyzing(true); setAnalysis(null);
    try {
      const { analysis, context } = await analyzeWorkload(workload, playbook, aiConfig.provider, aiConfig.model);
      setAnalysis(analysis); setEnrichedContext(context);
      sessionStorage.setItem(`analysis_${workload.id}_${playbook}`, analysis);
      if (context) sessionStorage.setItem(`context_${workload.id}_${playbook}`, JSON.stringify(context));
    } catch (e) { setAnalysis("Diagnostic interrupted. API error."); } finally { setIsAnalyzing(false); }
  };

  const filteredWorkloads = useMemo(() => {
    return (workloads || []).filter(w => {
      if (namespaceFilter !== 'all' && w.namespace !== namespaceFilter) return false;
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      if (workloadSearchTerm && !w.name.toLowerCase().includes(workloadSearchTerm.toLowerCase())) return false;
      return true;
    });
  }, [workloads, namespaceFilter, statusFilter, workloadSearchTerm]);

  const [customPlaybooks, setCustomPlaybooks] = useState<import('../types').Playbook[]>([]);
  const [cpuMetrics, setCpuMetrics] = useState<{ timestamp: number, value: number }[]>([]);
  const [memMetrics, setMemMetrics] = useState<{ timestamp: number, value: number }[]>([]);

  useEffect(() => {
    if (!selectedWorkload) return;
    const fetchMetrics = async () => {
      try {
        const clusterId = selectedWorkload.clusterId;
        const [cpuRes, memRes] = await Promise.all([
          fetch(`/api/cluster/metrics?cluster=${clusterId}&metric=cpu&workload=${selectedWorkload.name}&namespace=${selectedWorkload.namespace}&duration=1h`),
          fetch(`/api/cluster/metrics?cluster=${clusterId}&metric=memory&workload=${selectedWorkload.name}&namespace=${selectedWorkload.namespace}&duration=1h`)
        ]);
        if (cpuRes.ok) setCpuMetrics(await cpuRes.json());
        if (memRes.ok) setMemMetrics(await memRes.json());
      } catch (e) { console.error("Failed to fetch metrics", e); }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [selectedWorkload]);

  useEffect(() => {
    const fetchPlaybooks = async () => {
      try {
        const response = await fetch('/api/playbooks');
        if (response.ok) { const data = await response.json(); setCustomPlaybooks(data); }
      } catch (err) { console.error("Failed to fetch custom playbooks", err); }
    };
    fetchPlaybooks();
  }, []);

  const handleAnalyzeLogs = async () => {
    if (!selectedWorkload) return;
    setIsAnalyzing(true); setAnalysis(null);
    try {
      const selectedCustom = customPlaybooks.find(p => p.name === selectedPlaybook);
      const result = selectedCustom
        ? await analyzeWorkload(selectedWorkload, 'General Health', aiConfig.provider, aiConfig.model)
        : await analyzeWorkload(selectedWorkload, selectedPlaybook, aiConfig.provider, aiConfig.model);
      setAnalysis(result.analysis); setEnrichedContext(result.context);
    } catch (e) { setAnalysis("Error generating analysis."); } finally { setIsAnalyzing(false); }
  };

  const handleDeepDive = () => {
    if (!selectedWorkload || !analysis) return;
    let fullContext = `WORKLOAD ANALYSIS REPORT:\n${analysis}\n\n`;
    if (enrichedContext) {
      if (enrichedContext.yaml) fullContext += `MANIFEST YAML:\n${enrichedContext.yaml}\n\n`;
      if (enrichedContext.metrics) fullContext += `METRIC TRENDS:\n${enrichedContext.metrics}\n\n`;
      if (enrichedContext.events?.length > 0) fullContext += `CLUSTER EVENTS:\n${enrichedContext.events.join('\n')}\n`;
    }
    onOpenChat(fullContext);
  };

  const handleGenerateFix = async () => {
    if (!selectedWorkload) return;
    setIsGeneratingFix(true);
    const currentId = selectedWorkload.id;
    try {
      const suggestion = await generateRemediation(
        selectedWorkload.kind, selectedWorkload.name,
        (selectedWorkload.recentLogs || []).slice(-10).join('\n'),
        aiConfig.provider, aiConfig.model,
        selectedWorkload.namespace, analysis || undefined
      );
      if (selectedWorkload.id === currentId) { setPatchSuggestion(suggestion); setFixStatus('idle'); }
    } catch (e) { console.error(e); } finally { setIsGeneratingFix(false); }
  };

  const handleApplyFix = async () => {
    if (!selectedWorkload || !patchSuggestion) return;
    setIsApplyingFix(true);
    try {
      await applyRemediation(selectedWorkload.kind, selectedWorkload.name, patchSuggestion.patchType, patchSuggestion.patchContent);
      setFixStatus('success'); setPatchSuggestion(null);
    } catch (e) { console.error(e); setFixStatus('error'); } finally { setIsApplyingFix(false); }
  };

  const saturation = useMemo(() => {
    if (!selectedWorkload) return { cpu: 0, mem: 0, storage: 0, gpu: 0 };
    const cpuBase = selectedWorkload.metrics.cpuLimit > 0 ? selectedWorkload.metrics.cpuLimit : 0;
    const memBase = selectedWorkload.metrics.memoryLimit > 0 ? selectedWorkload.metrics.memoryLimit : 0;
    const storageBase = selectedWorkload.metrics.storageLimit > 0 ? selectedWorkload.metrics.storageLimit : 0;
    const gpuBase = selectedWorkload.metrics.gpuMemoryTotal && selectedWorkload.metrics.gpuMemoryTotal > 0 ? selectedWorkload.metrics.gpuMemoryTotal : 0;
    return {
      cpu: cpuBase > 0 ? Math.min(100, Math.round((selectedWorkload.metrics.cpuUsage / cpuBase) * 100)) : 0,
      mem: memBase > 0 ? Math.min(100, Math.round((selectedWorkload.metrics.memoryUsage / memBase) * 100)) : 0,
      storage: storageBase > 0 ? Math.min(100, Math.round((selectedWorkload.metrics.storageUsage! / storageBase) * 100)) : 0,
      gpu: gpuBase > 0 ? Math.min(100, Math.round((selectedWorkload.metrics.gpuMemoryUsage! / gpuBase) * 100)) : 0
    };
  }, [selectedWorkload]);

  const hasGpu = useMemo(() => selectedWorkload?.metrics.gpuMemoryTotal && selectedWorkload.metrics.gpuMemoryTotal > 0, [selectedWorkload]);

  const highlightLog = (log: string) => {
    const keywords = ['504', 'timeout', 'DiskPressure', 'failed', 'No space left', 'CRITICAL', 'ERROR', 'Exception', 'Panic'];
    let highlighted = log;
    highlighted = highlighted.replace(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/, '<span class="text-text-tertiary select-none font-mono">$1</span>');
    keywords.forEach(kw => { highlighted = highlighted.replace(new RegExp(`(${kw})`, 'gi'), '<span class="text-danger font-bold">$1</span>'); });
    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  const metricCard = (label: string, value: string | number, critical = false, sub?: string) => (
    <div className="kt-panel p-4 hover:border-primary-500/30 transition-all">
      <p className="text-[10px] font-sans font-semibold text-text-tertiary mb-1">{label}</p>
      <div className={`text-2xl font-bold ${critical ? 'text-danger' : 'text-text-primary'}`}>{value}</div>
      {sub && <div className="text-[10px] text-text-tertiary mt-1 font-sans">{sub}</div>}
    </div>
  );

  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match
        ? <CodeBlock language={match[1]}>{children}</CodeBlock>
        : <code className="bg-primary-500/10 text-primary-500 px-1.5 py-0.5 rounded-sm font-mono text-xs" {...props}>{children}</code>;
    },
    h2({ children, ...props }: any) { return <h2 className="font-sans text-lg font-bold text-text-primary mb-4 mt-6 pb-2 border-b border-border-main" {...props}>{children}</h2>; },
    ul({ children, ...props }: any) { return <ul className="space-y-2 my-4 list-none pl-0" {...props}>{children}</ul>; },
    li({ children, ...props }: any) { return <li className="flex gap-3 items-start text-text-secondary text-sm" {...props}><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500/50 shrink-0" /><span className="flex-1">{children}</span></li>; },
    strong({ children, ...props }: any) { return <strong className="font-bold text-text-primary" {...props}>{children}</strong>; }
  }), []);

  return (
    <div className="flex flex-col lg:flex-row gap-3 h-[calc(100vh-7rem)] relative w-full overflow-hidden">
      <aside className={`${selectedWorkload && !isSidebarOpen ? 'hidden' : 'flex'} lg:flex flex-col kt-panel overflow-hidden shrink-0 transition-all duration-300 h-full min-h-0 ${isDesktopCollapsed ? 'lg:w-16' : 'w-full lg:w-72'}`}>
        <div className={`kt-panel-header border-b border-border-main flex items-center ${isDesktopCollapsed ? 'p-3 justify-center' : 'p-3 justify-between'}`}>
          {!isDesktopCollapsed && <span>Workloads</span>}
          <button onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)} className="hidden lg:flex p-1.5 hover:bg-bg-hover rounded-sm text-text-tertiary transition-colors" title={isDesktopCollapsed ? "Expand" : "Collapse"}>
            {isDesktopCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
        {!isDesktopCollapsed && (
          <div className="px-3 pt-3 pb-2 space-y-2.5 border-b border-border-main">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Filter workloads..." value={workloadSearchTerm} onChange={(e) => setWorkloadSearchTerm(e.target.value)} className="kt-input pl-8 pr-7 py-1.5 text-xs" />
              {workloadSearchTerm && (
                <button onClick={() => setWorkloadSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-bg-hover rounded-sm text-text-tertiary hover:text-text-primary transition-colors"><X className="w-3 h-3" /></button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {(['all', 'Healthy', 'Warning', 'Critical'] as const).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`px-2 py-1 text-[10px] font-sans font-semibold border transition-all ${ statusFilter === s ? s === 'all' ? 'bg-primary-500/10 text-primary-500 border-primary-500/30' : s === 'Healthy' ? 'bg-success/10 text-success border-success/30' : s === 'Warning' ? 'bg-warning/10 text-warning border-warning/30' : 'bg-danger/10 text-danger border-danger/30' : 'bg-bg-hover text-text-tertiary border-transparent hover:text-text-secondary hover:border-border-main' }`}>
                  {s === 'all' ? 'All' : s}
                  <span className="ml-1 opacity-60 font-sans">{s === 'all' ? safeWorkloads.length : safeWorkloads.filter(w => w.status === s).length}</span>
                </button>
              ))}
            </div>
            <select value={namespaceFilter} onChange={(e) => setNamespaceFilter(e.target.value)} className="kt-select py-1.5 text-xs">
              <option value="all">All Namespaces</option>
              {Array.from(new Set(safeWorkloads.map(w => w.namespace))).sort().map(ns => <option key={ns} value={ns}>{ns}</option>)}
            </select>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredWorkloads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
              <Search className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-xs font-sans">No workloads match</p>
            </div>
          )}
          {filteredWorkloads.map(w => (
            <div key={w.id} ref={selectedWorkload?.id === w.id ? selectedRef : null} onClick={() => {
              if (selectedWorkload) notifyLeave(`workload-${selectedWorkload.id}`);
              setSelectedWorkload(w); notifyView(`workload-${w.id}`); setAnalysis(null); setPatchSuggestion(null); setIsSidebarOpen(false);
            }} className={`group p-2.5 cursor-pointer transition-all border ${selectedWorkload?.id === w.id ? 'bg-primary-500/10 border-primary-500/30' : 'hover:bg-bg-hover border-transparent'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold truncate ${selectedWorkload?.id === w.id ? 'text-text-primary' : 'text-text-secondary'}`}>{w.name}</span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${getMetricStatusColor(w.status === 'Healthy' ? 0 : w.status === 'Warning' ? 80 : 100)}`} />
              </div>
              {!isDesktopCollapsed && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-tertiary font-sans">{w.kind}</span>
                  <span className="text-[10px] text-text-tertiary/70 select-none">•</span>
                  <span className="text-[10px] text-text-tertiary font-sans">{w.namespace}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      <main className={`${!selectedWorkload || isSidebarOpen ? 'hidden' : 'flex'} lg:flex flex-1 min-w-0 kt-panel overflow-hidden flex-col`}>
        {selectedWorkload ? (
          <div className="flex flex-col h-full overflow-hidden">
            <header className="p-4 border-b border-border-main flex flex-wrap items-center justify-between gap-3 bg-bg-hover/30">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-bg-main border border-border-main text-text-secondary"><ChevronLeft className="w-4 h-4" /></button>
                <div className="p-2 bg-bg-main border border-border-main shrink-0"><Terminal className="w-5 h-5 text-primary-500" /></div>
                <div className="min-w-0">
                  <h2 className="font-sans text-lg font-bold text-text-primary truncate">{selectedWorkload.name}</h2>
                  <div className="flex items-center gap-2 text-xs text-text-tertiary font-sans">
                    <span>{selectedWorkload.namespace}</span>
                    <span>•</span>
                    <span>{selectedWorkload.kind}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-2 bg-bg-main px-2 py-1 border border-border-main">
                  <Activity className="w-4 h-4 text-primary-500" />
                  <select value={selectedPlaybook} onChange={(e) => { setSelectedPlaybook(e.target.value as DiagnosticPlaybook); setAnalysis(null); }} className="bg-transparent text-xs text-text-primary border-none focus:ring-0 cursor-pointer appearance-none pr-5 min-w-0 font-sans">
                    <option value="General Health">General Health</option>
                    <option value="Network Connectivity">Network</option>
                    <option value="Resource Constraints">Resources</option>
                  </select>
                </div>
                <button onClick={handleAnalyzeLogs} disabled={isAnalyzing} className="kt-button kt-button-primary kt-button-sm">
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Analyze
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {metricCard('Replicas', <>{selectedWorkload.availableReplicas}<span className="text-sm text-text-tertiary">/{selectedWorkload.replicas}</span></>)}
                {metricCard('CPU', `${saturation.cpu}%`, saturation.cpu > 90)}
                {metricCard('Memory', `${saturation.mem}%`, saturation.mem > 90)}
                {metricCard('Storage', `${saturation.storage}%`, saturation.storage > 85)}
                {hasGpu && metricCard('GPU', `${saturation.gpu}%`, saturation.gpu > 90, `${selectedWorkload?.metrics.gpuTemperature ?? '--'}°C`)}
              </div>

              {selectedWorkload.recommendation?.action !== 'None' && (
                <div className="kt-panel p-4 flex flex-col md:flex-row items-center justify-between gap-3 border-success/20">
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="p-2 bg-success/10 border border-success/30"><TrendingDown className="w-5 h-5 text-success" /></div>
                    <div>
                      <h4 className="text-sm font-sans font-semibold text-text-primary">Optimization Available</h4>
                      <p className="text-xs text-success font-sans">{selectedWorkload.recommendation.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <span className="text-sm font-bold text-text-primary">{selectedWorkload.recommendation.action}</span>
                    <span className="text-xs text-text-tertiary font-sans">{selectedWorkload.recommendation.confidence}% confidence</span>
                  </div>
                </div>
              )}

              {selectedPlaybook === 'Network Connectivity' && <TrafficPathExplorer workload={selectedWorkload} />}

              <div className="kt-panel overflow-hidden flex flex-col">
                <div className="kt-panel-header"><Sparkles className="w-4 h-4 text-primary-500" /> AI Analysis</div>
                <div className="p-4 relative z-10">
                  {isAnalyzing ? (
                    <div className="h-48 flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                      <p className="text-sm text-text-tertiary font-sans font-medium">Analyzing workload...</p>
                    </div>
                  ) : analysis ? (
                    <div className="animate-fade-in">
                      <div className="kt-panel p-4 mb-4 border-primary-500/20">
                        <div className="flex items-center justify-between gap-3 flex-wrap relative z-10">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary-600 text-white"><FileCheck className="w-4 h-4" /></div>
                            <div>
                              <h4 className="text-sm font-sans font-semibold text-text-primary">Analysis Complete</h4>
                              {currentReport && (
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className={`kt-badge ${currentReport.Severity === 'Critical' ? 'kt-badge-danger' : currentReport.Severity === 'Warning' ? 'kt-badge-warning' : 'kt-badge-success'}`}>{currentReport.Severity}</span>
                                  {currentReport.IncidentType && <span className="text-[10px] text-text-secondary border border-border-main px-1.5 py-0.5 bg-bg-hover font-sans">{currentReport.IncidentType}</span>}
                                  <span className="text-[10px] text-text-tertiary font-mono">{new Date(currentReport.CreatedAt).toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <Link to="/reports" className="text-xs text-primary-500 hover:text-primary-400 border border-primary-500/30 px-3 py-1.5 bg-primary-500/10 transition-colors shrink-0 font-sans">View in Reports →</Link>
                        </div>
                      </div>

                      <div className="prose prose-sm dark:prose-invert max-w-none text-text-secondary"><ReactMarkdown components={markdownComponents}>{analysis}</ReactMarkdown></div>

                      <div className="mt-4 pt-3 border-t border-border-main flex flex-wrap gap-2 relative z-10">
                        {!patchSuggestion ? (
                          <>
                            <button onClick={handleDeepDive} className="kt-button kt-button-secondary kt-button-sm"><MessageSquareShare className="w-4 h-4" /> Deep Dive</button>
                            <button onClick={handleGenerateFix} disabled={isGeneratingFix} className="kt-button kt-button-primary kt-button-sm">
                              {isGeneratingFix ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Generate Fix
                            </button>
                            <button onClick={handleHandover} className="kt-button kt-button-ghost kt-button-sm"><Share2 className="w-4 h-4" /> Export</button>
                          </>
                        ) : (
                          <div className="w-full kt-panel-inset p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-sans font-semibold text-text-primary flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary-500" /> Proposed Fix</h4>
                              <span className={`kt-badge ${patchSuggestion.risk === 'High' ? 'kt-badge-danger' : 'kt-badge-success'}`}>Risk: {patchSuggestion.risk}</span>
                            </div>
                            <p className="text-xs text-text-tertiary mb-3 font-sans">{patchSuggestion.reasoning}</p>
                            <CodeBlock language="yaml">{patchSuggestion.patchContent}</CodeBlock>
                            <div className="flex justify-end gap-2 mt-3">
                              <button onClick={() => setPatchSuggestion(null)} className="kt-button kt-button-ghost kt-button-sm">Discard</button>
                              <button onClick={handleApplyFix} disabled={isApplyingFix} className="kt-button kt-button-primary kt-button-sm">
                                {isApplyingFix ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />} Apply Fix
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {fixStatus === 'success' && <div className="mt-3 p-3 bg-success/10 text-success text-sm text-center border border-success/20 font-sans">Fix applied successfully</div>}
                      {fixStatus === 'error' && <div className="mt-3 p-3 bg-danger/10 text-danger text-sm text-center border border-danger/20 font-sans">Failed to apply fix</div>}
                    </div>
                  ) : (
                    <div className="h-48 flex flex-col items-center justify-center text-text-tertiary gap-3">
                      <Info className="w-8 h-8" />
                      <p className="text-sm font-sans">Click "Analyze" to generate AI insights</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="kt-panel overflow-hidden flex flex-col min-h-[360px]">
                <div className="kt-panel-header">
                  <div className="flex items-center gap-2"><span className="kt-led kt-led-success kt-led-pulse" /><Terminal className="w-4 h-4 text-text-secondary" /> Logs</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsLogSyncEnabled(!isLogSyncEnabled)} className={`flex items-center gap-1.5 px-2 py-1 text-[10px] border transition-all ${isLogSyncEnabled ? 'bg-primary-500/10 text-primary-500 border-primary-500/30' : 'text-text-tertiary hover:text-text-secondary border-border-main'} font-sans`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isLogSyncEnabled ? 'bg-primary-500' : 'bg-text-tertiary'}`} /> Sync
                    </button>
                    <div className="relative"><Search className="w-3.5 h-3.5 text-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" /><input type="text" placeholder="Search..." value={logSearchTerm} onChange={(e) => handleLogSearchChange(e.target.value)} className="kt-input pl-8 pr-3 py-1 text-xs w-40" /></div>
                    <button onClick={handleLogWrapToggle} className={`p-1.5 rounded-sm transition-colors border ${isLogWrapEnabled ? 'bg-primary-500/10 text-primary-500 border-primary-500/30' : 'text-text-tertiary hover:text-text-primary border-border-main'}`} title={isLogWrapEnabled ? "Disable Wrap" : "Enable Wrap"}><WrapText className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto font-mono text-xs p-3 custom-scrollbar kt-panel-inset m-4">
                  {(!selectedWorkload.recentLogs || selectedWorkload.recentLogs.length === 0) ? (
                    <div className="h-full flex flex-col items-center justify-center text-text-tertiary/50 gap-3"><Terminal className="w-8 h-8 opacity-20" /><p className="text-xs font-sans">No logs available</p></div>
                  ) : (
                    selectedWorkload.recentLogs.filter(log => !logSearchTerm || log.toLowerCase().includes(logSearchTerm.toLowerCase())).map((log, i) => (
                      <div key={i} className="flex gap-3 group hover:bg-bg-hover px-2 py-1 items-start transition-colors">
                        <span className="text-text-tertiary/50 select-none w-8 text-right shrink-0 font-sans">{i + 1}</span>
                        <div className={`text-text-secondary flex-1 min-w-0 ${isLogWrapEnabled ? 'break-all whitespace-pre-wrap' : 'whitespace-nowrap overflow-hidden overflow-x-auto'}`}>{highlightLog(log)}</div>
                        <CopyButton text={log} className="opacity-0 group-hover:opacity-100 shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {(selectedWorkload.events?.length || 0) > 0 && (
                <div className="kt-panel overflow-hidden">
                  <div className="kt-panel-header"><AlertCircle className="w-4 h-4 text-warning" /> Events</div>
                  <div className="divide-y divide-border-main relative z-10">
                    {selectedWorkload.events?.map(event => (
                      <div key={event.id} className="p-4 flex items-start gap-3 hover:bg-bg-hover transition-colors">
                        <div className={`p-2 shrink-0 ${event.type === 'Warning' ? 'bg-danger/10 text-danger border border-danger/30' : 'bg-success/10 text-success border border-success/30'}`}>
                          {event.type === 'Warning' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <span className="text-sm font-sans font-bold text-text-primary">{event.reason}</span>
                            <span className="text-[10px] text-text-tertiary font-sans">{event.lastSeen}</span>
                          </div>
                          <p className="text-xs text-text-secondary truncate font-sans">{event.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            <div className="p-6 bg-primary-500/10 border border-primary-500/30 mb-4 kt-amber-glow"><Activity className="w-10 h-10 text-primary-500" /></div>
            <h3 className="font-sans text-xl font-bold text-text-primary mb-2">Select a Workload</h3>
            <p className="text-sm text-text-tertiary max-w-sm font-sans">Choose a workload from the sidebar to begin triage analysis.</p>
          </div>
        )}
      </main>
    </div>
  );
};
