
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workload } from '../types';
import { generateTopologyDiagram } from '../services/geminiService';
import { useMonitoring } from '../contexts/MonitoringContext';
import { Loader2, Image as ImageIcon, Download, Sparkles, AlertCircle, Share2, ZoomIn, Info, LayoutGrid, Box, Server, Layers, Globe, RefreshCw } from 'lucide-react';
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
        <div className="flex flex-col h-full w-full bg-gray-50 dark:bg-dark-bg transition-colors duration-300 font-sans">
            {/* Header - Fixed Height */}
            <div className="shrink-0 p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3 tracking-tighter uppercase">
                        <Share2 className="w-6 h-6 text-primary-500" />
                        Architecture Topology
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Visualize your cluster&apos;s workload distribution and dependencies.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                        <button
                            onClick={() => setViewMode('schematic')}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest rounded-md flex items-center gap-2 transition-all ${viewMode === 'schematic'
                                ? 'bg-white dark:bg-zinc-700 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                                }`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" /> Schematic
                        </button>
                        <button
                            onClick={() => setViewMode('graph')}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest rounded-md flex items-center gap-2 transition-all ${viewMode === 'graph'
                                ? 'bg-white dark:bg-zinc-700 text-primary-600 dark:text-primary-400 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                                }`}
                        >
                            <ImageIcon className="w-3.5 h-3.5" /> AI Diagram
                        </button>
                    </div>

                    {viewMode === 'graph' && (
                        <div className="flex items-center gap-2">
                            <select
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
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
                                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 active:scale-95"
                            >
                                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                {renderedSvg ? 'Regenerate' : 'Generate Map'}
                            </button>

                            {renderedSvg && (
                                <button
                                    onClick={downloadImage}
                                    className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors"
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
            <div className="flex-1 min-h-0 overflow-auto relative bg-zinc-100/50 dark:bg-black/20 p-4">

                {/* Error State */}
                {error && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center max-w-2xl w-full animate-in fade-in slide-in-from-top-4">
                        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 w-full">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium flex-1">{error}</p>
                            <button
                                onClick={() => setShowDebug(!showDebug)}
                                className="text-xs font-bold uppercase underline decoration-red-400/50 hover:text-red-800 dark:hover:text-red-100"
                            >
                                {showDebug ? 'Hide Code' : 'Show Code'}
                            </button>
                            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-700 dark:hover:text-red-200"><Box className="w-4 h-4 rotate-45" /></button>
                        </div>
                        {showDebug && diagramCode && (
                            <div className="mt-2 w-full bg-zinc-900 text-zinc-300 p-4 rounded-xl text-xs font-mono overflow-auto max-h-64 border border-zinc-700 shadow-2xl">
                                <pre>{diagramCode}</pre>
                            </div>
                        )}
                    </div>
                )}

                {/* Graph View (AI Image) */}
                {viewMode === 'graph' && (
                    <div className="h-full w-full flex items-center justify-center min-h-[500px]">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center gap-4 text-center p-8">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                                    <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin relative z-10" />
                                </div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Generating Architecture Diagram...</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
                                    Analyzing workload relationships and rendering high-fidelity topology using Generative AI. This may take 5-10 seconds.
                                </p>
                            </div>
                        ) : renderedSvg ? (
                            <div className="relative w-full h-full flex items-center justify-center overflow-auto p-4 animate-in zoom-in-95 duration-500">
                                <div
                                    className="max-w-full max-h-full shadow-2xl rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
                                    dangerouslySetInnerHTML={{ __html: renderedSvg }}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 max-w-2xl mx-auto">
                                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
                                    <Sparkles className="w-8 h-8 text-indigo-500" />
                                </div>
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Generate AI Architecture Diagram</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-md">
                                    Use Generative AI to visually reconstruct your cluster&apos;s architecture based on current workload definitions, namespaces, and inferred traffic patterns.
                                </p>
                                <button
                                    onClick={handleGenerateDiagram}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
                                >
                                    <Sparkles className="w-5 h-5" /> Generate Diagram
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Schematic View (CSS Grid) */}
                {viewMode === 'schematic' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                        {Object.entries(groupedWorkloads).map(([namespace, items]: [string, Workload[]]) => (
                            <div key={namespace} className="bg-white dark:bg-dark-card rounded-[2.5rem] border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm flex flex-col group/namespace hover:shadow-xl transition-shadow">
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-zinc-500" />
                                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{namespace}</span>
                                    </div>
                                    <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-full">
                                        {items.length} workloads
                                    </span>
                                </div>
                                <div className="p-4 grid grid-cols-1 gap-3">
                                    {items.map(w => (
                                        <div
                                            key={w.id}
                                            onClick={() => navigate(`/triage?workload=${w.name}&playbook=General%20Health`)}
                                            className="flex items-center justify-between p-4 rounded-3xl border-2 border-transparent hover:border-primary-500/30 bg-gray-50/50 dark:bg-dark-bg/50 transition-all cursor-pointer hover:bg-white dark:hover:bg-white/5 group shadow-sm hover:shadow-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-8 rounded-full transition-all group-hover:scale-110 ${w.status === 'Healthy' ? 'bg-emerald-500' :
                                                    w.status === 'Warning' ? 'bg-amber-500' : 'bg-red-500'
                                                    }`}></div>
                                                <div>
                                                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{w.name}</div>
                                                    <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                                                        <Box className="w-3 h-3" /> {w.kind}
                                                        <span className="text-zinc-300 dark:text-zinc-700">|</span>
                                                        <Server className="w-3 h-3" /> {w.replicas} pods
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="text-[10px] font-mono text-zinc-500">
                                                    CPU: {w.metrics.cpuLimit > 0 ? Math.round((w.metrics.cpuUsage / w.metrics.cpuLimit) * 100) : 0}%
                                                </div>
                                                <div className="w-16 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${w.metrics.cpuLimit > 0 && (w.metrics.cpuUsage / w.metrics.cpuLimit) > 0.9 ? 'bg-red-500' :
                                                            w.metrics.cpuLimit > 0 && (w.metrics.cpuUsage / w.metrics.cpuLimit) > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
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
