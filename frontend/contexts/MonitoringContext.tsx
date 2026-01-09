import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Workload, Cluster, Organization, User, NotificationChannel, AlertRule, TriggeredAlert } from '../types';
import { useAuth } from './AuthContext';
import {
  MOCK_WORKLOADS,
  MOCK_CLUSTERS,
  MOCK_ORGANIZATIONS,
  MOCK_USERS,
  MOCK_NOTIFICATION_CHANNELS,
  MOCK_ALERT_RULES
} from '../constants';

interface MonitoringContextType {
  workloads: Workload[];
  clusters: Cluster[];
  selectedCluster: Cluster | null;
  organizations: Organization[];
  users: User[];
  notificationChannels: NotificationChannel[];
  alertRules: AlertRule[];
  triggeredAlerts: TriggeredAlert[];
  isAuthenticated: boolean;
  isAuthLoading: boolean; // Added loading state
  isWorkloadsLoading: boolean; // Added
  hasApiKey: boolean;
  isCheckingKey: boolean;
  activeNotification: TriggeredAlert | null;
  unreadReports: number;
  refreshClusters: () => Promise<void>;
  refreshWorkloads: () => Promise<void>;

  // Notification Config
  notificationSettings: { toastEnabled: boolean; toastFrequency: number };
  updateNotificationSettings: (settings: { toastEnabled: boolean; toastFrequency: number }) => void;

  // AI Config
  aiConfig: { provider: string; model: string };
  updateAIConfig: (config: { provider: string; model: string }) => void;

  // Actions
  login: () => void;
  logout: () => void;
  selectApiKey: () => Promise<void>;
  setSelectedCluster: (cluster: Cluster) => void;
  addCluster: (cluster: Cluster) => void;
  addChannel: (channel: NotificationChannel) => void;
  updateChannel: (channel: NotificationChannel) => void;
  deleteChannel: (id: string) => void;
  addAlertRule: (rule: AlertRule) => void;
  updateAlertRule: (rule: AlertRule) => void;
  deleteAlertRule: (id: string) => void;
  dismissNotification: () => void;
  removeCluster: (id: string) => Promise<void>;

  // Theme
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const MonitoringContext = createContext<MonitoringContextType | undefined>(undefined);

export const useMonitoring = () => {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoring must be used within a MonitoringProvider');
  }
  return context;
};

interface MonitoringProviderProps {
  children: ReactNode;
}

