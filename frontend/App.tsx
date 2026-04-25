import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { MonitoringProvider, useMonitoring } from './contexts/MonitoringContext';
import { Layout } from './components/Layout';
import { PageSkeleton } from './components/PageSkeleton';
import { NotFound } from './components/NotFound';
import { SettingsView } from './components/SettingsView';
import { AIChatWidget } from './components/AIChatWidget';
import { PageTransition } from './components/PageTransition';
import { BellRing, X, Loader2, Key, ExternalLink, Settings2 } from 'lucide-react';
import { DiagnosticPlaybook } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PresenceProvider } from './contexts/PresenceContext';
import { OfflineIndicator } from './components/OfflineIndicator';

// Route-level code splitting for all views
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TriageView = lazy(() => import('./components/TriageView').then(m => ({ default: m.TriageView })));
const RightSizingView = lazy(() => import('./components/RightSizingView').then(m => ({ default: m.RightSizingView })));
const ScalingEfficiencyView = lazy(() => import('./components/ScalingEfficiencyView').then(m => ({ default: m.ScalingEfficiencyView })));
const CapacityPlanningView = lazy(() => import('./components/CapacityPlanningView').then(m => ({ default: m.CapacityPlanningView })));
const MultiClusterView = lazy(() => import('./components/MultiClusterView').then(m => ({ default: m.MultiClusterView })));
const MLIntelligenceView = lazy(() => import('./components/MLIntelligenceView').then(m => ({ default: m.MLIntelligenceView })));
const DeveloperPortalView = lazy(() => import('./components/DeveloperPortalView').then(m => ({ default: m.DeveloperPortalView })));
const AutonomousRemediationView = lazy(() => import('./components/AutonomousRemediationView').then(m => ({ default: m.AutonomousRemediationView })));
const ExternalMetricsView = lazy(() => import('./components/ExternalMetricsView').then(m => ({ default: m.ExternalMetricsView })));
const TopologyView = lazy(() => import('./components/TopologyView').then(m => ({ default: m.TopologyView })));
const GitOpsView = lazy(() => import('./components/GitOpsView').then(m => ({ default: m.GitOpsView })));
const ReportsView = lazy(() => import('./components/ReportsView').then(m => ({ default: m.ReportsView })));
const NotificationsView = lazy(() => import('./components/NotificationsView').then(m => ({ default: m.NotificationsView })));
const TemplateLibraryView = lazy(() => import('./components/TemplateLibraryView').then(m => ({ default: m.TemplateLibraryView })));
const AuditLogsView = lazy(() => import('./components/AuditLogsView').then(m => ({ default: m.AuditLogsView })));

