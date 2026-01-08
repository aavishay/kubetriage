import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, AlertCircle, Scale, Settings, Box, ChevronLeft, ChevronRight, Sun, Moon, ChevronsUpDown, Check, Server, LogOut, Plus, X, Globe, Cloud, Bell, BookOpen, Menu, Key, Zap, FileText } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMonitoring } from '../contexts/MonitoringContext';
import { useAuth } from '../contexts/AuthContext';
import { Cluster } from '../types';

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
    unreadReports
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
    { path: '/templates', label: 'Playbook Library', icon: BookOpen },
    { path: '/triage', label: 'Incident Triage', icon: AlertCircle },
    { path: '/rightsizing', label: 'Right Sizing', icon: Scale },
    { path: '/topology', label: 'Architecture', icon: Cloud }, // Changed icon to match generic infrastructure
    { path: '/notifications', label: 'Alerting', icon: Bell },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500';
      case 'Degraded': return 'bg-amber-500';
      default: return 'bg-red-500';
    }
  };

  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-300 overflow-hidden flex-col md:flex-row">
      <RegisterClusterModal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} />

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Desktop & Mobile Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 md:z-auto
        flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300
        ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'md:w-20' : 'md:w-64'}
      `}>
        <div className={`flex p-6 items-center ${isCollapsed ? 'md:justify-center' : 'gap-3'} h-20 border-b border-zinc-100 dark:border-zinc-800 overflow-hidden shrink-0`}>
          <div className="bg-indigo-600 p-2 rounded-lg shrink-0 shadow-lg shadow-indigo-600/30"><Box className="w-5 h-5 text-white" /></div>
          {(!isCollapsed || isMobileMenuOpen) && (
            <div className="animate-in fade-in slide-in-from-left-2">
              <h1 className="font-bold text-zinc-900 dark:text-white tracking-tight leading-none text-base">KubeTriage</h1>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Platform Console</p>
            </div>
          )}
          <button className="ml-auto md:hidden p-2 text-zinc-400" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `flex items-center w-full p-3 rounded-xl transition-all group ${isActive ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white'}`}
            >
              <item.icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${isCollapsed && !isMobileMenuOpen ? 'mx-auto' : 'mr-3'}`} />
              {(!isCollapsed || isMobileMenuOpen) && <span className="font-bold text-sm truncate tracking-tight">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 hidden md:block">
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="flex items-center justify-center w-full p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-all active:scale-95">
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Header */}
        <header className="h-16 md:h-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 z-30 shrink-0">
          <div className="flex items-center gap-4">
            {/* Mobile Toggle */}
            <button
              className="p-2 md:hidden text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Cluster Switcher Dropdown */}
            <div className="relative" ref={clusterMenuRef}>
              <button
                onClick={() => setIsClusterMenuOpen(!isClusterMenuOpen)}
                className="flex items-center gap-3 px-3 md:px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl hover:border-indigo-500/50 transition-all shadow-sm active:scale-[0.98]"
              >
                {selectedCluster ? (
                  <>
                    <ProviderIcon provider={selectedCluster.provider} className="w-4 h-4" />
                    <div className="hidden sm:block text-left">
                      <div className="text-[9px] font-black uppercase text-zinc-400 leading-none mb-1">Target Cluster</div>
                      <div className="text-xs font-black text-zinc-900 dark:text-white leading-none flex items-center gap-2 tracking-tight">
                        {selectedCluster.name}
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(selectedCluster?.status || 'Active')} animate-pulse`} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4 text-zinc-400" />
                    <div className="hidden sm:block text-left">
                      <div className="text-[9px] font-black uppercase text-zinc-400 leading-none mb-1">Target Cluster</div>
                      <div className="text-xs font-black text-zinc-900 dark:text-white leading-none flex items-center gap-2 tracking-tight">
                        Select Cluster
                      </div>
                    </div>
                  </>
                )}
                <ChevronsUpDown className="w-4 h-4 text-zinc-400 ml-1" />
              </button>

              {isClusterMenuOpen && (
                <div className="absolute top-full left-0 mt-3 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-150 origin-top-left z-50">
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Control Plane Fleet</p>
                  </div>
                  {clusters.map(cluster => (
                    <button
                      key={cluster.id}
                      onClick={() => { setSelectedCluster(cluster); setIsClusterMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left ${selectedCluster?.id === cluster.id ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                    >
                      <ProviderIcon provider={cluster.provider} className="w-5 h-5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${selectedCluster?.id === cluster.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-300'}`}>{cluster.name}</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase">{cluster.region} • {cluster.provider}</p>
                      </div>
                      {selectedCluster?.id === cluster.id && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </button>
                  ))}
                  <div className="h-px bg-zinc-100 dark:border-zinc-800 my-2" />
                  <button
                    onClick={() => { setIsRegisterModalOpen(true); setIsClusterMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Register New Cluster
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-full border border-zinc-200 dark:border-zinc-700">
              <div className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${apiStatus === 'Connected' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${apiStatus === 'Connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </div>

              <button
                onClick={() => navigate('/notifications')}
                className="relative p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all shadow-sm"
              >
                <Bell className="w-5 h-5" />
                {unreadReports > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 text-[8px] font-bold text-white items-center justify-center">{unreadReports}</span>
                  </span>
                )}
              </button>
              <span className="text-[10px] font-black uppercase text-zinc-500">{apiLatency}ms <span className="opacity-40">IO</span></span>
            </div>

            <button onClick={toggleTheme} className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all shadow-sm">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="relative" ref={userMenuRef}>
              <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 p-0.5 shadow-lg active:scale-95 transition-transform">
                <div className="w-full h-full rounded-[10px] bg-white dark:bg-zinc-900 flex items-center justify-center font-bold text-zinc-900 dark:text-white text-xs">{(user?.email || "AU").substring(0, 2).toUpperCase()}</div>
              </button>
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-3 w-60 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 mb-2">
                    <p className="font-bold text-sm">{user?.email || "Admin User"}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">{user?.role || "SRE Lead"}</p>
                  </div>
                  <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"><Settings className="w-4 h-4" /> Preferences</button>
                  <button onClick={selectApiKey} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"><Key className="w-4 h-4" /> API Credentials</button>
                  <button onClick={() => window.open('/api/reports/compliance', '_blank')} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"><FileText className="w-4 h-4" /> Download SOC2 Report</button>
                  <div className="h-px bg-zinc-100 dark:border-zinc-800 my-2" />
                  <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"><LogOut className="w-4 h-4" /> Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl h-full">
            {/* Router Outlet for Page Content */}
            {children || <Outlet />}
          </div>
        </div>
      </div>
    </div>
  );
};