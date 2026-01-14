
import React from 'react';
import { BookOpen, Scale, Shield, Network, Cpu, Database, Activity, Zap, TrendingDown, Gauge, ArrowRight, ExternalLink, Sparkles, AlertCircle, Ghost, ServerCrash, BarChart, CloudRain, Anchor } from 'lucide-react';
import { ViewState, DiagnosticPlaybook, OptimizationProfile } from '../types';

interface TemplateLibraryViewProps {
   onApplyTemplate: (view: ViewState, template: string) => void;
   isDarkMode?: boolean;
}

export const TemplateLibraryView: React.FC<TemplateLibraryViewProps> = ({ onApplyTemplate, isDarkMode = true }) => {
   const triageTemplates = [
      {
         id: 'General Health' as DiagnosticPlaybook,
         title: 'Global Cluster Triage',
         icon: Activity,
         color: 'text-blue-500',
         bgColor: 'bg-blue-500/10',
         description: 'The standard multi-dimensional diagnosis. Scans logs, events, and metrics to correlate CrashLoops with underlying infrastructure pressure.',
         focus: ['Event Correlation', 'CrashLoopBackOff', 'Node Pressure'],
         view: 'triage' as ViewState
      },
      {
         id: 'Scheduling & Affinity' as DiagnosticPlaybook,
         title: 'Scheduling & Affinity',
         icon: Anchor,
         color: 'text-indigo-500',
         bgColor: 'bg-indigo-500/10',
         description: 'Targets taints, tolerations, and node affinity mismatches. Use this when pods are stuck in Pending or not scheduling on specific hardware.',
         focus: ['Node Taints', 'Affinity Rules', 'Resource Shortage'],
         view: 'triage' as ViewState
      },
      {
         id: 'Network Connectivity' as DiagnosticPlaybook,
         title: 'Egress/Ingress Blame',
         icon: Network,
         color: 'text-cyan-500',
         bgColor: 'bg-cyan-500/10',
         description: 'Find why services are timing out. Analyzes DNS failures, 5xx upstream errors, and sidecar proxy connectivity bottlenecks.',
         focus: ['DNS timeouts', '502/503/504 Errors', 'Istio/Sidecar Latency'],
         view: 'triage' as ViewState
      },
      {
         id: 'Resource Constraints' as DiagnosticPlaybook,
         title: 'OOM/Throttling Hunter',
         icon: Cpu,
         color: 'text-orange-500',
         bgColor: 'bg-orange-500/10',
         description: 'Targets memory leaks and CPU quota exhaustion. Essential for workloads exhibiting erratic p99 spikes or silent kills.',
         focus: ['OOMKilled events', 'CFS Throttling', 'GC Pauses'],
         view: 'triage' as ViewState
      }
   ];

   const sizingTemplates = [
      {
         id: 'Balanced' as OptimizationProfile,
         title: 'Balanced Production',
         icon: Scale,
         color: 'text-blue-600',
         bgColor: 'bg-blue-600/10',
         description: 'Safe, standard SRE defaults. Targets P95 + 20% safety margin. Recommended for mission-critical customer-facing APIs.',
         focus: ['Stability', 'Availability', 'Predictable OpEx'],
         view: 'rightsizing' as ViewState
      },
      {
         id: 'Cost-Saver' as OptimizationProfile,
         title: 'Aggressive FinOps Mode',
         icon: TrendingDown,
         color: 'text-emerald-600',
         bgColor: 'bg-emerald-600/10',
         description: 'Maximizes bin-packing. Tightens limits to observed peak. Perfect for non-production namespaces where small latencies are okay.',
         focus: ['Max Node Density', '90%+ Utilization', 'Cost Cutting'],
         view: 'rightsizing' as ViewState
      },
      {
         id: 'Performance' as OptimizationProfile,
         title: 'Low-Latency Hardening',
         icon: Gauge,
         color: 'text-purple-600',
         bgColor: 'bg-purple-600/10',
         description: 'Over-provisions for smooth tail latency. Sets huge buffers (50%+) so micro-bursts never cause kernel-level throttling.',
         focus: ['Zero Throttling', 'P99 Optimization', 'High Headroom'],
         view: 'rightsizing' as ViewState
      }
   ];

   return (
      <div className="space-y-12 pb-20 font-sans">
         {/* Hero Header */}
         <div className="bg-white dark:bg-dark-card rounded-[3.5rem] p-10 md:p-14 text-gray-900 dark:text-white relative overflow-hidden shadow-2xl border border-gray-100 dark:border-white/5">
            <div className="relative z-10 max-w-2xl">
               <div className="inline-flex items-center gap-2 bg-primary-500/10 text-primary-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-primary-500/20">
                  <Sparkles className="w-4 h-4" /> Generative AI Integrated
               </div>
               <h1 className="text-5xl font-black mb-4 tracking-tighter leading-none uppercase">SRE Runbooks &<br />Optimization Templates</h1>
               <p className="text-gray-500 dark:text-gray-400 text-lg mb-10 leading-relaxed font-bold uppercase tracking-tight opacity-80">
                  Deploy specialized AI diagnostic models and resource strategies with a single click. Tuning for Kubernetes-native signals.
               </p>
               <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-dark-bg p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                     <Activity className="w-6 h-6 text-primary-500" />
                     <div className="text-left">
                        <p className="text-[9px] font-black uppercase text-gray-400 leading-none mb-1">Triage Models</p>
                        <p className="text-sm font-black uppercase tracking-tighter">13 Active</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-dark-bg p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                     <Scale className="w-6 h-6 text-emerald-500" />
                     <div className="text-left">
                        <p className="text-[9px] font-black uppercase text-zinc-500 leading-none mb-1">Sizing Profiles</p>
                        <p className="text-xs font-bold">8 Active</p>
                     </div>
                  </div>
               </div>
            </div>
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full -mr-48 -mt-48 blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/5 rounded-full -ml-48 -mb-48 blur-[100px]" />
         </div>

         {/* Triage Section */}
         <section>
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h2 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-4 tracking-tighter uppercase leading-none">
                     <AlertCircle className="w-8 h-8 text-primary-500" /> Diagnostic Triage
                  </h2>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-2 ml-12 opacity-80">AI-driven root cause identification runbooks</p>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
               {triageTemplates.map(pb => (
                  <div key={pb.id} className="bg-white dark:bg-dark-card border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-8 flex flex-col hover:shadow-2xl transition-all group relative overflow-hidden">
                     <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 blur-3xl opacity-5 rounded-full ${pb.bgColor}`} />
                     <div className={`p-4 rounded-2xl w-fit mb-8 shadow-xl ${pb.bgColor} ${pb.color} group-hover:scale-110 transition-transform`}>
                        <pb.icon className="w-7 h-7" />
                     </div>
                     <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-3 tracking-tight">{pb.title}</h3>
                     <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-8 flex-1 leading-relaxed font-medium">
                        {pb.description}
                     </p>
                     <div className="space-y-4 mb-8">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Diagnostic Depth</p>
                        <div className="flex flex-wrap gap-2">
                           {pb.focus.map(f => (
                              <span key={f} className="text-[9px] bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-3 py-1 rounded-lg font-black uppercase tracking-widest border border-zinc-100 dark:border-zinc-700">
                                 {f}
                              </span>
                           ))}
                        </div>
                     </div>
                     <button
                        onClick={() => onApplyTemplate(pb.view, pb.id)}
                        className="w-full flex items-center justify-center gap-3 py-5 bg-primary-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-primary-500/30 hover:bg-primary-700 active:scale-95"
                     >
                        Apply Model <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                     </button>
                  </div>
               ))}
            </div>
         </section>

         {/* Sizing Section */}
         <section>
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3 tracking-tighter uppercase">
                     <Scale className="w-6 h-6 text-emerald-500" /> Right Sizing Strategies
                  </h2>
                  <p className="text-sm text-zinc-500 font-semibold mt-1">Resource allocation and capacity planning profiles</p>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {sizingTemplates.map(pr => (
                  <div key={pr.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6 flex flex-col hover:shadow-2xl hover:border-emerald-500/50 transition-all group">
                     <div className={`p-4 rounded-2xl w-fit mb-6 ${pr.bgColor} ${pr.color}`}>
                        <pr.icon className="w-7 h-7" />
                     </div>
                     <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-3 tracking-tight">{pr.title}</h3>
                     <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-8 flex-1 leading-relaxed font-medium">
                        {pr.description}
                     </p>
                     <div className="mb-8 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700">
                        <div className="flex justify-between items-center mb-3">
                           <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Target Efficiency</p>
                           <span className="text-xs font-black text-zinc-900 dark:text-white">{pr.id === 'Cost-Saver' ? '92%' : pr.id === 'Balanced' ? '78%' : '55%'}</span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden flex">
                           <div className={`h-full ${pr.id === 'Cost-Saver' ? 'w-11/12 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : pr.id === 'Balanced' ? 'w-8/12 bg-blue-500' : 'w-4/12 bg-purple-500'}`}></div>
                        </div>
                     </div>
                     <button
                        onClick={() => onApplyTemplate(pr.view, pr.id)}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl hover:scale-[1.03] active:scale-95"
                     >
                        Apply Strategy <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                     </button>
                  </div>
               ))}
            </div>
         </section>
      </div>
   );
};
