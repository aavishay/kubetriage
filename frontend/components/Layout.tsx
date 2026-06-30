import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard, AlertCircle, Settings, Box, ChevronLeft, ChevronRight, Sun, Moon, ChevronsUpDown, Check, Server, Plus, X, Globe, Cloud, Bell, BookOpen, Menu, Key, Zap, FileText, RefreshCw, Trash2, Activity, Brain, Database, GitBranch, Shield, TrendingUp
} from 'lucide-react';
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
import { ClusterCommandPalette } from './ClusterCommandPalette';

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const {
    isDarkMode,
    toggleTheme,
    selectedCluster,
    selectedClusterIds,
    clusters,
    setSelectedClusterIds,
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
  const [isClusterSearchOpen, setIsClusterSearchOpen] = useState(false);
  const [draftClusterIds, setDraftClusterIds] = useState<string[]>(selectedClusterIds);

  const clusterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '[' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setIsCollapsed(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsClusterSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleClusterSelect = useCallback((clusterId: string) => {
    setSelectedClusterIds([clusterId]);
  }, [setSelectedClusterIds]);

  const navItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/templates', label: 'Runbooks', icon: BookOpen },
    { path: '/triage', label: 'Triage', icon: AlertCircle },
    { path: '/scaling', label: 'Scaling', icon: Activity },
    { path: '/capacity', label: 'Capacity', icon: TrendingUp },
    { path: '/multicluster', label: 'Multi-Cluster', icon: Globe },
    { path: '/ml-intelligence', label: 'ML Intelligence', icon: Brain },
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
      default: return 'bg-rose-500';
    }
  };

  const formatSelectedLabel = () => {
    if (selectedClusterIds.length === 0) return 'ALL CLUSTERS';
    if (selectedClusterIds.length === 1) return selectedCluster?.displayName || selectedCluster?.name || 'SELECT';
    return `${selectedClusterIds.length} SELECTED`;
  };

  return (
    <div className="flex h-screen bg-bg-main text-text-secondary overflow-hidden flex-col md:flex-row font-sans selection:bg-primary-500/30 kt-scanlines kt-noise">
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

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-black focus:rounded-sm focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Sidebar Rack */}
      <aside
        id="main-sidebar"
        aria-label="Main navigation"
        className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-auto
          flex flex-col bg-bg-card border-r border-border-main
          transition-all duration-300 ease-out
          shadow-[10px_0_30px_rgba(0,0,0,0.3)]
          ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-18' : 'md:w-64'}
        `}>
        {/* Logo Header */}
        <div className={`flex items-center h-16 border-b border-border-main overflow-hidden shrink-0 relative
          ${isCollapsed ? 'md:justify-center md:px-0' : 'gap-3 px-4'}
        `}>
          <div className="shrink-0 p-1.5 border border-border-main bg-bg-main relative z-10">
            <img src={logo} alt="KubeTriage" className="w-7 h-7 object-contain" />
          </div>

          {(!isCollapsed || isMobileMenuOpen) && (
            <div className="animate-slide-up">
              <h1 className="font-sans font-bold text-text-primary text-lg">
                Kube<span className="text-primary-500">Triage</span>
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="kt-led kt-led-success kt-led-pulse" />
                <p className="text-[10px] text-text-tertiary font-sans font-medium">Online</p>
              </div>
            </div>
          )}

          <button className="ml-auto md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors rounded-sm hover:bg-bg-hover"
            onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item, index) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center w-full px-3 py-2.5 rounded-sm transition-all duration-200 group relative overflow-hidden focus-visible:ring-2 focus-visible:ring-primary-500/50 outline-none
                border-l-2
                ${isActive
                  ? 'bg-primary-500/8 border-primary-500 text-primary-500'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover'}
              `}
              title={isCollapsed ? item.label : undefined}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`
                    w-[18px] h-[18px] shrink-0 transition-all duration-200 relative z-10
                    ${isActive
                      ? 'text-primary-500 drop-shadow-[0_0_6px_rgba(0,200,240,0.5)]'
                      : 'text-text-tertiary group-hover:text-text-primary'}
                    ${isCollapsed && !isMobileMenuOpen ? 'mx-auto' : 'mr-3'}
                  `} />

                  {(!isCollapsed || isMobileMenuOpen) && (
                    <span className={`
                      font-sans font-medium text-xs relative z-10 transition-colors
                      ${isActive ? 'text-primary-500' : 'text-text-secondary group-hover:text-text-primary'}
                    `}>
                      {item.label}
                    </span>
                  )}

                  {isActive && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 kt-led kt-led-primary" style={{ background: '#00c8f0', boxShadow: '0 0 6px #00c8f0' }} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 hidden md:flex justify-center border-t border-border-main">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-8 h-8 rounded-sm bg-bg-hover border border-border-main hover:border-primary-500/30 text-text-tertiary hover:text-primary-500 transition-all duration-200 group focus-visible:ring-2 focus-visible:ring-primary-500/50 outline-none flex items-center justify-center"
            title={isCollapsed ? 'Expand sidebar (press [)' : 'Collapse sidebar (press [)'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            ) : (
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Header Status Strip */}
        <header className="h-16 border-b border-border-main bg-bg-card/95 backdrop-blur-sm flex items-center justify-between px-4 md:px-5 z-30 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              className="p-2 md:hidden text-text-secondary hover:text-text-primary transition-colors rounded-sm hover:bg-bg-hover focus-visible:ring-2 focus-visible:ring-primary-500/50 outline-none"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="main-sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Cluster Switcher */}
            <div className="relative min-w-0" ref={clusterMenuRef}>
              <button
                onClick={() => {
                  setDraftClusterIds(selectedClusterIds);
                  setIsClusterMenuOpen(o => !o);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-bg-main border border-border-main rounded-sm hover:border-primary-500/50 hover:bg-bg-hover transition-all duration-200 group min-w-0 w-full sm:w-auto sm:min-w-[200px] sm:max-w-[320px] focus-visible:ring-2 focus-visible:ring-primary-500/50 outline-none"
                aria-expanded={isClusterMenuOpen}
                aria-controls="cluster-dropdown"
                aria-label="Select target clusters"
              >
                <span className="kt-led shrink-0" style={{ background: selectedClusterIds.length > 0 ? '#00c8f0' : '#4a4d55', boxShadow: selectedClusterIds.length > 0 ? '0 0 6px #00c8f0' : 'none' }} />
                <div className="hidden sm:block text-left flex-1 min-w-0">
                  <div className="text-[10px] text-text-tertiary group-hover:text-primary-500 transition-colors font-sans font-medium">
                    Target Cluster
                  </div>
                  <div className="text-sm font-sans font-medium text-text-primary truncate">
                    {formatSelectedLabel()}
                  </div>
                </div>
                <ChevronsUpDown className="w-4 h-4 text-text-tertiary ml-auto group-hover:text-primary-500 transition-colors" />
              </button>

              {isClusterMenuOpen && (
                <div
                  id="cluster-dropdown"
                  className="absolute top-full left-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-80 bg-bg-card border border-border-main rounded-sm shadow-2xl py-1 animate-slide-up z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border-main bg-bg-hover">
                    <p className="text-[10px] text-text-tertiary flex items-center gap-2 font-sans font-medium">
                      <Server className="w-3.5 h-3.5" /> Control Plane Fleet
                    </p>
                    <button
                      onClick={() => setDraftClusterIds([])}
                      className="text-[10px] text-primary-400 hover:text-primary-300 font-sans font-medium"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                    <label className="flex items-center gap-3 px-3 py-2 rounded-sm hover:bg-bg-hover cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-primary-500 rounded-sm"
                        checked={draftClusterIds.length === 0}
                        onChange={() => setDraftClusterIds([])}
                      />
                      <span className="text-sm font-sans font-medium text-text-primary">All clusters</span>
                    </label>
                    {clusters.map(cluster => (
                      <div
                        key={cluster.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-sm hover:bg-bg-hover transition-colors group/item"
                      >
                        <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary-500 rounded-sm"
                            checked={draftClusterIds.includes(cluster.id)}
                            onChange={() => {
                              setDraftClusterIds(prev =>
                                prev.includes(cluster.id)
                                  ? prev.filter(id => id !== cluster.id)
                                  : [...prev, cluster.id]
                              );
                            }}
                          />
                          <div className="p-1 border border-border-main bg-bg-main text-text-secondary group-hover/item:text-text-primary transition-colors">
                            <ProviderIcon provider={cluster.provider} className="w-4 h-4 shrink-0" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-sans font-medium truncate ${draftClusterIds.includes(cluster.id) ? 'text-primary-500' : 'text-text-secondary group-hover/item:text-text-primary'}`}>
                              {cluster.displayName || cluster.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(cluster.status)}`}></span>
                              <p className="text-[10px] text-text-tertiary font-sans font-medium">{cluster.provider}</p>
                            </div>
                          </div>
                        </label>

                        <button
                          onClick={() => setClusterToDelete(cluster)}
                          className="p-1.5 hover:bg-danger-light rounded-sm transition-colors opacity-0 group-hover/item:opacity-100"
                          title="Remove Cluster"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-text-tertiary hover:text-danger transition-colors" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 px-2 py-2 border-t border-border-main">
                    <button
                      onClick={() => {
                        setSelectedClusterIds(draftClusterIds);
                        setIsClusterMenuOpen(false);
                      }}
                      className="flex-1 kt-button kt-button-primary py-1.5 text-xs"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => {
                        setDraftClusterIds(selectedClusterIds);
                        setIsClusterMenuOpen(false);
                      }}
                      className="flex-1 kt-button kt-button-secondary py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="h-px bg-border-main mx-2 my-1" />
                  <div className="p-1.5">
                    <button
                      onClick={() => { setIsRegisterModalOpen(true); setIsClusterMenuOpen(false); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-sans font-semibold text-black bg-primary-500 hover:bg-primary-400 rounded-sm transition-all"
                    >
                      <Plus className="w-4 h-4" /> Provision new cluster
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side: System status + Actions */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* System Status Strip - Desktop */}
            <div className="hidden lg:flex items-center gap-0 px-1 bg-bg-main border border-border-main rounded-sm">
              <div className="flex items-center gap-2 px-2 py-1 border-r border-border-main">
                <span className="text-[10px] text-text-tertiary font-sans font-medium">Latency</span>
                <span className="text-xs font-mono font-bold text-success tabular-nums">{apiLatency !== null ? `${apiLatency}ms` : '...'}</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1">
                <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'Connected' ? 'bg-success' : 'bg-warning'} ${apiStatus === 'Connected' ? 'shadow-[0_0_6px_#2ecc71]' : 'shadow-[0_0_6px_#f5a623]'}`}></span>
                <span className={`text-xs font-bold ${apiStatus === 'Connected' ? 'text-success' : 'text-warning'}`}>
                  {apiStatus}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate('/notifications')}
                className="relative p-2 rounded-sm bg-bg-main border border-border-main text-text-secondary hover:text-text-primary hover:border-primary-500/30 transition-all duration-200 active:translate-y-[1px] active:brightness-95 group focus-visible:ring-2 focus-visible:ring-primary-500/50 outline-none"
                aria-label="Notifications"
              >
                <Bell className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
                {unreadReports > 0 && (
                  <span className="absolute top-1 right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
                  </span>
                )}
              </button>

              <button
                onClick={refreshWorkloads}
                disabled={isWorkloadsLoading}
                className={`p-2 rounded-sm bg-bg-main border border-border-main text-text-secondary hover:text-text-primary hover:border-primary-500/30 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary-500/50 outline-none ${isWorkloadsLoading ? 'opacity-50' : 'active:translate-y-[1px] active:brightness-95'}`}
                title="Refresh Telemetry"
              >
                <RefreshCw className={`w-[18px] h-[18px] ${isWorkloadsLoading ? 'animate-spin text-primary-500' : ''}`} />
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-sm bg-bg-main border border-border-main text-text-secondary hover:text-text-primary hover:border-primary-500/30 transition-all duration-200 active:translate-y-[1px] active:brightness-95 group focus-visible:ring-2 focus-visible:ring-primary-500/50 outline-none"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? (
                  <Sun className="w-[18px] h-[18px] group-hover:text-primary-500 transition-colors" />
                ) : (
                  <Moon className="w-[18px] h-[18px] group-hover:text-primary-500 transition-colors" />
                )}
              </button>
            </div>
          </div>
        </header>

        <ClusterCommandPalette
          clusters={clusters}
          selectedClusterIds={selectedClusterIds}
          isOpen={isClusterSearchOpen}
          onClose={() => setIsClusterSearchOpen(false)}
          onSelect={handleClusterSelect}
        />

        {isWorkloadsLoading && (
          <div className="absolute top-0 left-0 right-0 h-[2px] z-50 overflow-hidden bg-transparent">
            <div className="h-full bg-primary-500 shadow-[0_0_10px_#00c8f0] animate-loading-bar"></div>
          </div>
        )}

        <div id="main-content" className="flex-1 overflow-y-auto px-4 md:px-5 py-5 custom-scrollbar" role="main" tabIndex={-1}>
          <div className="mx-auto max-w-[1600px] min-h-0">
            {children || <Outlet />}
          </div>
        </div>
      </div>
    </div>
  );
};
