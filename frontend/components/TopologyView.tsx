
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workload, getMetricStatusColor } from '../types';
import { generateTopologyDiagram } from '../services/geminiService';
import { useMonitoring } from '../contexts/MonitoringContext';
import { Loader2, Image as ImageIcon, Download, Sparkles, AlertCircle, Share2, LayoutGrid, Box, Server, Layers, RefreshCw, X } from 'lucide-react';
import mermaid from 'mermaid';

interface TopologyViewProps {
    workloads: Workload[];
}

const getStatusBarClass = (status: string) => {
    switch (status) {
        case 'Healthy': return 'bg-success shadow-success/30';
        case 'Warning': return 'bg-warning shadow-warning/30';
        default: return 'bg-danger shadow-danger/30';
    }
};

export const TopologyView: React.FC<TopologyViewProps> = ({ workloads }) => {
    const navigate = useNavigate();
    const { aiConfig, isDarkMode } = useMonitoring();
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
        (workloads || []).forEach(w => {
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
        <div className="flex flex-col h-full w-full bg-bg-main text-text-primary font-sans kt-page-enter">
            {/* Header */}
            <div className="shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
                <div>
                    <h2 className="font-sans text-2xl font-bold text-text-primary flex items-center gap-3">
                        <div className="p-2 bg-bg-main border border-border-main text-primary-500">
                            <Share2 className="w-6 h-6" />
                        </div>
                        Architecture Topology
                    </h2>
                    <p className="text-sm text-text-tertiary mt-1 font-sans">
                        Visualize cluster workload distribution and neural dependencies.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-bg-card border border-border-main p-0.5">
                        <button
                            onClick={() => setViewMode('schematic')}
                            className={`kt-button kt-button-sm ${viewMode === 'schematic' ? 'kt-button-primary' : 'kt-button-secondary'}`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" /> Schematic
                        </button>
                        <button
                            onClick={() => setViewMode('graph')}
                            className={`kt-button kt-button-sm ${viewMode === 'graph' ? 'kt-button-primary' : 'kt-button-secondary'}`}
                        >
                            <ImageIcon className="w-3.5 h-3.5" /> Neural Map
                        </button>
                    </div>

                    {viewMode === 'graph' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                            <select
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="kt-select text-xs w-36"
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
                                className="kt-button kt-button-primary kt-button-sm"
                            >
                                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                {renderedSvg ? 'Regenerate' : 'Generate Map'}
                            </button>

                            {renderedSvg && (
                                <button
                                    onClick={downloadImage}
                                    className="kt-button kt-button-secondary kt-button-sm"
                                    title="Download SVG"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-auto relative custom-scrollbar">

                {/* Error State */}
                {error && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center max-w-2xl w-full animate-in fade-in slide-in-from-top-4">
                        <div className="kt-panel w-full border-danger/30 kt-danger-glow">
                            <div className="kt-panel-header">
                                <span className="flex items-center gap-2 text-danger">
                                    <AlertCircle className="w-4 h-4" /> Rendering Error
                                </span>
                                <button onClick={() => setError(null)} className="kt-button kt-button-ghost kt-button-sm p-1">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-4 relative z-10">
                                <p className="text-sm text-text-secondary font-sans">{error}</p>
                                <div className="mt-3 flex items-center gap-2">
                                    <button onClick={() => setShowDebug(!showDebug)} className="kt-button kt-button-secondary kt-button-sm">
                                        {showDebug ? 'Hide Code' : 'Debug'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        {showDebug && diagramCode && (
                            <div className="mt-2 w-full kt-panel-inset p-4 text-xs font-mono overflow-auto max-h-96 custom-scrollbar relative">
                                <div className="absolute top-2 right-4 text-[10px] text-text-tertiary font-sans font-medium">Mermaid Source</div>
                                <pre>{diagramCode}</pre>
                            </div>
                        )}
                    </div>
                )}

                {/* Graph View (AI Image) */}
                {viewMode === 'graph' && (
                    <div className="h-full w-full flex items-center justify-center min-h-[500px]">
                        {isLoading ? (
                            <div className="kt-panel p-8 flex flex-col items-center justify-center gap-6 text-center">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary-500 rounded-full blur-[3rem] opacity-20 animate-pulse"></div>
                                    <div className="relative bg-bg-card/50 p-6 border border-border-main">
                                        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-sans text-xl font-bold text-text-primary mb-2">Constructing Neural Map...</h3>
                                    <p className="text-sm text-text-tertiary max-w-sm mx-auto leading-relaxed font-sans">
                                        Analyzing workload relationships and rendering high-fidelity topology via Generative AI.
                                    </p>
                                </div>
                            </div>
                        ) : renderedSvg ? (
                            <div className="relative w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-500">
                                <div className="kt-panel p-6 w-full h-full flex items-center justify-center overflow-auto">
                                    <div
                                        className="max-w-full max-h-full overflow-auto shadow-2xl border border-border-main bg-bg-card/30 backdrop-blur-sm p-8"
                                        dangerouslySetInnerHTML={{ __html: renderedSvg }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="kt-panel p-10 flex flex-col items-center justify-center text-center max-w-2xl mx-auto hover:border-primary-500/30 transition-all group">
                                <div className="w-20 h-20 bg-bg-main border border-border-main flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <Sparkles className="w-10 h-10 text-primary-500" />
                                </div>
                                <h3 className="font-sans text-2xl font-bold text-text-primary mb-3">Neural Map Generator</h3>
                                <p className="text-text-tertiary mb-8 max-w-md text-sm leading-relaxed font-sans">
                                    Use Generative AI to visually reconstruct your cluster architecture. Typically visualizes namespaces, workload kinds, and inferred network traffic.
                                </p>
                                <button
                                    onClick={handleGenerateDiagram}
                                    className="kt-button kt-button-primary"
                                >
                                    <Sparkles className="w-5 h-5" /> Initialize Generation
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Schematic View (Grid) */}
                {viewMode === 'schematic' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-20">
                        {Object.entries(groupedWorkloads).map(([namespace, items]: [string, Workload[]]) => (
                            <div key={namespace} className="kt-panel flex flex-col">
                                <div className="kt-panel-header">
                                    <span className="flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-primary-500" />
                                        <span className="truncate max-w-[180px]">{namespace}</span>
                                    </span>
                                    <span className="kt-badge kt-badge-info">{items.length} WORKLOADS</span>
                                </div>
                                <div className="p-4 relative z-10 grid grid-cols-1 gap-3">
                                    {items.map(w => (
                                        <div
                                            key={w.id}
                                            onClick={() => navigate(`/triage?workload=${w.name}&playbook=General%20Health`)}
                                            className="relative flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-border-main bg-bg-main hover:border-primary-500/30 transition-all cursor-pointer group gap-3"
                                        >
                                            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-transparent via-primary-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                            <div className="flex items-center gap-4 z-10 min-w-0">
                                                <div className={`w-1.5 h-10 rounded-full shadow-lg transition-all group-hover:scale-110 shrink-0 ${getStatusBarClass(w.status)}`}></div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-text-primary group-hover:text-primary-500 transition-colors truncate">{w.name}</div>
                                                    <div className="text-[10px] text-text-tertiary flex flex-wrap items-center gap-x-2 mt-1 font-bold opacity-80 font-sans">
                                                        <span className="flex items-center gap-1"><Box className="w-3 h-3" /> {w.kind}</span>
                                                        <span className="opacity-30">|</span>
                                                        <span className="flex items-center gap-1"><Server className="w-3 h-3" /> {w.replicas}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-start sm:items-end gap-1.5 z-10 shrink-0 ml-6 sm:ml-0">
                                                <div className="text-[10px] font-bold text-text-tertiary group-hover:text-text-primary transition-colors font-sans">
                                                    CPU: {w.metrics.cpuLimit > 0 ? Math.round((w.metrics.cpuUsage / w.metrics.cpuLimit) * 100) : 0}%
                                                </div>
                                                <div className="w-20 h-1.5 bg-bg-main rounded-full overflow-hidden border border-border-main shadow-inner">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ${getMetricStatusColor(w.metrics.cpuLimit > 0 ? (w.metrics.cpuUsage / w.metrics.cpuLimit) * 100 : 0)}`}
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
