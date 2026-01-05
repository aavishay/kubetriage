
import React, { useState, useMemo } from 'react';
import { Workload } from '../types';
import { generateTopologyDiagram } from '../services/geminiService';
import { Loader2, Image as ImageIcon, Download, Sparkles, AlertCircle, Share2, ZoomIn, Info, LayoutGrid, Box, Server, Layers, Globe, RefreshCw } from 'lucide-react';

interface TopologyViewProps {
  workloads: Workload[];
  isDarkMode?: boolean;
}

export const TopologyView: React.FC<TopologyViewProps> = ({ workloads, isDarkMode = true }) => {
  const [viewMode, setViewMode] = useState<'graph' | 'schematic'>('schematic');
  const [diagramImage, setDiagramImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [error, setError] = useState<string | null>(null);

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
    setDiagramImage(null);
    try {
        const imageBase64 = await generateTopologyDiagram(workloads, aspectRatio);
        if (imageBase64) {
            setDiagramImage(imageBase64);
            setViewMode('graph'); // Auto switch to graph view on success
        } else {
            setError("Failed to generate architecture diagram. Please try again.");
        }
    } catch (e) {
        console.error(e);
        setError("An error occurred while communicating with the AI service. Ensure you have selected a valid API Key.");
    } finally {
        setIsLoading(false);
    }
  };

  const downloadImage = () => {
    if (diagramImage) {
        const link = document.createElement('a');
        link.href = diagramImage;
        link.download = `architecture-diagram-${new Date().toISOString()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50 dark:bg-zinc-900 transition-colors duration-300">
      {/* Header - Fixed Height */}
      <div className="shrink-0 p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
               <Share2 className="w-6 h-6 text-indigo-500" />
               Architecture Topology
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
               Visualize your cluster's workload distribution and dependencies.
            </p>
         </div>

         <div className="flex flex-wrap items-center gap-3">
             <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                <button 
                  onClick={() => setViewMode('schematic')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-2 transition-all ${
                    viewMode === 'schematic' 
                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                  }`}
                >
                   <LayoutGrid className="w-3.5 h-3.5" /> Schematic
                </button>
                <button 
                  onClick={() => setViewMode('graph')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-2 transition-all ${
                    viewMode === 'graph' 
                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
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
                       className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                    >
                       {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                       {diagramImage ? 'Regenerate' : 'Generate'}
                    </button>

                    {diagramImage && (
                        <button 
                           onClick={downloadImage}
                           className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors"
                           title="Download Image"
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
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-lg animate-in fade-in slide-in-from-top-4">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-700 dark:hover:text-red-200"><Box className="w-4 h-4 rotate-45" /></button>
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
                             Analyzing workload relationships and rendering high-fidelity topology using Gemini Pro Vision. This may take 10-20 seconds.
                         </p>
                     </div>
                 ) : diagramImage ? (
                     <div className="relative w-full h-full flex items-center justify-center overflow-auto p-4">
                         <img 
                            src={diagramImage} 
                            alt="Cluster Architecture" 
                            className="max-w-none shadow-2xl rounded-lg border border-zinc-200 dark:border-zinc-800"
                            style={{ maxHeight: '95%', maxWidth: '95%', objectFit: 'contain' }}
                         />
                     </div>
                 ) : (
                     <div className="flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 max-w-2xl mx-auto">
                         <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
                            <Sparkles className="w-8 h-8 text-indigo-500" />
                         </div>
                         <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Generate AI Architecture Diagram</h3>
                         <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-md">
                             Use Gemini 3.0 Pro to visually reconstruct your cluster's architecture based on current workload definitions, namespaces, and inferred traffic patterns.
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
                     <div key={namespace} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm flex flex-col">
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
                                 <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-indigo-800 bg-zinc-50/50 dark:bg-black/20 transition-all">
                                     <div className="flex items-center gap-3">
                                         <div className={`w-2 h-8 rounded-full ${
                                             w.status === 'Healthy' ? 'bg-emerald-500' :
                                             w.status === 'Warning' ? 'bg-amber-500' : 'bg-red-500'
                                         }`}></div>
                                         <div>
                                             <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{w.name}</div>
                                             <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                                                 <Box className="w-3 h-3" /> {w.kind}
                                                 <span className="text-zinc-300 dark:text-zinc-700">|</span>
                                                 <Server className="w-3 h-3" /> {w.replicas} pods
                                             </div>
                                         </div>
                                     </div>
                                     <div className="flex flex-col items-end gap-1">
                                         <div className="text-[10px] font-mono text-zinc-500">
                                            CPU: {Math.round((w.metrics.cpuUsage / w.metrics.cpuLimit) * 100)}%
                                         </div>
                                         <div className="w-16 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                             <div 
                                                className={`h-full rounded-full ${
                                                    (w.metrics.cpuUsage / w.metrics.cpuLimit) > 0.9 ? 'bg-red-500' : 
                                                    (w.metrics.cpuUsage / w.metrics.cpuLimit) > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                                                }`} 
                                                style={{ width: `${Math.min(100, (w.metrics.cpuUsage / w.metrics.cpuLimit) * 100)}%` }}
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
