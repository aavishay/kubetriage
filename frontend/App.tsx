import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { MonitoringProvider, useMonitoring } from './contexts/MonitoringContext';
import { AuthProvider } from './contexts/AuthContext';
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
import { NotFound } from './components/NotFound';
import { SettingsView } from './components/SettingsView';
import { ReportsView } from './components/ReportsView';
import { BellRing, X, Loader2, Key, ExternalLink, Settings2 } from 'lucide-react';
import { DiagnosticPlaybook } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';

// Wrapper component to consume Context and enforce Auth
const AppContent: React.FC = () => {
  const {
    isAuthenticated,
    isAuthLoading,
    isWorkloadsLoading, // Added
    hasApiKey,
    isCheckingKey,
    isDarkMode,
    activeNotification,
    dismissNotification,
    selectApiKey,
    workloads,
    organizations,
    users,
    notificationChannels,
    alertRules,
    triggeredAlerts,
    addChannel,
    updateChannel,
    deleteChannel,
    addAlertRule,
    updateAlertRule,
    deleteAlertRule,
    login,
    refreshWorkloads,
    metricsWindow,
    setMetricsWindow
  } = useMonitoring();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleOpenChat = (context?: string) => {
    if (context) setChatContext(context);
    setIsChatOpen(true);
  };

  const handleApplyTemplate = (template: string) => {
    // Navigation logic for templates usually goes to Triage or RightSizing
    navigate('/triage', { state: { template } });
  };

  const handleNavigateToTriage = (workloadId: string, playbook: DiagnosticPlaybook) => {
    navigate('/triage', { state: { workloadId, playbook } });
  };

  if (isCheckingKey || isAuthLoading) {
    return (
      <div className={`min-h-screen w-full flex flex-col items-center justify-center bg-dark-bg text-white ${isDarkMode ? 'dark' : ''} bg-mesh`}>
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-primary-500 rounded-full blur-[100px] opacity-20 animate-pulse"></div>
          <div className="p-8 bg-dark-card rounded-full border border-white/5 relative z-10 shadow-2xl">
            <Loader2 className="w-16 h-16 text-primary-500 animate-spin" />
          </div>
        </div>
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-black uppercase tracking-[0.5em] font-display neon-text">Neural Boot Sequence</h1>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] animate-pulse">Synchronizing cluster telemetry...</p>
        </div>
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className={`${isDarkMode ? 'dark' : ''} font-sans`}>
        <div className="min-h-screen w-full flex items-center justify-center bg-dark-bg p-6 bg-mesh">
          <div className="w-full max-w-xl bg-dark-card border border-white/5 rounded-[4rem] shadow-2xl p-16 text-center animate-in zoom-in-95 backdrop-blur-3xl glass cyber-card overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent opacity-50"></div>
            <div className="w-24 h-24 bg-primary-500/10 rounded-4xl flex items-center justify-center mx-auto mb-10 text-primary-500 ring-1 ring-primary-500/30 shadow-[0_0_30px_rgba(14,165,233,0.2)]">
              <Key className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter font-display">Auth Protocol Required</h1>
            <p className="text-gray-400 mb-12 text-sm font-medium leading-relaxed max-w-xs mx-auto">Gemini-1.5-Pro cryptographic identity missing. Initialize neural vectoring to continue.</p>
            <div className="space-y-6">
              <button
                onClick={selectApiKey}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white font-black py-5 rounded-3xl transition-all shadow-2xl shadow-primary-500/20 flex items-center justify-center gap-4 text-xs uppercase tracking-[0.2em] border-b-4 border-primary-800 active:scale-95"
              >
                <Key className="w-5 h-5" /> Initialize API Key
              </button>
              <a
                href="https://ai.google.dev/gemini-api/docs/billing"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-[10px] font-black text-gray-500 hover:text-primary-400 uppercase tracking-widest transition-colors"
              >
                Gemini Ledger Status <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <LoginView onLogin={login} />
      </div>
    );
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard workloads={workloads} isLoading={isWorkloadsLoading} isDarkMode={isDarkMode} onTriageRequest={handleNavigateToTriage} onRefresh={refreshWorkloads} metricsWindow={metricsWindow} setMetricsWindow={setMetricsWindow} />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/templates" element={<TemplateLibraryView onApplyTemplate={(view, tmpl) => handleApplyTemplate(tmpl)} isDarkMode={isDarkMode} />} />
          <Route path="/triage" element={
            <TriageView
              workloads={workloads}
              isDarkMode={isDarkMode}
              onOpenChat={handleOpenChat}
            // State passing handled by useLocation in component usually, but for now we rely on internal state if not full rewrite of TriageView
            />
          } />
          <Route path="/rightsizing" element={
            <RightSizingView
              workloads={workloads}
              isDarkMode={isDarkMode}
              onOpenChat={handleOpenChat}
              onTriageRequest={handleNavigateToTriage}
              onRefresh={refreshWorkloads}
            />
          } />
          <Route path="/topology" element={<TopologyView workloads={workloads} isDarkMode={isDarkMode} />} />
          <Route path="/organizations" element={<OrganizationView organizations={organizations} onAddOrganization={() => { }} isDarkMode={isDarkMode} />} />
          <Route path="/users" element={<UserView users={users} onAddUser={() => { }} onUpdateUser={() => { }} onDeleteUser={() => { }} isDarkMode={isDarkMode} />} />
          <Route path="/reports" element={<ReportsView isDarkMode={isDarkMode} />} />
          <Route path="/notifications" element={
            <NotificationsView
              channels={notificationChannels}
              onAddChannel={addChannel}
              onUpdateChannel={updateChannel}
              onDeleteChannel={deleteChannel}
              alertRules={alertRules}
              onAddAlertRule={addAlertRule}
              onUpdateAlertRule={updateAlertRule}
              onDeleteAlertRule={deleteAlertRule}
              triggeredAlerts={triggeredAlerts}
              isDarkMode={isDarkMode}
            />
          } />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>

      {/* Alert Notification Toast */}
      {activeNotification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg p-4 animate-in slide-in-from-bottom-12 fade-in duration-700">
          <div
            onClick={() => navigate('/triage')}
            className={`cursor-pointer hover:bg-zinc-50 dark:hover:bg-dark-lighter/50 transition-all p-6 rounded-4xl border-2 shadow-2xl flex items-center gap-6 bg-white dark:bg-dark-card group ${activeNotification.severity === 'Critical' ? 'border-accent-rose shadow-accent-rose/10' : 'border-amber-400 shadow-amber-400/10'}`}
          >
            <div className={`p-4 rounded-3xl shrink-0 ${activeNotification.severity === 'Critical' ? 'bg-accent-rose text-white animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.5)]' : 'bg-amber-500 text-white'}`}>
              <BellRing className="w-8 h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-xs uppercase tracking-[0.1em] text-gray-900 dark:text-white leading-none mb-2 font-display">System Breach Detected</h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold truncate">
                {activeNotification.workloadName}: <span className="text-primary-500">{activeNotification.metric}</span> at <span className="text-accent-rose">{activeNotification.value}%</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/notifications', { state: { editRuleId: activeNotification.ruleId } });
                }}
                className="p-3 hover:bg-gray-100 dark:hover:bg-white/5 rounded-2xl text-gray-400 hover:text-primary-500 transition-all"
              >
                <Settings2 className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNotification();
                }}
                className="p-3 hover:bg-gray-100 dark:hover:bg-white/5 rounded-2xl text-gray-400 hover:text-accent-rose transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <AIChatWidget isOpen={isChatOpen} onClose={() => { setIsChatOpen(false); setChatContext(null); }} initialContext={chatContext} />
    </div>
  );
};
const App: React.FC = () => {
  return (
    <AuthProvider>
      <MonitoringProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </BrowserRouter>
      </MonitoringProvider>
    </AuthProvider>
  );
};

export default App;
