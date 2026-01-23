import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, AlertCircle, Scale, Settings, Box, ChevronLeft, ChevronRight, Sun, Moon, ChevronsUpDown, Check, Server, LogOut, Plus, X, Globe, Cloud, Bell, BookOpen, Menu, Key, Zap, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMonitoring } from '../contexts/MonitoringContext';
import { useAuth } from '../contexts/AuthContext';
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
    default: return <Server className={`${className} text-zinc-500`} />;
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
    isAuthenticated,
    logout,
    selectApiKey,
    users,
    unreadReports,
    isWorkloadsLoading,
    refreshWorkloads,
    removeCluster
  } = useMonitoring();

  const location = useLocation();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [apiLatency, setApiLatency] = useState(24);
  const [apiStatus, setApiStatus] = useState<'Connected' | 'Degraded'>('Connected');
  const [isClusterMenuOpen, setIsClusterMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [clusterToDelete, setClusterToDelete] = useState<Cluster | null>(null);

  const clusterMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setApiLatency(Math.floor(Math.random() * 40) + 15);
      setApiStatus(Math.random() > 0.95 ? 'Degraded' : 'Connected');
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clusterMenuRef.current && !clusterMenuRef.current.contains(event.target as Node)) setIsClusterMenuOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setIsUserMenuOpen(false);
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
    { path: '/topology', label: 'Architecture', icon: Cloud },
    { path: '/reports', label: 'Reporting', icon: FileText },
    { path: '/notifications', label: 'Alerting', icon: Bell },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500 shadow-[0_0_10px_#10b981]';
      case 'Degraded': return 'bg-amber-500 shadow-[0_0_10px_#f59e0b]';
      default: return 'bg-red-500 shadow-[0_0_10px_#ef4444]';
    }
  };

  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-black text-zinc-300 overflow-hidden flex-col md:flex-row font-sans selection:bg-primary-500/30">
      {/* Dynamic Background Noise */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

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
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Desktop & Mobile Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 md:z-auto
        flex flex-col bg-dark-card/90 backdrop-blur-xl border-r border-white/5 
        transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-[10px_0_30px_rgba(0,0,0,0.5)] md:shadow-none
        ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'md:w-[88px]' : 'md:w-72'}
      `}>
        <div className={`flex p-8 items-center ${isCollapsed ? 'md:justify-center' : 'gap-4'} h-24 border-b border-white/5 overflow-hidden shrink-0 relative`}>
          {/* Logo Neon Glow */}
          <div className="absolute top-1/2 left-8 w-10 h-10 bg-primary-500/20 blur-xl rounded-full -translate-y-1/2 pointer-events-none"></div>

          <div className="shrink-0 p-3 bg-gradient-to-br from-primary-600 to-indigo-600 rounded-xl shadow-lg shadow-primary-500/20 ring-1 ring-white/10 relative z-10">
            <img src={logo} alt="Logo" className="w-5 h-5 object-contain brightness-0 invert" />
          </div>
          {(!isCollapsed || isMobileMenuOpen) && (
            <div className="animate-in fade-in slide-in-from-left-6 duration-700">
              <h1 className="font-black text-white tracking-widest leading-none text-lg font-display uppercase drop-shadow-md">Neural<span className="text-primary-500">Ops</span></h1>
              <div className="flex items-center gap-2 mt-1.5 bg-white/5 px-2 py-0.5 rounded-full w-fit border border-white/5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_#10b981]"></span>
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Online</p>
              </div>
            </div>
          )}
          <button className="ml-auto md:hidden p-2 text-zinc-400 hover:text-white transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center w-full p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden
                ${isActive
                  ? 'text-white shadow-[inset_0_0_20px_rgba(14,165,233,0.1)] border border-primary-500/30'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5 border border-transparent'}
              `}
              title={isCollapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  {isActive && <div className="absolute inset-0 bg-primary-500/5 z-0" />}
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full shadow-[0_0_10px_#0ea5e9]" />}

                  <item.icon className={`w-5 h-5 shrink-0 transition-transform duration-300 relative z-10 ${isActive ? 'text-primary-400 scale-110 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]' : 'group-hover:scale-110'} ${isCollapsed && !isMobileMenuOpen ? 'mx-auto' : 'mr-4'}`} />

                  {(!isCollapsed || isMobileMenuOpen) && (
                    <span className={`font-bold text-xs uppercase tracking-wide relative z-10 ${isActive ? 'text-primary-100' : ''}`}>
                      {item.label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 hidden md:block">
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="flex items-center justify-center w-full p-3 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-white transition-all active:scale-95 group">
            {isCollapsed ? <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" /> : <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Header */}
        <header className="h-20 border-b border-white/5 bg-dark-bg/80 backdrop-blur-xl flex items-center justify-between px-6 md:px-8 z-30 shrink-0 sticky top-0 md:bg-transparent">
          <div className="flex items-center gap-4 md:gap-6 w-full">
            {/* Mobile Toggle */}
            <button
              className="p-2 md:hidden text-zinc-400 hover:text-white transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Cluster Switcher Dropdown */}
            <div className="relative" ref={clusterMenuRef}>
              <button
                onClick={() => setIsClusterMenuOpen(!isClusterMenuOpen)}
                className="flex items-center gap-3 px-1 md:px-5 py-2.5 bg-black/40 border border-white/10 rounded-2xl hover:border-primary-500/40 hover:bg-black/60 transition-all shadow-lg active:scale-[0.98] group min-w-[50px] md:min-w-[240px]"
              >
                {selectedCluster ? (
                  <>
                    <div className="p-1.5 rounded-lg bg-white/5 border border-white/5 group-hover:border-primary-500/20 transition-colors">
                      <ProviderIcon provider={selectedCluster.provider} className="w-4 h-4 text-zinc-300" />
                    </div>
                    <div className="hidden sm:block text-left flex-1 min-w-0">
                      <div className="text-[9px] font-black uppercase text-zinc-500 leading-none mb-1.5 font-display tracking-widest group-hover:text-primary-400 transition-colors">Target Cluster</div>
                      <div className="text-sm font-bold text-white leading-none flex items-center gap-2 tracking-wide font-display truncate">
                        {selectedCluster.name}
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(selectedCluster?.status || 'Active')}`} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Cloud className="w-5 h-5 text-zinc-400" />
                    <div className="hidden sm:block text-left">
                      <div className="text-[9px] font-black uppercase text-zinc-500 leading-none mb-1 font-display tracking-widest">Target Cluster</div>
                      <div className="text-xs font-bold text-zinc-300 leading-none tracking-wide">Select active system...</div>
                    </div>
                  </>
                )}
                <ChevronsUpDown className="w-4 h-4 text-zinc-500 ml-auto group-hover:text-primary-400" />
              </button>

              {isClusterMenuOpen && (
                <div className="absolute top-full left-0 mt-4 w-80 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] py-2 animate-in fade-in zoom-in-95 duration-200 origin-top-left z-50 overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                      <Server className="w-3 h-3" /> Control Plane Fleet
                    </p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {clusters.map(cluster => (
                      <button
                        key={cluster.id}
                        onClick={() => { setSelectedCluster(cluster); setIsClusterMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left relative overflow-hidden group/item ${selectedCluster?.id === cluster.id ? 'bg-primary-500/10 border border-primary-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                      >
                        {selectedCluster?.id === cluster.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-primary-500 rounded-r-full shadow-[0_0_10px_#0ea5e9]"></div>}

                        <div className="p-2 rounded-lg bg-black/20 text-zinc-400 group-hover/item:text-white transition-colors">
                          <ProviderIcon provider={cluster.provider} className="w-4 h-4 shrink-0" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${selectedCluster?.id === cluster.id ? 'text-primary-400' : 'text-zinc-300 group-hover/item:text-white'}`}>{cluster.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(cluster.status)}`}></span>
                            <p className="text-[10px] text-zinc-500 font-mono uppercase">{cluster.region} :: {cluster.provider}</p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setClusterToDelete(cluster);
                          }}
                          className="p-2 hover:bg-rose-500/20 rounded-lg transition-colors opacity-0 group-hover/item:opacity-100"
                          title="Remove Cluster"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-zinc-500 hover:text-rose-500 transition-colors" />
                        </button>
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-white/5 mx-4 my-1" />
                  <div className="p-2">
                    <button
                      onClick={() => { setIsRegisterModalOpen(true); setIsClusterMenuOpen(false); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-white bg-primary-600 hover:bg-primary-500 rounded-xl transition-all shadow-lg shadow-primary-900/20"
                    >
                      <Plus className="w-4 h-4" /> Provision New Cluster
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-4 ml-auto">
              {/* System Status Indicators */}
              <div className="flex items-center gap-6 px-6 py-2 bg-black/20 rounded-full border border-white/5 backdrop-blur-sm">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">API Latency</span>
                  <span className="text-xs font-mono text-emerald-400 tabular-nums">{apiLatency}ms</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="flex flex-col items-start">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Uptime Status</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'Connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`}></span>
                    <span className={`text-xs font-bold ${apiStatus === 'Connected' ? 'text-emerald-500' : 'text-amber-500'}`}>{apiStatus}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 md:gap-4 ml-auto lg:ml-0">
              <button
                onClick={() => navigate('/notifications')}
                className="relative p-3 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all group"
              >
                <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {unreadReports > 0 && (
                  <span className="absolute top-2 right-2 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 text-[8px] font-bold text-white items-center justify-center border border-black">{unreadReports}</span>
                  </span>
                )}
              </button>

              <button
                onClick={refreshWorkloads}
                disabled={isWorkloadsLoading}
                className={`p-3 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all ${isWorkloadsLoading ? 'opacity-50' : 'active:scale-95'}`}
                title="Refresh Telemetry"
              >
                <RefreshCw className={`w-5 h-5 ${isWorkloadsLoading ? 'animate-spin text-primary-500' : ''}`} />
              </button>

              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-3 pl-1 pr-4 py-1 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 p-[2px] shadow-lg">
                    <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center font-bold text-white text-xs font-display">
                      {(user?.email || "AU").substring(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-xs font-bold text-white leading-none">{user?.email?.split('@')[0] || "Admin"}</div>
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mt-0.5">Operator</div>
                  </div>
                  <ChevronLeft className={`w-3 h-3 text-zinc-500 transition-transform ${isUserMenuOpen ? '-rotate-90' : 'rotate-0'}`} />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-4 w-60 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-150 origin-top-right z-50 overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
                      <p className="font-bold text-sm text-white">{user?.email || "Admin User"}</p>
                      <p className="text-[10px] text-primary-500 uppercase tracking-widest font-black mt-1 flex items-center gap-1.5">
                        <Key className="w-3 h-3" /> {user?.role || "SRE Lead"}
                      </p>
                    </div>
                    <div className="p-2 space-y-1">
                      <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors"><Settings className="w-4 h-4" /> Preferences</button>
                      <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"><LogOut className="w-4 h-4" /> Terminate Session</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Loading Progress Bar */}
        {isWorkloadsLoading && (
          <div className="absolute top-0 left-0 right-0 h-[2px] z-50 overflow-hidden bg-transparent">
            <div className="h-full bg-gradient-to-r from-transparent via-primary-500 to-transparent w-[200%] animate-loading-bar shadow-[0_0_10px_#0ea5e9]"></div>
          </div>
        )}

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 custom-scrollbar">
          <div className="mx-auto max-w-[1600px] h-full">
            {/* Router Outlet for Page Content */}
            {children || <Outlet />}
          </div>
        </div>
      </div>
    </div>
  );
};