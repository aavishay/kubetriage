import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Workload, TriageReport, ViewPropsWithChat, DiagnosticPlaybook, getMetricStatusColor } from '../types';
import { useMonitoring } from '../contexts/MonitoringContext';
import { usePresence } from '../contexts/PresenceContext';
import { analyzeWorkload } from '../services/geminiService';
import { generateRemediation, applyRemediation } from '../services/remediationService';
import ReactMarkdown from 'react-markdown';
import { Terminal, Loader2, Sparkles, Activity, Search, Globe, ChevronLeft, MessageSquareShare, ArrowRight, PanelLeftClose, PanelLeft, AlertCircle, CheckCircle2, ChevronRight, Layers, Server, Zap, Info, ShieldCheck, HardDrive, WrapText, Bot, Copy, Check, FileCheck, Hash, HeartPulse, Share2, TrendingDown, TrendingUp, Radio, X } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { MetricsChart } from './MetricsChart';
import { LogStreamViewer } from './LogStreamViewer';
import { CommentsThread } from './CommentsThread';

interface TriageViewProps extends ViewPropsWithChat {
  initialWorkloadId?: string;
  defaultTemplate?: string;
}

// Utility Components
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
      className={`p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const CodeBlock = ({ language, children, className = "" }: { language: string, children: React.ReactNode, className?: string }) => {
  const [isWrapped, setIsWrapped] = useState(false);
  const code = String(children).replace(/\n$/, '');

  return (
    <div className={`${className} overflow-hidden relative group bg-bg-main border border-border-main rounded-xl shadow-sm`}>
      <div className="absolute right-3 top-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={() => setIsWrapped(!isWrapped)}
          className={`p-1.5 rounded-lg border border-border-main text-xs transition-all shadow-sm ${
            isWrapped ? 'bg-primary-500/20 text-primary-600 dark:text-primary-400 border-primary-500/30' : 'bg-bg-card text-text-tertiary hover:text-text-primary'
          }`}
          title={isWrapped ? "Disable Wrapping" : "Enable Wrapping"}
        >
          <WrapText className="w-3.5 h-3.5" />
        </button>
        <CopyButton text={code} className="bg-bg-card border border-border-main shadow-sm" />
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        wrapLongLines={isWrapped}
        customStyle={{ margin: 0, padding: '1.5rem', fontSize: '13px', lineHeight: '1.6', background: 'transparent' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    Healthy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    Warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    Critical: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  };
  return (
    <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border ${colors[status as keyof typeof colors] || colors.Healthy}`}>
      {status}
    </span>
  );
};