export const MonitoringProvider: React.FC<MonitoringProviderProps> = ({ children }) => {
  // --- Auth & Config State ---
  // Consume AuthContext for source of truth
  const { isAuthenticated, isLoading: isAuthLoading, login: authLogin, logout: authLogout } = useAuth();

  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  // --- Theme State ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });
  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- Core Data State ---
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [isWorkloadsLoading, setIsWorkloadsLoading] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(() => {
    const saved = localStorage.getItem('selected_cluster');
    return saved ? JSON.parse(saved) : null;
  });

  // Persist selected cluster
  useEffect(() => {
    if (selectedCluster) {
      localStorage.setItem('selected_cluster', JSON.stringify(selectedCluster));
    }
  }, [selectedCluster]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [unreadReports, setUnreadReports] = useState<number>(0);

  // Fetch Workloads
  // Fetch Data
  const refreshClusters = useCallback(async () => {
    try {
      const response = await fetch('/api/clusters');
      if (response.ok) {
        const data = await response.json();
        // Map backend response to frontend Cluster type
        const mappedClusters = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          provider: c.provider || 'On-Prem',
          status: c.status || 'Active',
          region: 'local', // Default for now
        }));

        if (mappedClusters.length > 0) {
          setClusters(mappedClusters);
          // If we had a saved cluster, ensure it's still in the list, otherwise fallback to first
          setSelectedCluster(prev => {
            const stillExists = mappedClusters.find((c: any) => c.id === prev?.id);
            if (stillExists) return stillExists;
            return mappedClusters[0];
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch clusters", err);
    }
  }, []);

  useEffect(() => {
    refreshClusters();
  }, [refreshClusters]);

  // Poll for unread reports
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch('/api/reports');
        if (res.ok) {
          const data = await res.json();
          setUnreadReports(data.filter((r: any) => !r.IsRead).length);
        }
      } catch (e) { console.error(e); }
    };
    fetchReports();
    const interval = setInterval(fetchReports, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchWorkloads = async () => {
      // Clear current workloads when switching clusters to prevent stale data visibility
      // SWR: Load from cache first
      const cacheKey = `cache_workloads_${selectedCluster.id}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setWorkloads(JSON.parse(cached));
      } else {
        setWorkloads([]);
      }

      if (!selectedCluster) {
        return;
      }

      setIsWorkloadsLoading(true);

      try {
        const response = await fetch(`/api/cluster/workloads?cluster=${selectedCluster.id}`);
        if (response.ok) {
          const data = await response.json();
          const workloadsWithEvents = Array.isArray(data) ? data.map((w: any) => ({
            ...w,
            events: w.events || []
          })) : [];
          setWorkloads(workloadsWithEvents);
          // Cache successful response
          localStorage.setItem(cacheKey, JSON.stringify(workloadsWithEvents));
        } else {
          console.error("Failed to fetch workloads");
        }
      } catch (err) {
        console.error("Error fetching workloads", err);
      } finally {
        setIsWorkloadsLoading(false);
      }
    };
    fetchWorkloads();
  }, [selectedCluster]);

  const refreshWorkloads = useCallback(async () => {
    if (!selectedCluster) return;
    setIsWorkloadsLoading(true);
    try {
      const response = await fetch(`/api/cluster/workloads?cluster=${selectedCluster.id}`);
      if (response.ok) {
        const data = await response.json();
        const workloadsWithEvents = Array.isArray(data) ? data.map((w: any) => ({
          ...w,
          events: w.events || []
        })) : [];
        setWorkloads(workloadsWithEvents);
        localStorage.setItem(`cache_workloads_${selectedCluster.id}`, JSON.stringify(workloadsWithEvents));
      }
    } catch (err) {
      console.error("Error refreshing workloads", err);
    } finally {
      setIsWorkloadsLoading(false);
    }
  }, [selectedCluster]);

  // --- Notifications & Alerting State ---
  // --- Notifications & Alerting State ---
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>(() => {
    const saved = localStorage.getItem('notification_channels');
    return saved ? JSON.parse(saved) : MOCK_NOTIFICATION_CHANNELS;
  });

  const [alertRules, setAlertRules] = useState<AlertRule[]>(() => {
    const saved = localStorage.getItem('alert_rules');
    return saved ? JSON.parse(saved) : MOCK_ALERT_RULES;
  });

  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>(() => {
    const saved = localStorage.getItem('triggered_alerts_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeNotification, setActiveNotification] = useState<TriggeredAlert | null>(null);

  const [notificationSettings, setNotificationSettings] = useState(() => {
    const saved = localStorage.getItem('notification_settings');
    // Default to false as requested by user
    return saved ? JSON.parse(saved) : { toastEnabled: false, toastFrequency: 5 };
  });

  const [aiConfig, setAiConfig] = useState<{ provider: string; model: string }>(() => {
    const saved = localStorage.getItem('ai_config');
    return saved ? JSON.parse(saved) : { provider: 'ollama', model: 'llama3' };
  });

  const [lastToastTime, setLastToastTime] = useState(0);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('notification_channels', JSON.stringify(notificationChannels));
  }, [notificationChannels]);

  useEffect(() => {
    localStorage.setItem('alert_rules', JSON.stringify(alertRules));
  }, [alertRules]);

  useEffect(() => {
    localStorage.setItem('triggered_alerts_history', JSON.stringify(triggeredAlerts.slice(0, 50)));
  }, [triggeredAlerts]);

  useEffect(() => {
    localStorage.setItem('notification_settings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);


  const updateNotificationSettings = (settings: { toastEnabled: boolean; toastFrequency: number }) => {
    setNotificationSettings(settings);
  };

  useEffect(() => {
    localStorage.setItem('ai_config', JSON.stringify(aiConfig));
  }, [aiConfig]);

  // FIXME: Migration for users with broken Gemini default
  useEffect(() => {
    if (aiConfig.provider === 'gemini' && aiConfig.model === '') {
      setAiConfig({ provider: 'ollama', model: 'llama3' });
    }
  }, []);

  const updateAIConfig = (config: { provider: string; model: string }) => {
    setAiConfig(config);
  };

  // --- Helpers ---
  const login = async () => {
    await authLogin("user", "pass");
  };

  const logout = () => {
    authLogout();
  };

  const selectApiKey = async () => {
    if ((window as any).aistudio) {
      try {
        await (window as any).aistudio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("Failed to select key", e);
      }
    }
  };

  const addCluster = (newCluster: Cluster) => {
    setClusters(prev => [...prev, newCluster]);
    setSelectedCluster(newCluster);
  };

  const addChannel = (channel: NotificationChannel) => setNotificationChannels(prev => [...prev, channel]);
  const updateChannel = (updatedChannel: NotificationChannel) => setNotificationChannels(prev => prev.map(c => c.id === updatedChannel.id ? updatedChannel : c));
  const deleteChannel = (id: string) => setNotificationChannels(prev => prev.filter(c => c.id !== id));

  const addAlertRule = (rule: AlertRule) => setAlertRules(prev => [...prev, rule]);
  const updateAlertRule = (updatedRule: AlertRule) => setAlertRules(prev => prev.map(r => r.id === updatedRule.id ? updatedRule : r));
  const deleteAlertRule = (id: string) => setAlertRules(prev => prev.filter(r => r.id !== id));

  const dismissNotification = () => setActiveNotification(null);

  const removeCluster = async (id: string) => {
    try {
      const res = await fetch(`/api/clusters/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setClusters(prev => prev.filter(c => c.id !== id));
        if (selectedCluster?.id === id) {
          // Switch to another cluster or clear selection
          const remaining = clusters.filter(c => c.id !== id);
          if (remaining.length > 0) {
            setSelectedCluster(remaining[0]);
          } else {
            setSelectedCluster(null as any); // Force clear or handle empty state
          }
        }
      }
    } catch (e) {
      console.error("Failed to delete cluster", e);
    }
  };

  // --- Monitoring Engine Logic (Simulation) ---
  const checkAlertRules = useCallback((currentWorkloads: Workload[]) => {
    const newAlerts: TriggeredAlert[] = [];

    alertRules.forEach(rule => {
      if (!rule.enabled) return;

      currentWorkloads.forEach(workload => {
        let value = 0;
        let saturatedValue = 0; // percentage

        if (rule.metric === 'CPU') {
          value = workload.metrics.cpuUsage;
          saturatedValue = workload.metrics.cpuLimit > 0 ? (value / workload.metrics.cpuLimit) * 100 : 0;
        } else if (rule.metric === 'Memory') {
          value = workload.metrics.memoryUsage;
          saturatedValue = workload.metrics.memoryLimit > 0 ? (value / workload.metrics.memoryLimit) * 100 : 0;
        } else if (rule.metric === 'Storage') {
          value = workload.metrics.storageUsage;
          saturatedValue = workload.metrics.storageLimit > 0 ? (value / workload.metrics.storageLimit) * 100 : 0;
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
              workloadId: workload.id,
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

      // Check Global Notification Settings
      if (notificationSettings.toastEnabled) {
        const now = Date.now();
        const timeSinceLast = (now - lastToastTime) / 1000;

        if (timeSinceLast >= notificationSettings.toastFrequency) {
          setActiveNotification(newAlerts[newAlerts.length - 1]); // Show latest
          setLastToastTime(now);
          setTimeout(() => setActiveNotification(null), 8000);
        }
      }
    }
  }, [alertRules, triggeredAlerts, notificationSettings, lastToastTime]);

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
              ...(w.metrics || {
                cpuUsage: 0, memoryUsage: 0, cpuLimit: 1, memoryLimit: 1,
                cpuRequest: 0, memoryRequest: 0, storageRequest: 0,
                storageLimit: 0, storageUsage: 0, networkIn: 0,
                networkOut: 0, diskIo: 0
              }),
              cpuUsage: Math.min(w.metrics?.cpuLimit || 0, Math.max(0, (w.metrics?.cpuUsage || 0) + cpuVar)),
              memoryUsage: Math.max(0, (w.metrics?.memoryUsage || 0) + (Math.random() > 0.5 ? 10 : -10))
            }
          };
        });
        checkAlertRules(updated);
        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isAuthenticated, checkAlertRules]);

  // Check API Key
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

  return (
    <MonitoringContext.Provider value={{
      workloads,
      clusters,
      selectedCluster,
      organizations,
      users,
      notificationChannels,
      alertRules,
      triggeredAlerts,
      isAuthenticated,
      isAuthLoading, // Added
      isWorkloadsLoading,
      hasApiKey,
      isCheckingKey,
      activeNotification,
      login,
      logout,
      selectApiKey,
      setSelectedCluster,
      addCluster,
      addChannel,
      updateChannel,
      deleteChannel,
      addAlertRule,
      updateAlertRule,
      deleteAlertRule,
      dismissNotification,
      isDarkMode,
      toggleTheme,
      unreadReports,
      refreshClusters,
      refreshWorkloads,
      notificationSettings,
      updateNotificationSettings,
      aiConfig,
      updateAIConfig,
      removeCluster, // Exported
    }}>
      {children}
    </MonitoringContext.Provider>
  );
};
