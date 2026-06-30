import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMonitoring } from '../contexts/MonitoringContext';
import { NotificationChannel, NotificationType, AlertRule, TriggeredAlert } from '../types';
import { Bell, Plus, Search, Slack, Mail, Webhook, Trash2, Edit2, X, Activity, Loader2, Play, Pause, Settings2, ShieldAlert, Cpu, MemoryStick, Zap, DollarSign, Filter, CheckCircle2, AlertCircle, MessageSquare, History, Clock, ArrowRight, BellRing, ChevronDown, ChevronUp } from 'lucide-react';
import { useEscapeKey } from '../utils/useEscapeKey';
import { StatusBadge } from './dashboard/StatusBadge';

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
      if (newExpanded.has(groupName)) newExpanded.delete(groupName);
      else newExpanded.add(groupName);
      setExpandedGroups(newExpanded);
   };

   const [isPaused, setIsPaused] = useState(false);
   const [frozenAlerts, setFrozenAlerts] = useState<TriggeredAlert[]>([]);
   const togglePause = () => {
      if (!isPaused) setFrozenAlerts(triggeredAlerts);
      else setFrozenAlerts([]);
      setIsPaused(!isPaused);
   };

   const [testingId, setTestingId] = useState<string | null>(null);
   const [testResult, setTestResult] = useState<{ id: string, success: boolean } | null>(null);

   const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
   const [channelName, setChannelName] = useState('');
   const [channelType, setChannelType] = useState<NotificationType>('Slack');
   const [channelTarget, setChannelTarget] = useState('');

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
         if (ruleToEdit) openRuleModal(ruleToEdit);
      }
      if (location.state?.activeTab) setActiveTab(location.state.activeTab);
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
         if (existing) onUpdateChannel({ ...existing, name: channelName, type: channelType, target: channelTarget });
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
         if (existing) onUpdateAlertRule({ ...existing, name: ruleName, metric: ruleMetric, threshold: ruleThreshold, severity: ruleSeverity, channels: ruleChannels });
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
         case 'Memory': return <MemoryStick className="w-5 h-5 text-success" />;
         case 'Cost': return <DollarSign className="w-5 h-5 text-warning" />;
         default: return <Zap className="w-5 h-5 text-info" />;
      }
   };

   const getTypeIcon = (type: NotificationType) => {
      switch (type) {
         case 'Slack': return <Slack className="w-4 h-4 text-white" />;
         case 'PagerDuty': return <Activity className="w-4 h-4 text-white" />;
         case 'Email': return <Mail className="w-4 h-4 text-white" />;
         default: return <Webhook className="w-4 h-4 text-white" />;
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

   const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

   return (
      <div className="space-y-5 font-sans animate-fade-in">
         <div className="kt-panel p-5 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative z-10">
               <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary-500/10 border border-primary-500/30">
                     <Bell className="w-6 h-6 text-primary-500" />
                  </div>
                  <h2 className="text-2xl font-display font-bold text-text-primary">Broadcast & Logic</h2>
               </div>
               <p className="text-sm text-text-secondary max-w-sm opacity-80 font-sans">Define alert thresholds and connect external notification sinks.</p>
            </div>

            <div className="flex flex-wrap bg-bg-main border border-border-main p-0.5">
               {(['rules', 'channels', 'history'] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 font-sans font-semibold text-xs border transition-all ${activeTab === tab ? 'bg-primary-500/10 text-primary-500 border-primary-500/30' : 'text-text-secondary hover:text-text-primary border-transparent'}`}>
                     {tab === 'rules' ? 'Alert Logic' : tab === 'channels' ? 'Global Sinks' : 'History'}
                  </button>
               ))}
            </div>
         </div>

         <div className="kt-panel p-5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-5 relative z-10">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary-600 text-white kt-amber-glow">
                     <Settings2 className="w-6 h-6" />
                  </div>
                  <div>
                     <h3 className="text-text-primary font-display font-bold text-xl">Alert Frequency Control</h3>
                     <p className="text-xs text-text-secondary font-sans font-semibold mt-1.5 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Global Toast Policy
                     </p>
                  </div>
               </div>

               <div className="flex flex-col sm:flex-row items-center gap-4 bg-bg-main border border-border-main p-2">
                  <div className="flex items-center gap-3 px-4 py-2">
                     <span className="text-[10px] font-sans font-semibold text-text-secondary">Popups</span>
                     <label className="relative inline-flex items-center cursor-pointer group">
                        <input type="checkbox" checked={notificationSettings.toastEnabled} onChange={(e) => updateNotificationSettings({ ...notificationSettings, toastEnabled: e.target.checked })} className="sr-only peer" />
                        <div className="w-12 h-6 bg-bg-hover peer-focus:outline-none rounded-sm peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-main after:border after:rounded-sm after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500 shadow-inner" />
                     </label>
                  </div>

                  <div className="h-6 w-px bg-border-main hidden sm:block" />

                  <div className="flex items-center gap-4 px-4 py-2 min-w-0 w-full sm:min-w-[220px]">
                     <div className="flex-1 space-y-3">
                        <div className="flex justify-between items-end">
                           <span className="text-[10px] font-sans font-semibold text-text-secondary">Cooldown</span>
                           <span className="text-sm font-mono font-bold text-primary-500 bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 rounded-sm">{notificationSettings.toastFrequency}s</span>
                        </div>
                        <input type="range" min="1" max="60" disabled={!notificationSettings.toastEnabled} value={notificationSettings.toastFrequency} onChange={(e) => updateNotificationSettings({ ...notificationSettings, toastFrequency: parseInt(e.target.value) })} className="w-full h-1.5 bg-bg-hover border border-border-main rounded-sm appearance-none cursor-pointer accent-primary-500 disabled:opacity-50" />
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 gap-5">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center kt-panel p-4">
               <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <input type="text" placeholder={`Filter ${activeTab}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="kt-input pl-10 pr-4 py-2.5" />
               </div>
               {activeTab !== 'history' && (
                  <button onClick={() => activeTab === 'channels' ? openChannelModal() : openRuleModal()} className="kt-button kt-button-primary kt-button-sm">
                     <Plus className="w-4 h-4" />
                     {activeTab === 'channels' ? 'New Integration' : 'New Rule'}
                  </button>
               )}
            </div>

            {activeTab === 'history' ? (
               <div className="kt-panel overflow-hidden">
                  <div className="kt-panel-header">
                     <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-text-secondary" /> Threshold Breach Timeline
                     </div>
                     <button onClick={togglePause} className={`px-3 py-1 text-[10px] font-sans font-semibold border transition-all flex items-center gap-2 ${isPaused ? 'bg-warning text-black border-warning kt-amber-glow' : 'bg-bg-card text-text-tertiary hover:text-primary-500 border-border-main'}`}>
                        {isPaused ? <><Clock className="w-3 h-3" /> Live Updates Paused</> : <><Activity className="w-3 h-3" /> Real-time</>}
                     </button>
                  </div>
                  <div className="divide-y divide-border-main relative z-10">
                     {filteredHistory.length > 0 ? (
                        Object.entries(
                           filteredHistory.reduce((acc, alert) => {
                              if (!acc[alert.workloadName]) acc[alert.workloadName] = [];
                              acc[alert.workloadName].push(alert);
                              return acc;
                           }, {} as Record<string, typeof filteredHistory>)
                        ).map(([workloadName, alerts]) => (
                           <div key={workloadName} className="kt-panel m-4 overflow-hidden">
                              <div onClick={() => toggleGroup(workloadName)} className="px-4 py-4 border-b border-border-main bg-bg-hover/50 flex flex-wrap justify-between items-center gap-3 cursor-pointer hover:bg-bg-hover/70 transition-colors">
                                 <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 bg-primary-500/10 border border-primary-500/30 shrink-0">
                                       {expandedGroups.has(workloadName) ? <ChevronUp className="w-4 h-4 text-primary-500" /> : <ChevronDown className="w-4 h-4 text-primary-500" />}
                                    </div>
                                    <div className="min-w-0">
                                       <h4 className="text-sm font-sans font-semibold text-text-primary truncate">{workloadName}</h4>
                                       <p className="text-[10px] text-text-tertiary font-sans">{alerts.length} Alert{alerts.length > 1 ? 's' : ''}</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-2 shrink-0">
                                    {!expandedGroups.has(workloadName) && (
                                       <div className="flex -space-x-2 mr-4">
                                          {alerts.slice(0, 3).map((a, i) => (
                                             <div key={i} className={`w-6 h-6 border-2 border-bg-card flex items-center justify-center text-[8px] font-bold text-bg-card ${a.severity === 'Critical' ? 'bg-danger' : 'bg-warning'} font-sans`}>
                                                !
                                             </div>
                                          ))}
                                          {alerts.length > 3 && (
                                             <div className="w-6 h-6 border-2 border-bg-card bg-bg-hover flex items-center justify-center text-[8px] font-bold text-text-tertiary font-sans">
                                                +{alerts.length - 3}
                                             </div>
                                          )}
                                       </div>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); handleAlertClick(alerts[0]); }} className="px-3 py-1.5 bg-bg-card border border-border-main text-[10px] font-sans font-semibold hover:border-primary-500 transition-colors group/btn">
                                       Triage Workload
                                       <ArrowRight className="w-3 h-3 inline-block ml-2 group-hover/btn:translate-x-1 transition-transform" />
                                    </button>
                                 </div>
                              </div>
                              {expandedGroups.has(workloadName) && (
                                 <div className="divide-y divide-border-main animate-fade-in">
                                    {alerts.map(alert => (
                                       <div key={alert.id} onClick={() => handleAlertClick(alert)} className="p-4 sm:p-5 flex items-center gap-4 sm:gap-6 group hover:bg-bg-hover transition-all cursor-pointer">
                                          <div className={`p-3 sm:p-3 shrink-0 transition-transform group-hover:scale-110 ${alert.severity === 'Critical' ? 'bg-danger text-white kt-danger-glow' : 'bg-warning text-white kt-amber-glow'}`}>
                                             <BellRing className="w-5 h-5 sm:w-5 sm:h-5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                             <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <span className="text-sm font-sans font-semibold text-text-primary truncate group-hover:text-primary-500 transition-colors">{alert.ruleName}</span>
                                                <StatusBadge status={alert.severity} />
                                             </div>
                                             <div className="text-xs text-text-tertiary flex flex-wrap items-center gap-x-2 font-sans">
                                                Metric reached <span className="font-mono font-bold text-primary-500">{alert.value}%</span> {alert.metric} utilization.
                                             </div>
                                          </div>
                                          <div className="text-right shrink-0 hidden sm:block">
                                             <div className="text-[10px] font-sans font-semibold text-text-primary mb-1.5">{formatTime(alert.timestamp)}</div>
                                             <div className="flex items-center justify-end gap-1.5 text-[9px] text-text-tertiary font-sans">
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
                           <p className="text-sm text-text-tertiary font-sans font-medium">No alerts detected in current window</p>
                        </div>
                     )}
                  </div>
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeTab === 'channels' ? (
                     filteredChannels.map(channel => (
                        <div key={channel.id} className="kt-panel p-5 group hover:border-primary-500/30 transition-all flex flex-col h-full">
                           <div className="flex justify-between items-start mb-6 relative z-10">
                              <div className={`p-3 ${getTypeColor(channel.type)}`}>{getTypeIcon(channel.type)}</div>
                              <div className="flex gap-2">
                                 <button onClick={() => openChannelModal(channel)} className="p-2 border border-border-main hover:border-primary-500/30 hover:text-primary-500 text-text-tertiary transition-colors" title="Edit channel"><Edit2 className="w-4 h-4" /></button>
                                 <button onClick={() => onDeleteChannel(channel.id)} className="p-2 border border-border-main hover:border-danger/30 hover:text-danger text-text-tertiary transition-colors" title="Delete channel"><Trash2 className="w-4 h-4" /></button>
                              </div>
                           </div>
                           <h3 className="text-xl font-display font-bold text-text-primary truncate mb-1.5">{channel.name}</h3>
                           <p className="text-[10px] font-mono text-text-tertiary truncate mb-8">{channel.target}</p>

                           <div className="mt-auto space-y-4 relative z-10">
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2.5">
                                    <span className={`w-2 h-2 rounded-full ${channel.status === 'Active' ? 'bg-success kt-success-glow animate-pulse' : 'bg-text-tertiary'}`} />
                                    <span className="text-[10px] font-sans font-semibold text-text-tertiary">{channel.status}</span>
                                 </div>
                                 <button onClick={() => handleTest(channel.id)} disabled={testingId === channel.id} className="flex items-center gap-2 font-sans font-semibold text-[9px] text-primary-500 hover:text-primary-400 transition-colors disabled:opacity-50">
                                    {testingId === channel.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (testResult?.id === channel.id ? <CheckCircle2 className="w-3 h-3 text-success" /> : <Play className="w-3 h-3" />)}
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
                           <div key={rule.id} className={`kt-panel p-5 group hover:border-primary-500/30 transition-all flex flex-col h-full relative overflow-hidden ${isActive ? 'border-danger/50 kt-danger-glow' : ''}`}>
                              <div className="flex justify-between items-start mb-6 relative z-10">
                                 <div className={`p-3 border ${isActive ? 'bg-danger text-white animate-pulse border-danger' : 'bg-bg-hover border-border-main'}`}>
                                    {isActive ? <BellRing className="w-5 h-5" /> : getMetricIcon(rule.metric)}
                                 </div>
                                 <div className="flex gap-2">
                                    <button onClick={() => openRuleModal(rule)} className="p-2 border border-border-main hover:border-primary-500/30 hover:text-primary-500 text-text-tertiary transition-colors" title="Edit rule"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => onDeleteAlertRule(rule.id)} className="p-2 border border-border-main hover:border-danger/30 hover:text-danger text-text-tertiary transition-colors" title="Delete rule"><Trash2 className="w-4 h-4" /></button>
                                 </div>
                              </div>

                              <h3 className="text-xl font-display font-bold text-text-primary truncate mb-4">{rule.name}</h3>

                              <div className="space-y-4 mb-6 flex-1 relative z-10">
                                 <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] text-text-tertiary font-sans font-medium uppercase">Saturation Threshold</span>
                                    <span className={`text-lg font-mono font-bold ${isActive ? 'text-danger' : 'text-text-primary'}`}>{rule.threshold}%</span>
                                 </div>
                                 <div className="w-full h-2 bg-bg-hover border border-border-main rounded-sm overflow-hidden">
                                    <div className={`h-full rounded-sm transition-all duration-1000 ${isActive ? 'bg-danger kt-danger-glow' : rule.severity === 'Critical' ? 'bg-danger/50' : rule.severity === 'Warning' ? 'bg-warning' : 'bg-primary-500'}`} style={{ width: `${rule.threshold}%` }} />
                                 </div>
                              </div>

                              <div className="space-y-4 mt-auto relative z-10">
                                 <div className="flex flex-wrap gap-2">
                                    {rule.channels.map(chId => {
                                       const chan = channels.find(c => c.id === chId);
                                       if (!chan) return null;
                                       return (
                                          <div key={chId} className="flex items-center gap-1.5 px-2 py-1 bg-bg-main border border-border-main">
                                             <div className={`p-0.5 ${getTypeColor(chan.type)}`}>{getTypeIcon(chan.type)}</div>
                                             <span className="text-[8px] font-sans font-semibold text-text-tertiary">{chan.name}</span>
                                          </div>
                                       );
                                    })}
                                 </div>

                                 <div className="pt-4 border-t border-border-main flex items-center justify-between">
                                    <StatusBadge status={rule.severity} />
                                    <label className="relative inline-flex items-center cursor-pointer">
                                       <input type="checkbox" checked={rule.enabled} onChange={() => onUpdateAlertRule({ ...rule, enabled: !rule.enabled })} className="sr-only peer" />
                                       <div className="w-11 h-6 bg-bg-hover peer-focus:outline-none rounded-sm peer peer-checked:after:translate-x-full peer-checked:after:border-bg-card after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-bg-card after:border-border-main after:border after:rounded-sm after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
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

         {isChannelModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
               <div className="kt-panel w-full max-w-lg max-h-[90vh] overflow-hidden animate-slide-up">
                  <div className="kt-panel-header">
                     <div className="flex items-center gap-2">
                        <Plus className="w-5 h-5 text-primary-500" />
                        {editingChannelId ? 'Edit Integration' : 'New Broadcast Sink'}
                     </div>
                     <button onClick={() => setIsChannelModalOpen(false)} className="p-2 border border-border-main hover:border-danger/30 hover:text-danger text-text-tertiary transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={handleChannelSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar relative z-10">
                     <div className="space-y-2">
                        <label className="text-[10px] text-text-tertiary font-sans font-medium uppercase">Display Name</label>
                        <input type="text" value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="e.g. Platform SRE Slack" className="kt-input" required />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] text-text-tertiary font-sans font-medium uppercase">Target Type</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                           {(['Slack', 'PagerDuty', 'Webhook', 'Email'] as NotificationType[]).map(type => (
                              <button key={type} type="button" onClick={() => setChannelType(type)} className={`p-3 border text-[10px] font-sans font-semibold transition-all ${channelType === type ? 'bg-primary-600 border-primary-500 text-white kt-amber-glow' : 'bg-bg-card border-border-main text-text-tertiary hover:border-primary-500/30'}`}>
                                 {type}
                              </button>
                           ))}
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] text-text-tertiary font-sans font-medium uppercase">Connection String</label>
                        <input type="text" value={channelTarget} onChange={(e) => setChannelTarget(e.target.value)} placeholder={channelType === 'Email' ? 'admin@example.com' : 'https://hooks.slack.com/...'} className="kt-input font-sans" required />
                     </div>
                     <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setIsChannelModalOpen(false)} className="kt-button kt-button-ghost kt-button-sm">Cancel</button>
                        <button type="submit" className="kt-button kt-button-primary flex-[2]">Establish Sink</button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {isRuleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
               <div className="kt-panel w-full max-w-lg max-h-[90vh] overflow-hidden animate-slide-up">
                  <div className="kt-panel-header">
                     <div className="flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-primary-500" />
                        {editingRuleId ? 'Edit Logic' : 'New Alert Strategy'}
                     </div>
                     <button onClick={() => setIsRuleModalOpen(false)} className="p-2 border border-border-main hover:border-danger/30 hover:text-danger text-text-tertiary transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={handleRuleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar relative z-10">
                     <div className="space-y-2">
                        <label className="text-[10px] text-text-tertiary font-sans font-medium uppercase">Strategy Title</label>
                        <input type="text" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Critical CPU Pressure" className="kt-input" required />
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-text-tertiary font-sans font-medium uppercase">Metric</label>
                           <select value={ruleMetric} onChange={(e) => setRuleMetric(e.target.value as any)} className="kt-select">
                              <option value="CPU">Compute (CPU)</option>
                              <option value="Memory">Memory (RAM)</option>
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-text-tertiary font-sans font-medium uppercase">Severity</label>
                           <select value={ruleSeverity} onChange={(e) => setRuleSeverity(e.target.value as any)} className="kt-select">
                              <option value="Info">Information</option>
                              <option value="Warning">Warning</option>
                              <option value="Critical">Critical</option>
                           </select>
                        </div>
                     </div>

                     <div className="space-y-3">
                        <div className="flex justify-between items-end">
                           <label className="text-[10px] text-text-tertiary font-sans font-medium uppercase">Activation Threshold</label>
                           <span className="text-2xl font-mono font-bold text-primary-500">{ruleThreshold}%</span>
                        </div>
                        <input type="range" min="1" max="100" value={ruleThreshold} onChange={(e) => setRuleThreshold(parseInt(e.target.value))} className="w-full h-2 bg-bg-hover border border-border-main rounded-sm appearance-none cursor-pointer accent-primary-500" />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] text-text-tertiary font-sans font-medium uppercase">Route To Channels</label>
                        <div className="flex flex-wrap gap-2">
                           {channels.map(chan => (
                              <button key={chan.id} type="button" onClick={() => {
                                 if (ruleChannels.includes(chan.id)) setRuleChannels(ruleChannels.filter(id => id !== chan.id));
                                 else setRuleChannels([...ruleChannels, chan.id]);
                              }} className={`kt-button kt-button-sm ${ruleChannels.includes(chan.id) ? 'kt-button-primary' : 'kt-button-ghost border border-border-main'}`}>
                                 {chan.name}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="pt-4 flex gap-3">
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
