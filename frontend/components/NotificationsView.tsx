
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMonitoring } from '../contexts/MonitoringContext';
import { NotificationChannel, NotificationType, AlertRule, TriggeredAlert } from '../types';
import { Bell, Plus, Search, MoreHorizontal, Slack, Mail, Webhook, Trash2, Edit2, X, Activity, Loader2, Play, Pause, Settings2, ShieldAlert, Cpu, MemoryStick, Zap, DollarSign, Filter, CheckCircle2, AlertCircle, MessageSquare, History, Clock, ArrowRight, BellRing, ChevronDown, ChevronUp } from 'lucide-react';
import { useEscapeKey } from '../utils/useEscapeKey';

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
   const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

   const closeChannelModal = useCallback(() => setIsChannelModalOpen(false), []);
   const closeRuleModal = useCallback(() => setIsRuleModalOpen(false), []);
   useEscapeKey(isChannelModalOpen, closeChannelModal);
   useEscapeKey(isRuleModalOpen, closeRuleModal);

   const toggleGroup = (groupName: string) => {
      const newExpanded = new Set(expandedGroups);
      if (newExpanded.has(groupName)) {
         newExpanded.delete(groupName);
      } else {
         newExpanded.add(groupName);
      }
      setExpandedGroups(newExpanded);
   };

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
         case 'CPU': return <Cpu className="w-5 h-5 text-primary-500" />;
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
         case 'Slack': return 'bg-violet-600';
         case 'PagerDuty': return 'bg-emerald-600';
         case 'Email': return 'bg-blue-500';
         default: return 'bg-text-tertiary';
      }
   };

   const formatTime = (ts: number) => {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
   };

   return (
      <div className="space-y-6 font-sans animate-fade-in">
         <div className="bg-bg-card rounded-[2.5rem] p-6 border border-border-main shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
               <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-primary-500/10 rounded-2xl">
                     <Bell className="w-6 h-6 text-primary-500" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tighter text-text-primary uppercase">Broadcast & Logic</h2>
               </div>
               <p className="text-sm text-text-secondary font-bold uppercase tracking-wider max-w-sm opacity-60">Define alert thresholds and connect external notification sinks.</p>
            </div>

            <div className="flex bg-bg-hover p-1.5 rounded-2xl border border-border-main">
               <button
                  onClick={() => setActiveTab('rules')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'rules' ? 'bg-bg-card text-primary-500 shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}
               >
                  Alert Logic
               </button>
               <button
                  onClick={() => setActiveTab('channels')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'channels' ? 'bg-bg-card text-primary-500 shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}
               >
                  Global Sinks
               </button>
               <button
                  onClick={() => setActiveTab('history')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-bg-card text-primary-500 shadow-lg' : 'text-text-secondary hover:text-text-primary'}`}
               >
                  History
               </button>
            </div>
         </div>

         {/* Global Preferences Card */}
         <div className="relative overflow-hidden bg-bg-card/50 backdrop-blur-xl rounded-[2.5rem] p-6 border border-border-main shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />

            <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
               <div className="flex items-center gap-5">
                  <div className="p-4 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl shadow-lg shadow-primary-500/30 text-white">
                     <Settings2 className="w-6 h-6" />
                  </div>
                  <div>
                     <h3 className="text-text-primary font-black tracking-tighter text-xl uppercase">Alert Frequency Control</h3>
                     <p className="text-xs text-text-secondary font-bold uppercase tracking-wider mt-1.5 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        Global Toast Policy
                     </p>
                  </div>
               </div>

               <div className="flex flex-col sm:flex-row items-center gap-6 bg-bg-hover/40 p-2 rounded-[2rem] border border-border-main backdrop-blur-md">
                  {/* Toggle */}
                  <div className="flex items-center gap-4 px-6 py-2">
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">Popups</span>
                     <label className="relative inline-flex items-center cursor-pointer group">
                        <input
                           type="checkbox"
                           checked={notificationSettings.toastEnabled}
                           onChange={(e) => updateNotificationSettings({ ...notificationSettings, toastEnabled: e.target.checked })}
                           className="sr-only peer"
                        />
                        <div className="w-12 h-7 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-border-main after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 shadow-inner group-hover:scale-105 transition-transform" />
                     </label>
                  </div>

                  <div className="h-8 w-px bg-border-main hidden sm:block" />

                  {/* Slider */}
                  <div className="flex items-center gap-4 px-6 py-2 min-w-[240px]">
                     <div className="flex-1 space-y-3">
                        <div className="flex justify-between items-end">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">Cooldown</span>
                           <span className="text-sm font-mono font-black text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-lg border border-primary-500/20">{notificationSettings.toastFrequency}s</span>
                        </div>
                        <input
                           type="range"
                           min="1"
                           max="60"
                           disabled={!notificationSettings.toastEnabled}
                           value={notificationSettings.toastFrequency}
                           onChange={(e) => updateNotificationSettings({ ...notificationSettings, toastFrequency: parseInt(e.target.value) })}
                           className="w-full h-1.5 bg-bg-hover rounded-full appearance-none cursor-pointer accent-primary-600 disabled:opacity-50"
                        />
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 gap-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-bg-card p-5 rounded-[2rem] border border-border-main shadow-sm">
               <div className="relative w-full sm:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <input
                     type="text"
                     placeholder={`Filter ${activeTab}...`}
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="kt-input pl-11 pr-4 py-3"
                  />
               </div>
               {activeTab !== 'history' && (
                  <button
                     onClick={() => activeTab === 'channels' ? openChannelModal() : openRuleModal()}
                     className="kt-button kt-button-primary kt-button-sm"
                  >
                     <Plus className="w-4 h-4" />
                     {activeTab === 'channels' ? 'New Integration' : 'New Rule'}
                  </button>
               )}
            </div>

            {/* Content Area */}
            {activeTab === 'history' ? (
               <div className="bg-bg-card rounded-[2.5rem] border border-border-main overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-border-main bg-bg-hover/50">
                     <h3 className="text-xs font-black uppercase tracking-widest text-text-tertiary flex items-center gap-2">
                        <History className="w-4 h-4" /> Threshold Breach Timeline
                     </h3>
                     <button
                        onClick={togglePause}
                        className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isPaused ? 'bg-amber-500 text-white shadow-lg animate-pulse' : 'bg-bg-card text-text-tertiary hover:text-primary-500 border border-border-main'}`}
                     >
                        {isPaused ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Live Updates Paused</span> : <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Real-time</span>}
                     </button>
                  </div>
                  <div className="divide-y divide-border-main">

                     {filteredHistory.length > 0 ? (
                        Object.entries(
                           filteredHistory.reduce((acc, alert) => {
                              if (!acc[alert.workloadName]) acc[alert.workloadName] = [];
                              acc[alert.workloadName].push(alert);
                              return acc;
                           }, {} as Record<string, typeof filteredHistory>)
                        ).map(([workloadName, alerts]) => (
                           <div key={workloadName} className="bg-bg-card rounded-[2.5rem] border border-border-main overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500 mb-6 last:mb-0">
                              <div
                                 className="px-8 py-5 border-b border-border-main bg-bg-hover/50 flex justify-between items-center cursor-pointer hover:bg-bg-hover/70 transition-colors"
                                 onClick={() => toggleGroup(workloadName)}
                              >
                                 <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary-500/10 rounded-xl">
                                       {expandedGroups.has(workloadName) ? <ChevronUp className="w-4 h-4 text-primary-500" /> : <ChevronDown className="w-4 h-4 text-primary-500" />}
                                    </div>
                                    <div>
                                       <h4 className="text-sm font-black text-text-primary uppercase tracking-tighter">{workloadName}</h4>
                                       <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">{alerts.length} Alert{alerts.length > 1 ? 's' : ''}</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    {!expandedGroups.has(workloadName) && (
                                       <div className="flex -space-x-2 mr-4">
                                          {alerts.slice(0, 3).map((a, i) => (
                                             <div key={i} className={`w-6 h-6 rounded-full border-2 border-bg-card flex items-center justify-center text-[8px] font-black text-bg-card ${a.severity === 'Critical' ? 'bg-red-500' : 'bg-amber-500'}`}>
                                                !
                                             </div>
                                          ))}
                                          {alerts.length > 3 && (
                                             <div className="w-6 h-6 rounded-full border-2 border-bg-card bg-bg-hover flex items-center justify-center text-[8px] font-black text-text-tertiary">
                                                +{alerts.length - 3}
                                             </div>
                                          )}
                                       </div>
                                    )}
                                    <button
                                       onClick={(e) => { e.stopPropagation(); handleAlertClick(alerts[0]); }}
                                       className="px-4 py-2 rounded-xl bg-bg-card border border-border-main text-[10px] font-black uppercase tracking-widest hover:border-primary-500 transition-colors group/btn"
                                    >
                                       Triage Workload
                                       <ArrowRight className="w-3 h-3 inline-block ml-2 group-hover/btn:translate-x-1 transition-transform" />
                                    </button>
                                 </div>
                              </div>
                              {expandedGroups.has(workloadName) && (
                                 <div className="divide-y divide-border-main animate-in slide-in-from-top-2 duration-300">
                                    {alerts.map(alert => (
                                       <div
                                          key={alert.id}
                                          onClick={() => handleAlertClick(alert)}
                                          className="p-6 flex items-center gap-8 group hover:bg-bg-hover transition-all cursor-pointer"
                                       >
                                          <div className={`p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110 shadow-lg ${alert.severity === 'Critical' ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-amber-500 text-white shadow-amber-500/20'}`}>
                                             <BellRing className="w-6 h-6" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                             <div className="flex items-center gap-3 mb-2">
                                                <span className="text-sm font-black text-text-primary uppercase tracking-tighter group-hover:text-primary-500 transition-colors">{alert.ruleName}</span>
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${alert.severity === 'Critical' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                                   }`}>
                                                   {alert.severity}
                                                </span>
                                             </div>
                                             <div className="text-xs text-text-tertiary font-bold flex items-center gap-2">
                                                Metric reached <span className="font-mono text-primary-500">{alert.value}%</span> {alert.metric} utilization.
                                             </div>
                                          </div>
                                          <div className="text-right shrink-0">
                                             <div className="text-[10px] font-black text-text-primary uppercase tracking-widest mb-1.5">{formatTime(alert.timestamp)}</div>
                                             <div className="flex items-center justify-end gap-1.5 text-[9px] text-text-tertiary font-bold uppercase">
                                                <span className="w-1.5 h-1.5 rounded-full bg-primary-500/50" />
                                                {alert.channelsNotified.length} Channels Notified
                                             </div>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              )}
                           </div>
                        ))
                     ) : (
                        <div className="p-20 text-center flex flex-col items-center">
                           <CheckCircle2 className="w-12 h-12 text-text-tertiary mb-4" />
                           <p className="text-sm font-bold text-text-tertiary uppercase tracking-widest">No alerts detected in current window</p>
                        </div>
                     )}
                  </div>
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {activeTab === 'channels' ? (
                     filteredChannels.map(channel => (
                        <div key={channel.id} className="bg-bg-card rounded-[2.5rem] p-6 border border-border-main shadow-sm group hover:border-primary-500/50 transition-all flex flex-col h-full">
                           <div className="flex justify-between items-start mb-8">
                              <div className={`p-4 rounded-2xl shadow-xl ${getTypeColor(channel.type)}`}>
                                 {getTypeIcon(channel.type)}
                              </div>
                              <div className="flex gap-2">
                                 <button onClick={() => openChannelModal(channel)} className="p-2.5 rounded-xl bg-bg-hover text-text-tertiary hover:text-primary-500 transition-colors border border-border-main">
                                    <Edit2 className="w-4 h-4" />
                                 </button>
                                 <button onClick={() => onDeleteChannel(channel.id)} className="p-2.5 rounded-xl bg-bg-hover text-text-tertiary hover:text-red-500 transition-colors border border-border-main">
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                           </div>
                           <h3 className="text-xl font-black text-text-primary tracking-tighter mb-1.5">{channel.name}</h3>
                           <p className="text-[10px] font-mono text-text-tertiary truncate mb-8 uppercase tracking-widest">{channel.target}</p>

                           <div className="mt-auto space-y-6">
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2.5">
                                    <div className={`w-2 h-2 rounded-full ${channel.status === 'Active' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-text-tertiary'}`} />
                                    <span className="text-[10px] font-black uppercase text-text-tertiary tracking-widest">{channel.status}</span>
                                 </div>
                                 <button
                                    onClick={() => handleTest(channel.id)}
                                    disabled={testingId === channel.id}
                                    className="flex items-center gap-2 text-[9px] font-black uppercase text-primary-500 tracking-[0.2em] hover:opacity-70 transition-opacity disabled:opacity-50"
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
                           <div key={rule.id} className={`bg-bg-card rounded-[2.5rem] p-6 border shadow-sm group hover:border-primary-500/50 transition-all flex flex-col h-full relative overflow-hidden ${isActive ? 'border-red-500 dark:border-red-900/50' : 'border-border-main'
                              }`}>
                              {/* Severity Background Glow */}
                              <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 blur-3xl opacity-10 rounded-full ${rule.severity === 'Critical' ? 'bg-red-500' : rule.severity === 'Warning' ? 'bg-amber-500' : 'bg-primary-500'}`} />

                              <div className="flex justify-between items-start mb-8 relative z-10">
                                 <div className={`p-3 rounded-2xl border ${isActive ? 'bg-red-500 text-white animate-pulse border-red-400' : 'bg-bg-hover border-border-main'}`}>
                                    {isActive ? <BellRing className="w-5 h-5" /> : getMetricIcon(rule.metric)}
                                 </div>
                                 <div className="flex gap-2">
                                    <button onClick={() => openRuleModal(rule)} className="p-2.5 rounded-xl bg-bg-hover text-text-tertiary hover:text-primary-500 transition-colors border border-border-main">
                                       <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onDeleteAlertRule(rule.id)} className="p-2.5 rounded-xl bg-bg-hover text-text-tertiary hover:text-red-500 transition-colors border border-border-main">
                                       <Trash2 className="w-4 h-4" />
                                    </button>
                                 </div>
                              </div>

                              <h3 className="text-xl font-black text-text-primary tracking-tighter mb-4">{rule.name}</h3>

                              <div className="space-y-6 mb-8 flex-1">
                                 <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase text-text-tertiary tracking-widest">Saturation Threshold</span>
                                    <span className={`text-lg font-mono font-black ${isActive ? 'text-red-500' : 'text-text-primary'}`}>{rule.threshold}%</span>
                                 </div>
                                 <div className="w-full h-2.5 bg-bg-hover rounded-full overflow-hidden shadow-inner">
                                    <div
                                       className={`h-full rounded-full transition-all duration-1000 ${isActive ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : rule.severity === 'Critical' ? 'bg-red-500/50' : rule.severity === 'Warning' ? 'bg-amber-500' : 'bg-primary-500'}`}
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
                                          <div key={chId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-hover border border-border-main">
                                             <div className={`p-1 rounded-md ${getTypeColor(chan.type)}`}>
                                                {getTypeIcon(chan.type)}
                                             </div>
                                             <span className="text-[8px] font-black uppercase text-text-tertiary tracking-widest">{chan.name}</span>
                                          </div>
                                       );
                                    })}
                                 </div>

                                 <div className="pt-6 border-t border-border-main flex items-center justify-between">
                                    <span className={`text-[9px] font-black uppercase tracking-[0.25em] px-3 py-1 rounded-full ${rule.severity === 'Critical' ? 'bg-red-500/10 text-red-500' :
                                       rule.severity === 'Warning' ? 'bg-amber-500/10 text-amber-500' :
                                          'bg-primary-500/10 text-primary-500'
                                       }`}>
                                       {rule.severity} Impact
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                       <input type="checkbox" checked={rule.enabled} onChange={() => onUpdateAlertRule({ ...rule, enabled: !rule.enabled })} className="sr-only peer" />
                                       <div className="w-11 h-6 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-bg-card after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-bg-card after:border-border-main after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
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
               <div className="bg-bg-card border border-border-main rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                  <div className="p-8 border-b border-border-main flex justify-between items-center bg-bg-hover/50">
                     <h3 className="text-xl font-black tracking-tighter text-text-primary flex items-center gap-3">
                        <Plus className="w-6 h-6 text-primary-500" />
                        {editingChannelId ? 'Edit Integration' : 'New Broadcast Sink'}
                     </h3>
                     <button onClick={() => setIsChannelModalOpen(false)} className="p-2.5 rounded-2xl bg-bg-card border border-border-main text-text-tertiary hover:text-red-500 transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                  </div>
                  <form onSubmit={handleChannelSubmit} className="p-10 space-y-8">
                     <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase text-text-tertiary tracking-[0.2em]">Display Name</label>
                        <input
                           type="text"
                           value={channelName}
                           onChange={(e) => setChannelName(e.target.value)}
                           placeholder="e.g. Platform SRE Slack"
                           className="kt-input"
                           required
                        />
                     </div>
                     <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase text-text-tertiary tracking-[0.2em]">Target Type</label>
                        <div className="grid grid-cols-3 gap-3">
                           {(['Slack', 'PagerDuty', 'Webhook', 'Email'] as NotificationType[]).map(type => (
                              <button
                                 key={type}
                                 type="button"
                                 onClick={() => setChannelType(type)}
                                 className={`p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${channelType === type ? 'bg-primary-600 border-primary-500 text-white shadow-xl shadow-primary-600/30' : 'bg-bg-card border-border-main text-text-tertiary'}`}
                              >
                                 {type}
                              </button>
                           ))}
                        </div>
                     </div>
                     <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase text-text-tertiary tracking-[0.2em]">Connection String</label>
                        <input
                           type="text"
                           value={channelTarget}
                           onChange={(e) => setChannelTarget(e.target.value)}
                           placeholder={channelType === 'Email' ? 'admin@example.com' : 'https://hooks.slack.com/...'}
                           className="kt-input font-mono"
                           required
                        />
                     </div>
                     <div className="pt-6 flex gap-4">
                        <button type="button" onClick={() => setIsChannelModalOpen(false)} className="kt-button kt-button-ghost kt-button-sm">Cancel</button>
                        <button type="submit" className="kt-button kt-button-primary flex-[2]">Establish Sink</button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {/* Rule Modal */}
         {isRuleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
               <div className="bg-bg-card border border-border-main rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                  <div className="p-8 border-b border-border-main flex justify-between items-center bg-bg-hover/50">
                     <h3 className="text-xl font-black tracking-tighter text-text-primary flex items-center gap-3">
                        <Settings2 className="w-6 h-6 text-primary-500" />
                        {editingRuleId ? 'Edit Logic' : 'New Alert Strategy'}
                     </h3>
                     <button onClick={() => setIsRuleModalOpen(false)} className="p-2.5 rounded-2xl bg-bg-card border border-border-main text-text-tertiary hover:text-red-500 transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                  </div>
                  <form onSubmit={handleRuleSubmit} className="p-10 space-y-8">
                     <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase text-text-tertiary tracking-[0.2em]">Strategy Title</label>
                        <input
                           type="text"
                           value={ruleName}
                           onChange={(e) => setRuleName(e.target.value)}
                           placeholder="e.g. Critical CPU Pressure"
                           className="kt-input"
                           required
                        />
                     </div>

                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                           <label className="text-[10px] font-black uppercase text-text-tertiary tracking-[0.2em]">Metric</label>
                           <select
                              value={ruleMetric}
                              onChange={(e) => setRuleMetric(e.target.value as any)}
                              className="kt-input appearance-none"
                           >
                              <option value="CPU">Compute (CPU)</option>
                              <option value="Memory">Memory (RAM)</option>
                           </select>
                        </div>
                        <div className="space-y-2.5">
                           <label className="text-[10px] font-black uppercase text-text-tertiary tracking-[0.2em]">Severity</label>
                           <select
                              value={ruleSeverity}
                              onChange={(e) => setRuleSeverity(e.target.value as any)}
                              className="kt-input appearance-none"
                           >
                              <option value="Info">Information</option>
                              <option value="Warning">Warning</option>
                              <option value="Critical">Critical</option>
                           </select>
                        </div>
                     </div>

                     <div className="space-y-6">
                        <div className="flex justify-between items-end">
                           <label className="text-[10px] font-black uppercase text-text-tertiary tracking-[0.2em]">Activation Threshold</label>
                           <span className="text-2xl font-mono font-black text-primary-500">{ruleThreshold}%</span>
                        </div>
                        <input
                           type="range"
                           min="1" max="100"
                           value={ruleThreshold}
                           onChange={(e) => setRuleThreshold(parseInt(e.target.value))}
                           className="w-full h-2 bg-bg-hover rounded-full appearance-none cursor-pointer accent-primary-600"
                        />
                     </div>

                     <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase text-text-tertiary tracking-[0.2em]">Route To Channels</label>
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
                                 className={`kt-button kt-button-sm ${ruleChannels.includes(chan.id) ? 'kt-button-primary' : 'kt-button-ghost border border-border-main'}`}
                              >
                                 {chan.name}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="pt-6 flex gap-4">
                        <button type="button" onClick={() => setIsRuleModalOpen(false)} className="kt-button kt-button-ghost kt-button-sm">Cancel</button>
                        <button type="submit" className="kt-button kt-button-primary flex-[2]">Commit Strategy</button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
};