// Traffic Path Explorer
const TrafficPathExplorer = ({ workload }: { workload: Workload }) => {
  return (
    <div className="bg-bg-card rounded-2xl p-6 border border-border-main relative overflow-hidden mb-6 shadow-sm">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-500/10 rounded-xl">
            <Radio className="w-5 h-5 text-primary-500 dark:text-primary-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-primary">Network Path Trace</h4>
            <p className="text-xs text-text-tertiary">L7 Ingress Diagnostic</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full">
          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Degradation Detected</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto py-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-bg-main border border-border-main flex items-center justify-center text-text-tertiary shadow-sm">
            <Globe className="w-6 h-6" />
          </div>
          <span className="text-[10px] text-text-tertiary uppercase">Ingress</span>
        </div>

        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent"></div>

        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
            <Zap className="w-7 h-7" />
          </div>
          <span className="text-xs font-medium text-text-primary">Gateway</span>
        </div>

        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent"></div>

        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-bg-main border border-rose-500/30 flex items-center justify-center text-rose-500 dark:text-rose-400 shadow-sm">
            <Server className="w-6 h-6" />
          </div>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 uppercase">Backend</span>
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
  const [selectedPlaybook, setSelectedPlaybook] = useState<DiagnosticPlaybook>(
    (targetTemplate as DiagnosticPlaybook) || 'General Health'
  );

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
  const [isLogSyncEnabled, setIsLogSyncEnabled] = useState(false);

  // Sync Logic
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

  // Fetch Latest Report whenever selection or analysis changes
  useEffect(() => {
    if (selectedWorkload) {
      fetch(`/api/reports?all=true&workloadName=${encodeURIComponent(selectedWorkload.name)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            // Usually returns sorted, so first one is latest
            setCurrentReport(data[0]);
          } else {
            setCurrentReport(null);
          }
        })
        .catch(err => {
          console.error("Failed to fetch workload report", err);
          setCurrentReport(null);
        });
    } else {
      setCurrentReport(null);
    }
  }, [selectedWorkload, analysis]);

  const safeWorkloads = workloads || [];

  // Selection Logic
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
          if (cached) {
            setAnalysis(cached);
          } else {
            // Check if there's an existing report in the DB first before hitting the AI again
            fetch(`/api/reports?all=true&workloadName=${encodeURIComponent(workload.name)}`)
              .then(res => res.json())
              .then(data => {
                if (data && data.length > 0 && data[0].Analysis && data[0].Analysis !== "No analysis generated.") {
                  setAnalysis(data[0].Analysis);
                  setCurrentReport(data[0]);
                  sessionStorage.setItem(cacheKey, data[0].Analysis);
                } else {
                  triggerAutoAnalysis(workload, selectedPlaybook);
                }
              })
              .catch(() => triggerAutoAnalysis(workload, selectedPlaybook));
          }
        } else if (selectedWorkload !== workload) {
          setSelectedWorkload(workload);
        }
      }
    }
  }, [targetWorkloadId, safeWorkloads, targetTemplate]);

  useEffect(() => {
    return () => {
      if (selectedWorkload) notifyLeave(`workload-${selectedWorkload.id}`);
    };
  }, [selectedWorkload]);

  useEffect(() => {
    if (selectedWorkload && !safeWorkloads.some(w => w.id === selectedWorkload.id)) {
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
      sessionStorage.setItem(`analysis_${workload.id}_${playbook}`, analysis);
      if (context) sessionStorage.setItem(`context_${workload.id}_${playbook}`, JSON.stringify(context));
    } catch (e) {
      setAnalysis("Diagnostic interrupted. API error.");
    } finally {
      setIsAnalyzing(false);
    }
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
      } catch (e) {
        console.error("Failed to fetch metrics", e);
      }
    };
    fetchMetrics();
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
    } catch (e) {
      setAnalysis("Error generating analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeepDive = () => {
    if (!selectedWorkload || !analysis) return;
    let fullContext = `WORKLOAD ANALYSIS REPORT:\n${analysis}\n\n`;
    if (enrichedContext) {
      if (enrichedContext.yaml) fullContext += `MANIFEST YAML:\n${enrichedContext.yaml}\n\n`;
      if (enrichedContext.metrics) fullContext += `METRIC TRENDS:\n${enrichedContext.metrics}\n\n`;
      if (enrichedContext.events?.length > 0) {
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
    } catch (e) {
      console.error(e);
      setFixStatus('error');
    } finally {
      setIsApplyingFix(false);
    }
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

  const hasGpu = useMemo(() => {
    return selectedWorkload?.metrics.gpuMemoryTotal && selectedWorkload.metrics.gpuMemoryTotal > 0;
  }, [selectedWorkload]);

  const highlightLog = (log: string) => {
    const keywords = ['504', 'timeout', 'DiskPressure', 'failed', 'No space left', 'CRITICAL', 'ERROR', 'Exception', 'Panic'];
    let highlighted = log;
    highlighted = highlighted.replace(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/, '<span class="text-text-tertiary select-none font-mono">$1</span>');
    keywords.forEach(kw => {
      const regex = new RegExp(`(${kw})`, 'gi');
      highlighted = highlighted.replace(regex, '<span class="text-rose-500 dark:text-rose-400 font-semibold">$1</span>');
    });
    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match
        ? <CodeBlock language={match[1]}>{children}</CodeBlock>
        : <code className="bg-primary-500/10 text-primary-400 px-1.5 py-0.5 rounded font-mono text-xs" {...props}>{children}</code>;
    },
    h2({ children, ...props }: any) {
      return (
        <h2 className="text-lg font-semibold text-text-primary mb-4 mt-6 pb-2 border-b border-border-main" {...props}>
          {children}
        </h2>
      );
    },
    ul({ children, ...props }: any) {
      return <ul className="space-y-2 my-4 list-none pl-0" {...props}>{children}</ul>;
    },
    li({ children, ...props }: any) {
      return (
        <li className="flex gap-3 items-start text-text-secondary text-sm" {...props}>
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500/50 shrink-0" />
          <span className="flex-1">{children}</span>
        </li>
      );
    },
    strong({ children, ...props }: any) {
      return <strong className="font-semibold text-text-primary" {...props}>{children}</strong>;
    }
  }), []);

  // Card base styles
  const cardBase = "bg-bg-card border border-border-main rounded-xl shadow-sm";
  const cardHover = "hover:border-primary-500/30 transition-all duration-200";

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full relative w-full overflow-hidden">
      {/* Sidebar */}
      <aside className={`${selectedWorkload && !isSidebarOpen ? 'hidden' : 'flex'} lg:flex flex-col ${cardBase} overflow-hidden shrink-0 transition-all duration-300 ${
        isDesktopCollapsed ? 'lg:w-16' : 'w-full lg:w-80'
      }`}>
        <div className={`border-b border-border-main flex items-center ${isDesktopCollapsed ? 'p-4 justify-center' : 'p-4 justify-between'}`}>
          {!isDesktopCollapsed && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-600 rounded-lg shadow-sm shadow-primary-500/20">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-semibold text-text-primary text-sm">Workloads</h3>
            </div>
          )}
          <button
            onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            className="hidden lg:flex p-2 hover:bg-bg-hover rounded-lg text-text-tertiary transition-colors"
            title={isDesktopCollapsed ? "Expand" : "Collapse"}
          >
            {isDesktopCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Filters */}
        {!isDesktopCollapsed && (
          <div className="px-3 pt-3 pb-2 space-y-2.5 border-b border-border-main">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter workloads..."
                value={workloadSearchTerm}
                onChange={(e) => setWorkloadSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-bg-hover/50 border border-border-main rounded-lg text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary-500/50 transition-colors"
              />
              {workloadSearchTerm && (
                <button
                  onClick={() => setWorkloadSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-bg-hover rounded text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status Chips */}
            <div className="flex items-center gap-1.5">
              {(['all', 'Healthy', 'Warning', 'Critical'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    statusFilter === s
                      ? s === 'all' ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400 border border-primary-500/30' :
                        s === 'Healthy' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' :
                        s === 'Warning' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
                        'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      : 'bg-bg-hover/50 text-text-tertiary border border-transparent hover:text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  {s === 'all' ? 'All' : s}
                  <span className="ml-1 opacity-60">
                    {s === 'all' ? safeWorkloads.length : safeWorkloads.filter(w => w.status === s).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Namespace Filter */}
            <select
              value={namespaceFilter}
              onChange={(e) => setNamespaceFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-bg-hover/50 border border-border-main rounded-lg text-[11px] text-text-primary focus:outline-none focus:border-primary-500/50 transition-colors cursor-pointer"
            >
              <option value="all">All Namespaces</option>
              {Array.from(new Set(safeWorkloads.map(w => w.namespace))).sort().map(ns => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {filteredWorkloads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
              <Search className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-xs font-medium uppercase tracking-wider">No workloads match</p>
              <p className="text-[10px] mt-1 opacity-60">Try adjusting filters</p>
            </div>
          )}
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
              className={`group p-3 rounded-lg cursor-pointer transition-all ${
                selectedWorkload?.id === w.id
                  ? 'bg-primary-500/10 border border-primary-500/30'
                  : 'hover:bg-bg-hover border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium truncate ${selectedWorkload?.id === w.id ? 'text-text-primary' : 'text-text-secondary'}`}>
                  {w.name}
                </span>
                <div className={`w-2 h-2 rounded-full ${
                  getMetricStatusColor(w.status === 'Healthy' ? 0 : w.status === 'Warning' ? 80 : 100)
                }`} />
              </div>
              {!isDesktopCollapsed && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-tertiary uppercase font-medium">{w.kind}</span>
                  <span className="text-[10px] text-text-tertiary/70 select-none">•</span>
                  <span className="text-[10px] text-text-tertiary">{w.namespace}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${!selectedWorkload || isSidebarOpen ? 'hidden' : 'flex'} lg:flex flex-1 min-w-0 ${cardBase} overflow-hidden flex-col`}>
        {selectedWorkload ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <header className="p-4 border-b border-border-main flex flex-wrap items-center justify-between gap-4 bg-bg-hover/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-bg-main rounded-lg border border-border-main shadow-sm">
                  <Terminal className="w-5 h-5 text-primary-500 dark:text-primary-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">{selectedWorkload.name}</h2>
                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                    <span>{selectedWorkload.namespace}</span>
                    <span className="text-border-main select-none">•</span>
                    <span>{selectedWorkload.kind}</span>
                  </div>
                </div>
                       <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-bg-main px-3 py-2 rounded-lg border border-border-main shadow-sm transition-all focus-within:border-primary-500/50 group">
                  <Activity className="w-4 h-4 text-primary-500 dark:text-primary-400 group-hover:scale-110 transition-transform" />
                  <select
                    value={selectedPlaybook}
                    onChange={(e) => { setSelectedPlaybook(e.target.value as DiagnosticPlaybook); setAnalysis(null); }}
                    className="bg-transparent text-sm text-text-primary border-none focus:ring-0 cursor-pointer appearance-none pr-6"
                  >
                    <option value="General Health">General Health</option>
                    <option value="Network Connectivity">Network</option>
                    <option value="Resource Constraints">Resources</option>
                  </select>
                </div>
                <button
                  onClick={handleAnalyzeLogs}
                  disabled={isAnalyzing}
                  className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-primary-500/20"
                >
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Analyze
                </button>
              </div>
      </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`${cardBase} ${cardHover} p-4`}>
                  <p className="text-[10px] text-text-tertiary uppercase mb-1">Replicas</p>
                  <div className="text-2xl font-semibold text-text-primary">
                    {selectedWorkload.availableReplicas}
                    <span className="text-sm text-text-tertiary">/{selectedWorkload.replicas}</span>
                  </div>
                </div>

                <div className={`${cardBase} ${cardHover} p-4`}>
                  <p className="text-[10px] text-text-tertiary uppercase mb-1">CPU</p>
                  <div className={`text-2xl font-semibold ${saturation.cpu > 90 ? 'text-rose-500' : 'text-text-primary'}`}>
                    {saturation.cpu}%
                  </div>
                </div>

                <div className={`${cardBase} ${cardHover} p-4`}>
                  <p className="text-[10px] text-text-tertiary uppercase mb-1">Memory</p>
                  <div className={`text-2xl font-semibold ${saturation.mem > 90 ? 'text-rose-500' : 'text-text-primary'}`}>
                    {saturation.mem}%
                  </div>
                </div>

                <div className={`${cardBase} ${cardHover} p-4`}>
                  <p className="text-[10px] text-text-tertiary uppercase mb-1">Storage</p>
                  <div className={`text-2xl font-semibold ${saturation.storage > 85 ? 'text-rose-500' : 'text-text-primary'}`}>
                    {saturation.storage}%
                  </div>
                </div>

                {hasGpu && (
                  <div className={`${cardBase} ${cardHover} p-4 border-purple-500/20`}>
                    <p className="text-[10px] text-text-tertiary uppercase mb-1 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-purple-500" /> GPU
                    </p>
                    <div className={`text-2xl font-semibold ${saturation.gpu > 90 ? 'text-rose-500' : 'text-purple-600 dark:text-purple-400'}`}>
                      {saturation.gpu}%
                    </div>
                    {selectedWorkload?.metrics.gpuTemperature !== undefined && (
                      <div className="text-[10px] text-text-tertiary mt-1">
                        {selectedWorkload.metrics.gpuTemperature}°C
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recommendation */}
              {selectedWorkload.recommendation?.action !== 'None' && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <TrendingDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-text-primary">Optimization Available</h4>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">{selectedWorkload.recommendation.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-text-primary">{selectedWorkload.recommendation.action}</span>
                    <span className="text-xs text-text-tertiary">{selectedWorkload.recommendation.confidence}% confidence</span>
                  </div>
                </div>
              )}

              {/* Network Path */}
              {selectedPlaybook === 'Network Connectivity' && <TrafficPathExplorer workload={selectedWorkload} />}

              {/* AI Analysis */}
              <div className={`${cardBase} overflow-hidden shadow-sm`}>
                <div className="px-4 py-3 border-b border-border-main flex items-center justify-between bg-bg-hover/30">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary-500 dark:text-primary-400" />
                    <span className="text-sm font-medium text-text-primary">AI Analysis</span>
                  </div>
                </div>

                <div className="p-4">
                  {isAnalyzing ? (
                    <div className="h-48 flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                      <p className="text-sm text-zinc-500">Analyzing workload...</p>
                    </div>
                  ) : analysis ? (
                    <div className="animate-fade-in">
                      <div className="bg-primary-500/5 border border-primary-500/20 rounded-lg p-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary-600 rounded-lg shadow-sm shadow-primary-500/20">
                            <FileCheck className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-text-primary">Analysis Complete</h4>
                            {currentReport && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-sm font-semibold ${
                                  currentReport.Severity === 'Critical' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' :
                                  currentReport.Severity === 'Warning' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                  'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                }`}>
                                  {currentReport.Severity}
                                </span>
                                {currentReport.IncidentType && (
                                  <span className="text-[10px] bg-bg-hover text-text-secondary px-1.5 py-0.5 rounded-sm border border-border-main">
                                    {currentReport.IncidentType}
                                  </span>
                                )}
                                <span className="text-[10px] text-text-tertiary">
                                  {new Date(currentReport.CreatedAt).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Link to="/reports" className="text-xs bg-primary-500/10 text-primary-600 dark:text-primary-400 px-3 py-1.5 rounded-lg hover:bg-primary-500/20 transition-colors shrink-0 font-medium">
                          View in Reports &rarr;
                        </Link>
                      </div>

                      <div className="prose prose-sm dark:prose-invert max-w-none text-text-secondary">
                        <ReactMarkdown components={markdownComponents}>{analysis}</ReactMarkdown>
                      </div>

                      {/* Actions */}
                      <div className="mt-6 pt-4 border-t border-border-main flex flex-wrap gap-3">
                        {!patchSuggestion ? (
                          <>
                            <button
                              onClick={handleDeepDive}
                              className="px-4 py-2 bg-bg-hover hover:bg-bg-hover/80 text-text-primary rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-border-main shadow-sm"
                            >
                              <MessageSquareShare className="w-4 h-4" /> Deep Dive
                            </button>
                            <button
                              onClick={handleGenerateFix}
                              disabled={isGeneratingFix}
                              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-primary-500/20"
                            >
                              {isGeneratingFix ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                              Generate Fix
                            </button>
                            <button
                              onClick={handleHandover}
                              className="px-4 py-2 text-text-tertiary hover:text-text-primary rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              <Share2 className="w-4 h-4" /> Export
                            </button>
                          </>
                        ) : (
                          <div className="w-full bg-bg-main rounded-xl p-4 border border-border-main shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary-500 dark:text-primary-400" /> Proposed Fix
                              </h4>
                              <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${
                                patchSuggestion.risk === 'High'
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              }`}>
                                Risk: {patchSuggestion.risk}
                              </span>
                            </div>
                            <p className="text-xs text-text-tertiary mb-3">{patchSuggestion.reasoning}</p>
                            <CodeBlock language="yaml">{patchSuggestion.patchContent}</CodeBlock>
                            <div className="flex justify-end gap-2 mt-3">
                              <button
                                onClick={() => setPatchSuggestion(null)}
                                className="px-4 py-2 text-text-tertiary hover:text-text-primary text-sm font-medium transition-colors"
                              >
                                Discard
                              </button>
                              <button
                                onClick={handleApplyFix}
                                disabled={isApplyingFix}
                                className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-primary-500/20"
                              >
                                {isApplyingFix ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                                Apply Fix
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {fixStatus === 'success' && (
                        <div className="mt-4 p-3 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm text-center border border-emerald-500/20">
                          Fix applied successfully
                        </div>
                      )}
                      {fixStatus === 'error' && (
                        <div className="mt-4 p-3 bg-rose-500/10 text-rose-400 rounded-lg text-sm text-center border border-rose-500/20">
                          Failed to apply fix
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-48 flex flex-col items-center justify-center text-text-tertiary gap-3">
                      <Info className="w-8 h-8" />
                      <p className="text-sm">Click "Analyze" to generate AI insights</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Logs */}
              <div className={`${cardBase} overflow-hidden flex flex-col min-h-[400px] shadow-sm`}>
                <div className="px-4 py-3 border-b border-border-main flex items-center justify-between gap-4 bg-bg-hover/30">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <Terminal className="w-4 h-4 text-text-tertiary" />
                    <span className="text-sm font-medium text-text-primary">Logs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsLogSyncEnabled(!isLogSyncEnabled)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                        isLogSyncEnabled ? 'bg-primary-500/10 text-primary-400' : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${isLogSyncEnabled ? 'bg-primary-400' : 'bg-text-tertiary'}`} />
                      Sync
                    </button>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={logSearchTerm}
                        onChange={(e) => handleLogSearchChange(e.target.value)}
                        className="kt-input pl-8 pr-3 py-1.5 text-xs w-40"
                      />
                    </div>
                    <button
                      onClick={handleLogWrapToggle}
                      className={`p-1.5 rounded-lg transition-colors ${isLogWrapEnabled ? 'bg-primary-500/10 text-primary-500 dark:text-primary-400' : 'text-text-tertiary hover:text-text-primary'}`}
                      title={isLogWrapEnabled ? "Disable Wrap" : "Enable Wrap"}
                    >
                      <WrapText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto font-mono text-xs p-4 custom-scrollbar bg-bg-main/50">
                  {(!selectedWorkload.recentLogs || selectedWorkload.recentLogs.length === 0) ? (
                    <div className="h-full flex flex-col items-center justify-center text-text-tertiary/50 gap-3">
                      <Terminal className="w-8 h-8 opacity-20" />
                      <p className="text-xs uppercase tracking-wider font-medium">No logs available</p>
                    </div>
                  ) : (
                    selectedWorkload.recentLogs
                      .filter(log => !logSearchTerm || log.toLowerCase().includes(logSearchTerm.toLowerCase()))
                      .map((log, i) => (
                        <div key={i} className="flex gap-3 group hover:bg-bg-hover px-2 py-1 items-start transition-colors">
                          <span className="text-text-tertiary/50 select-none w-8 text-right shrink-0">{i + 1}</span>
                          <div className={`text-text-secondary flex-1 ${isLogWrapEnabled ? 'break-all whitespace-pre-wrap' : 'whitespace-nowrap overflow-hidden'}`}>
                            {highlightLog(log)}
                          </div>
                          <CopyButton text={log} className="opacity-0 group-hover:opacity-100 shrink-0" />
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Events */}
              {(selectedWorkload.events?.length || 0) > 0 && (
                <div className={`${cardBase} overflow-hidden shadow-sm`}>
                  <div className="px-4 py-3 border-b border-border-main flex items-center gap-2 bg-bg-hover/30">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-text-primary">Events</span>
                  </div>
                  <div className="divide-y divide-border-main">
                    {selectedWorkload.events?.map(event => (
                      <div key={event.id} className="p-4 flex items-start gap-3 hover:bg-bg-hover transition-colors"
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${
                          event.type === 'Warning' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {event.type === 'Warning' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-medium text-text-primary">{event.reason}</span>
                            <span className="text-[10px] text-text-tertiary">{event.lastSeen}</span>
                          </div>
                          <p className="text-xs text-text-secondary truncate">{event.message}</p>
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
            <div className="p-6 bg-primary-500/10 rounded-full mb-4 shadow-xl shadow-primary-500/5">
              <Activity className="w-10 h-10 text-primary-500 dark:text-primary-400" />
            </div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">Select a Workload</h3>
            <p className="text-sm text-text-tertiary max-w-sm">
              Choose a workload from the sidebar to begin triage analysis.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
