
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Workload, ViewPropsWithChat, DiagnosticPlaybook } from '../types';
import { useMonitoring } from '../contexts/MonitoringContext';
import { usePresence } from '../contexts/PresenceContext';
import { analyzeWorkload } from '../services/geminiService';
import { generateRemediation, applyRemediation } from '../services/remediationService';
import ReactMarkdown from 'react-markdown';
import { Terminal, Loader2, Sparkles, Activity, Search, Clock, Globe, ChevronLeft, MessageSquareShare, ArrowRight, PanelLeftClose, PanelLeft, AlertCircle, CheckCircle2, ChevronRight, Layers, ArrowDown, Server, Zap, Globe2, WifiOff, MoreHorizontal, Info, ActivitySquare, Radio, ShieldCheck, HardDrive, WrapText, Bot, Copy, Check, FileCheck, Scroll, Hash, HeartPulse, Share2, Coins, TrendingDown, TrendingUp } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { MetricsChart } from './MetricsChart';
import { LogStreamViewer } from './LogStreamViewer';
import { CommentsThread } from './CommentsThread';

interface TriageViewProps extends ViewPropsWithChat {
  initialWorkloadId?: string; // Kept for backward compatibility or direct usage if needed
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
    <button onClick={handleCopy} className={`p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors ${className}`} title="Copy to clipboard">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const CodeBlock = ({ language, children, className = "my-8 rounded-3xl", fontSize = "13px" }: { language: string, children: React.ReactNode, className?: string, fontSize?: string }) => {
  const [isWrapped, setIsWrapped] = useState(false);
  const code = String(children).replace(/\n$/, '');

  return (
    <div className={`${className} overflow-hidden shadow-2xl relative group bg-dark-bg/90 border border-white/10`}>
      <div className="absolute right-4 top-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={() => setIsWrapped(!isWrapped)}
          className={`p-2 rounded-xl border border-white/10 ${isWrapped ? 'bg-primary-500/20 text-primary-400' : 'bg-dark-card/80 text-gray-400 hover:text-white'} backdrop-blur-md shadow-sm transition-all`}
          title={isWrapped ? "Disable Wrapping" : "Enable Wrapping"}
        >
          <WrapText className="w-3.5 h-3.5" />
        </button>
        <CopyButton text={code} className="bg-dark-card/80 backdrop-blur-md shadow-sm border border-white/10" />
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        wrapLongLines={isWrapped}
        customStyle={{ margin: 0, padding: '2rem', fontSize: fontSize, lineHeight: '1.6', background: 'transparent' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

const TrafficPathExplorer = ({ workload }: { workload: Workload }) => {
  return (
    <div className="bg-dark-card rounded-5xl p-10 border border-primary-500/20 shadow-2xl relative overflow-hidden group mb-12 transition-all hover:border-primary-500/40 cyber-card">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.1),transparent)] pointer-events-none" />
      <div className="relative z-10 text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-primary-500/10 rounded-2xl ring-1 ring-primary-500/50 shadow-[0_0_15px_rgba(14,165,233,0.2)]"><Radio className="w-7 h-7 text-primary-400 animate-pulse" /></div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-400 font-display">Path Trace 0x01</h4>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">L7 Ingress Fabric Diagnostic</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 py-3 bg-accent-rose/10 border border-accent-rose/30 rounded-full shadow-[0_0_20px_rgba(244,63,94,0.1)]">
            <span className="w-2 h-2 bg-accent-rose rounded-full animate-ping"></span>
            <span className="text-[10px] font-black uppercase text-accent-rose tracking-[0.1em]">Signal Degradation Detected</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto py-10 relative">
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-dark-bg/50 -translate-y-1/2" />
          <div className="flex flex-col items-center gap-6 relative z-10 group/node transition-transform hover:scale-110">
            <div className="w-20 h-20 rounded-4xl bg-dark-bg border border-white/10 flex items-center justify-center text-gray-500 shadow-2xl group-hover/node:bg-primary-600 group-hover/node:text-white transition-all"><Globe className="w-8 h-8" /></div>
            <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest font-display">Public Ingress</span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-dark-bg via-primary-500 to-dark-bg animate-pulse" />
          <div className="flex flex-col items-center gap-6 relative z-10 group/node transition-transform hover:scale-110">
            <div className="w-24 h-24 rounded-[2.5rem] bg-primary-600 border-2 border-primary-400/50 flex items-center justify-center text-white shadow-2xl shadow-primary-500/30 ring-8 ring-primary-500/5"><Zap className="w-10 h-10" /></div>
            <span className="text-[11px] font-black uppercase text-white tracking-[0.2em] font-display">Gateway</span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-dark-bg via-accent-rose to-dark-bg animate-pulse" />
          <div className="flex flex-col items-center gap-6 relative z-10 group/node transition-transform hover:scale-110">
            <div className="w-20 h-20 rounded-4xl bg-dark-bg border border-accent-rose/30 flex items-center justify-center text-accent-rose animate-pulse shadow-2xl shadow-accent-rose/20"><Server className="w-8 h-8" /></div>
            <span className="text-[9px] font-black uppercase text-accent-rose tracking-widest font-display">Pod Backend</span>
          </div>
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

  // Priority: URL > Router State > Props
  const targetWorkloadId = urlWorkload || location.state?.workloadId || propId;
  const targetTemplate = urlPlaybook || location.state?.playbook || propTemplate;

  // State Initialization
  const [selectedWorkload, setSelectedWorkload] = useState<Workload | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { aiConfig } = useMonitoring();
  const [selectedPlaybook, setSelectedPlaybook] = useState<DiagnosticPlaybook>(
    (targetTemplate as DiagnosticPlaybook) || 'General Health'
  );

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('ui_sidebar_open');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('ui_sidebar_open', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workloadSearchTerm, setWorkloadSearchTerm] = useState<string>('');
  const [logSearchTerm, setLogSearchTerm] = useState<string>('');
  const [isLogWrapEnabled, setIsLogWrapEnabled] = useState(false);
  const [isLogSyncEnabled, setIsLogSyncEnabled] = useState(false); // Sync Toggle
  const [o11yTemplates, setO11yTemplates] = useState<{ name: string, url: string }[]>([
    { name: 'Grafana', url: 'https://grafana.example.com/d/k8s-pod?var-pod=${pod_name}&var-namespace=${namespace}' },
    { name: 'Datadog', url: 'https://app.datadoghq.com/logs?query=pod_name:${pod_name}' }
  ]);

  // Sync Logic
  useEffect(() => {
    if (!selectedWorkload || !isLogSyncEnabled) return;

    // Listen for incoming events
    const event = logStateEvents[`workload-${selectedWorkload.id}`];
    if (event && event.payload) {
      // Only update if different to avoid loops (basic check)
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

    // Create Markdown Summary
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
    alert("Incident Summary copied to clipboard for Slack/Jira!");
  };

  // Remediation State
  const [patchSuggestion, setPatchSuggestion] = useState<import('../services/remediationService').PatchSuggestion | null>(null);
  const [isGeneratingFix, setIsGeneratingFix] = useState(false);
  const [isApplyingFix, setIsApplyingFix] = useState(false);
  const [fixStatus, setFixStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [enrichedContext, setEnrichedContext] = useState<any>(null);

  // URL Sync Effect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedWorkload) params.set('workload', selectedWorkload.name);
    if (selectedPlaybook) params.set('playbook', selectedPlaybook);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [selectedWorkload, selectedPlaybook]);

  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedWorkload && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedWorkload]);

  // Restore Analysis Cache
  useEffect(() => {
    if (selectedWorkload && selectedPlaybook && !analysis && !isAnalyzing) {
      const cacheKey = `analysis_${selectedWorkload.id}_${selectedPlaybook}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) setAnalysis(cached);
    }
  }, [selectedWorkload, selectedPlaybook]);

  // Selection Logic
  useEffect(() => {
    if (targetWorkloadId) {
      const workload = workloads.find(w => w.id === targetWorkloadId || w.name === targetWorkloadId);
      if (workload) {
        if (selectedWorkload?.id !== workload.id) {
          // Leave previous
          if (selectedWorkload) notifyLeave(`workload-${selectedWorkload.id}`);

          setSelectedWorkload(workload);
          notifyView(`workload-${workload.id}`);

          setIsSidebarOpen(false);
          // Only trigger auto-analysis if NOT cached
          const cacheKey = `analysis_${workload.id}_${selectedPlaybook}`;
          if (!sessionStorage.getItem(cacheKey)) {
            triggerAutoAnalysis(workload, selectedPlaybook);
          }
        } else if (selectedWorkload !== workload) {
          // Live data update
          setSelectedWorkload(workload);
        }
      }
    }
  }, [targetWorkloadId, workloads, targetTemplate]);

  // Clean up presence on unmount
  useEffect(() => {
    return () => {
      if (selectedWorkload) notifyLeave(`workload-${selectedWorkload.id}`);
    };
  }, [selectedWorkload]);

  // Validation: Reset selectedWorkload if it's not in the current workloads list (e.g. cluster switch)
  useEffect(() => {
    if (selectedWorkload && !workloads.some(w => w.id === selectedWorkload.id)) {
      setSelectedWorkload(null);
      setAnalysis(null);
    }
  }, [workloads, selectedWorkload]);

  const triggerAutoAnalysis = async (workload: Workload, playbook: DiagnosticPlaybook) => {
    setIsAnalyzing(true); setAnalysis(null);
    try {
      const { analysis, context } = await analyzeWorkload(workload, playbook, aiConfig.provider, aiConfig.model);
      setAnalysis(analysis);
      setEnrichedContext(context);
      // Cache Result
      sessionStorage.setItem(`analysis_${workload.id}_${playbook}`, analysis);
      if (context) sessionStorage.setItem(`context_${workload.id}_${playbook}`, JSON.stringify(context));
    }
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

  // Playbooks State
  const [customPlaybooks, setCustomPlaybooks] = useState<import('../types').Playbook[]>([]);
  const [cpuMetrics, setCpuMetrics] = useState<{ timestamp: number, value: number }[]>([]);
  const [memMetrics, setMemMetrics] = useState<{ timestamp: number, value: number }[]>([]);

  useEffect(() => {
    if (!selectedWorkload) return;
    const fetchMetrics = async () => {
      try {
        const [cpuRes, memRes] = await Promise.all([
          fetch(`/api/cluster/metrics?metric=cpu&workload=${selectedWorkload.name}&namespace=${selectedWorkload.namespace}&duration=1h`),
          fetch(`/api/cluster/metrics?metric=memory&workload=${selectedWorkload.name}&namespace=${selectedWorkload.namespace}&duration=1h`)
        ]);

        if (cpuRes.ok) setCpuMetrics(await cpuRes.json());
        if (memRes.ok) setMemMetrics(await memRes.json());
      } catch (e) {
        console.error("Failed to fetch metrics", e);
      }
    };
    fetchMetrics();
    // Use polling in real app (every 30s)
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [selectedWorkload]);

  useEffect(() => {
    const fetchPlaybooks = async () => {
      try {
        const response = await fetch('/api/playbooks');
        if (response.ok) {
          const data = await response.json();
          setCustomPlaybooks(data);
        }
      } catch (err) {
        console.error("Failed to fetch custom playbooks", err);
      }
    };
    fetchPlaybooks();
  }, []);

  const handleAnalyzeLogs = async () => {
    if (!selectedWorkload) return;
    setIsAnalyzing(true); setAnalysis(null);
    try {
      const selectedCustom = customPlaybooks.find(p => p.name === selectedPlaybook);
      let result;
      if (selectedCustom) {
        result = await analyzeWorkload(selectedWorkload, 'General Health', aiConfig.provider, aiConfig.model);
      } else {
        result = await analyzeWorkload(selectedWorkload, selectedPlaybook, aiConfig.provider, aiConfig.model);
      }
      setAnalysis(result.analysis);
      setEnrichedContext(result.context);
    }
    catch (e) { setAnalysis("Error generating analysis."); }
    finally { setIsAnalyzing(false); }
  };

  const handleDeepDive = () => {
    if (!selectedWorkload || !analysis) return;

    let fullContext = `WORKLOAD ANALYSIS REPORT:\n${analysis}\n\n`;

    if (enrichedContext) {
      if (enrichedContext.yaml) fullContext += `MANIFEST YAML:\n${enrichedContext.yaml}\n\n`;
      if (enrichedContext.metrics) fullContext += `HISTORICAL METRIC TRENDS:\n${enrichedContext.metrics}\n\n`;
      if (enrichedContext.events && enrichedContext.events.length > 0) {
        fullContext += `CLUSTER EVENTS:\n${enrichedContext.events.join('\n')}\n`;
      }
    }

    onOpenChat(fullContext);
  };

  const handleGenerateFix = async () => {
    if (!selectedWorkload) return;
    setIsGeneratingFix(true);
    const currentId = selectedWorkload.id;
    try {
      // Resource Kind/Name extraction would be better if we had specific log metadata, but defaulting to Workload name for now
      const suggestion = await generateRemediation(
        selectedWorkload.kind,
        selectedWorkload.name,
        (selectedWorkload.recentLogs || []).slice(-10).join('\n'),
        aiConfig.provider,
        aiConfig.model,
        selectedWorkload.namespace,
        analysis || undefined
      );
      if (selectedWorkload.id === currentId) {
        setPatchSuggestion(suggestion);
        setFixStatus('idle');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingFix(false);
    }
  };

  const handleApplyFix = async () => {
    if (!selectedWorkload || !patchSuggestion) return;
    setIsApplyingFix(true);
    try {
      await applyRemediation(selectedWorkload.kind, selectedWorkload.name, patchSuggestion.patchType, patchSuggestion.patchContent);
      setFixStatus('success');
      setPatchSuggestion(null);
      // Refresh workload logic would go here
    } catch (e) {
      console.error(e);
      setFixStatus('error');
    } finally {
      setIsApplyingFix(false);
    }
  };

  const saturation = useMemo(() => {
    if (!selectedWorkload) return { cpu: 0, mem: 0, storage: 0 };
    const cpuLimit = selectedWorkload.metrics.cpuLimit || 0;
    const memLimit = selectedWorkload.metrics.memoryLimit || 0;
    const storageLimit = selectedWorkload.metrics.storageLimit || 0;

    return {
      cpu: cpuLimit > 0 ? Math.round((selectedWorkload.metrics.cpuUsage / cpuLimit) * 100) : 0,
      mem: memLimit > 0 ? Math.round((selectedWorkload.metrics.memoryUsage / memLimit) * 100) : 0,
      storage: storageLimit > 0 ? Math.round((selectedWorkload.metrics.storageUsage! / storageLimit) * 100) : 0
    };
  }, [selectedWorkload]);

  const highlightLog = (log: string) => {
    const keywords = ['504', 'timeout', 'DiskPressure', 'failed', 'No space left', 'CRITICAL', 'ERROR', 'Exception', 'Panic'];
    let highlighted = log;

    // Dim Timestamp (ISO or common formats at start)
    highlighted = highlighted.replace(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/, '<span class="text-zinc-600 select-none">$1</span>');

    keywords.forEach(kw => {
      const regex = new RegExp(`(${kw})`, 'gi');
      highlighted = highlighted.replace(regex, '<span class="text-rose-400 font-black">$1</span>');
    });
    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match
        ? <CodeBlock language={match[1]}>{children}</CodeBlock>
        : <code className="bg-primary-500/10 text-primary-500 px-2 py-0.5 rounded-lg font-mono text-xs font-black" {...props}>{children}</code>;
    },
    h2({ children, ...props }: any) {
      const text = String(children).toLowerCase();
      let icon = <Hash className="w-5 h-5 text-gray-400" />;
      if (text.includes('executive summary')) icon = <AlertCircle className="w-6 h-6 text-accent-rose" />;
      if (text.includes('root cause')) icon = <Search className="w-6 h-6 text-primary-500" />;
      if (text.includes('impact')) icon = <Activity className="w-6 h-6 text-amber-500" />;
      if (text.includes('health')) icon = <HeartPulse className="w-6 h-6 text-emerald-500" />;

      return (
        <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-4 mb-8 mt-14 pb-5 border-b border-gray-100 dark:border-white/5 text-gray-900 dark:text-white font-display" {...props}>
          {icon}
          {children}
        </h2>
      );
    },
    ul({ children, ...props }: any) {
      return <ul className="space-y-4 mt-6 mb-8 list-none pl-0" {...props}>{children}</ul>;
    },
    li({ children, ...props }: any) {
      return (
        <li className="flex gap-4 items-start text-gray-600 dark:text-gray-300 text-[15px] leading-relaxed" {...props}>
          <span className="mt-2 w-2 h-2 rounded-full bg-primary-500/30 dark:bg-primary-500/20 ring-1 ring-primary-500/50 shrink-0 shadow-[0_0_8px_rgba(14,165,233,0.3)]" />
          <span className="flex-1">{children}</span>
        </li>
      );
    },
    strong({ children, ...props }: any) {
      return <strong className="font-black text-gray-900 dark:text-white" {...props}>{children}</strong>;
    }
  }), []);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-full relative w-full overflow-hidden font-sans">
      <aside className={`${selectedWorkload && !isSidebarOpen ? 'hidden' : 'flex'} lg:flex transition-all duration-500 flex-col bg-white dark:bg-dark-bg border border-gray-100 dark:border-white/5 shadow-sm rounded-5xl overflow-hidden shrink-0 ${isDesktopCollapsed ? 'lg:w-24' : 'w-full lg:w-[400px]'}`}>
        <div className={`border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-dark-bg/50 flex items-center transition-all ${isDesktopCollapsed ? 'p-6 justify-center' : 'p-10 justify-between'}`}>
          {!isDesktopCollapsed && (
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-600 rounded-2xl shadow-lg shadow-primary-500/20">
                <ActivitySquare className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter text-base hidden sm:block font-display">Neural Fleet</h3>
            </div>
          )}
          <button
            onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            className={`hidden lg:flex p-3 hover:bg-gray-100 dark:hover:bg-white/5 rounded-2xl text-gray-500 transition-all active:scale-90 ${isDesktopCollapsed ? 'bg-gray-50 dark:bg-dark-card' : ''}`}
            title={isDesktopCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isDesktopCollapsed ? <PanelLeft className="w-6 h-6" /> : <PanelLeftClose className="w-6 h-6" />}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30 dark:bg-black/10 custom-scrollbar">
          {filteredWorkloads.map(w => (
            <div
              key={w.id}
              ref={selectedWorkload?.id === w.id ? selectedRef : null}
              onClick={() => {
                if (selectedWorkload) notifyLeave(`workload-${selectedWorkload.id}`);
                setSelectedWorkload(w);
                notifyView(`workload-${w.id}`);
                setAnalysis(null);
                setPatchSuggestion(null);
                setIsSidebarOpen(false);
              }}
              className={`group relative p-8 rounded-4xl cursor-pointer transition-all border-2 ${selectedWorkload?.id === w.id ? 'bg-primary-600 border-primary-500 text-white shadow-[0_20px_40px_rgba(14,165,233,0.15)] translate-x-2' : 'bg-white dark:bg-dark-card border-transparent shadow-sm hover:translate-x-1 hover:shadow-2xl hover:shadow-primary-500/10 hover:border-primary-500/20'}`}
            >
              <span className="text-base font-black truncate leading-none uppercase tracking-tight block mb-2 font-display">{w.name}</span>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-2 ${selectedWorkload?.id === w.id ? 'text-white/80' : 'text-primary-500 dark:text-primary-400'}`}>
                  {w.kind === 'ScaledJob' ? <Scroll className="w-4 h-4" /> : <Layers className="w-4 h-4" />} {w.kind}
                </span>
                <div className={`w-3 h-3 rounded-full ${w.status === 'Healthy' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : w.status === 'Warning' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-accent-rose shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`} />
              </div>
            </div>
          ))}
        </div>

        {/* Comments Section in Sidebar */}
        {selectedWorkload && (
          <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20">
            <CommentsThread
              clusterID="default" // MVP assumption
              namespace={selectedWorkload.namespace}
              workloadName={selectedWorkload.name}
              isDarkMode={isDarkMode}
            />
          </div>
        )}
      </aside>

      <main className={`${!selectedWorkload || isSidebarOpen ? 'hidden' : 'flex'} lg:flex flex-1 min-w-0 bg-white dark:bg-dark-bg rounded-5xl overflow-hidden flex flex-col border border-gray-100 dark:border-white/5 shadow-sm`}>
        {selectedWorkload ? (
          <div className="flex flex-col h-full overflow-hidden relative">
            <header className="p-6 md:p-10 border-b border-gray-100 dark:border-white/5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 bg-white/60 dark:bg-dark-bg/60 backdrop-blur-2xl sticky top-0 z-20">
              <div className="flex items-center gap-8">
                <div className="p-6 bg-dark-bg/80 rounded-4xl shadow-2xl border border-white/5 flex items-center justify-center ring-1 ring-primary-500/20"><Terminal className="w-8 h-8 text-primary-400" /></div>
                <div className="min-w-0">
                  <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter uppercase leading-none font-display">
                    {selectedWorkload.name}
                  </h2>
                  <div className="flex items-center gap-4 mt-3">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] font-display">Infrastructure Vector • {selectedWorkload.namespace} • {selectedWorkload.kind}</p>

                    {/* Presence */}
                    {activeUsers[`workload-${selectedWorkload.id}`] && activeUsers[`workload-${selectedWorkload.id}`].length > 0 && (
                      <div className="flex -space-x-2">
                        {activeUsers[`workload-${selectedWorkload.id}`].map((u) => (
                          <img key={u.userId} src={u.avatarUrl} alt={u.userName} title={u.userName} className="w-6 h-6 rounded-full border border-black" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Deep Links Ribbon */}
              <div className="flex gap-4 overflow-x-auto pb-2">
                {o11yTemplates.map(tmpl => {
                  if (!selectedWorkload.podNames || selectedWorkload.podNames.length === 0) return null;
                  const url = tmpl.url
                    .replace('${pod_name}', selectedWorkload.podNames[0])
                    .replace('${namespace}', selectedWorkload.namespace)
                    .replace('${workload}', selectedWorkload.name);

                  return (
                    <a key={tmpl.name} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-all whitespace-nowrap">
                      <ActivitySquare className="w-3.5 h-3.5" />
                      Open in {tmpl.name}
                    </a>
                  );
                })}
              </div>

              <div className="flex flex-1 items-center gap-6 w-full xl:w-auto">
                <div className="flex items-center gap-4 bg-gray-50 dark:bg-dark-card border border-gray-100 dark:border-white/5 px-6 py-4 rounded-3xl shadow-sm glass">
                  <div className="p-2.5 bg-primary-500/10 rounded-xl"><ActivitySquare className="w-5 h-5 text-primary-500" /></div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5 font-display">Core Playbook</span>
                    <select value={selectedPlaybook} onChange={(e) => { setSelectedPlaybook(e.target.value as DiagnosticPlaybook); setAnalysis(null); }} className="bg-transparent text-sm font-black uppercase text-gray-900 dark:text-white cursor-pointer pr-8 border-none focus:ring-0">
                      <option value="General Health">General Health</option>
                      <option value="Network Connectivity">Network Connectivity</option>
                      <option value="Resource Constraints">Resource Constraints</option>
                      {customPlaybooks.length > 0 && <optgroup label="Custom Intelligence">{customPlaybooks.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</optgroup>}
                    </select>
                  </div>
                </div>
                <button onClick={handleAnalyzeLogs} disabled={isAnalyzing} className="flex-1 xl:flex-none bg-primary-600 hover:bg-primary-500 text-white px-12 py-5 rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 border-b-4 border-primary-800">
                  {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 fill-white" />}
                  Init AI Diagnostic
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-10 bg-gray-50/20 dark:bg-black/20 pb-40 scroll-smooth custom-scrollbar">
              {/* Metrics Ribbon */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                <div className="bg-white dark:bg-dark-card p-6 rounded-4xl border border-gray-100 dark:border-white/5 shadow-sm text-center animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 fill-mode-forwards cyber-card">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-[0.3em] font-display">Integrity</p>
                  <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tight font-display">{selectedWorkload.availableReplicas}<span className="text-lg opacity-30 ml-1">/{selectedWorkload.replicas}</span></span>
                </div>
                <div className="bg-white dark:bg-dark-card p-6 rounded-4xl border border-gray-100 dark:border-white/5 shadow-sm text-center flex flex-col justify-between overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 fill-mode-forwards cyber-card">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-[0.3em] font-display">Core Load</p>
                    <span className={`text-4xl font-black tracking-tight font-display ${saturation.cpu > 90 ? 'text-accent-rose' : 'text-gray-900 dark:text-white'}`}>{saturation.cpu}%</span>
                  </div>
                  <div className="-mx-6 -mb-6 mt-6 opacity-30">
                    <MetricsChart data={cpuMetrics} color={saturation.cpu > 90 ? "#f43f5e" : "#0ea5e9"} height={80} unit="%" />
                  </div>
                </div>
                <div className="bg-white dark:bg-dark-card p-6 rounded-4xl border border-gray-100 dark:border-white/5 shadow-sm text-center flex flex-col justify-between overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 fill-mode-forwards cyber-card">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-[0.3em] font-display">Memory Sat</p>
                    <span className={`text-4xl font-black tracking-tight font-display ${saturation.mem > 90 ? 'text-accent-rose' : 'text-gray-900 dark:text-white'}`}>{saturation.mem}%</span>
                  </div>
                  <div className="-mx-6 -mb-6 mt-6 opacity-30">
                    <MetricsChart data={memMetrics} color={saturation.mem > 90 ? "#f43f5e" : "#8b5cf6"} height={80} unit="MiB" />
                  </div>
                </div>
                <div className="bg-white dark:bg-dark-card p-6 rounded-4xl border border-gray-100 dark:border-white/5 shadow-sm text-center animate-in fade-in slide-in-from-bottom-6 duration-700 delay-400 fill-mode-forwards cyber-card flex flex-col justify-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-[0.3em] font-display">Storage I/O</p>
                  <span className={`text-4xl font-black tracking-tight font-display ${saturation.storage > 85 ? 'text-accent-rose animate-pulse' : 'text-primary-400'}`}>{saturation.storage}%</span>
                </div>
              </div>

              {/* Cost Optimization Card */}
              {selectedWorkload.recommendation && selectedWorkload.recommendation.action !== 'None' && (
                <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-4xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
                  <div className="flex items-center gap-6 relative z-10">
                    <div className="p-4 bg-emerald-500/20 rounded-2xl ring-1 ring-emerald-500/40 shadow-lg">
                      <Coins className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter font-display">Optimization Opportunity</h4>
                      <p className="text-emerald-500 font-bold text-sm mt-1">{selectedWorkload.recommendation.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 relative z-10">
                    <div className="text-right">
                      <span className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Suggested Action</span>
                      <span className={`text-2xl font-black uppercase tracking-tight flex items-center justify-end gap-2 ${selectedWorkload.recommendation.action === 'Downsize' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {selectedWorkload.recommendation.action === 'Downsize' ? <TrendingDown className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
                        {selectedWorkload.recommendation.action}
                      </span>
                    </div>
                    <div className="h-12 w-px bg-white/10" />
                    <div className="text-center">
                      <span className="block text-3xl font-black text-white">{selectedWorkload.recommendation.confidence}%</span>
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Confidence</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Scaling Configuration (KEDA) */}
              {selectedWorkload.scaling && selectedWorkload.scaling.enabled && (
                <section className="bg-white dark:bg-dark-card rounded-5xl border border-gray-100 dark:border-white/5 p-10 shadow-sm relative overflow-hidden cyber-card">
                  <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><Activity className="w-48 h-48 text-primary-500" /></div>
                  <div className="flex items-center gap-6 mb-10">
                    <div className="p-4 bg-primary-500/10 rounded-2xl"><Activity className="w-7 h-7 text-primary-500" /></div>
                    <div>
                      <h4 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight font-display">Autoscaling Topology</h4>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-1">Orchestrated via KEDA Events</p>
                    </div>
                    {selectedWorkload.scaling.kedaReady ?
                      <div className="px-5 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-500/20"><ShieldCheck className="w-4 h-4" /> Scaler Ready</div> :
                      <div className="px-5 py-2 bg-accent-rose/10 text-accent-rose rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-accent-rose/20"><AlertCircle className="w-4 h-4" /> Desync Detected</div>
                    }
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
                    <div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-3 font-display">Elastic Constraint</span>
                      <div className="flex items-center gap-4">
                        <span className="text-3xl font-black text-gray-900 dark:text-white font-display">{selectedWorkload.scaling.min} <ArrowRight className="inline w-5 h-5 text-gray-300 mx-1" /> {selectedWorkload.scaling.max}</span>
                        {selectedWorkload.scaling.min === 0 && (
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">Zero-State Enabled</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-3 font-display">Current Density</span>
                      <span className="text-3xl font-black text-gray-900 dark:text-white font-display">{selectedWorkload.scaling.current} <span className="text-primary-500 text-sm font-black align-middle ml-1">UNITS</span></span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-3 font-display">Event Triggers</span>
                      <div className="flex flex-wrap gap-2.5 mt-2">
                        {(selectedWorkload.scaling.config?.triggers || []).map((t, i) => (
                          <span key={i} className="px-3.5 py-2 bg-dark-bg/60 rounded-xl text-[10px] font-black text-primary-400 uppercase tracking-widest border border-white/5">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Node Provisioning (Karpenter) */}
              {selectedWorkload.provisioning && selectedWorkload.provisioning.enabled && (
                <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5"><Server className="w-32 h-32 text-blue-500" /></div>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-blue-500/10 rounded-2xl"><Server className="w-6 h-6 text-blue-500" /></div>
                    <div>
                      <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Node Provisioning Status</h4>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Managed by Karpenter</p>
                    </div>
                    <div className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Enabled</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                    <div>
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Active NodePools</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(selectedWorkload.provisioning.nodePools || []).map((np, i) => (
                          <span key={i} className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider border border-zinc-200 dark:border-zinc-700">{np}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Pending NodeClaims</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(selectedWorkload.provisioning.nodeClaims || []).length > 0 ? (
                          selectedWorkload.provisioning.nodeClaims.map((nc, i) => (
                            <span key={i} className="px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] font-bold text-amber-500 uppercase tracking-wider">{nc}</span>
                          ))
                        ) : (
                          <span className="text-zinc-500 text-xs font-bold">None</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">System Health</span>
                      <div className="flex flex-col gap-2">
                        {(selectedWorkload.provisioning.misconfigurations || []).length > 0 ? (
                          selectedWorkload.provisioning.misconfigurations.map((m, i) => (
                            <div key={i} className="flex items-start gap-2 text-rose-500">
                              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                              <span className="text-[10px] font-bold uppercase tracking-tight">{m}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-2 text-emerald-500">
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-tight">Optimized</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {selectedPlaybook === 'Network Connectivity' && <TrafficPathExplorer workload={selectedWorkload} />}

              <div className="flex flex-col gap-10">
                <section className="bg-white dark:bg-dark-card rounded-5xl border border-gray-100 dark:border-white/5 shadow-2xl flex flex-col relative overflow-hidden cyber-card">
                  <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-dark-bg/50 backdrop-blur-md relative z-10">
                    <div className="flex items-center gap-5">
                      <Sparkles className="w-6 h-6 text-primary-500 shadow-[0_0_15px_rgba(14,165,233,0.4)]" />
                      <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.3em] font-display">AI Intelligence Report</h3>
                    </div>
                  </div>
                  <div className="p-10 flex-1 overflow-y-auto relative z-10">
                    {isAnalyzing ? (
                      <div className="h-[400px] flex flex-col items-center justify-center text-center gap-10 animate-in fade-in duration-700">
                        <div className="relative">
                          <div className="absolute inset-0 bg-primary-500 rounded-full blur-[60px] opacity-10 animate-pulse"></div>
                          <Loader2 className="w-16 h-16 text-primary-500 animate-spin relative z-10" />
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter font-display">Scanning Vector Space...</h4>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em] animate-pulse">Analyzing manifest & telemetry logs</p>
                        </div>
                      </div>
                    ) : analysis ? (
                      <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000">
                        <div className="bg-gradient-to-br from-primary-500/10 to-accent-violet/10 border border-primary-500/30 backdrop-blur-3xl rounded-4xl p-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-[0_30px_60px_rgba(0,0,0,0.4)] relative overflow-hidden">
                          <div className="absolute inset-0 bg-primary-500/5 blur-[120px] pointer-events-none" />
                          <div className="flex items-center gap-6 relative z-10 text-center md:text-left">
                            <div className="p-5 bg-primary-600 text-white rounded-3xl shadow-2xl shadow-primary-500/40 ring-4 ring-primary-500/5">
                              <FileCheck className="w-8 h-8" />
                            </div>
                            <div>
                              <h4 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter font-display">Triage Finalized</h4>
                              <p className="text-[10px] text-primary-500 font-black uppercase tracking-[0.2em] mt-2">Correlated Log Set archived to Ops Ledger.</p>
                            </div>
                          </div>
                          <Link to="/reports" className="group flex items-center gap-3 bg-white text-dark-bg px-10 py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl hover:bg-primary-50 hover:scale-[1.05] transition-all border border-gray-100">
                            View in Reporting Center <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </Link>
                        </div>

                        <div className="mt-8 prose prose-sm prose-indigo max-w-none dark:prose-invert prose-headings:font-black prose-headings:tracking-tighter prose-p:leading-loose prose-strong:text-primary-500 dark:prose-strong:text-primary-400 prose-li:marker:text-gray-400">
                          <ReactMarkdown components={markdownComponents}>
                            {analysis}
                          </ReactMarkdown>
                        </div>

                        {/* Remediation Section */}
                        <div className="mt-16 pt-12 border-t border-gray-100 dark:border-white/5 font-display">
                          {!patchSuggestion ? (
                            <div className="flex flex-col gap-8">
                              <div className="flex flex-col md:flex-row justify-center gap-6">
                                <button onClick={handleDeepDive} className="bg-dark-bg text-white px-10 py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 border border-white/10 group">
                                  Copilot Deep Dive <MessageSquareShare className="w-5 h-5 text-primary-500 group-hover:scale-110 transition-transform" />
                                </button>
                                <button onClick={handleGenerateFix} disabled={isGeneratingFix} className="bg-primary-600 text-white px-10 py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary-600/20 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 border-b-4 border-primary-800">
                                  {isGeneratingFix ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5 fill-white" />}
                                  {isGeneratingFix ? 'Neutralizing Vectors...' : 'Generate Neural Fix'}
                                </button>
                              </div>
                              <div className="flex justify-center">
                                <button onClick={handleHandover} className="text-zinc-500 hover:text-zinc-300 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:underline">
                                  <Share2 className="w-4 h-4" /> Export to Slack / Jira
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-dark-card p-10 rounded-5xl border-2 border-primary-500/30 animate-in zoom-in-95 shadow-2xl glass cyber-card">
                              <div className="flex items-center justify-between mb-8">
                                <h4 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-3 font-display"><Sparkles className="w-6 h-6 text-primary-500" /> Proposed Autofix</h4>
                                <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${patchSuggestion.risk === 'High' ? 'bg-accent-rose/10 text-accent-rose border-accent-rose/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>Risk Profile: {patchSuggestion.risk}</div>
                              </div>
                              <p className="text-gray-600 dark:text-gray-300 mb-8 text-sm font-medium leading-relaxed">{patchSuggestion.reasoning}</p>
                              <CodeBlock
                                language="yaml"
                                className="mb-8 rounded-4xl border border-white/5 opacity-90"
                                fontSize="12px"
                              >
                                {patchSuggestion.patchContent}
                              </CodeBlock>
                              <div className="flex justify-end gap-4">
                                <button onClick={() => setPatchSuggestion(null)} className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Discard</button>
                                <button onClick={handleApplyFix} disabled={isApplyingFix} className="bg-primary-600 hover:bg-primary-500 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary-600/20 flex items-center gap-3 transition-all active:scale-95">
                                  {isApplyingFix ? <Loader2 className="w-5 h-5 animate-spin" /> : <HardDrive className="w-5 h-5 fill-white" />}
                                  {isApplyingFix ? 'Applying Flux...' : 'Inject Patch to Sector'}
                                </button>
                              </div>
                            </div>
                          )}
                          {fixStatus === 'success' && <div className="mt-8 p-6 bg-emerald-500/10 text-emerald-500 rounded-3xl text-center font-black text-[10px] uppercase tracking-[0.3em] animate-in fade-in slide-in-from-top-4 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">Sync Successful • Patch Operational</div>}
                          {fixStatus === 'error' && <div className="mt-8 p-6 bg-accent-rose/10 text-accent-rose rounded-3xl text-center font-black text-[10px] uppercase tracking-[0.3em] animate-in fade-in slide-in-from-top-4 border border-accent-rose/20 shadow-[0_0_30px_rgba(244,63,94,0.1)]">Injection Failed • Check Permissions</div>}
                        </div>
                      </div>
                    ) : (
                      <div className="h-[400px] flex flex-col items-center justify-center text-center p-12 opacity-30 grayscale gap-6">
                        <div className="p-8 bg-gray-100 dark:bg-dark-bg/50 rounded-full">
                          <Info className="w-12 h-12 text-gray-400" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.5em] font-display">Awaiting SRE Diagnostic Initiation</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="bg-dark-bg/90 rounded-5xl border border-white/5 shadow-2xl overflow-hidden flex flex-col min-h-[600px] cyber-card">
                  {selectedWorkload.podNames && selectedWorkload.podNames.length > 0 ? (
                    <LogStreamViewer
                      namespace={selectedWorkload.namespace}
                      podNames={selectedWorkload.podNames}
                    />
                  ) : (
                    <>
                      <div className="px-8 py-6 border-b border-white/5 bg-black/40 flex items-center justify-between gap-4 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></div>
                          <Terminal className="w-5 h-5 text-gray-400" />
                          <h3 className="text-[10px] font-black text-gray-100 uppercase tracking-[0.3em] font-display">Neural Log Stream</h3>
                        </div>
                        <div className="flex items-center gap-6">
                          <button
                            onClick={() => setIsLogSyncEnabled(!isLogSyncEnabled)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isLogSyncEnabled ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 text-gray-500 border border-transparent hover:text-gray-300'}`}
                            title="Sync View with Team"
                          >
                            <div className={`w-2 h-2 rounded-full ${isLogSyncEnabled ? 'bg-indigo-500 animate-pulse' : 'bg-gray-600'}`} />
                            Sync View
                          </button>
                          <div className="relative">
                            <Search className="w-4 h-4 text-gray-600 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Search heap..."
                              value={logSearchTerm}
                              onChange={(e) => handleLogSearchChange(e.target.value)}
                              className="bg-black/40 border border-white/5 rounded-2xl pl-12 pr-6 py-2.5 text-[11px] text-gray-300 placeholder:text-gray-700 focus:outline-none focus:border-primary-500/50 w-64 font-mono transition-all"
                            />
                          </div>
                          <button
                            onClick={handleLogWrapToggle}
                            className={`p-3 rounded-2xl transition-all ${isLogWrapEnabled ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30 shadow-[0_0_15px_rgba(14,165,233,0.1)]' : 'hover:bg-white/5 text-gray-600 border border-transparent'}`}
                            title={isLogWrapEnabled ? "Disable Wrap" : "Enable Wrap"}
                          >
                            <WrapText className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-8 overflow-auto font-mono text-[11px] leading-relaxed flex-1 bg-black/20 custom-scrollbar">
                        {(!selectedWorkload.recentLogs || selectedWorkload.recentLogs.length === 0) ? (
                          <div className="h-full flex flex-col items-center justify-center text-gray-700 gap-6 opacity-40">
                            <div className="p-10 bg-white/5 rounded-full ring-1 ring-white/10">
                              <Terminal className="w-12 h-12" />
                            </div>
                            <p className="font-black uppercase tracking-[0.5em] text-[10px] font-display">Empty Vector Space</p>
                          </div>
                        ) : (
                          selectedWorkload.recentLogs
                            .filter(log => !logSearchTerm || log.toLowerCase().includes(logSearchTerm.toLowerCase()))
                            .map((log, i) => (
                              <div key={i} className="flex gap-6 group hover:bg-primary-500/5 odd:bg-white/[0.01] px-6 py-1 items-start leading-relaxed border-l-2 border-transparent hover:border-primary-500 transition-all font-mono min-w-fit">
                                <span className="text-gray-700 select-none text-[10px] w-10 font-bold flex-shrink-0 text-right opacity-30 mt-[2px]">{i + 1}</span>
                                <div className={`text-gray-400 min-w-0 flex-1 text-[12px] selection:bg-primary-500/30 ${isLogWrapEnabled ? 'break-all whitespace-pre-wrap' : 'whitespace-nowrap'}`}>
                                  {highlightLog(log)}
                                </div>
                                <CopyButton text={log} className="opacity-0 group-hover:opacity-100 flex-shrink-0 scale-75 hover:bg-primary-500/20" />
                              </div>
                            ))
                        )}
                      </div>
                    </>
                  )}
                </section>
              </div>

              {/* Events Timeline */}
              <section className="bg-white dark:bg-dark-card rounded-5xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden cyber-card">
                <div className="px-10 py-8 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-dark-bg/50 flex items-center gap-4 font-display">
                  <AlertCircle className="w-6 h-6 text-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]" />
                  <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">Control Plane Timeline</h3>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {(selectedWorkload.events || []).map(event => (
                    <div key={event.id} className="p-8 flex items-center gap-10 group hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-all">
                      <div className={`p-4 rounded-3xl shrink-0 shadow-lg ${event.type === 'Warning' ? 'bg-accent-rose/10 text-accent-rose ring-1 ring-accent-rose/30 shadow-accent-rose/10' : 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/30'}`}>
                        {event.type === 'Warning' ? <AlertCircle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-6 mb-2">
                          <span className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight font-display">{event.reason}</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-full">{event.lastSeen}</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed truncate">{event.message}</p>
                      </div>
                      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-5 h-5 text-gray-300" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div >
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center h-full animate-in fade-in duration-1000">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-primary-500/10 rounded-full blur-[80px] animate-pulse"></div>
              <div className="p-12 bg-dark-bg/50 rounded-full border border-white/5 relative z-10 shadow-2xl">
                <ActivitySquare className="w-16 h-16 text-primary-500 animate-pulse" />
              </div>
            </div>
            <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter mb-6 uppercase font-display">Neural Command Center</h3>
            <p className="text-base text-gray-500 dark:text-gray-400 max-w-sm font-medium leading-relaxed opacity-70">
              Synchronize with the fleet by selecting a target vector from the triage matrix on the left.
            </p>
          </div>
        )
        }
      </main >
    </div >
  );
};
