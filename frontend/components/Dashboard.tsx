
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
}

export const Dashboard: React.FC<DashboardProps> = ({ workloads, isDarkMode = true, isLoading = false, onTriageRequest, onRefresh }) => {
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

   const cardClass = "bg-white dark:bg-[#16191E] p-4 md:p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/5 hover:-translate-y-0.5";
   const tooltipStyle = {
      backgroundColor: isDarkMode ? '#16191E' : '#ffffff',
      borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f3f4f6',
      color: isDarkMode ? '#fff' : '#111827',
      borderRadius: '16px',
      border: '1px solid ' + (isDarkMode ? 'rgba(255,255,255,0.1)' : '#f3f4f6'),
      fontSize: '12px',
      fontWeight: '600',
      padding: '8px 12px'
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
         <div className="flex flex-col items-center justify-center min-h-[400px] animate-in fade-in duration-500">
            <div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-6 relative">
               <Server className="w-12 h-12 text-zinc-400" />
               <div className="absolute top-0 right-0 w-4 h-4 bg-amber-500 rounded-full animate-ping" />
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-2">No Workloads Found</h2>
            <p className="text-zinc-500 max-w-md text-center mb-8">
               We couldn&apos;t detect any compatible workloads in this cluster. This might be due to missing RBAC permissions or an empty namespace.
            </p>
            <button
               onClick={() => onRefresh?.()}
               className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all flex items-center gap-2"
            >
               <Activity className="w-4 h-4" /> Refresh Dashboard
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

         {/* Priority Investigation Hero - Focused on ingress-nginx network issues */}
         <section className="relative group animate-in slide-in-from-top-4 duration-700">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-600/20 to-purple-600/20 rounded-[3rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative bg-[#16191E] dark:bg-[#0A0C0E] rounded-[3rem] p-6 md:p-10 border border-white/5 shadow-2xl overflow-hidden">
               <div className="flex flex-col lg:flex-row items-center gap-10">
                  <div className="relative shrink-0">
                     <div className="p-8 bg-primary-500/10 rounded-[2.5rem] border border-primary-500/20 shadow-inner">
                        <Network className="w-14 h-14 text-primary-400 animate-pulse" />
                     </div>
                     <div className="absolute -top-3 -right-3 w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-xs font-black text-white shadow-lg animate-bounce border-4 border-[#16191E]">1</div>
                  </div>

                  <div className="flex-1 text-center lg:text-left">
                     <div className="flex flex-wrap justify-center lg:justify-start items-center gap-3 mb-6">
                        <span className="px-4 py-1.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[11px] font-black uppercase tracking-widest shadow-sm">Priority investigation</span>
                        <span className="px-4 py-1.5 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                           <Wifi className="w-4 h-4" /> Network connectivity
                        </span>
                     </div>
                     <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter mb-4 leading-none">
                        Diagnose: <span className="text-primary-400">ingress-nginx</span>
                     </h2>
                     <p className="text-gray-400 text-base font-medium max-w-2xl leading-relaxed">
                        Critical upstream latency detected. Multiple 504 Gateway Timeouts reported in production. AI suggests a targeted connectivity triage of the NGINX control plane.
                     </p>
                  </div>

                  <div className="shrink-0 flex flex-col gap-4 w-full lg:w-auto">
                     <button
                        onClick={() => onTriageRequest?.('w-6', 'Network Connectivity')}
                        className="bg-white text-[#0A0C0E] px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-primary-50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group/btn"
                     >
                        <Sparkles className="w-5 h-5 text-primary-600" />
                        Initialize Diagnostic
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                     </button>
                     <div className="flex items-center justify-center gap-2.5 text-[11px] font-black text-gray-500 uppercase tracking-[0.1em]">
                        <SearchCode className="w-4 h-4" /> Analyzing logs & topology
                     </div>
                  </div>
               </div>
               {/* Design detail */}
               <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary-500/10 rounded-full blur-[100px] pointer-events-none"></div>
               <div className="absolute -top-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>
            </div>
         </section>

         {/* Top Metrics Grid */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className={`${cardClass} animate-in fade-in slide-in-from-bottom-2 duration-500 delay-[100ms]`}>
               <div className="flex justify-between items-start mb-6">
                  <div className="p-2.5 bg-primary-500/10 rounded-2xl text-primary-600 dark:text-primary-400 shadow-sm"><DollarSign className="w-6 h-6" /></div>
                  <span className="text-[11px] font-black text-primary-500 bg-primary-500/5 px-2 py-0.5 rounded-full uppercase tracking-widest border border-primary-500/10">+4.2%</span>
               </div>
               <p className="text-gray-500 dark:text-gray-400 text-[11px] font-black uppercase tracking-[0.15em] leading-none mb-3">OpEx Monthly</p>
               <h3 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">${totalCost.toLocaleString()}</h3>
            </div>

            <div className={`${cardClass} animate-in fade-in slide-in-from-bottom-2 duration-500 delay-[200ms]`}>
               <div className="flex justify-between items-start mb-6">
                  <div className="p-2.5 bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400 shadow-sm"><Activity className="w-6 h-6" /></div>
                  <span className="text-[11px] font-black text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-full uppercase tracking-widest border border-emerald-500/10">Healthy</span>
               </div>
               <p className="text-gray-500 dark:text-gray-400 text-[11px] font-black uppercase tracking-[0.15em] leading-none mb-3">Fleet Integrity</p>
               <h3 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">{Math.round((1 - (criticalCount / workloads.length)) * 100)}%</h3>
            </div>

            <div className={`${cardClass} animate-in fade-in slide-in-from-bottom-2 duration-500 delay-[300ms]`}>
               <div className="flex justify-between items-start mb-6">
                  <div className="p-2.5 bg-purple-500/10 rounded-2xl text-purple-600 dark:text-purple-400 shadow-sm"><TrendingDown className="w-6 h-6" /></div>
                  <span className="text-[11px] font-black text-purple-500 bg-purple-500/5 px-2 py-0.5 rounded-full uppercase tracking-widest border border-purple-500/10">Optimizable</span>
               </div>
               <p className="text-gray-500 dark:text-gray-400 text-[11px] font-black uppercase tracking-[0.15em] leading-none mb-3">Waste Forecast</p>
               <h3 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">${Math.round(potentialSavings).toLocaleString()}</h3>
            </div>

            <div className={`${cardClass} animate-in fade-in slide-in-from-bottom-2 duration-500 delay-[400ms]`}>
               <div className="flex justify-between items-start mb-6">
                  <div className="p-2.5 bg-orange-500/10 rounded-2xl text-orange-600 dark:text-orange-400 shadow-sm"><Box className="w-6 h-6" /></div>
                  <span className="text-[11px] font-black text-orange-500 bg-orange-500/5 px-2 py-0.5 rounded-full uppercase tracking-widest border border-orange-500/10">{workloads.length} Units</span>
               </div>
               <p className="text-gray-500 dark:text-gray-400 text-[11px] font-black uppercase tracking-[0.15em] leading-none mb-3">Active Services</p>
               <h3 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">Ready</h3>
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

            <div className="lg:col-span-3 bg-white dark:bg-[#16191E] rounded-[2rem] border border-gray-100 dark:border-white/5 p-6 md:p-8 flex flex-col shadow-sm h-full animate-in fade-in slide-in-from-right-4 duration-700 delay-200">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 flex items-center gap-2.5">
                     <Zap className="w-4 h-4 text-primary-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]" /> Resource Saturation
                  </h3>
                  <div className="flex items-center gap-4">
                     {/* Sort Selector */}
                     <div className="flex p-1 bg-gray-100/50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
                        {(['Live', 'Avg', 'P95', 'P99'] as const).map((sort) => (
                           <button
                              key={sort}
                              onClick={() => setSaturationSort(sort)}
                              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${saturationSort === sort
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
                              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${saturationTab === type
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
                           const metrics = w.metrics || {};
                           let live = 0, avg = 0, p95 = 0, p99 = 0;

                           if (saturationTab === 'CPU') {
                              base = (Number(metrics.cpuLimit) || Number(metrics.cpuRequest)) || 0;
                              live = Number(metrics.cpuUsage) || 0;
                              avg = Number(metrics.cpuAvg) || 0;
                              p95 = Number(metrics.cpuP95) || 0;
                              p99 = Number(metrics.cpuP99) || 0;
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
                           const saturation = item.base > 0 ? Math.min(100, Math.round((item.used / item.base) * 100)) : 0;
                           const isCritical = saturationTab === 'Memory' ? saturation >= 95 : saturation >= 90;
                           const isWarning = saturation >= 70 && !isCritical;

                           const colorClass = isCritical
                              ? 'bg-gradient-to-r from-rose-500 to-pink-600 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                              : isWarning
                                 ? 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                                 : 'bg-gradient-to-r from-primary-400 to-teal-500 shadow-[0_0_12px_rgba(56,189,248,0.2)]';

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
                                       <span className={`text-[12px] font-black ${isCritical ? 'text-rose-500' : 'text-gray-700 dark:text-gray-200'}`}>{saturation}%</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-gray-100 dark:bg-dark-bg/80 rounded-full overflow-hidden shadow-inner">
                                       <div
                                          className={`h-full rounded-full transition-all duration-1000 ease-out ${colorClass}`}
                                          style={{ width: `${saturation}%` }}
                                       />
                                    </div>
                                 </div>

                                 <div className="w-32 shrink-0 text-right">
                                    <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                                       <span className="text-gray-900 dark:text-white font-black">{item.used.toFixed(saturationTab === 'Network' ? 1 : 2)}{item.unit}</span>
                                       {item.base > 0 && saturationTab !== 'Network' && (
                                          <> <span className="opacity-40">/</span> {item.base.toFixed(0)}{item.unit}</>
                                       )}
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 block">
                                       {saturationTab === 'CPU' ? 'cores limit' : saturationTab === 'Memory' ? 'ram limit' : saturationTab === 'Storage' ? 'disk limit' : 'bandwidth'}
                                    </span>
                                 </div>
                              </div>
                           );
                        })}
                  </div>
               </div>
            </div>
         </div>

         {/* Error Budget Section */}
         <div className="bg-white dark:bg-[#16191E] rounded-[3rem] border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500">
            <div className="p-10 border-b border-gray-50 dark:border-white/5 flex justify-between items-center bg-gray-50/20 dark:bg-dark-bg/20">
               <div className="flex items-center gap-6">
                  <div className="p-4 bg-primary-500/10 rounded-[1.5rem] text-primary-500 shadow-lg shadow-primary-500/5">
                     <ShieldAlert className="w-9 h-9" />
                  </div>
                  <div>
                     <h3 className="text-3xl font-black tracking-tighter uppercase text-gray-900 dark:text-white leading-none mb-2">Reliability Control</h3>
                     <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">30-Day Rolling Error Budget Window</p>
                  </div>
               </div>
               <div className="flex items-center gap-8">
                  <div className="text-right">
                     <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-401 leading-none mb-2">Target SLO</p>
                     <p className="text-3xl font-black text-primary-500 dark:text-primary-400 leading-none font-mono">{reliabilityMetrics.slo}%</p>
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
