import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, AlertCircle, Scale, Settings, Box, ChevronLeft, ChevronRight, Sun, Moon, ChevronsUpDown, Check, Server, Plus, X, Globe, Cloud, Bell, BookOpen, Menu, Key, Zap, FileText, RefreshCw, Trash2, Activity, Brain, Users, Bot, Database, GitBranch, Shield } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMonitoring } from '../contexts/MonitoringContext';
import { Cluster } from '../types';
import logo from '../src/assets/kubetriage_logo.svg';

interface LayoutProps {
  children?: React.ReactNode;
}

const ProviderIcon = ({ provider, className }: { provider: Cluster['provider'], className?: string }) => {
  switch (provider) {
    case 'GKE': return <Cloud className={`${className} text-blue-500`} />;
    case 'EKS': return <Zap className={`${className} text-orange-500`} />;
    case 'AKS': return <Globe className={`${className} text-blue-400`} />;
    default: return <Server className={`${className} text-text-secondary`} />;
  }
};

import { DeleteClusterModal } from './DeleteClusterModal';
import { RegisterClusterModal } from './RegisterClusterModal';

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const {
    isDarkMode,
    toggleTheme,
    selectedCluster,
    clusters,
    setSelectedCluster,
    unreadReports,
    isWorkloadsLoading,
    refreshWorkloads,
    removeCluster
  } = useMonitoring();

  const location = useLocation();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [apiStatus, setApiStatus] = useState<'Connected' | 'Degraded'>('Connected');
  const [isClusterMenuOpen, setIsClusterMenuOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [clusterToDelete, setClusterToDelete] = useState<Cluster | null>(null);

  const clusterMenuRef = useRef<HTMLDivElement>(null);

  // Measure real API latency via health check
  useEffect(() => {
    const measureLatency = async () => {
      try {
        const start = performance.now();
        const res = await fetch('/api/health');
        const elapsed = Math.round(performance.now() - start);
        if (res.ok) {
          setApiLatency(elapsed);
          setApiStatus('Connected');
        } else {
          setApiStatus('Degraded');
        }
      } catch {
        setApiStatus('Degraded');
      }
    };
    measureLatency();
    const interval = setInterval(measureLatency, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clusterMenuRef.current && !clusterMenuRef.current.contains(event.target as Node)) setIsClusterMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/templates', label: 'Runbooks', icon: BookOpen },
    { path: '/triage', label: 'Triage', icon: AlertCircle },
    { path: '/rightsizing', label: 'Right Sizing', icon: Scale },
    { path: '/scaling', label: 'Scaling', icon: Activity },
    { path: '/multicluster', label: 'Multi-Cluster', icon: Globe },
    { path: '/ml-intelligence', label: 'ML Intelligence', icon: Brain },
    { path: '/developer', label: 'Developer Portal', icon: Users },
    { path: '/autonomous', label: 'Auto Remediation', icon: Bot },
    { path: '/metrics/external', label: 'External Metrics', icon: Database },
    { path: '/topology', label: 'Architecture', icon: Cloud },
    { path: '/gitops', label: 'GitOps', icon: GitBranch },
    { path: '/reports', label: 'Reporting', icon: FileText },
    { path: '/notifications', label: 'Alerting', icon: Bell },
    { path: '/audit-logs', label: 'Audit Logs', icon: Shield },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500';
      case 'Degraded': return 'bg-amber-500';
      default: return 'bg-red-500';
    }
  };

  const getStatusGlow = (status: string) => {
    switch (status) {
      case 'Active': return 'shadow-[0_0_8px_rgba(16,185,129,0.5)]';
      case 'Degraded': return 'shadow-[0_0_8px_rgba(245,158,11,0.5)]';
      default: return 'shadow-[0_0_8px_rgba(244,63,94,0.5)]';
    }
  };

  return (
    <div className="flex h-screen bg-bg-main text-text-secondary overflow-hidden flex-col md:flex-row font-sans selection:bg-primary-500/30">
      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.02] z-0 bg-mesh"></div>

      <RegisterClusterModal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} />
      <DeleteClusterModal
        isOpen={!!clusterToDelete}
        onClose={() => setClusterToDelete(null)}
        onConfirm={async () => {
          if (clusterToDelete) {
            await removeCluster(clusterToDelete.id);
            if (selectedCluster?.id === clusterToDelete.id) setIsClusterMenuOpen(false);
            setClusterToDelete(null);
          }
        }}
        clusterName={clusterToDelete?.name || ''}
      />

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Desktop & Mobile Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 md:z-auto
        flex flex-col bg-bg-card border-r border-border-main
        transition-all duration-300 ease-out
        shadow-[10px_0_30px_rgba(0,0,0,0.05)] dark:shadow-[10px_0_30px_rgba(0,0,0,0.3)] md:shadow-none
        ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'md:w-20' : 'md:w-72'}
      `}>
        {/* Logo Section */}
        <div className={`flex items-center h-20 border-b border-border-main overflow-hidden shrink-0 relative
          ${isCollapsed ? 'md:justify-center md:px-0' : 'gap-3 px-6'}
        `}>
          {/* Subtle glow behind logo */}
          <div className="absolute top-1/2 left-6 w-8 h-8 bg-primary-500/10 blur-xl rounded-full -translate-y-1/2 pointer-events-none
            transition-opacity duration-300 ${isCollapsed ? 'md:opacity-100' : 'md:opacity-0'}"></div>

          <div className="shrink-0 p-2 rounded-xl bg-bg-hover ring-1 ring-border-main relative z-10">
            <img src={logo} alt="Logo" className="w-7 h-7 object-contain" />
          </div>

          {(!isCollapsed || isMobileMenuOpen) && (
            <div className="animate-slide-up">
              <h1 className="font-display font-black text-text-primary tracking-tight text-lg uppercase">
                Kube<span className="text-primary-500">Triage</span>
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse-soft"></span>
                <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Online</p>
              </div>
            </div>
          )}

          <button className="ml-auto md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-bg-hover"
            onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item, index) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center w-full px-3 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden
                ${isActive
                  ? 'bg-primary-500/10 text-text-primary border border-primary-500/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'}
              `}
              title={isCollapsed ? item.label : undefined}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {({ isActive }) => (
                <>
                  {/* Active indicator line */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary-500 rounded-r-full" />
                  )}

                  <item.icon className={`
                    w-5 h-5 shrink-0 transition-all duration-200 relative z-10
                    ${isActive
                      ? 'text-primary-500'
                      : 'text-text-tertiary group-hover:text-text-primary'}
                    ${isCollapsed && !isMobileMenuOpen ? 'mx-auto' : 'mr-3'}
                  `} />

                  {(!isCollapsed || isMobileMenuOpen) && (
                    <span className={`
                      font-medium text-sm relative z-10 transition-colors
                      ${isActive ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}
                    `}>
                      {item.label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-border-main hidden md:block">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center w-full p-2.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-all duration-200 group"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            ) : (
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Header */}
        <header className="h-16 border-b border-border-main bg-bg-main/50 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 z-30 shrink-0">
          <div className="flex items-center gap-4 w-full">
            {/* Mobile Toggle */}
            <button
              className="p-2 md:hidden text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-bg-hover"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Cluster Switcher */}
            <div className="relative" ref={clusterMenuRef}>
              <button
                onClick={() => setIsClusterMenuOpen(!isClusterMenuOpen)}
                className="flex items-center gap-2.5 px-3 py-2 bg-bg-card/80 border border-border-main rounded-xl hover:border-primary-500/30 hover:bg-kt-dark-lighter/50 transition-all duration-200 group min-w-[44px] md:min-w-[200px]"
              >
                {selectedCluster ? (
                  <>
                    <div className="p-1.5 rounded-lg bg-bg-hover group-hover:bg-primary-500/10 transition-colors">
                      <ProviderIcon provider={selectedCluster.provider} className="w-4 h-4 text-text-secondary group-hover:text-primary-500" />
                    </div>
                    <div className="hidden sm:block text-left flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider group-hover:text-primary-500 transition-colors">
                        Target Cluster
                      </div>
                      <div className="text-sm font-semibold text-text-primary truncate flex items-center gap-2">
                        {selectedCluster.displayName || selectedCluster.name}
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(selectedCluster?.status || 'Active')} ${getStatusGlow(selectedCluster?.status || 'Active')}`} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Cloud className="w-5 h-5 text-text-secondary" />
                    <div className="hidden sm:block text-left">
                      <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Target Cluster</div>
                      <div className="text-xs font-medium text-text-secondary">Select cluster...</div>
                    </div>
                  </>
                )}
                <ChevronsUpDown className="w-4 h-4 text-text-tertiary ml-auto group-hover:text-primary-500 transition-colors" />
              </button>

              {/* Cluster Dropdown */}
              {isClusterMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-bg-card border border-border-main rounded-2xl shadow-2xl py-2 animate-slide-up z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border-main bg-bg-hover">
                    <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
                      <Server className="w-3.5 h-3.5" /> Control Plane Fleet
                    </p>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                    {clusters.map(cluster => (
                      <button
                        key={cluster.id}
                        onClick={() => { setSelectedCluster(cluster); setIsClusterMenuOpen(false); }}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left relative overflow-hidden group/item
                          ${selectedCluster?.id === cluster.id
                            ? 'bg-primary-500/10 border border-primary-500/20'
                            : 'hover:bg-bg-hover border border-transparent'}
                        `}
                      >
                        {selectedCluster?.id === cluster.id && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 bg-primary-500 rounded-r-full" />
                        )}

                        <div className="p-1.5 rounded-lg bg-bg-hover text-text-secondary group-hover/item:text-text-primary transition-colors">
                          <ProviderIcon provider={cluster.provider} className="w-4 h-4 shrink-0" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${selectedCluster?.id === cluster.id ? 'text-primary-500' : 'text-text-secondary group-hover/item:text-text-primary'}`}>
                            {cluster.displayName || cluster.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(cluster.status)} ${getStatusGlow(cluster.status)}`}></span>
                            <p className="text-[10px] text-text-tertiary font-mono uppercase">{cluster.region} :: {cluster.provider}</p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setClusterToDelete(cluster);
                          }}
                          className="p-1.5 hover:bg-danger-light rounded-lg transition-colors opacity-0 group-hover/item:opacity-100"
                          title="Remove Cluster"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-text-tertiary hover:text-danger transition-colors" />
                        </button>
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-border-main mx-3 my-1.5" />
                  <div className="p-1.5">
                    <button
                      onClick={() => { setIsRegisterModalOpen(true); setIsClusterMenuOpen(false); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-500 rounded-xl transition-all"
                    >
                      <Plus className="w-4 h-4" /> Provision New Cluster
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* System Status - Desktop */}
            <div className="hidden lg:flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-4 px-4 py-2 bg-bg-card/50 rounded-xl border border-border-main">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Latency</span>
                  <span className="text-xs font-mono text-emerald-500 tabular-nums dark:text-emerald-400">{apiLatency !== null ? `${apiLatency}ms` : '...'}</span>
                </div>
                <div className="w-px h-4 bg-border-main"></div>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(apiStatus)} ${getStatusGlow(apiStatus)}`}></span>
                  <span className={`text-xs font-medium ${apiStatus === 'Connected' ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`}>
                    {apiStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 ml-auto lg:ml-0">
              {/* Settings */}
              <button
                onClick={() => navigate('/settings')}
                className="p-2.5 rounded-xl bg-bg-hover border border-border-main text-text-secondary hover:text-text-primary hover:border-primary-500/30 transition-all duration-200 active:scale-95 group"
                title="Settings"
              >
                <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
              </button>

              {/* Notifications */}
              <button
                onClick={() => navigate('/notifications')}
                className="relative p-2.5 rounded-xl bg-bg-hover border border-border-main text-text-secondary hover:text-text-primary hover:border-primary-500/30 transition-all duration-200 group"
              >
                <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {unreadReports > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </button>

              {/* Refresh */}
              <button
                onClick={refreshWorkloads}
                disabled={isWorkloadsLoading}
                className={`p-2.5 rounded-xl bg-bg-hover border border-border-main text-text-secondary hover:text-text-primary hover:border-primary-500/30 transition-all duration-200 ${isWorkloadsLoading ? 'opacity-50' : 'active:scale-95'}`}
                title="Refresh Telemetry"
              >
                <RefreshCw className={`w-5 h-5 ${isWorkloadsLoading ? 'animate-spin text-primary-500' : ''}`} />
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-bg-hover border border-border-main text-text-secondary hover:text-text-primary hover:border-primary-500/30 transition-all duration-200 active:scale-95 group"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? (
                  <Sun className="w-5 h-5 group-hover:text-amber-400 transition-colors" />
                ) : (
                  <Moon className="w-5 h-5 group-hover:text-primary-500 transition-colors" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Loading Progress Bar */}
        {isWorkloadsLoading && (
          <div className="absolute top-0 left-0 right-0 h-[2px] z-50 overflow-hidden bg-transparent">
            <div className="h-full bg-gradient-to-r from-transparent via-primary-500 to-transparent w-[200%] animate-loading-bar"></div>
          </div>
        )}

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 custom-scrollbar">
          <div className="mx-auto max-w-[1600px] h-full">
            {children || <Outlet />}
          </div>
        </div>
      </div>
    </div>
  );
};
