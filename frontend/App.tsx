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
import { BellRing, X, Loader2, Key, ExternalLink, Settings2 } from 'lucide-react';
import { DiagnosticPlaybook } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';

// Wrapper component to consume Context and enforce Auth
const AppContent: React.FC = () => {
  const {
    isAuthenticated,
    isAuthLoading, // Added
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
    login
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
            <button onClick={selectApiKey} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 mb-4">
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
        <LoginView onLogin={login} />
      </div>
    );
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard workloads={workloads} isDarkMode={isDarkMode} onTriageRequest={handleNavigateToTriage} />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
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
            />
          } />
          <Route path="/topology" element={<TopologyView workloads={workloads} isDarkMode={isDarkMode} />} />
          <Route path="/organizations" element={<OrganizationView organizations={organizations} onAddOrganization={() => { }} isDarkMode={isDarkMode} />} />
          <Route path="/users" element={<UserView users={users} onAddUser={() => { }} onUpdateUser={() => { }} onDeleteUser={() => { }} isDarkMode={isDarkMode} />} />
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md p-4 animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div
            onClick={() => navigate('/triage')}
            className={`cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors p-5 rounded-[2rem] border-2 shadow-2xl flex items-center gap-4 bg-white dark:bg-zinc-900 ${activeNotification.severity === 'Critical' ? 'border-red-500' : 'border-amber-500'}`}
          >
            <div className={`p-3 rounded-2xl shrink-0 ${activeNotification.severity === 'Critical' ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-white'}`}>
              <BellRing className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-sm uppercase tracking-tighter text-zinc-900 dark:text-white leading-none mb-1">Threshold Breached</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold truncate">
                {activeNotification.workloadName}: {activeNotification.metric} at {activeNotification.value}% (Limit {activeNotification.threshold}%)
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate('/notifications', { state: { editRuleId: activeNotification.ruleId } });
              }}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-500 transition-colors"
            >
              <Settings2 className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissNotification();
              }}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-red-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
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