// Wrapper component to consume Context
const AppContent: React.FC = () => {
  const {
    isWorkloadsLoading,
    hasApiKey,
    isCheckingKey,
    isDarkMode,
    activeNotification,
    dismissNotification,
    selectApiKey,
    workloads,
    notificationChannels,
    alertRules,
    triggeredAlerts,
    addChannel,
    updateChannel,
    deleteChannel,
    addAlertRule,
    updateAlertRule,
    deleteAlertRule,
    refreshWorkloads,
    metricsWindow,
    setMetricsWindow,
    selectedCluster
  } = useMonitoring();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleOpenChat = (context?: string) => {
    if (context) setChatContext(context);
    setIsChatOpen(true);
  };

  const handleApplyTemplate = (template: string) => {
    navigate('/triage', { state: { template } });
  };

  const handleNavigateToTriage = (workloadId: string, playbook: DiagnosticPlaybook) => {
    navigate('/triage', { state: { workloadId, playbook } });
  };

  if (isCheckingKey) {
    return (
      <div className={`min-h-screen w-full flex flex-col items-center justify-center bg-bg-main text-text-primary ${isDarkMode ? 'dark' : ''}`}>
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary-500 rounded-full blur-3xl opacity-20"></div>
          <div className="p-6 bg-bg-card rounded-2xl border border-border-main relative z-10 shadow-xl">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
          </div>
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold text-text-primary">Loading</h1>
          <p className="text-sm text-text-secondary">Initializing cluster telemetry...</p>
        </div>
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className={`${isDarkMode ? 'dark' : ''} font-sans`}>
        <div className="min-h-screen w-full flex items-center justify-center bg-bg-main p-6">
          <div className="w-full max-w-md bg-bg-card border border-border-main rounded-2xl shadow-xl p-10 text-center">
            <div className="w-16 h-16 bg-primary-500/10 rounded-xl flex items-center justify-center mx-auto mb-6 text-primary-500">
              <Key className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-semibold text-text-primary mb-3">API Key Required</h1>
            <p className="text-text-secondary mb-8 text-sm leading-relaxed max-w-xs mx-auto">
              A Gemini API key is required to use AI-powered features. Please configure your API key to continue.
            </p>
            <div className="space-y-4">
              <button
                onClick={selectApiKey}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Key className="w-4 h-4" /> Configure API Key
              </button>
              <a
                href="https://ai.google.dev/gemini-api/docs/billing"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-primary-500 transition-colors"
              >
                View Gemini API documentation <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <Layout>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={
              <PageTransition>
                <Dashboard workloads={workloads} isLoading={isWorkloadsLoading} isDarkMode={isDarkMode} onTriageRequest={handleNavigateToTriage} onRefresh={refreshWorkloads} metricsWindow={metricsWindow} setMetricsWindow={setMetricsWindow} />
              </PageTransition>
            } />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/templates" element={
              <PageTransition>
                <TemplateLibraryView onApplyTemplate={(view, tmpl) => handleApplyTemplate(tmpl)} isDarkMode={isDarkMode} />
              </PageTransition>
            } />
            <Route path="/triage" element={
              <PageTransition>
                <TriageView
                  workloads={workloads}
                  isDarkMode={isDarkMode}
                  onOpenChat={handleOpenChat}
                />
              </PageTransition>
            } />
            <Route path="/rightsizing" element={
              <PageTransition>
                <RightSizingView
                  workloads={workloads}
                  isDarkMode={isDarkMode}
                  onOpenChat={handleOpenChat}
                  onTriageRequest={handleNavigateToTriage}
                  onRefresh={refreshWorkloads}
                />
              </PageTransition>
            } />
            <Route path="/scaling" element={
              <PageTransition>
                <ScalingEfficiencyView clusterId={selectedCluster?.id} />
              </PageTransition>
            } />
            <Route path="/capacity" element={
              <PageTransition>
                <CapacityPlanningView />
              </PageTransition>
            } />
            <Route path="/multicluster" element={
              <PageTransition>
                <MultiClusterView />
              </PageTransition>
            } />
            <Route path="/ml-intelligence" element={
              <PageTransition>
                <MLIntelligenceView />
              </PageTransition>
            } />
            <Route path="/developer" element={
              <PageTransition>
                <DeveloperPortalView />
              </PageTransition>
            } />
            <Route path="/autonomous" element={
              <PageTransition>
                <AutonomousRemediationView />
              </PageTransition>
            } />
            <Route path="/metrics/external" element={
              <PageTransition>
                <ExternalMetricsView />
              </PageTransition>
            } />
            <Route path="/topology" element={
              <PageTransition>
                <TopologyView workloads={workloads} />
              </PageTransition>
            } />
            <Route path="/gitops" element={
              <PageTransition>
                <GitOpsView clusterId={selectedCluster?.id} />
              </PageTransition>
            } />
            <Route path="/reports" element={
              <PageTransition>
                <ReportsView />
              </PageTransition>
            } />
            <Route path="/notifications" element={
              <PageTransition>
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
              </PageTransition>
            } />
            <Route path="/audit-logs" element={
              <PageTransition>
                <AuditLogsView />
              </PageTransition>
            } />
            <Route path="/settings" element={
              <PageTransition>
                <SettingsView />
              </PageTransition>
            } />
            <Route path="*" element={
              <PageTransition>
                <NotFound />
              </PageTransition>
            } />
          </Routes>
        </Suspense>
      </Layout>
      <OfflineIndicator />

      {/* Alert Notification Toast */}
      {activeNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md p-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div
            onClick={() => navigate('/triage')}
            className={`cursor-pointer hover:bg-bg-hover transition-all p-4 rounded-2xl border border-transparent shadow-md flex items-center gap-4 bg-bg-card group ${activeNotification.severity === 'Critical' ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-amber-500'}`}
          >
            <div className={`p-3 rounded-lg shrink-0 ${activeNotification.severity === 'Critical' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>
              <BellRing className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm text-text-primary mb-1">
                {activeNotification.severity === 'Critical' ? 'Critical Alert' : 'Warning'}
              </h4>
              <p className="text-xs text-text-secondary truncate">
                {activeNotification.workloadName}: <span className="text-primary-500">{activeNotification.metric}</span> at <span className={activeNotification.severity === 'Critical' ? 'text-rose-500' : 'text-amber-500'}>{activeNotification.value}%</span>
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/notifications', { state: { editRuleId: activeNotification.ruleId } });
                }}
                className="p-2 hover:bg-bg-hover rounded-lg text-text-tertiary hover:text-primary-500 transition-colors"
              >
                <Settings2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNotification();
                }}
                className="p-2 hover:bg-bg-hover rounded-lg text-text-tertiary hover:text-rose-500 transition-colors"
              >
                <X className="w-4 h-4" />
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
    <MonitoringProvider>
      <PresenceProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </BrowserRouter>
      </PresenceProvider>
    </MonitoringProvider>
  );
};

export default App;
