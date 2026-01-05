
import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { TriageView } from './components/TriageView';
import { RightSizingView } from './components/RightSizingView';
import { TopologyView } from './components/TopologyView';
import { OrganizationView } from './components/OrganizationView';
import { UserView } from './components/UserView';
import { NotificationsView } from './components/NotificationsView';
import { TemplateLibraryView } from './components/TemplateLibraryView';
import { LoginView } from './components/LoginView';
import { AIChatWidget } from './components/AIChatWidget';
import { MOCK_WORKLOADS, MOCK_CLUSTERS, MOCK_ORGANIZATIONS, MOCK_USERS, MOCK_NOTIFICATION_CHANNELS, MOCK_ALERT_RULES } from './constants';
import { ViewState, Cluster, Organization, User, NotificationChannel, AlertRule, TriggeredAlert, Workload, DiagnosticPlaybook } from './types';
import { Key, Loader2, ExternalLink, BellRing, X } from 'lucide-react';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  
  // Navigation & Action State
  const [targetTemplate, setTargetTemplate] = useState<string | undefined>(undefined);
  const [initialWorkloadId, setInitialWorkloadId] = useState<string | undefined>(undefined);
  
  // API Key State
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  // Core Data State
  const [workloads, setWorkloads] = useState<Workload[]>(MOCK_WORKLOADS);
  const [clusters, setClusters] = useState<Cluster[]>(MOCK_CLUSTERS);
  const [selectedCluster, setSelectedCluster] = useState<Cluster>(MOCK_CLUSTERS[0]);
  const [organizations, setOrganizations] = useState<Organization[]>(MOCK_ORGANIZATIONS);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);

  // Notifications & Alerting State
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>(MOCK_NOTIFICATION_CHANNELS);
  const [alertRules, setAlertRules] = useState<AlertRule[]>(MOCK_ALERT_RULES);
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([]);
  const [activeNotification, setActiveNotification] = useState<TriggeredAlert | null>(null);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<string | null>(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Monitoring Simulation Logic
  const checkAlertRules = useCallback((currentWorkloads: Workload[]) => {
    const newAlerts: TriggeredAlert[] = [];
    
    alertRules.forEach(rule => {
      if (!rule.enabled) return;

      currentWorkloads.forEach(workload => {
        let value = 0;
        let saturatedValue = 0; // percentage

        if (rule.metric === 'CPU') {
          value = workload.metrics.cpuUsage;
          saturatedValue = (value / workload.metrics.cpuLimit) * 100;
        } else if (rule.metric === 'Memory') {
          value = workload.metrics.memoryUsage;
          saturatedValue = (value / workload.metrics.memoryLimit) * 100;
        }

        const isBreached = rule.operator === '>' 
          ? saturatedValue > rule.threshold 
          : saturatedValue < rule.threshold;

        if (isBreached) {
          const lastAlert = triggeredAlerts.find(a => a.ruleId === rule.id && a.workloadName === workload.name);
          const isSpam = lastAlert && (Date.now() - lastAlert.timestamp < 30000); // 30s cooldown

          if (!isSpam) {
            const alert: TriggeredAlert = {
              id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              ruleId: rule.id,
              ruleName: rule.name,
              workloadName: workload.name,
              metric: rule.metric,
              value: parseFloat(saturatedValue.toFixed(1)),
              threshold: rule.threshold,
              timestamp: Date.now(),
              severity: rule.severity,
              channelsNotified: rule.channels
            };
            newAlerts.push(alert);
          }
        }
      });
    });

    if (newAlerts.length > 0) {
      setTriggeredAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
      setActiveNotification(newAlerts[0]);
      setTimeout(() => setActiveNotification(null), 8000);
    }
  }, [alertRules, triggeredAlerts]);

  // Simulate real-time metric updates
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(() => {
      setWorkloads(prev => {
        const updated = prev.map(w => {
          const cpuVar = (Math.random() * 0.2) - 0.1; 
          const memVar = (Math.random() * 0.05) - 0.025; 
          
          return {
            ...w,
            metrics: {
              ...w.metrics,
              cpuUsage: Math.min(w.metrics.cpuLimit, Math.max(0, w.metrics.cpuUsage + cpuVar)),
              memoryUsage: Math.min(w.metrics.memoryLimit, Math.max(0, w.metrics.memoryUsage + (w.metrics.memoryLimit * memVar)))
            }
          };
        });
        checkAlertRules(updated);
        return updated;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isAuthenticated, checkAlertRules]);

  useEffect(() => {
    const checkKey = async () => {
      setIsCheckingKey(true);
      try {
        if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } else {
          setHasApiKey(true);
        }
      } catch (e) {
        console.error("Error checking API key status", e);
        setHasApiKey(false);
      } finally {
        setIsCheckingKey(false);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
        try {
            await (window as any).aistudio.openSelectKey();
            setHasApiKey(true); 
        } catch (e) {
            console.error("Failed to select key", e);
        }
    }
  };

  const handleOpenChat = (context?: string) => {
    if (context) setChatContext(context);
    setIsChatOpen(true);
  };

  const handleApplyTemplate = (view: ViewState, template: string) => {
    setTargetTemplate(template);
    setCurrentView(view);
  };

  const handleNavigateToTriage = (workloadId: string, playbook: DiagnosticPlaybook) => {
    setInitialWorkloadId(workloadId);
    setTargetTemplate(playbook);
    setCurrentView('triage');
  };

  const handleAddCluster = (newCluster: Cluster) => {
    setClusters(prev => [...prev, newCluster]);
    setSelectedCluster(newCluster);
  };

  const handleAddChannel = (channel: NotificationChannel) => setNotificationChannels(prev => [...prev, channel]);
  const handleUpdateChannel = (updatedChannel: NotificationChannel) => setNotificationChannels(prev => prev.map(c => c.id === updatedChannel.id ? updatedChannel : c));
  const handleDeleteChannel = (id: string) => setNotificationChannels(prev => prev.filter(c => c.id !== id));

  const handleAddAlertRule = (rule: AlertRule) => setAlertRules(prev => [...prev, rule]);
  const handleUpdateAlertRule = (updatedRule: AlertRule) => setAlertRules(prev => prev.map(r => r.id === updatedRule.id ? updatedRule : r));
  const handleDeleteAlertRule = (id: string) => setAlertRules(prev => prev.filter(r => r.id !== id));

  if (isCheckingKey) {
     return (
        <div className={`min-h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-[#09090b] ${isDarkMode ? 'dark' : ''}`}>
           <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
     );
  }

  if (!hasApiKey) {
     return (
        <div className={`${isDarkMode ? 'dark' : ''} font-sans`}>
            <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-[#09090b] p-4">
                <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-8 text-center animate-fadeIn">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500">
                        <Key className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">API Key Required</h1>
                    <button onClick={handleSelectKey} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 mb-4">
                        <Key className="w-4 h-4" /> Select API Key
                    </button>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1">
                        About Gemini API Billing <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </div>
        </div>
     );
  }

  if (!isAuthenticated) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <LoginView onLogin={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <Layout 
        currentView={currentView} 
        onChangeView={(view) => { setCurrentView(view); setTargetTemplate(undefined); setInitialWorkloadId(undefined); }}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        currentCluster={selectedCluster}
        allClusters={clusters}
        onClusterChange={setSelectedCluster}
        onAddCluster={handleAddCluster}
        onLogout={() => setIsAuthenticated(false)}
        onChangeApiKey={handleSelectKey}
      >
        {currentView === 'dashboard' && (
          <Dashboard 
            workloads={workloads} 
            isDarkMode={isDarkMode} 
            onTriageRequest={handleNavigateToTriage}
          />
        )}
        {currentView === 'templates' && <TemplateLibraryView onApplyTemplate={handleApplyTemplate} isDarkMode={isDarkMode} />}
        {currentView === 'triage' && (
          <TriageView 
            workloads={workloads} 
            isDarkMode={isDarkMode} 
            onOpenChat={handleOpenChat} 
            defaultTemplate={targetTemplate}
            initialWorkloadId={initialWorkloadId}
          />
        )}
        {currentView === 'rightsizing' && (
          <RightSizingView 
            workloads={workloads} 
            isDarkMode={isDarkMode} 
            onOpenChat={handleOpenChat} 
            defaultTemplate={targetTemplate} 
            onTriageRequest={handleNavigateToTriage}
            initialWorkloadId={initialWorkloadId}
          />
        )}
        {currentView === 'topology' && <TopologyView workloads={workloads} isDarkMode={isDarkMode} />}
        {currentView === 'organizations' && <OrganizationView organizations={organizations} onAddOrganization={(org) => setOrganizations(prev => [...prev, org])} isDarkMode={isDarkMode} />}
        {currentView === 'users' && <UserView users={users} onAddUser={(u) => setUsers(prev => [...prev, u])} onUpdateUser={(u) => setUsers(prev => prev.map(it => it.id === u.id ? u : it))} onDeleteUser={(id) => setUsers(prev => prev.filter(u => u.id !== id))} isDarkMode={isDarkMode} />}
        {currentView === 'notifications' && (
          <NotificationsView 
            channels={notificationChannels} 
            onAddChannel={handleAddChannel} 
            onUpdateChannel={handleUpdateChannel} 
            onDeleteChannel={handleDeleteChannel} 
            alertRules={alertRules}
            onAddAlertRule={handleAddAlertRule}
            onUpdateAlertRule={handleUpdateAlertRule}
            onDeleteAlertRule={handleDeleteAlertRule}
            triggeredAlerts={triggeredAlerts}
            isDarkMode={isDarkMode} 
          />
        )}
      </Layout>

      {/* Alert Notification Toast */}
      {activeNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md p-4 animate-in slide-in-from-bottom-10 fade-in duration-500">
           <div className={`p-5 rounded-[2rem] border-2 shadow-2xl flex items-center gap-4 bg-white dark:bg-zinc-900 ${
             activeNotification.severity === 'Critical' ? 'border-red-500' : 'border-amber-500'
           }`}>
              <div className={`p-3 rounded-2xl shrink-0 ${activeNotification.severity === 'Critical' ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-white'}`}>
                 <BellRing className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                 <h4 className="font-black text-sm uppercase tracking-tighter text-zinc-900 dark:text-white leading-none mb-1">Threshold Breached</h4>
                 <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold truncate">
                    {activeNotification.workloadName}: {activeNotification.metric} at {activeNotification.value}% (Limit {activeNotification.threshold}%)
                 </p>
              </div>
              <button onClick={() => setActiveNotification(null)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400">
                 <X className="w-5 h-5" />
              </button>
           </div>
        </div>
      )}

      <AIChatWidget isOpen={isChatOpen} onClose={() => { setIsChatOpen(false); setChatContext(null); }} initialContext={chatContext} />
    </div>
  );
};

export default App;
