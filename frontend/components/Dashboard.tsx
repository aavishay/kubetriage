
import React, { useMemo } from 'react';
import { Workload, DiagnosticPlaybook } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
// Added missing ChevronRight import
import { Activity, DollarSign, Box, Zap, TrendingDown, ShieldAlert, HeartPulse, Sparkles, Network, ArrowRight, Target, SearchCode, ShieldCheck, Wifi, ExternalLink, ChevronRight, Server, Loader2 } from 'lucide-react';

interface DashboardProps {
   workloads: Workload[];
   isDarkMode?: boolean;
   isLoading?: boolean;
   onRefresh?: () => void;
   onTriageRequest?: (workloadId: string, playbook: DiagnosticPlaybook) => void;
   metricsWindow?: string;
   setMetricsWindow?: (window: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ workloads, isDarkMode = true, isLoading = false, onTriageRequest, onRefresh, metricsWindow = '1h', setMetricsWindow }) => {
   const [saturationTab, setSaturationTab] = React.useState<'CPU' | 'Memory' | 'Storage' | 'Network'>('CPU');
   const [saturationSort, setSaturationSort] = React.useState<'Live' | 'Avg' | 'P95' | 'P99'>('Live');
   const totalCost = workloads.reduce((acc, w) => acc + (w.costPerMonth || 0), 0);
   const criticalCount = workloads.filter(w => w.status === 'Critical').length;
   const warningCount = workloads.filter(w => w.status === 'Warning').length;

   // Fixed syntax error: 'potential savings' -> 'potentialSavings'
   const potentialSavings = workloads
      .filter(w => w.recommendation && w.recommendation.action === 'Downsize')
      .reduce((acc, w) => acc + (w.costPerMonth * 0.4), 0);

   const statusData = [
      { name: 'Healthy', value: workloads.filter(w => w.status === 'Healthy').length, color: '#10b981' },
      { name: 'Warning', value: warningCount, color: '#f59e0b' },
      { name: 'Critical', value: criticalCount, color: '#ef4444' },
   ];

   const resourceData = workloads.map(w => ({
      name: w.name,
      // Ensure requested and used are numbers and handle potential NaN
      requested: Number(w.metrics?.cpuRequest) || 0,
      used: Number(w.metrics?.cpuUsage) || 0,
      status: w.status
   }));

   const incidents = useMemo(() => {
      return workloads.filter(w => w.status !== 'Healthy').sort((a, b) => {
         if (a.status === 'Critical' && b.status !== 'Critical') return -1;
         if (a.status !== 'Critical' && b.status === 'Critical') return 1;
         return 0;
      });
   }, [workloads]);

   const reliabilityMetrics = useMemo(() => {
      const slo = 99.9;
      const totalPossibleBudget = 0.1;
      const criticalWeight = 0.015;
      const warningWeight = 0.004;
      const healthyWeight = 0.0005;

      const dailyConsumption = (
         (criticalCount * criticalWeight) +
         (warningCount * warningWeight) +
         ((workloads.length - criticalCount - warningCount) * healthyWeight)
      );

      const baselineConsumed = 0.042;
      const remainingBudget = Math.max(0, totalPossibleBudget - baselineConsumed - dailyConsumption);
      const budgetPercentage = (remainingBudget / totalPossibleBudget) * 100;
      const idealDailyBurn = totalPossibleBudget / 30;
      const burnRate = dailyConsumption / idealDailyBurn;
      // Handle division by zero for hoursRemaining if burnRate is 0
      const hoursRemaining = burnRate > 0 ? (remainingBudget / (dailyConsumption / 24)) : 720;
      const days = Math.floor(hoursRemaining / 24);
      const hours = Math.floor(hoursRemaining % 24);

      return {
         slo, remainingBudget, budgetPercentage: isFinite(budgetPercentage) ? budgetPercentage : 0, burnRate: isFinite(burnRate) ? burnRate : 0,
         uptimeForecast: `${days}d ${hours}h`,
         severity: burnRate > 2.0 ? 'Critical' : burnRate > 1.2 ? 'Warning' : 'Healthy'
      };
   }, [workloads, criticalCount, warningCount]);

   const budgetGaugeData = [
      { name: 'Consumed', value: Math.max(0, isFinite(reliabilityMetrics.budgetPercentage) ? 100 - reliabilityMetrics.budgetPercentage : 100), color: reliabilityMetrics.severity === 'Critical' ? '#ef4444' : '#6366f1' },
      { name: 'Remaining', value: Math.max(0, isFinite(reliabilityMetrics.budgetPercentage) ? reliabilityMetrics.budgetPercentage : 0), color: isDarkMode ? '#27272a' : '#f4f4f5' },
   ];

   const cardClass = "bg-white dark:bg-dark-card p-4 md:p-6 rounded-4xl border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-1 cyber-card";
   const tooltipStyle = {
      backgroundColor: isDarkMode ? '#12151B' : '#ffffff',
      borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
      color: isDarkMode ? '#fff' : '#111827',
      borderRadius: '1.5rem',
      border: '1px solid ' + (isDarkMode ? 'rgba(255,255,255,0.1)' : '#f3f4f6'),
      fontSize: '12px',
      fontWeight: '600',
      padding: '12px 16px'
   };

   // Loading State - Only show full page spinner on initial fetch (no data yet)
   if (isLoading && workloads.length === 0) {
      return (
         <div className="flex flex-col items-center justify-center min-h-[400px] animate-in fade-in duration-500">
            <div className="relative">
               <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
               <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin relative z-10" />
            </div>
            <p className="mt-4 text-sm font-bold text-zinc-500 uppercase tracking-widest">Syncing Cluster Telemetry...</p>
         </div>
      );
   }

   if (workloads.length === 0) {
      return (
         <div className="flex flex-col items-center justify-center min-h-[600px] animate-in fade-in zoom-in-95 duration-700 bg-mesh">
            <div className="relative mb-12">
               <div className="absolute inset-0 bg-primary-500 rounded-full blur-[100px] opacity-10 animate-pulse"></div>
               <div className="p-12 bg-dark-card rounded-full border border-white/5 relative z-10 shadow-2xl">
                  <Server className="w-16 h-16 text-gray-600" />
               </div>
               <div className="absolute -top-2 -right-2 w-6 h-6 bg-accent-rose rounded-full animate-ping" />
            </div>
            <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4 font-display">Ghost Fleet Detected</h2>
            <p className="text-gray-500 max-w-sm text-center mb-10 text-sm font-medium leading-relaxed opacity-70">
               Zero active target vectors in the current sector. Synchronize RBAC headers or switch to a populated cluster sector.
            </p>
            <button
               onClick={() => onRefresh?.()}
               className="px-12 py-5 bg-primary-600 hover:bg-primary-500 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-3xl shadow-2xl shadow-primary-500/20 active:scale-95 transition-all flex items-center gap-3 border-b-4 border-primary-800"
            >
               <Activity className="w-4 h-4" /> Re-Scan Sector
            </button>
         </div>
      );
   }

   const getIncidentSummary = (w: Workload) => {
      if (w.availableReplicas === 0 && w.replicas > 0) return `Resource failure: 0/${w.replicas} available. Unreachable.`;
      if (w.availableReplicas < w.replicas) return `Degraded: ${w.availableReplicas}/${w.replicas} ready.`;

      // Ensure metrics are numbers and handle division by zero
      const cpuLimit = Number(w.metrics?.cpuLimit) || 0;
      const cpuUsage = Number(w.metrics?.cpuUsage) || 0;
      const memLimit = Number(w.metrics?.memoryLimit) || 0;
      const memUsage = Number(w.metrics?.memoryUsage) || 0;

      const cpuSat = cpuLimit > 0 ? (cpuUsage / cpuLimit) * 100 : 0;
      const memSat = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

      if (cpuSat > 90) return `Critical CPU: ${Math.round(cpuSat)}% limit. Throttling likely.`;
      if (memSat > 95) return `Critical Memory: ${Math.round(memSat)}% usage. OOM imminent.`;
      if (cpuSat > 70) return `High CPU: ${Math.round(cpuSat)}% of limit. Monitor latency.`;
      if (memSat > 80) return `High Memory: ${Math.round(memSat)}% of limit. Scaling needed.`;

      const events = w.events || [];
      const recentWarning = events.find(e => e.type === 'Warning');
      if (recentWarning) return `K8s Warning: ${recentWarning.reason}`;

      return w.status === 'Critical' ? "Critical degradation." : "Reliability warning.";
   };

   return (
      <div className="space-y-5 md:space-y-6 animate-in fade-in duration-500">

         {/* Priority Investigation Hero */}
         <section className="relative group perspective-1000">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-accent-violet rounded-5xl blur-2xl opacity-10 group-hover:opacity-30 transition-opacity duration-1000"></div>
            <div className="relative bg-dark-bg/90 rounded-5xl p-8 md:p-14 border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.6)] overflow-hidden cyber-card">
               {/* Background Elements */}
               <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[140px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
               <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-violet/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
               <div className="absolute inset-0 bg-mesh opacity-20 pointer-events-none"></div>

               <div className="flex flex-col lg:flex-row items-center gap-12 relative z-10">
                  <div className="relative shrink-0">
                     <div className="p-12 bg-dark-card rounded-4xl border border-white/10 shadow-inner group-hover:border-primary-500/50 transition-colors duration-500 neon-border">
                        <Network className="w-20 h-20 text-primary-400 animate-pulse" />
                     </div>
                     <div className="absolute -top-4 -right-4 w-12 h-12 bg-accent-rose rounded-3xl flex items-center justify-center text-[12px] font-black text-white shadow-2xl border-4 border-dark-bg neon-text">CRITICAL</div>
                  </div>

                  <div className="flex-1 text-center lg:text-left">
                     <div className="flex flex-wrap justify-center lg:justify-start items-center gap-6 mb-10">
                        <span className="px-6 py-2.5 rounded-full bg-accent-rose/10 text-accent-rose border border-accent-rose/20 text-[10px] font-black uppercase tracking-[0.3em] font-display">Neural High-Priority</span>
                        <div className="flex items-center gap-3 px-6 py-2.5 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20 text-[10px] font-black uppercase tracking-[0.3em] font-display">
                           <Wifi className="w-5 h-5" /> Live Ingress Vector
                        </div>
                     </div>
                     <h2 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter font-display mb-8 leading-none">
                        Link Breach: <span className="bg-gradient-to-r from-primary-400 to-accent-cyan bg-clip-text text-transparent underline decoration-accent-rose/30 decoration-8 underline-offset-12">ingress-svc</span>
                     </h2>
                     <p className="text-gray-400 text-xl font-medium max-w-2xl leading-relaxed opacity-90">
                        Detected erratic upstream latency spikes. 504 Gateway errors are proliferating across the prod sector. AI suggests an immediate network fabric injection.
                     </p>
                  </div>

                  <div className="shrink-0 flex flex-col gap-8 w-full lg:w-auto">
                     <button
                        onClick={() => onTriageRequest?.('w-6', 'Network Connectivity')}
                        className="bg-white text-dark-bg px-16 py-8 rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-primary-50 hover:scale-[1.08] active:scale-95 transition-all flex items-center justify-center gap-4 group/btn border-b-8 border-gray-200"
                     >
                        <Sparkles className="w-6 h-6 text-primary-600 animate-pulse" />
                        Execute AI Triage
                        <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                     </button>
                     <div className="flex items-center justify-center gap-4 text-[11px] font-black text-gray-500 uppercase tracking-[0.3em] font-display">
                        <span className="w-2 h-2 rounded-full bg-primary-500 animate-ping"></span>
                        Neural Core Scanning...
                     </div>
                  </div>
               </div>
            </div>
         </section>

         {/* Top Metrics Grid */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            <div className={`${cardClass} animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[100ms] neon-border`}>
               <div className="flex justify-between items-start mb-8">
                  <div className="p-4 bg-primary-500/10 rounded-3xl text-primary-400 border border-primary-500/20 shadow-[0_0_15px_rgba(14,165,233,0.1)]"><DollarSign className="w-8 h-8" /></div>
                  <div className="flex flex-col items-end">
                     <span className="text-[10px] font-black text-primary-500 bg-primary-500/10 px-3 py-1 rounded-lg uppercase tracking-[0.2em] border border-primary-500/20 mb-1">+4.2%</span>
                  </div>
               </div>
               <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4 font-display">Neural Burn Rate</p>
               <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter font-display leading-none">${totalCost.toLocaleString()}</h3>
            </div>

            <div className={`${cardClass} animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[200ms]`}>
               <div className="flex justify-between items-start mb-8">
                  <div className="p-4 bg-emerald-500/10 rounded-3xl text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"><Activity className="w-8 h-8" /></div>
                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg uppercase tracking-[0.2em] border border-emerald-500/20">Operational</span>
               </div>
               <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4 font-display">Cluster Fidelity</p>
               <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter font-display leading-none">{Math.round((1 - (criticalCount / workloads.length)) * 100)}%</h3>
            </div>

            <div className={`${cardClass} animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[300ms]`}>
               <div className="flex justify-between items-start mb-8">
                  <div className="p-4 bg-accent-violet/10 rounded-3xl text-accent-violet border border-accent-violet/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]"><TrendingDown className="w-8 h-8" /></div>
                  <span className="text-[10px] font-black text-accent-violet bg-accent-violet/10 px-3 py-1 rounded-lg uppercase tracking-[0.2em] border border-accent-violet/20">Recovery</span>
               </div>
               <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4 font-display">Waste Forecast</p>
               <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter font-display leading-none">${Math.round(potentialSavings).toLocaleString()}</h3>
            </div>

            <div className={`${cardClass} animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[400ms]`}>
               <div className="flex justify-between items-start mb-8">
                  <div className="p-4 bg-accent-cyan/10 rounded-3xl text-accent-cyan border border-accent-cyan/20 shadow-[0_0_15px_rgba(34,211,238,0.1)]"><Box className="w-8 h-8" /></div>
                  <span className="text-[10px] font-black text-accent-cyan bg-accent-cyan/10 px-3 py-1 rounded-lg uppercase tracking-[0.2em] border border-accent-cyan/20">{workloads.length} UNITS</span>
               </div>
               <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4 font-display">Active Vectors</p>
               <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter font-display leading-none">Healthy</h3>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 md:gap-6">

            <div className="lg:col-span-2 flex flex-col gap-6">
               <div className="bg-white dark:bg-[#16191E] rounded-[2rem] border border-gray-100 dark:border-white/5 p-6 md:p-8 flex flex-col shadow-sm flex-1 animate-in fade-in slide-in-from-left-4 duration-700 delay-200">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-8 flex items-center gap-2.5">
                     <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                     Active Incidents
                  </h3>
                  <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-2 custom-scrollbar">
                     {incidents.length > 0 ? (
                        incidents.map((w, idx) => (
                           <div key={w.id} className="p-5 rounded-2xl border border-gray-50 dark:border-white/5 bg-gray-50/50 dark:bg-dark-bg/50 group hover:border-primary-500/30 transition-all duration-300 shadow-sm animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${idx * 100}ms` }}>
                              <div className="flex justify-between items-start mb-4">
                                 <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${w.status === 'Critical' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
                                    <div>
                                       <span className="text-[13px] font-black text-gray-900 dark:text-white uppercase tracking-tight block leading-none mb-1">{w.name}</span>
                                       <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">Active Incident</span>
                                    </div>
                                 </div>
                                 <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-md border ${w.status === 'Critical' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                    {w.status}
                                 </span>
                              </div>

                              <p className="text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
                                 {getIncidentSummary(w)}
                              </p>

                              <button
                                 onClick={() => onTriageRequest?.(w.id, 'Resource Constraints')}
                                 className="w-full flex items-center justify-between gap-2 bg-white dark:bg-[#1A1D23] p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:border-primary-500/50 hover:bg-primary-50/50 dark:hover:bg-primary-500/5 transition-all duration-300 group/btn shadow-sm"
                              >
                                 <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2.5 text-gray-700 dark:text-gray-300">
                                    <Sparkles className="w-4 h-4 text-primary-500" />
                                    Investigate with AI
                                 </span>
                                 <ChevronRight className="w-5 h-5 text-gray-400 group-hover/btn:translate-x-1 transition-all" />
                              </button>
                           </div>
                        ))
                     ) : (
                        <div className="p-12 text-center flex flex-col items-center">
                           <div className="p-4 bg-emerald-500/10 rounded-full mb-4">
                              <HeartPulse className="w-12 h-12 text-emerald-500" />
                           </div>
                           <p className="text-[11px] font-black uppercase text-gray-400 tracking-widest">All services nominal</p>
                        </div>
                     )}
                  </div>
               </div>

               <div className="bg-white dark:bg-[#16191E] rounded-[2rem] border border-gray-100 dark:border-white/5 p-6 md:p-8 flex flex-col shadow-sm animate-in fade-in slide-in-from-left-4 duration-700 delay-300">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-8 flex items-center gap-2.5">
                     <Activity className="w-4 h-4 text-primary-500" /> Status Distribution
                  </h3>
                  <div className="h-48 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie data={statusData} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                              {statusData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                           </Pie>
                           <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                     </ResponsiveContainer>
                  </div>
               </div>
            </div>

            <div className="lg:col-span-3 bg-white dark:bg-dark-card rounded-5xl border border-gray-100 dark:border-white/5 p-8 md:p-12 flex flex-col shadow-sm h-full animate-in fade-in slide-in-from-right-6 duration-700 delay-200 cyber-card">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500 flex items-center gap-3 font-display">
                     <Zap className="w-5 h-5 text-primary-500 shadow-[0_0_15px_rgba(14,165,233,0.4)]" /> Resource Saturation
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                     {/* Timeframe Selector */}
                     <div className="flex p-1 bg-gray-100/50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
                        {(['5m', '15m', '30m', '1h'] as const).map((win) => (
                           <button
                              key={win}
                              onClick={() => setMetricsWindow?.(win)}
                              className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${metricsWindow === win
                                 ? 'bg-white dark:bg-[#1A1D23] text-indigo-500 shadow-sm border border-gray-200 dark:border-white/10'
                                 : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                 }`}
                           >
                              {win}
                           </button>
                        ))}
                     </div>
                     {/* Sort Selector */}
                     <div className="flex p-1 bg-gray-100/50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
                        {(['Live', 'Avg', 'P95', 'P99'] as const).map((sort) => (
                           <button
                              key={sort}
                              onClick={() => setSaturationSort(sort)}
                              className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${saturationSort === sort
                                 ? 'bg-white dark:bg-[#1A1D23] text-indigo-500 shadow-sm border border-gray-200 dark:border-white/10'
                                 : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                 }`}
                           >
                              {sort}
                           </button>
                        ))}
                     </div>

                     {/* Resource Tab Selector */}
                     <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
                        {(['CPU', 'Memory', 'Storage', 'Network'] as const).map((type) => (
                           <button
                              key={type}
                              onClick={() => setSaturationTab(type)}
                              className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${saturationTab === type
                                 ? 'bg-white dark:bg-[#1A1D23] text-primary-500 shadow-sm border border-gray-200 dark:border-white/10'
                                 : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                 }`}
                           >
                              {type}
                           </button>
                        ))}
                     </div>
                  </div>
               </div>
               <div className="flex-1 min-h-0 w-full overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-6">
                     {workloads
                        .map(w => {
                           let base = 0, used = 0, unit = 'm', label = 'Saturation';

                           // Extract all potential metrics first
                           const metrics = w.metrics || {} as any;
                           let live = 0, avg = 0, p95 = 0, p99 = 0;

                           if (saturationTab === 'CPU') {
                              base = ((Number(metrics.cpuLimit) || Number(metrics.cpuRequest)) || 0) * 1000;
                              live = (Number(metrics.cpuUsage) || 0) * 1000;
                              avg = (Number(metrics.cpuAvg) || 0) * 1000;
                              p95 = (Number(metrics.cpuP95) || 0) * 1000;
                              p99 = (Number(metrics.cpuP99) || 0) * 1000;
                              unit = 'm';
                              label = `CPU ${saturationSort === 'Live' ? 'Saturation' : saturationSort}`;
                           } else if (saturationTab === 'Memory') {
                              base = (Number(metrics.memoryLimit) || Number(metrics.memoryRequest)) || 0;
                              live = Number(metrics.memoryUsage) || 0;
                              avg = Number(metrics.memoryAvg) || 0;
                              p95 = Number(metrics.memoryP95) || 0;
                              p99 = Number(metrics.memoryP99) || 0;
                              unit = 'MiB';
                              label = `Memory ${saturationSort === 'Live' ? 'Saturation' : saturationSort}`;
                           } else if (saturationTab === 'Storage') {
                              base = (Number(metrics.storageLimit) || Number(metrics.storageRequest)) || 0;
                              live = Number(metrics.storageUsage) || 0;
                              unit = 'GiB';
                              label = 'Disk Saturation';
                              // Storage doesn't have advanced metrics yet, fallback to live
                           } else if (saturationTab === 'Network') {
                              base = 100;
                              live = (Number(metrics.networkIn) || 0) + (Number(metrics.networkOut) || 0);
                              unit = 'MB/s';
                              label = 'Net Throughput';
                           }

                           // Select 'used' value based on sort mode
                           if (saturationSort === 'Avg' && avg > 0) used = avg;
                           else if (saturationSort === 'P95' && p95 > 0) used = p95;
                           else if (saturationSort === 'P99' && p99 > 0) used = p99;
                           else used = live;

                           return { name: w.name, base, used, unit, label, status: w.status, avg, p95, p99 };
                        })
                        .sort((a, b) => {
                           // Sort based on the selected 'used' value calculated above
                           const aSat = (a.base > 0) ? (a.used / a.base) : 0;
                           const bSat = (b.base > 0) ? (b.used / b.base) : 0;
                           return bSat - aSat;
                        })
                        .map((item, idx) => {
                           const isUnbounded = item.base === 0;
                           const saturation = item.base > 0 ? Math.min(100, Math.round((item.used / item.base) * 100)) : 0;
                           const isCritical = saturationTab === 'Memory' ? saturation >= 95 : saturation >= 90;
                           const isWarning = saturation >= 70 && !isCritical;

                           // Saturation Bar Color
                           const colorClass = isUnbounded
                              ? 'bg-gray-200 dark:bg-gray-800'
                              : isCritical
                                 ? 'bg-gradient-to-r from-accent-rose to-pink-600 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                                 : isWarning
                                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                    : 'bg-gradient-to-r from-primary-400 to-accent-cyan shadow-[0_0_15px_rgba(14,165,233,0.3)]';

                           return (
                              <div
                                 key={idx}
                                 onClick={() => onTriageRequest?.(item.name, 'General Health')}
                                 className="group flex items-center gap-6 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-dark-bg transition-all duration-300 cursor-pointer border border-transparent hover:border-gray-100 dark:hover:border-white/5 animate-in fade-in slide-in-from-right-2"
                                 style={{ animationDelay: `${idx * 50}ms` }}
                              >
                                 <div className="w-48 shrink-0">
                                    <h4 className="text-[14px] font-bold text-gray-800 dark:text-white truncate" title={item.name}>{item.name}</h4>
                                    <div className="flex items-center gap-2.5 mt-1.5 font-bold">
                                       <div className={`w-2 h-2 rounded-full ${item.status === 'Critical' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                       <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em]">{item.status}</span>
                                    </div>
                                 </div>

                                 <div className="flex-1 flex flex-col justify-center">
                                    <div className="flex justify-between items-end mb-2">
                                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{item.label}</span>
                                       <span className={`text-[12px] font-black ${isCritical && !isUnbounded ? 'text-rose-500' : 'text-gray-700 dark:text-gray-200'}`}>
                                          {isUnbounded ? '—' : `${saturation}%`}
                                       </span>
                                    </div>
                                    <div className="h-2.5 w-full bg-gray-100 dark:bg-dark-bg/80 rounded-full overflow-hidden shadow-inner">
                                       <div
                                          className={`h-full rounded-full transition-all duration-1000 ease-out ${colorClass}`}
                                          style={{ width: isUnbounded ? '0%' : `${saturation}%` }}
                                       />
                                    </div>
                                 </div>

                                 <div className="w-32 shrink-0 text-right">
                                    <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                                       <span className="text-gray-900 dark:text-white font-black">{item.used.toFixed(2)}{item.unit}</span>
                                       {isUnbounded ? (
                                          <span className="block text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">No Limit</span>
                                       ) : (
                                          item.base > 0 && saturationTab !== 'Network' && (
                                             <> <span className="opacity-40">/</span> {item.base.toFixed(0)}{item.unit}</>
                                          )
                                       )}
                                    </div>
                                    {!isUnbounded && (
                                       <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 block">
                                          {saturationTab === 'CPU' ? 'cores limit' : saturationTab === 'Memory' ? 'ram limit' : saturationTab === 'Storage' ? 'disk limit' : 'bandwidth'}
                                       </span>
                                    )}
                                 </div>
                              </div>
                           );
                        })}
                  </div>
               </div>
            </div>
         </div>

         {/* Error Budget Section */}
         <div className="bg-white dark:bg-dark-card rounded-5xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 cyber-card">
            <div className="p-12 border-b border-gray-50 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 bg-gray-50/20 dark:bg-white/[0.02]">
               <div className="flex items-center gap-8">
                  <div className="p-6 bg-primary-500/10 rounded-4xl text-primary-500 shadow-[0_0_30px_rgba(14,165,233,0.15)] border border-primary-500/20">
                     <ShieldAlert className="w-10 h-10" />
                  </div>
                  <div>
                     <h3 className="text-4xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none mb-3 font-display">System Resilience</h3>
                     <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 dark:text-gray-500">30-Day Autonomous Error Budget</p>
                  </div>
               </div>
               <div className="flex items-center gap-12">
                  <div className="text-right">
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 leading-none mb-3 font-display">Operational SLO</p>
                     <p className="text-4xl font-black text-primary-500 dark:text-primary-400 leading-none font-mono">{reliabilityMetrics.slo}%</p>
                  </div>
               </div>
            </div>

            <div className="p-10 grid grid-cols-1 lg:grid-cols-3 gap-16">
               <div className="flex flex-col items-center justify-center">
                  <div className="relative w-64 h-64 group">
                     <div className="absolute inset-0 bg-primary-500/5 rounded-full blur-[80px] group-hover:bg-primary-500/10 transition-colors"></div>
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie
                              data={budgetGaugeData}
                              cx="50%"
                              cy="50%"
                              startAngle={210}
                              endAngle={-30}
                              innerRadius={85}
                              outerRadius={95}
                              dataKey="value"
                              stroke="none"
                           >
                              {budgetGaugeData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                           </Pie>
                        </PieChart>
                     </ResponsiveContainer>
                     <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Budget</span>
                        <span className={`text-5xl font-black tracking-tighter ${reliabilityMetrics.severity === 'Critical' ? 'text-rose-500' : 'text-gray-900 dark:text-white'}`}>
                           {reliabilityMetrics.budgetPercentage.toFixed(1)}%
                        </span>
                        <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em] mt-2">REMAINING</span>
                     </div>
                  </div>
               </div>

               <div className="flex flex-col justify-center space-y-8">
                  <div className="bg-gray-50/50 dark:bg-dark-bg/50 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
                     <div className="flex justify-between items-center mb-5">
                        <div className="flex items-center gap-3">
                           <ShieldCheck className="w-5 h-5 text-emerald-500" />
                           <span className="text-[11px] font-black uppercase text-gray-500 tracking-[0.2em]">Risk Factor</span>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${reliabilityMetrics.severity === 'Healthy' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                           reliabilityMetrics.severity === 'Warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                           }`}>
                           {reliabilityMetrics.severity}
                        </span>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">{reliabilityMetrics.burnRate.toFixed(2)}x</div>
                        <div className="text-[11px] font-bold uppercase text-gray-400 leading-tight tracking-widest">Burn Rate<br />vs Normal</div>
                     </div>
                  </div>

                  <div className="bg-gray-50/50 dark:bg-dark-bg/50 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
                     <div className="flex justify-between items-center mb-5">
                        <div className="flex items-center gap-3">
                           <Target className="w-5 h-5 text-primary-500" />
                           <span className="text-[11px] font-black uppercase text-gray-500 tracking-[0.2em]">Exhaustion Forecast</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">{reliabilityMetrics.uptimeForecast}</div>
                        <div className="text-[11px] font-bold uppercase text-gray-400 leading-tight tracking-widest">Time until<br />SLO breach</div>
                     </div>
                  </div>
               </div>

               <div className="bg-gray-50/50 dark:bg-dark-bg/50 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 flex flex-col justify-between shadow-sm">
                  <div>
                     <h4 className="text-[13px] font-black uppercase tracking-widest text-gray-900 dark:text-white mb-4">Policy Compliance</h4>
                     <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8">
                        Current resource distribution is within 15% of the <span className="text-primary-500 font-bold">"Balanced Production"</span> template. No immediate re-balancing required.
                     </p>
                  </div>
                  <button
                     onClick={() => onTriageRequest?.('w-6', 'General Health')}
                     className="w-full flex items-center justify-between p-5 bg-white dark:bg-[#1A1D23] rounded-2xl border border-gray-100 dark:border-white/5 hover:border-primary-500 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300 group/pol shadow-sm"
                  >
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 dark:text-gray-400 group-hover/pol:text-primary-500">Run Compliance Audit</span>
                     <ExternalLink className="w-5 h-5 text-gray-300 group-hover/pol:text-primary-500 transition-colors" />
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
};
