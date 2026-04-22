
import React, { useState, useEffect } from 'react';
import { BookOpen, Scale, Shield, Network, Cpu, Database, Activity, Zap, TrendingDown, Gauge, ArrowRight, ExternalLink, Sparkles, AlertCircle, Ghost, ServerCrash, BarChart, CloudRain, Anchor, ShieldCheck, Play, Pause } from 'lucide-react';
import { ViewState, DiagnosticPlaybook, OptimizationProfile, Recipe } from '../types';

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
         color: 'text-primary-500',
         bgColor: 'bg-primary-500/10',
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

   const [recipes, setRecipes] = useState<Recipe[]>([]);

   useEffect(() => {
      const fetchRecipes = async () => {
         try {
            const res = await fetch('/api/recipes');
            if (res.ok) setRecipes(await res.json());
         } catch (e) { console.error(e); }
      };
      fetchRecipes();
   }, []);

   const handleToggleRecipe = async (id: string) => {
      try {
         const res = await fetch(`/api/recipes/${id}/toggle`, { method: 'POST' });
         if (res.ok) {
            setRecipes(recipes.map(r => r.ID === id ? { ...r, IsEnabled: !r.IsEnabled } : r));
         }
      } catch (e) { console.error(e); }
   };

   return (
      <div className="space-y-8 pb-20 animate-fade-in">
         {/* Hero Header */}
         <div className="bg-bg-card border border-border-main rounded-xl p-6 md:p-8">
            <div className="max-w-2xl">
               <div className="inline-flex items-center gap-1.5 bg-primary-500/10 text-primary-400 px-3 py-1 rounded-full text-xs font-medium mb-4">
                  <Sparkles className="w-3.5 h-3.5" /> AI Integrated
               </div>
               <h1 className="text-2xl font-semibold text-text-primary mb-2">SRE Runbooks & Templates</h1>
               <p className="text-sm text-text-secondary mb-6">
                  Deploy specialized AI diagnostic models and resource strategies with a single click.
               </p>
               <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 bg-bg-main p-3 rounded-lg border border-border-main">
                     <Activity className="w-5 h-5 text-primary-500" />
                     <div className="text-left">
                        <p className="text-xs text-text-secondary">Triage Models</p>
                        <p className="text-sm font-medium text-text-primary">13 Active</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 bg-bg-main p-3 rounded-lg border border-border-main">
                     <Scale className="w-5 h-5 text-emerald-500" />
                     <div className="text-left">
                        <p className="text-xs text-text-secondary">Sizing Profiles</p>
                        <p className="text-sm font-medium text-text-primary">8 Active</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 bg-bg-main p-3 rounded-lg border border-border-main">
                     <Zap className="w-5 h-5 text-amber-500" />
                     <div className="text-left">
                        <p className="text-xs text-text-secondary">Automation</p>
                        <p className="text-sm font-medium text-text-primary">4 Rules</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Triage Section */}
         <section>
            <div className="flex items-center gap-2 mb-4">
               <AlertCircle className="w-5 h-5 text-primary-500" />
               <h2 className="text-lg font-medium text-text-primary">Diagnostic Triage</h2>
            </div>
            <p className="text-xs text-text-secondary mb-4">AI-driven root cause identification runbooks</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
               {triageTemplates.map(pb => (
                  <div key={pb.id} className="bg-bg-card border border-border-main rounded-xl p-5 flex flex-col hover:border-primary-500/30 transition-colors group">
                     <div className={`p-2.5 rounded-lg w-fit mb-4 ${pb.bgColor} ${pb.color}`}>
                        <pb.icon className="w-5 h-5" />
                     </div>
                     <h3 className="text-sm font-medium text-text-primary mb-2">{pb.title}</h3>
                     <p className="text-xs text-text-secondary mb-4 flex-1 leading-relaxed">
                        {pb.description}
                     </p>
                     <div className="space-y-2 mb-4">
                        <p className="text-xs text-text-tertiary uppercase">Focus Areas</p>
                        <div className="flex flex-wrap gap-1.5">
                           {pb.focus.map(f => (
                              <span key={f} className="text-[10px] bg-bg-hover text-text-secondary px-2 py-0.5 rounded border border-border-main">
                                 {f}
                              </span>
                           ))}
                        </div>
                     </div>
                     <button
                        onClick={() => onApplyTemplate(pb.view, pb.id)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium rounded-lg transition-colors"
                     >
                        Apply Model <ArrowRight className="w-3.5 h-3.5" />
                     </button>
                  </div>
               ))}
            </div>
         </section>

         {/* Sizing Section */}
         <section>
            <div className="flex items-center gap-2 mb-4">
               <Scale className="w-5 h-5 text-emerald-500" />
               <h2 className="text-lg font-medium text-text-primary">Right Sizing Strategies</h2>
            </div>
            <p className="text-xs text-text-secondary mb-4">Resource allocation and capacity planning profiles</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {sizingTemplates.map(pr => (
                  <div key={pr.id} className="bg-bg-card border border-border-main rounded-xl p-5 flex flex-col hover:border-primary-500/30 transition-colors group">
                     <div className={`p-2.5 rounded-lg w-fit mb-4 ${pr.bgColor} ${pr.color}`}>
                        <pr.icon className="w-5 h-5" />
                     </div>
                     <h3 className="text-sm font-medium text-text-primary mb-2">{pr.title}</h3>
                     <p className="text-xs text-text-secondary mb-4 flex-1 leading-relaxed">
                        {pr.description}
                     </p>
                     <div className="mb-4 p-3 rounded-lg bg-bg-main border border-border-main">
                        <div className="flex justify-between items-center mb-2">
                           <p className="text-xs text-text-secondary">Target Efficiency</p>
                           <span className="text-xs font-medium text-text-primary">{pr.id === 'Cost-Saver' ? '92%' : pr.id === 'Balanced' ? '78%' : '55%'}</span>
                        </div>
                        <div className="w-full bg-bg-hover h-1.5 rounded-full overflow-hidden">
                           <div className={`h-full ${pr.id === 'Cost-Saver' ? 'w-[92%] bg-emerald-500' : pr.id === 'Balanced' ? 'w-[78%] bg-blue-500' : 'w-[55%] bg-purple-500'}`}></div>
                        </div>
                     </div>
                     <button
                        onClick={() => onApplyTemplate(pr.view, pr.id)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium rounded-lg transition-colors"
                     >
                        Apply Strategy <ArrowRight className="w-3.5 h-3.5" />
                     </button>
                  </div>
               ))}
            </div>
         </section>

         {/* Automation & Security Recipes */}
         <section>
            <div className="flex items-center gap-2 mb-4">
               <ShieldCheck className="w-5 h-5 text-amber-500" />
               <h2 className="text-lg font-medium text-text-primary">Automation & Security</h2>
            </div>
            <p className="text-xs text-text-secondary mb-4">Proactive background guardrails & automated fixes</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {recipes.map(recipe => (
                  <div key={recipe.ID} className={`bg-bg-card border rounded-xl p-5 flex items-center justify-between group transition-all ${recipe.IsEnabled ? 'border-warning/30' : 'border-border-main opacity-60'}`}>
                     <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-lg ${recipe.TriggerType === 'Security' ? 'bg-danger-light text-danger' : 'bg-warning-light text-warning'}`}>
                           {recipe.TriggerType === 'Security' ? <Shield className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                        </div>
                        <div>
                           <h3 className="text-sm font-medium text-text-primary">{recipe.Name}</h3>
                           <p className="text-xs text-text-secondary mt-0.5">{recipe.Description}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${recipe.IsEnabled ? 'bg-success-light text-success border border-success/20' : 'bg-bg-hover text-text-tertiary border border-border-main'}`}>
                           {recipe.IsEnabled ? 'Active' : 'Paused'}
                        </div>
                        <button
                           onClick={() => handleToggleRecipe(recipe.ID)}
                           className="p-2 hover:bg-bg-hover rounded-lg transition-colors"
                        >
                           {recipe.IsEnabled ? <Pause className="w-4 h-4 text-text-secondary" /> : <Play className="w-4 h-4 text-primary-500" />}
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </section>
      </div>
   );
};
