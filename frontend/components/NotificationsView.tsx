
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMonitoring } from '../contexts/MonitoringContext';
import { NotificationChannel, NotificationType, AlertRule, TriggeredAlert } from '../types';
import { Bell, Plus, Search, MoreHorizontal, Slack, Mail, Webhook, Trash2, Edit2, X, Activity, Loader2, Play, Pause, Settings2, ShieldAlert, Cpu, MemoryStick, Zap, DollarSign, Filter, CheckCircle2, AlertCircle, MessageSquare, History, Clock, ArrowRight, BellRing } from 'lucide-react';

interface NotificationsViewProps {
   channels: NotificationChannel[];
   onAddChannel: (channel: NotificationChannel) => void;
   onUpdateChannel: (channel: NotificationChannel) => void;
   onDeleteChannel: (id: string) => void;
   alertRules: AlertRule[];
   onAddAlertRule: (rule: AlertRule) => void;
   onUpdateAlertRule: (rule: AlertRule) => void;
   onDeleteAlertRule: (id: string) => void;
   triggeredAlerts: TriggeredAlert[];
   isDarkMode?: boolean;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
   channels, onAddChannel, onUpdateChannel, onDeleteChannel,
   alertRules, onAddAlertRule, onUpdateAlertRule, onDeleteAlertRule,
   triggeredAlerts,
   isDarkMode = true
}) => {
   const { notificationSettings, updateNotificationSettings } = useMonitoring();
   const [activeTab, setActiveTab] = useState<'channels' | 'rules' | 'history'>('rules');
   const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
   const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
   const [searchTerm, setSearchTerm] = useState('');

   // Freeze Logic
   const [isPaused, setIsPaused] = useState(false);
   const [frozenAlerts, setFrozenAlerts] = useState<TriggeredAlert[]>([]);

   const togglePause = () => {
      if (!isPaused) {
         setFrozenAlerts(triggeredAlerts);
      } else {
         setFrozenAlerts([]);
      }
      setIsPaused(!isPaused);
   };

   // Test State
   const [testingId, setTestingId] = useState<string | null>(null);
   const [testResult, setTestResult] = useState<{ id: string, success: boolean } | null>(null);

   // Channel Form State
   const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
   const [channelName, setChannelName] = useState('');
   const [channelType, setChannelType] = useState<NotificationType>('Slack');
   const [channelTarget, setChannelTarget] = useState('');

   // Rule Form State
   const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
   const [ruleName, setRuleName] = useState('');
   const [ruleMetric, setRuleMetric] = useState<AlertRule['metric']>('CPU');
   const [ruleThreshold, setRuleThreshold] = useState(80);
   const [ruleSeverity, setRuleSeverity] = useState<AlertRule['severity']>('Critical');
   const [ruleChannels, setRuleChannels] = useState<string[]>([]);

   const location = useLocation();

   useEffect(() => {
      if (location.state?.editRuleId) {
         const ruleToEdit = alertRules.find(r => r.id === location.state.editRuleId);
         if (ruleToEdit) {
            openRuleModal(ruleToEdit);
         }
      }
      if (location.state?.activeTab) {
         setActiveTab(location.state.activeTab);
      }
   }, [location.state, alertRules]);

   const filteredChannels = channels.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.type.toLowerCase().includes(searchTerm.toLowerCase())
   );

   const filteredRules = alertRules.filter(r =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.metric.toLowerCase().includes(searchTerm.toLowerCase())
   );

   const getEffectiveAlerts = () => isPaused ? frozenAlerts : triggeredAlerts;

   const filteredHistory = getEffectiveAlerts().filter(a =>
      a.ruleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.workloadName.toLowerCase().includes(searchTerm.toLowerCase())
   );

   const navigate = useNavigate();

   const handleAlertClick = (alert: TriggeredAlert) => {
      navigate('/triage', { state: { workloadId: alert.workloadId } });
   };

   const openChannelModal = (channel?: NotificationChannel) => {
      if (channel) {
         setEditingChannelId(channel.id);
         setChannelName(channel.name);
         setChannelType(channel.type);
         setChannelTarget(channel.target);
      } else {
         setEditingChannelId(null);
         setChannelName('');
         setChannelType('Slack');
         setChannelTarget('');
      }
      setIsChannelModalOpen(true);
   };

   const openRuleModal = (rule?: AlertRule) => {
      if (rule) {
         setEditingRuleId(rule.id);
         setRuleName(rule.name);
         setRuleMetric(rule.metric);
         setRuleThreshold(rule.threshold);
         setRuleSeverity(rule.severity);
         setRuleChannels(rule.channels);
      } else {
         setEditingRuleId(null);
         setRuleName('');
         setRuleMetric('CPU');
         setRuleThreshold(80);
         setRuleSeverity('Critical');
         setRuleChannels([]);
      }
      setIsRuleModalOpen(true);
   };

   const handleChannelSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!channelName || !channelTarget) return;

      if (editingChannelId) {
         const existing = channels.find(c => c.id === editingChannelId);
         if (existing) {
            onUpdateChannel({ ...existing, name: channelName, type: channelType, target: channelTarget });
         }
      } else {
         onAddChannel({ id: `nc-${Date.now()}`, name: channelName, type: channelType, target: channelTarget, status: 'Active', events: ['Critical'] });
      }
      setIsChannelModalOpen(false);
   };

   const handleRuleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!ruleName) return;

      if (editingRuleId) {
         const existing = alertRules.find(r => r.id === editingRuleId);
         if (existing) {
            onUpdateAlertRule({ ...existing, name: ruleName, metric: ruleMetric, threshold: ruleThreshold, severity: ruleSeverity, channels: ruleChannels });
         }
      } else {
         onAddAlertRule({ id: `ar-${Date.now()}`, name: ruleName, metric: ruleMetric, operator: '>', threshold: ruleThreshold, severity: ruleSeverity, channels: ruleChannels, enabled: true });
      }
      setIsRuleModalOpen(false);
   };

   const handleTest = (id: string) => {
      setTestingId(id);
      setTimeout(() => {
         setTestingId(null);
         setTestResult({ id, success: true });
         setTimeout(() => setTestResult(null), 3000);
      }, 1500);
   };

   const getMetricIcon = (metric: AlertRule['metric']) => {
      switch (metric) {
         case 'CPU': return <Cpu className="w-5 h-5 text-indigo-500" />;
         case 'Memory': return <MemoryStick className="w-5 h-5 text-emerald-500" />;
         case 'Cost': return <DollarSign className="w-5 h-5 text-amber-500" />;
         default: return <Zap className="w-5 h-5 text-blue-500" />;
      }
   };

   const getTypeIcon = (type: NotificationType) => {
      switch (type) {
         case 'Slack': return <Slack className="w-4 h-4 text-white" />;
         case 'PagerDuty': return <Activity className="w-4 h-4 text-white" />;
         case 'Email': return <Mail className="w-4 h-4 text-white" />;
         default: return <Bell className="w-4 h-4 text-white" />;
      }
   };

   const getTypeColor = (type: NotificationType) => {
      switch (type) {
         case 'Slack': return 'bg-[#4A154B]';
         case 'PagerDuty': return 'bg-[#006000]';
         case 'Email': return 'bg-blue-500';
         default: return 'bg-zinc-600';
      }
   };

   const formatTime = (ts: number) => {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
   };

   return (
      <div className="space-y-6">
         <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
               <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-indigo-500/10 rounded-2xl">
                     <Bell className="w-6 h-6 text-indigo-500" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase">Broadcast & Logic</h2>
               </div>
               <p className="text-sm text-zinc-500 font-semibold max-w-sm">Define alert thresholds and connect external notification sinks for proactive cluster monitoring.</p>
            </div>

            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700">
               <button
                  onClick={() => setActiveTab('rules')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'rules' ? 'bg-white dark:bg-zinc-700 text-indigo-500 shadow-lg' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
               >
                  Alert Logic
               </button>
               <button
                  onClick={() => setActiveTab('channels')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'channels' ? 'bg-white dark:bg-zinc-700 text-indigo-500 shadow-lg' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
               >
                  Global Sinks
               </button>
               <button
                  onClick={() => setActiveTab('history')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white dark:bg-zinc-700 text-indigo-500 shadow-lg' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
               >
                  History
               </button>
            </div>
         </div>

         {/* Global Preferences Card */}
         <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-zinc-900 dark:to-zinc-800/50 rounded-[2.5rem] p-8 border border-indigo-100 dark:border-zinc-800 shadow-sm">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
               <div className="flex items-center gap-4">
                  <div className="bg-white dark:bg-zinc-800 p-3 rounded-2xl shadow-sm">
                     <Settings2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                     <h3 className="text-zinc-900 dark:text-white font-black tracking-tight text-lg">Alert Frequency Control</h3>
                     <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider mt-1">Manage global toast notification behavior</p>
                  </div>
               </div>

               <div className="flex flex-col sm:flex-row items-center gap-8 bg-white/50 dark:bg-zinc-900/50 p-6 rounded-3xl border border-white/50 dark:border-zinc-700/50 w-full md:w-auto">
                  {/* Toggle */}
                  <div className="flex items-center gap-4">
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Toast Popups</span>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input
                           type="checkbox"
                           checked={notificationSettings.toastEnabled}
                           onChange={(e) => updateNotificationSettings({ ...notificationSettings, toastEnabled: e.target.checked })}
                           className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-zinc-200 dark:bg-zinc-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                     </label>
                  </div>

                  <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700 hidden sm:block"></div>

                  {/* Slider */}
                  <div className="flex items-center gap-4 w-full sm:w-64">
                     <div className="flex-1 space-y-2">
                        <div className="flex justify-between">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Min Interval</span>
                           <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">{notificationSettings.toastFrequency}s</span>
                        </div>
                        <input
                           type="range"
                           min="1"
                           max="60"
                           disabled={!notificationSettings.toastEnabled}
                           value={notificationSettings.toastFrequency}
                           onChange={(e) => updateNotificationSettings({ ...notificationSettings, toastFrequency: parseInt(e.target.value) })}
                           className="w-full h-2 bg-zinc-200 dark:bg-zinc-950 rounded-full appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
                        />
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 gap-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
               <div className="relative w-full sm:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                     type="text"
                     placeholder={`Filter ${activeTab}...`}
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full pl-12 pr-6 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-xs font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50"
                  />
               </div>
               {activeTab !== 'history' && (
                  <button
                     onClick={() => activeTab === 'channels' ? openChannelModal() : openRuleModal()}
                     className="flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-zinc-500/10 hover:scale-[1.02] active:scale-95 transition-all w-full sm:w-auto justify-center"
                  >
                     <Plus className="w-4 h-4" />
                     {activeTab === 'channels' ? 'New Integration' : 'New Rule'}
                  </button>
               )}
            </div>

            {/* Content Area */}
            {activeTab === 'history' ? (
               <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                  <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30">
                     <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                        <History className="w-4 h-4" /> Threshold Breach Timeline
                     </h3>
                     <button
                        onClick={togglePause}
                        className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isPaused ? 'bg-amber-500 text-white shadow-lg animate-pulse' : 'bg-white dark:bg-zinc-800 text-zinc-500 hover:text-indigo-500 border border-zinc-200 dark:border-zinc-700'}`}
                     >
                        {isPaused ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Live Updates Paused</span> : <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Real-time</span>}
                     </button>
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">

                     {filteredHistory.length > 0 ? (
                        filteredHistory.map(alert => (
                           <div
                              key={alert.id}
                              onClick={() => handleAlertClick(alert)}
                              className="p-8 flex items-center gap-8 group hover:bg-zinc-50 dark:hover:bg-zinc-950/50 transition-colors cursor-pointer"
                           >
                              <div className={`p-4 rounded-2xl shrink-0 ${alert.severity === 'Critical' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                 <BellRing className="w-6 h-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                 <div className="flex items-center gap-3 mb-1">
                                    <span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tighter group-hover:text-indigo-500 transition-colors">{alert.ruleName}</span>
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${alert.severity === 'Critical' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                                       }`}>
                                       {alert.severity}
                                    </span>
                                 </div>
                                 <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">
                                    Workload <span className="text-zinc-900 dark:text-white">"{alert.workloadName}"</span> reached {alert.value}% {alert.metric} utilization.
                                 </p>
                              </div>
                              <div className="text-right shrink-0">
                                 <div className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-1">{formatTime(alert.timestamp)}</div>
                                 <div className="flex items-center justify-end gap-1 text-[9px] text-zinc-400 font-bold uppercase">
                                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform text-indigo-500" />
                                    {alert.channelsNotified.length} Channels Notified
                                 </div>
                              </div>
                           </div>
                        ))
                     ) : (
                        <div className="p-20 text-center flex flex-col items-center">
                           <CheckCircle2 className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mb-4" />
                           <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No alerts detected in current window</p>
                        </div>
                     )}
                  </div>
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {activeTab === 'channels' ? (
                     filteredChannels.map(channel => (
                        <div key={channel.id} className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm group hover:border-indigo-500/50 transition-all flex flex-col h-full">
                           <div className="flex justify-between items-start mb-8">
                              <div className={`p-4 rounded-2xl shadow-xl ${getTypeColor(channel.type)}`}>
                                 {getTypeIcon(channel.type)}
                              </div>
                              <div className="flex gap-2">
                                 <button onClick={() => openChannelModal(channel)} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-indigo-500 transition-colors border border-zinc-100 dark:border-zinc-700">
                                    <Edit2 className="w-4 h-4" />
                                 </button>
                                 <button onClick={() => onDeleteChannel(channel.id)} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors border border-zinc-100 dark:border-zinc-700">
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                           </div>
                           <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tighter mb-1.5">{channel.name}</h3>
                           <p className="text-[10px] font-mono text-zinc-500 truncate mb-8 uppercase tracking-widest">{channel.target}</p>

                           <div className="mt-auto space-y-6">
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2.5">
                                    <div className={`w-2 h-2 rounded-full ${channel.status === 'Active' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-zinc-400'}`} />
                                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{channel.status}</span>
                                 </div>
                                 <button
                                    onClick={() => handleTest(channel.id)}
                                    disabled={testingId === channel.id}
                                    className="flex items-center gap-2 text-[9px] font-black uppercase text-indigo-500 tracking-[0.2em] hover:opacity-70 transition-opacity disabled:opacity-50"
                                 >
                                    {testingId === channel.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (testResult?.id === channel.id ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Play className="w-3 h-3" />)}
                                    Test Sink
                                 </button>
                              </div>
                           </div>
                        </div>
                     ))
                  ) : (
                     filteredRules.map(rule => {
                        const isActive = triggeredAlerts.some(a => a.ruleId === rule.id && Date.now() - a.timestamp < 120000);

                        return (
                           <div key={rule.id} className={`bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border shadow-sm group hover:border-indigo-500/50 transition-all flex flex-col h-full relative overflow-hidden ${isActive ? 'border-red-500 dark:border-red-900/50' : 'border-zinc-200 dark:border-zinc-800'
                              }`}>
                              {/* Severity Background Glow */}
                              <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 blur-3xl opacity-10 rounded-full ${rule.severity === 'Critical' ? 'bg-red-500' : rule.severity === 'Warning' ? 'bg-amber-500' : 'bg-indigo-500'}`} />

                              <div className="flex justify-between items-start mb-8 relative z-10">
                                 <div className={`p-3 rounded-2xl border ${isActive ? 'bg-red-500 text-white animate-pulse border-red-400' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'}`}>
                                    {isActive ? <BellRing className="w-5 h-5" /> : getMetricIcon(rule.metric)}
                                 </div>
                                 <div className="flex gap-2">
                                    <button onClick={() => openRuleModal(rule)} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-indigo-500 transition-colors border border-zinc-100 dark:border-zinc-700">
                                       <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onDeleteAlertRule(rule.id)} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors border border-zinc-100 dark:border-zinc-700">
                                       <Trash2 className="w-4 h-4" />
                                    </button>
                                 </div>
                              </div>

                              <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tighter mb-4">{rule.name}</h3>

                              <div className="space-y-6 mb-8 flex-1">
                                 <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Saturation Threshold</span>
                                    <span className={`text-lg font-mono font-black ${isActive ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>{rule.threshold}%</span>
                                 </div>
                                 <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                                    <div
                                       className={`h-full rounded-full transition-all duration-1000 ${isActive ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : rule.severity === 'Critical' ? 'bg-red-500/50' : rule.severity === 'Warning' ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                       style={{ width: `${rule.threshold}%` }}
                                    />
                                 </div>
                              </div>

                              <div className="space-y-6 mt-auto relative z-10">
                                 <div className="flex flex-wrap gap-2">
                                    {rule.channels.map(chId => {
                                       const chan = channels.find(c => c.id === chId);
                                       if (!chan) return null;
                                       return (
                                          <div key={chId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
                                             <div className={`p-1 rounded-md ${getTypeColor(chan.type)}`}>
                                                {getTypeIcon(chan.type)}
                                             </div>
                                             <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">{chan.name}</span>
                                          </div>
                                       );
                                    })}
                                 </div>

                                 <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                    <span className={`text-[9px] font-black uppercase tracking-[0.25em] px-3 py-1 rounded-full ${rule.severity === 'Critical' ? 'bg-red-500/10 text-red-500' :
                                       rule.severity === 'Warning' ? 'bg-amber-500/10 text-amber-500' :
                                          'bg-indigo-500/10 text-indigo-500'
                                       }`}>
                                       {rule.severity} Impact
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                       <input type="checkbox" checked={rule.enabled} onChange={() => onUpdateAlertRule({ ...rule, enabled: !rule.enabled })} className="sr-only peer" />
                                       <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                 </div>
                              </div>
                           </div>
                        );
                     })
                  )}
               </div>
            )}
         </div>

         {/* Channel Modal */}
         {isChannelModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
               <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                  <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50">
                     <h3 className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white flex items-center gap-3">
                        <Plus className="w-6 h-6 text-indigo-500" />
                        {editingChannelId ? 'Edit Integration' : 'New Broadcast Sink'}
                     </h3>
                     <button onClick={() => setIsChannelModalOpen(false)} className="p-2.5 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-500 transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                  </div>
                  <form onSubmit={handleChannelSubmit} className="p-10 space-y-8">
                     <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Display Name</label>
                        <input
                           type="text"
                           value={channelName}
                           onChange={(e) => setChannelName(e.target.value)}
                           placeholder="e.g. Platform SRE Slack"
                           className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/50"
                           required
                        />
                     </div>
                     <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Target Type</label>
                        <div className="grid grid-cols-3 gap-3">
                           {(['Slack', 'PagerDuty', 'Webhook', 'Email'] as NotificationType[]).map(type => (
                              <button
                                 key={type}
                                 type="button"
                                 onClick={() => setChannelType(type)}
                                 className={`p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${channelType === type ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/30' : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 text-zinc-400'}`}
                              >
                                 {type}
                              </button>
                           ))}
                        </div>
                     </div>
                     <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Connection String</label>
                        <input
                           type="text"
                           value={channelTarget}
                           onChange={(e) => setChannelTarget(e.target.value)}
                           placeholder={channelType === 'Email' ? 'admin@example.com' : 'https://hooks.slack.com/...'}
                           className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-sm font-bold font-mono focus:ring-2 focus:ring-indigo-500/50"
                           required
                        />
                     </div>
                     <div className="pt-6 flex gap-4">
                        <button type="button" onClick={() => setIsChannelModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-zinc-600 transition-colors">Cancel</button>
                        <button type="submit" className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 active:scale-95 transition-all">Establish Sink</button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {/* Rule Modal */}
         {isRuleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
               <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                  <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50">
                     <h3 className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white flex items-center gap-3">
                        <Settings2 className="w-6 h-6 text-indigo-500" />
                        {editingRuleId ? 'Edit Logic' : 'New Alert Strategy'}
                     </h3>
                     <button onClick={() => setIsRuleModalOpen(false)} className="p-2.5 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-500 transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                  </div>
                  <form onSubmit={handleRuleSubmit} className="p-10 space-y-8">
                     <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Strategy Title</label>
                        <input
                           type="text"
                           value={ruleName}
                           onChange={(e) => setRuleName(e.target.value)}
                           placeholder="e.g. Critical CPU Pressure"
                           className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/50"
                           required
                        />
                     </div>

                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                           <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Metric</label>
                           <select
                              value={ruleMetric}
                              onChange={(e) => setRuleMetric(e.target.value as any)}
                              className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/50 appearance-none"
                           >
                              <option value="CPU">Compute (CPU)</option>
                              <option value="Memory">Memory (RAM)</option>
                           </select>
                        </div>
                        <div className="space-y-2.5">
                           <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Severity</label>
                           <select
                              value={ruleSeverity}
                              onChange={(e) => setRuleSeverity(e.target.value as any)}
                              className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/50 appearance-none"
                           >
                              <option value="Info">Information</option>
                              <option value="Warning">Warning</option>
                              <option value="Critical">Critical</option>
                           </select>
                        </div>
                     </div>

                     <div className="space-y-6">
                        <div className="flex justify-between items-end">
                           <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Activation Threshold</label>
                           <span className="text-2xl font-mono font-black text-indigo-500">{ruleThreshold}%</span>
                        </div>
                        <input
                           type="range"
                           min="1" max="100"
                           value={ruleThreshold}
                           onChange={(e) => setRuleThreshold(parseInt(e.target.value))}
                           className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-600"
                        />
                     </div>

                     <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Route To Channels</label>
                        <div className="flex flex-wrap gap-2">
                           {channels.map(chan => (
                              <button
                                 key={chan.id}
                                 type="button"
                                 onClick={() => {
                                    if (ruleChannels.includes(chan.id)) {
                                       setRuleChannels(ruleChannels.filter(id => id !== chan.id));
                                    } else {
                                       setRuleChannels([...ruleChannels, chan.id]);
                                    }
                                 }}
                                 className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${ruleChannels.includes(chan.id) ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 text-zinc-400'}`}
                              >
                                 {chan.name}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="pt-6 flex gap-4">
                        <button type="button" onClick={() => setIsRuleModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-zinc-600 transition-colors">Cancel</button>
                        <button type="submit" className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 active:scale-95 transition-all">Commit Strategy</button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
};
