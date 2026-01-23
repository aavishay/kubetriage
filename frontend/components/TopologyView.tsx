
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workload } from '../types';
import { generateTopologyDiagram } from '../services/geminiService';
import { useMonitoring } from '../contexts/MonitoringContext';
import { Loader2, Image as ImageIcon, Download, Sparkles, AlertCircle, Share2, ZoomIn, Info, LayoutGrid, Box, Server, Layers, Globe, RefreshCw, X } from 'lucide-react';
import mermaid from 'mermaid';

interface TopologyViewProps {
    workloads: Workload[];
    isDarkMode?: boolean;
}

export const TopologyView: React.FC<TopologyViewProps> = ({ workloads, isDarkMode = true }) => {
    const navigate = useNavigate();
    const { aiConfig } = useMonitoring();
    const [viewMode, setViewMode] = useState<'graph' | 'schematic'>('schematic');
    const [diagramCode, setDiagramCode] = useState<string | null>(null);
    const [renderedSvg, setRenderedSvg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [error, setError] = useState<string | null>(null);
    const [showDebug, setShowDebug] = useState(false);

    // Initialize mermaid
    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: isDarkMode ? 'dark' : 'default',
            securityLevel: 'loose',
        });
    }, [isDarkMode]);

    // Group workloads by namespace for Schematic View
    const groupedWorkloads = useMemo<Record<string, Workload[]>>(() => {
        const groups: Record<string, Workload[]> = {};
        workloads.forEach(w => {
            if (!groups[w.namespace]) groups[w.namespace] = [];
            groups[w.namespace].push(w);
        });
        return groups;
    }, [workloads]);

    const handleGenerateDiagram = async () => {
        setIsLoading(true);
        setError(null);
        setDiagramCode(null);
        setRenderedSvg(null);
        try {
            const code = await generateTopologyDiagram(workloads, aspectRatio, aiConfig.provider, aiConfig.model);
            if (code) {
                setDiagramCode(code);
                setViewMode('graph'); // Auto switch to graph view on success
                if (!isMounted.current) return;

                // Render Mermaid if mounted
                try {
                    // Unique ID to prevent collision if multiple renders happen fast
                    const id = `mermaid-${Date.now()}`;
                    const { svg } = await mermaid.render(id, code);
                    if (isMounted.current) {
                        setRenderedSvg(svg);
                    }
                } catch (renderError) {
                    console.error("Mermaid Render Error", renderError);
                    console.error("Failed Diagram Code:\n", code);
                    if (isMounted.current) {
                        const errorMessage = renderError instanceof Error ? renderError.message : String(renderError);
                        setError(`Failed to render diagram. Mermaid Error: ${errorMessage}`);
                    }
                    // Attempt to clean up any stray error divs mermaid might have appended to body
                    const errorDiv = document.querySelector(`#dmermaid-${Date.now()}`); // Heuristic
                    if (errorDiv) errorDiv.remove();
                }
            } else {
                if (isMounted.current) setError("Failed to generate architecture diagram. Please try again.");
            }
        } catch (e) {
            console.error(e);
            if (isMounted.current) setError("An error occurred while communicating with the AI service. If using local AI, ensure backend is running.");
        } finally {
            if (isMounted.current) setIsLoading(false);
        }
    };

    // Mount tracking
    const isMounted = React.useRef(true);
    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const downloadImage = () => {
        if (renderedSvg) {
            const blob = new Blob([renderedSvg], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `architecture-topology-${new Date().toISOString()}.svg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-dark-bg bg-mesh text-zinc-100 font-sans selection:bg-primary-500/30">
            {/* Header - Fixed Height */}
            <div className="shrink-0 p-6 border-b border-white/5 bg-white/5 backdrop-blur-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-4 tracking-tighter font-display uppercase">
                        <div className="p-2.5 bg-gradient-to-br from-primary-600 to-indigo-600 rounded-xl shadow-lg shadow-primary-500/20 border border-white/10">
                            <Share2 className="w-6 h-6 text-white" />
                        </div>
                        Architecture Topology
                    </h2>
                    <p className="text-sm text-zinc-400 mt-2 font-light tracking-wide pl-1">
                        Visualize cluster workload distribution and neural dependencies.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                        <button
                            onClick={() => setViewMode('schematic')}
                            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg flex items-center gap-2 transition-all ${viewMode === 'schematic'
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                                : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
                                }`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" /> Schematic
                        </button>
                        <button
                            onClick={() => setViewMode('graph')}
                            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg flex items-center gap-2 transition-all ${viewMode === 'graph'
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                                : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
                                }`}
                        >
                            <ImageIcon className="w-3.5 h-3.5" /> Neural Map
                        </button>
                    </div>

                    {viewMode === 'graph' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                            <select
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="bg-black/20 border border-white/10 text-zinc-300 text-xs rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 hover:bg-white/5 transition-colors"
                                disabled={isLoading}
                            >
                                <option value="16:9">16:9 (Landscape)</option>
                                <option value="4:3">4:3 (Standard)</option>
                                <option value="1:1">1:1 (Square)</option>
                                <option value="9:16">9:16 (Portrait)</option>
                            </select>

                            <button
                                onClick={handleGenerateDiagram}
                                disabled={isLoading}
                                className="bg-white hover:bg-zinc-200 text-black px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 active:scale-95 disabled:active:scale-100"
                            >
                                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary-600" />}
                                {renderedSvg ? 'Regenerate' : 'Generate Map'}
                            </button>

                            {renderedSvg && (
                                <button
                                    onClick={downloadImage}
                                    className="bg-black/20 hover:bg-white/10 text-zinc-400 hover:text-white p-2.5 rounded-xl border border-white/10 transition-colors"
                                    title="Download SVG"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 min-h-0 overflow-auto relative p-6 custom-scrollbar">

                {/* Error State */}
                {error && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center max-w-2xl w-full animate-in fade-in slide-in-from-top-4">
                        <div className="bg-red-500/10 backdrop-blur-md border border-red-500/30 text-red-200 px-6 py-4 rounded-2xl shadow-2xl flex items-start gap-4 w-full">
                            <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-red-100 uppercase tracking-wider mb-1">Rendering Error</h4>
                                <p className="text-sm opacity-90">{error}</p>
                            </div>
                            <button
                                onClick={() => setShowDebug(!showDebug)}
                                className="text-xs font-bold uppercase underline decoration-red-400/50 hover:text-white"
                            >
                                {showDebug ? 'Hide Code' : 'Debug'}
                            </button>
                            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        {showDebug && diagramCode && (
                            <div className="mt-2 w-full bg-zinc-950 text-zinc-300 p-6 rounded-2xl text-xs font-mono overflow-auto max-h-96 border border-white/10 shadow-2xl custom-scrollbar relative">
                                <div className="absolute top-2 right-4 text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Mermaid Source</div>
                                <pre>{diagramCode}</pre>
                            </div>
                        )}
                    </div>
                )}

                {/* Graph View (AI Image) */}
                {viewMode === 'graph' && (
                    <div className="h-full w-full flex items-center justify-center min-h-[500px]">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center gap-6 text-center">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary-500 rounded-full blur-[3rem] opacity-20 animate-pulse"></div>
                                    <div className="relative bg-black/40 p-4 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
                                        <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-2 font-display tracking-wide">Constructing Neural Map...</h3>
                                    <p className="text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
                                        Analyzing workload relationships and rendering high-fidelity topology via Generative AI.
                                    </p>
                                </div>
                            </div>
                        ) : renderedSvg ? (
                            <div className="relative w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-500">
                                <div
                                    className="max-w-full max-h-full overflow-auto shadow-2xl rounded-3xl border border-white/10 bg-zinc-900/50 backdrop-blur-sm p-8 cyber-card"
                                    onClick={(e) => {
                                        // Simple zoom logic could go here
                                    }}
                                    dangerouslySetInnerHTML={{ __html: renderedSvg }}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center p-12 bg-white/5 backdrop-blur-sm rounded-[3rem] border border-white/5 max-w-2xl mx-auto hover:bg-white/[0.07] transition-all group cyber-card">
                                <div className="w-20 h-20 bg-gradient-to-br from-primary-500/20 to-indigo-500/20 rounded-3xl flex items-center justify-center mb-8 border border-white/5 group-hover:scale-110 transition-transform duration-500">
                                    <Sparkles className="w-10 h-10 text-primary-400" />
                                </div>
                                <h3 className="text-2xl font-black text-white mb-3 font-display uppercase tracking-wider">Neural Map Generator</h3>
                                <p className="text-zinc-400 mb-8 max-w-md text-sm leading-relaxed">
                                    Use Generative AI to visually reconstruct your cluster architecture. Typically visualizes namespaces, workload kinds, and inferred network traffic.
                                </p>
                                <button
                                    onClick={handleGenerateDiagram}
                                    className="bg-primary-600 hover:bg-primary-500 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-primary-500/20 transition-all flex items-center gap-3 hover:-translate-y-1 active:translate-y-0 active:scale-95"
                                >
                                    <Sparkles className="w-5 h-5" /> Initialize Generation
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Schematic View (Grid) */}
                {viewMode === 'schematic' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                        {Object.entries(groupedWorkloads).map(([namespace, items]: [string, Workload[]]) => (
                            <div key={namespace} className="bg-dark-card border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col group/namespace hover:border-primary-500/30 transition-all duration-300 backdrop-blur-sm">
                                <div className="bg-white/5 p-4 border-b border-white/5 flex items-center justify-between group-hover/namespace:bg-white/[0.07] transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                                            <Layers className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-white tracking-wide">{namespace}</span>
                                    </div>
                                    <span className="text-[10px] font-bold bg-black/40 text-zinc-400 px-2.5 py-1 rounded-full border border-white/5">
                                        {items.length} WORKLOADS
                                    </span>
                                </div>
                                <div className="p-4 grid grid-cols-1 gap-3">
                                    {items.map(w => (
                                        <div
                                            key={w.id}
                                            onClick={() => navigate(`/triage?workload=${w.name}&playbook=General%20Health`)}
                                            className="relative flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-black/20 hover:bg-white/5 transition-all cursor-pointer group hover:border-primary-500/20 overflow-hidden"
                                        >
                                            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                            <div className="flex items-center gap-4 z-10">
                                                <div className={`w-1.5 h-10 rounded-full shadow-[0_0_10px_currentColor] transition-all group-hover:scale-110 ${w.status === 'Healthy' ? 'bg-emerald-500 text-emerald-500/50' :
                                                    w.status === 'Warning' ? 'bg-amber-500 text-amber-500/50' : 'bg-red-500 text-red-500/50'
                                                    }`}></div>
                                                <div>
                                                    <div className="text-sm font-bold text-zinc-200 group-hover:text-primary-300 transition-colors">{w.name}</div>
                                                    <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-1 font-mono uppercase">
                                                        <span className="flex items-center gap-1"><Box className="w-3 h-3" /> {w.kind}</span>
                                                        <span className="text-zinc-700">|</span>
                                                        <span className="flex items-center gap-1"><Server className="w-3 h-3" /> {w.replicas}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-1.5 z-10">
                                                <div className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors">
                                                    CPU: {w.metrics.cpuLimit > 0 ? Math.round((w.metrics.cpuUsage / w.metrics.cpuLimit) * 100) : 0}%
                                                </div>
                                                <div className="w-20 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ${w.metrics.cpuLimit > 0 && (w.metrics.cpuUsage / w.metrics.cpuLimit) > 0.9 ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' :
                                                            w.metrics.cpuLimit > 0 && (w.metrics.cpuUsage / w.metrics.cpuLimit) > 0.7 ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                                                            }`}
                                                        style={{ width: `${w.metrics.cpuLimit > 0 ? Math.min(100, (w.metrics.cpuUsage / w.metrics.cpuLimit) * 100) : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
