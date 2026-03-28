import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Workload, ViewPropsWithChat, DiagnosticPlaybook } from '../types';
import { useMonitoring } from '../contexts/MonitoringContext';
import { usePresence } from '../contexts/PresenceContext';
import { analyzeWorkload } from '../services/geminiService';
import { generateRemediation, applyRemediation } from '../services/remediationService';
import ReactMarkdown from 'react-markdown';
import { Terminal, Loader2, Sparkles, Activity, Search, Globe, ChevronLeft, MessageSquareShare, ArrowRight, PanelLeftClose, PanelLeft, AlertCircle, CheckCircle2, ChevronRight, Layers, Server, Zap, Info, ShieldCheck, HardDrive, WrapText, Bot, Copy, Check, FileCheck, Hash, HeartPulse, Share2, TrendingDown, TrendingUp, Radio } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { MetricsChart } from './MetricsChart';
import { LogStreamViewer } from './LogStreamViewer';
import { CommentsThread } from './CommentsThread';

interface TriageReport {
    ID: number;
    ClusterID: string;
    WorkloadName: string;
    Analysis: string;
    Severity: string;
    IsRead: boolean;
    CreatedAt: string;
    AutoRemediationPayload?: string;
    ApprovalStatus?: string;
    IncidentType?: string;
}

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
      className={`p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors ${className}`}
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
    <div className={`${className} overflow-hidden relative group bg-dark-bg border border-white/10 rounded-xl`}>
      <div className="absolute right-3 top-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={() => setIsWrapped(!isWrapped)}
          className={`p-1.5 rounded-lg border border-white/10 text-xs transition-all ${
            isWrapped ? 'bg-primary-500/20 text-primary-400' : 'bg-dark-card text-zinc-400 hover:text-white'
          }`}
          title={isWrapped ? "Disable Wrapping" : "Enable Wrapping"}
        >
          <WrapText className="w-3.5 h-3.5" />
        </button>
        <CopyButton text={code} className="bg-dark-card border border-white/10" />
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
    Healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
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
    <div className="bg-dark-card rounded-2xl p-6 border border-white/5 relative overflow-hidden mb-6">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-500/10 rounded-xl">
            <Radio className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Network Path Trace</h4>
            <p className="text-xs text-zinc-500">L7 Ingress Diagnostic</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full">
          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
          <span className="text-xs font-medium text-rose-400">Degradation Detected</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto py-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-dark-bg border border-white/10 flex items-center justify-center text-zinc-400">
            <Globe className="w-6 h-6" />
          </div>
          <span className="text-[10px] text-zinc-500 uppercase">Ingress</span>
        </div>

        <div className="flex-1 h-px bg-gradient-to-r from-white/5 via-primary-500/50 to-white/5"></div>

        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
            <Zap className="w-7 h-7" />
          </div>
          <span className="text-xs font-medium text-white">Gateway</span>
        </div>

        <div className="flex-1 h-px bg-gradient-to-r from-white/5 via-rose-500/50 to-white/5"></div>

        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-dark-bg border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Server className="w-6 h-6" />
          </div>
          <span className="text-[10px] text-rose-400 uppercase">Backend</span>
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

  // Selection Logic
  useEffect(() => {
    if (targetWorkloadId) {
      const workload = workloads.find(w => w.id === targetWorkloadId || w.name === targetWorkloadId);
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
  }, [targetWorkloadId, workloads, targetTemplate]);

  useEffect(() => {
    return () => {
      if (selectedWorkload) notifyLeave(`workload-${selectedWorkload.id}`);
    };
  }, [selectedWorkload]);

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
      sessionStorage.setItem(`analysis_${workload.id}_${playbook}`, analysis);
      if (context) sessionStorage.setItem(`context_${workload.id}_${playbook}`, JSON.stringify(context));
    } catch (e) {
      setAnalysis("Diagnostic interrupted. API error.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredWorkloads = useMemo(() => {
    return workloads.filter(w => {
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
    if (!selectedWorkload) return { cpu: 0, mem: 0, storage: 0 };
    const cpuBase = selectedWorkload.metrics.cpuLimit > 0 ? selectedWorkload.metrics.cpuLimit : 0;
    const memBase = selectedWorkload.metrics.memoryLimit > 0 ? selectedWorkload.metrics.memoryLimit : 0;
    const storageBase = selectedWorkload.metrics.storageLimit > 0 ? selectedWorkload.metrics.storageLimit : 0;
    
    return {
      cpu: cpuBase > 0 ? Math.min(100, Math.round((selectedWorkload.metrics.cpuUsage / cpuBase) * 100)) : 0,
      mem: memBase > 0 ? Math.min(100, Math.round((selectedWorkload.metrics.memoryUsage / memBase) * 100)) : 0,
      storage: storageBase > 0 ? Math.min(100, Math.round((selectedWorkload.metrics.storageUsage! / storageBase) * 100)) : 0
    };
  }, [selectedWorkload]);

  const highlightLog = (log: string) => {
    const keywords = ['504', 'timeout', 'DiskPressure', 'failed', 'No space left', 'CRITICAL', 'ERROR', 'Exception', 'Panic'];
    let highlighted = log;
    highlighted = highlighted.replace(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/, '<span class="text-zinc-600 select-none">$1</span>');
    keywords.forEach(kw => {
      const regex = new RegExp(`(${kw})`, 'gi');
      highlighted = highlighted.replace(regex, '<span class="text-rose-400 font-semibold">$1</span>');
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
        <h2 className="text-lg font-semibold text-white mb-4 mt-6 pb-2 border-b border-white/5" {...props}>
          {children}
        </h2>
      );
    },
    ul({ children, ...props }: any) {
      return <ul className="space-y-2 my-4 list-none pl-0" {...props}>{children}</ul>;
    },
    li({ children, ...props }: any) {
      return (
        <li className="flex gap-3 items-start text-zinc-400 text-sm" {...props}>
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500/50 shrink-0" />
          <span className="flex-1">{children}</span>
        </li>
      );
    },
    strong({ children, ...props }: any) {
      return <strong className="font-semibold text-white" {...props}>{children}</strong>;
    }
  }), []);

  // Card base styles
  const cardBase = "bg-dark-card border border-white/5 rounded-xl";
  const cardHover = "hover:border-white/10 transition-all duration-200";

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full relative w-full overflow-hidden">
      {/* Sidebar */}
      <aside className={`${selectedWorkload && !isSidebarOpen ? 'hidden' : 'flex'} lg:flex flex-col ${cardBase} overflow-hidden shrink-0 transition-all duration-300 ${
        isDesktopCollapsed ? 'lg:w-16' : 'w-full lg:w-80'
      }`}>
        <div className={`border-b border-white/5 flex items-center ${isDesktopCollapsed ? 'p-4 justify-center' : 'p-4 justify-between'}`}>
          {!isDesktopCollapsed && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-600 rounded-lg">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-semibold text-white text-sm">Workloads</h3>
            </div>
          )}
          <button
            onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            className="hidden lg:flex p-2 hover:bg-white/5 rounded-lg text-zinc-400 transition-colors"
            title={isDesktopCollapsed ? "Expand" : "Collapse"}
          >
            {isDesktopCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
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
                  : 'hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium truncate ${selectedWorkload?.id === w.id ? 'text-white' : 'text-zinc-300'}`}>
                  {w.name}
                </span>
                <div className={`w-2 h-2 rounded-full ${
                  w.status === 'Healthy' ? 'bg-emerald-500' :
                  w.status === 'Warning' ? 'bg-amber-500' : 'bg-rose-500'
                }`} />
              </div>
              {!isDesktopCollapsed && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 uppercase">{w.kind}</span>
                  <span className="text-[10px] text-zinc-600">• {w.namespace}</span>
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
            <header className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-dark-bg rounded-lg border border-white/5">
                  <Terminal className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{selectedWorkload.name}</h2>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{selectedWorkload.namespace}</span>
                    <span>•</span>
                    <span>{selectedWorkload.kind}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                  <Activity className="w-4 h-4 text-primary-400" />
                  <select
                    value={selectedPlaybook}
                    onChange={(e) => { setSelectedPlaybook(e.target.value as DiagnosticPlaybook); setAnalysis(null); }}
                    className="bg-transparent text-sm text-white border-none focus:ring-0 cursor-pointer"
                  >
                    <option value="General Health">General Health</option>
                    <option value="Network Connectivity">Network</option>
                    <option value="Resource Constraints">Resources</option>
                  </select>
                </div>
                <button
                  onClick={handleAnalyzeLogs}
                  disabled={isAnalyzing}
                  className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Analyze
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`${cardBase} ${cardHover} p-4`}>
                  <p className="text-[10px] text-zinc-500 uppercase mb-1">Replicas</p>
                  <div className="text-2xl font-semibold text-white">
                    {selectedWorkload.availableReplicas}
                    <span className="text-sm text-zinc-500">/{selectedWorkload.replicas}</span>
                  </div>
                </div>

                <div className={`${cardBase} ${cardHover} p-4`}>
                  <p className="text-[10px] text-zinc-500 uppercase mb-1">CPU</p>
                  <div className={`text-2xl font-semibold ${saturation.cpu > 90 ? 'text-rose-400' : 'text-white'}`}>
                    {saturation.cpu}%
                  </div>
                </div>

                <div className={`${cardBase} ${cardHover} p-4`}>
                  <p className="text-[10px] text-zinc-500 uppercase mb-1">Memory</p>
                  <div className={`text-2xl font-semibold ${saturation.mem > 90 ? 'text-rose-400' : 'text-white'}`}>
                    {saturation.mem}%
                  </div>
                </div>

                <div className={`${cardBase} ${cardHover} p-4`}>
                  <p className="text-[10px] text-zinc-500 uppercase mb-1">Storage</p>
                  <div className={`text-2xl font-semibold ${saturation.storage > 85 ? 'text-rose-400' : 'text-white'}`}>
                    {saturation.storage}%
                  </div>
                </div>
              </div>

              {/* Recommendation */}
              {selectedWorkload.recommendation?.action !== 'None' && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <TrendingDown className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">Optimization Available</h4>
                      <p className="text-xs text-emerald-400">{selectedWorkload.recommendation.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-white">{selectedWorkload.recommendation.action}</span>
                    <span className="text-xs text-zinc-500">{selectedWorkload.recommendation.confidence}% confidence</span>
                  </div>
                </div>
              )}

              {/* Network Path */}
              {selectedPlaybook === 'Network Connectivity' && <TrafficPathExplorer workload={selectedWorkload} />}

              {/* AI Analysis */}
              <div className={`${cardBase} overflow-hidden`}>
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary-400" />
                    <span className="text-sm font-medium text-white">AI Analysis</span>
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
                      <div className="bg-primary-500/5 border border-primary-500/20 rounded-lg p-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary-600 rounded-lg">
                            <FileCheck className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-white">Analysis Complete</h4>
                            {currentReport && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-sm font-semibold ${
                                  currentReport.Severity === 'Critical' ? 'bg-rose-500/20 text-rose-400' :
                                  currentReport.Severity === 'Warning' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                  {currentReport.Severity}
                                </span>
                                {currentReport.IncidentType && (
                                  <span className="text-[10px] bg-white/10 text-zinc-300 px-1.5 py-0.5 rounded-sm">
                                    {currentReport.IncidentType}
                                  </span>
                                )}
                                <span className="text-[10px] text-zinc-500">
                                  {new Date(currentReport.CreatedAt).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Link to="/reports" className="text-xs bg-primary-500/10 text-primary-400 px-3 py-1.5 rounded-lg hover:bg-primary-500/20 transition-colors shrink-0">
                          View in Reports &rarr;
                        </Link>
                      </div>

                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown components={markdownComponents}>{analysis}</ReactMarkdown>
                      </div>

                      {/* Actions */}
                      <div className="mt-6 pt-4 border-t border-white/5 flex flex-wrap gap-3">
                        {!patchSuggestion ? (
                          <>
                            <button
                              onClick={handleDeepDive}
                              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              <MessageSquareShare className="w-4 h-4" /> Deep Dive
                            </button>
                            <button
                              onClick={handleGenerateFix}
                              disabled={isGeneratingFix}
                              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              {isGeneratingFix ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                              Generate Fix
                            </button>
                            <button
                              onClick={handleHandover}
                              className="px-4 py-2 text-zinc-400 hover:text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              <Share2 className="w-4 h-4" /> Export
                            </button>
                          </>
                        ) : (
                          <div className="w-full bg-dark-bg rounded-xl p-4 border border-white/5">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary-400" /> Proposed Fix
                              </h4>
                              <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${
                                patchSuggestion.risk === 'High'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                Risk: {patchSuggestion.risk}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mb-3">{patchSuggestion.reasoning}</p>
                            <CodeBlock language="yaml">{patchSuggestion.patchContent}</CodeBlock>
                            <div className="flex justify-end gap-2 mt-3">
                              <button
                                onClick={() => setPatchSuggestion(null)}
                                className="px-4 py-2 text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                              >
                                Discard
                              </button>
                              <button
                                onClick={handleApplyFix}
                                disabled={isApplyingFix}
                                className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
                    <div className="h-48 flex flex-col items-center justify-center text-zinc-500 gap-3">
                      <Info className="w-8 h-8" />
                      <p className="text-sm">Click "Analyze" to generate AI insights</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Logs */}
              <div className={`${cardBase} overflow-hidden flex flex-col min-h-[400px]`}>
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <Terminal className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm font-medium text-white">Logs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsLogSyncEnabled(!isLogSyncEnabled)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                        isLogSyncEnabled ? 'bg-primary-500/10 text-primary-400' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${isLogSyncEnabled ? 'bg-primary-400' : 'bg-zinc-600'}`} />
                      Sync
                    </button>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={logSearchTerm}
                        onChange={(e) => handleLogSearchChange(e.target.value)}
                        className="bg-dark-bg border border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-primary-500/50 w-40"
                      />
                    </div>
                    <button
                      onClick={handleLogWrapToggle}
                      className={`p-1.5 rounded-lg transition-colors ${isLogWrapEnabled ? 'bg-primary-500/10 text-primary-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                      title={isLogWrapEnabled ? "Disable Wrap" : "Enable Wrap"}
                    >
                      <WrapText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto font-mono text-xs p-4 custom-scrollbar bg-black/20">
                  {(!selectedWorkload.recentLogs || selectedWorkload.recentLogs.length === 0) ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-3">
                      <Terminal className="w-8 h-8" />
                      <p className="text-xs uppercase tracking-wider">No logs available</p>
                    </div>
                  ) : (
                    selectedWorkload.recentLogs
                      .filter(log => !logSearchTerm || log.toLowerCase().includes(logSearchTerm.toLowerCase()))
                      .map((log, i) => (
                        <div key={i} className="flex gap-3 group hover:bg-white/[0.02] px-2 py-1 items-start">
                          <span className="text-zinc-700 select-none w-8 text-right shrink-0">{i + 1}</span>
                          <div className={`text-zinc-400 flex-1 ${isLogWrapEnabled ? 'break-all whitespace-pre-wrap' : 'whitespace-nowrap overflow-hidden'}`}>
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
                <div className={`${cardBase} overflow-hidden`}>
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-white">Events</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {selectedWorkload.events?.map(event => (
                      <div key={event.id} className="p-4 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${
                          event.type === 'Warning' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {event.type === 'Warning' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-medium text-white">{event.reason}</span>
                            <span className="text-[10px] text-zinc-500">{event.lastSeen}</span>
                          </div>
                          <p className="text-xs text-zinc-400 truncate">{event.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="p-6 bg-primary-500/10 rounded-full mb-4">
              <Activity className="w-10 h-10 text-primary-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Select a Workload</h3>
            <p className="text-sm text-zinc-500 max-w-sm">
              Choose a workload from the sidebar to begin triage analysis.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
