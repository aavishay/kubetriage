
import React, { useMemo } from 'react';
import { Workload, DiagnosticPlaybook } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
// Added missing ChevronRight import
import { Activity, DollarSign, Box, Zap, TrendingDown, ShieldAlert, HeartPulse, Sparkles, AlertCircle, Network, ServerCrash, ZapOff, ArrowRight, Gauge, Target, SearchCode, ShieldCheck, Wifi, ExternalLink, ChevronRight, Server } from 'lucide-react';

interface DashboardProps {
   workloads: Workload[];
   isDarkMode?: boolean;
   onTriageRequest?: (workloadId: string, playbook: DiagnosticPlaybook) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ workloads, isDarkMode = true, onTriageRequest }) => {
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
      requested: w.metrics?.cpuRequest || 0,
      used: w.metrics?.cpuUsage || 0,
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
      const hoursRemaining = burnRate > 0 ? (remainingBudget / (dailyConsumption / 24)) : 720;
      const days = Math.floor(hoursRemaining / 24);
      const hours = Math.floor(hoursRemaining % 24);

      return {
         slo, remainingBudget, budgetPercentage, burnRate,
         uptimeForecast: `${days}d ${hours}h`,
         severity: burnRate > 2.0 ? 'Critical' : burnRate > 1.2 ? 'Warning' : 'Healthy'
      };
   }, [workloads, criticalCount, warningCount]);

   const budgetGaugeData = [
      { name: 'Consumed', value: Math.max(0, isFinite(reliabilityMetrics.budgetPercentage) ? 100 - reliabilityMetrics.budgetPercentage : 100), color: reliabilityMetrics.severity === 'Critical' ? '#ef4444' : '#6366f1' },
      { name: 'Remaining', value: Math.max(0, isFinite(reliabilityMetrics.budgetPercentage) ? reliabilityMetrics.budgetPercentage : 0), color: isDarkMode ? '#27272a' : '#f4f4f5' },
   ];

   const cardClass = "bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md";
   const tooltipStyle = {
      backgroundColor: isDarkMode ? '#18181b' : '#ffffff',
      borderColor: isDarkMode ? '#27272a' : '#e4e4e7',
      color: isDarkMode ? '#fff' : '#18181b',
      borderRadius: '12px',
      border: '1px solid ' + (isDarkMode ? '#27272a' : '#e4e4e7'),
      fontSize: '11px',
      fontWeight: 'bold'
   };

   if (workloads.length === 0) {
      return (
         <div className="flex flex-col items-center justify-center min-h-[400px] animate-in fade-in duration-500">
            <div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-6 relative">
               <Server className="w-12 h-12 text-zinc-400" />
               <div className="absolute top-0 right-0 w-4 h-4 bg-amber-500 rounded-full animate-ping" />
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-2">No Workloads Found</h2>
            <p className="text-zinc-500 max-w-md text-center mb-8">
               We couldn't detect any compatible workloads in this cluster. This might be due to missing RBAC permissions or an empty namespace.
            </p>
            <button
               onClick={() => window.location.reload()}
               className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all flex items-center gap-2"
            >
               <Activity className="w-4 h-4" /> Refresh Dashboard
            </button>
         </div>
      );
   }

   return (
      <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">

         {/* Priority Investigation Hero - Focused on ingress-nginx network issues */}
         <section className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
            <div className="relative bg-zinc-900 dark:bg-zinc-950 rounded-[2.5rem] p-8 md:p-10 border border-zinc-800 shadow-2xl overflow-hidden">
               <div className="flex flex-col lg:flex-row items-center gap-10">
                  <div className="relative shrink-0">
                     <div className="p-6 bg-indigo-500/10 rounded-[2rem] border border-indigo-500/20">
                        <Network className="w-12 h-12 text-indigo-400 animate-pulse" />
                     </div>
                     <div className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg animate-bounce border-2 border-zinc-900">1</div>
                  </div>

                  <div className="flex-1 text-center lg:text-left">
                     <div className="flex flex-wrap justify-center lg:justify-start items-center gap-3 mb-4">
                        <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-black uppercase tracking-widest">Priority investigation</span>
                        <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                           <Wifi className="w-3 h-3" /> Network connectivity
                        </span>
                     </div>
                     <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter mb-3 leading-none">
                        Diagnose: <span className="text-indigo-400">ingress-nginx-controller</span>
                     </h2>
                     <p className="text-zinc-400 text-sm font-medium max-w-2xl leading-relaxed">
                        Critical upstream latency detected. Multiple 504 Gateway Timeouts reported in production namespace. Gemini AI suggests a targeted connectivity triage of the NGINX control plane.
                     </p>
                  </div>

                  <div className="shrink-0 flex flex-col gap-3 w-full lg:w-auto">
                     <button
                        onClick={() => onTriageRequest?.('w-6', 'Network Connectivity')}
                        className="bg-white text-zinc-900 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 group/btn"
                     >
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        Initialize Diagnostic
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                     </button>
                     <div className="flex items-center justify-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                        <SearchCode className="w-3.5 h-3.5" /> Analyzing logs & topology
                     </div>
                  </div>
               </div>
               {/* Design detail */}
               <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-[60px]"></div>
            </div>
         </section>

         {/* Top Metrics Grid */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            <div className={cardClass}>
               <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400"><DollarSign className="w-5 h-5" /></div>
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">+4.2%</span>
               </div>
               <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-none mb-2">OpEx Monthly</p>
               <h3 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">${totalCost.toLocaleString()}</h3>
            </div>

            <div className={cardClass}>
               <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400"><Activity className="w-5 h-5" /></div>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Healthy</span>
               </div>
               <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-none mb-2">Fleet Integrity</p>
               <h3 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">{Math.round((1 - (criticalCount / workloads.length)) * 100)}%</h3>
            </div>

            <div className={cardClass}>
               <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400"><TrendingDown className="w-5 h-5" /></div>
                  <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Optimizable</span>
               </div>
               <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-none mb-2">Waste Forecast</p>
               {/* Fixed syntax error: 'potential savings' -> 'potentialSavings' */}
               <h3 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">${Math.round(potentialSavings).toLocaleString()}</h3>
            </div>

            <div className={cardClass}>
               <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-orange-500/10 rounded-xl text-orange-600 dark:text-orange-400"><Box className="w-5 h-5" /></div>
                  <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{workloads.length} Units</span>
               </div>
               <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-none mb-2">Active Services</p>
               <h3 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">Ready</h3>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">
            {/* Active Incidents Feed */}
            <div className="lg:col-span-2 flex flex-col gap-6">
               <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 flex flex-col shadow-sm flex-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                     <ShieldAlert className="w-4 h-4 text-rose-500" /> Active Incidents
                  </h3>
                  <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                     {incidents.length > 0 ? incidents.map(w => (
                        <div key={w.id} className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 group hover:border-indigo-500/30 transition-all">
                           <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-3">
                                 <div className={`w-2 h-2 rounded-full ${w.status === 'Critical' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
                                 <span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">{w.name}</span>
                              </div>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${w.status === 'Critical' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                                 {w.status}
                              </span>
                           </div>
                           <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold mb-4 line-clamp-1">
                              {w.recentLogs[0] || 'No logs available'}
                           </p>
                           <button
                              onClick={() => onTriageRequest?.(w.id, 'Resource Constraints')}
                              className="w-full flex items-center justify-between gap-2 bg-white dark:bg-zinc-800 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-indigo-600 hover:text-white transition-all group/btn"
                           >
                              <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                 <Sparkles className="w-3.5 h-3.5 text-indigo-500 group-hover/btn:text-white" />
                                 Investigate with Gemini
                              </span>
                              <ChevronRight className="w-4 h-4 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                           </button>
                        </div>
                     )) : (
                        <div className="p-10 text-center flex flex-col items-center">
                           <HeartPulse className="w-10 h-10 text-emerald-500 mb-3" />
                           <p className="text-xs font-black uppercase text-zinc-400 tracking-widest">All services nominal</p>
                        </div>
                     )}
                  </div>
               </div>

               <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 flex flex-col shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                     <Activity className="w-4 h-4 text-indigo-500" /> Status Distribution
                  </h3>
                  <div className="h-48 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none">
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

            <div className="lg:col-span-3 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 flex flex-col shadow-sm h-full">
               <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-8 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" /> Resource Saturation (CPU)
               </h3>
               <div className="flex-1 w-full min-h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={resourceData} layout="vertical" margin={{ left: 0, right: 20 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: isDarkMode ? '#a1a1aa' : '#52525b' }} />
                        <Tooltip cursor={{ fill: isDarkMode ? '#18181b' : '#f9fafb' }} contentStyle={tooltipStyle} />
                        <Bar dataKey="requested" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={12} name="Request" />
                        <Bar dataKey="used" radius={[0, 4, 4, 0]} barSize={12} name="Used">
                           {resourceData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.status === 'Critical' ? '#ef4444' : entry.status === 'Warning' ? '#f59e0b' : '#10b981'} />
                           ))}
                        </Bar>
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         {/* Error Budget Section */}
         <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/30 dark:bg-zinc-950/30">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500 shadow-lg shadow-rose-500/5">
                     <ShieldAlert className="w-7 h-7" />
                  </div>
                  <div>
                     <h3 className="text-xl font-black tracking-tighter uppercase text-zinc-900 dark:text-white leading-none mb-1">Reliability Control Center</h3>
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">30-Day Rolling Error Budget Window</p>
                  </div>
               </div>
               <div className="flex items-center gap-6">
                  <div className="text-right">
                     <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 leading-none mb-1">Target SLO</p>
                     <p className="text-xl font-black text-indigo-500 dark:text-indigo-400 leading-none font-mono">{reliabilityMetrics.slo}%</p>
                  </div>
               </div>
            </div>

            <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
               <div className="flex flex-col items-center justify-center">
                  <div className="relative w-56 h-56 group">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie
                              data={budgetGaugeData}
                              cx="50%"
                              cy="50%"
                              startAngle={210}
                              endAngle={-30}
                              innerRadius={70}
                              outerRadius={80}
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
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Budget</span>
                        <span className={`text-4xl font-black tracking-tighter ${reliabilityMetrics.severity === 'Critical' ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>
                           {reliabilityMetrics.budgetPercentage.toFixed(1)}%
                        </span>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter mt-1">REMAINING</span>
                     </div>
                  </div>
               </div>

               <div className="flex flex-col justify-center space-y-6">
                  <div className="bg-zinc-50 dark:bg-zinc-950/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                     <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                           <ShieldCheck className="w-4 h-4 text-emerald-500" />
                           <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Risk Factor</span>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${reliabilityMetrics.severity === 'Healthy' ? 'bg-emerald-500/10 text-emerald-500' :
                           reliabilityMetrics.severity === 'Warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                           }`}>
                           {reliabilityMetrics.severity}
                        </span>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">{reliabilityMetrics.burnRate.toFixed(2)}x</div>
                        <div className="text-[10px] font-black uppercase text-zinc-400 leading-tight">Burn Rate<br />vs Normal</div>
                     </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-950/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                     <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                           <Target className="w-4 h-4 text-indigo-500" />
                           <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Exhaustion Forecast</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">{reliabilityMetrics.uptimeForecast}</div>
                        <div className="text-[10px] font-black uppercase text-zinc-400 leading-tight">Time until<br />SLO breach</div>
                     </div>
                  </div>
               </div>

               <div className="bg-zinc-50 dark:bg-zinc-950/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between">
                  <div>
                     <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white mb-2">Policy Compliance</h4>
                     <p className="text-[10px] text-zinc-500 font-bold leading-relaxed mb-6">
                        Current resource distribution is within 15% of the "Balanced Production" template. No immediate re-balancing required.
                     </p>
                  </div>
                  <button
                     onClick={() => onTriageRequest?.('w-6', 'General Health')}
                     className="w-full flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:border-indigo-500 transition-all group/pol"
                  >
                     <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 group-hover/pol:text-indigo-500">Run Compliance Audit</span>
                     <ExternalLink className="w-4 h-4 text-zinc-300 group-hover/pol:text-indigo-500" />
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
};
