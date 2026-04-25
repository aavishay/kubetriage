import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Workload, Cluster, NotificationChannel, AlertRule, TriggeredAlert } from '../types';
import { fetchWithOffline } from '../services/fetchWithOffline';

interface MonitoringContextType {
  workloads: Workload[];
  clusters: Cluster[];
  selectedCluster: Cluster | null;
  notificationChannels: NotificationChannel[];
  alertRules: AlertRule[];
  triggeredAlerts: TriggeredAlert[];
  isWorkloadsLoading: boolean;
  hasApiKey: boolean;
  isCheckingKey: boolean;
  activeNotification: TriggeredAlert | null;
  unreadReports: number;
  refreshClusters: () => Promise<void>;
  refreshWorkloads: () => Promise<void>;
  metricsWindow: string;
  setMetricsWindow: (window: string) => void;

  // Notification Config
  notificationSettings: { toastEnabled: boolean; toastFrequency: number };
  updateNotificationSettings: (settings: { toastEnabled: boolean; toastFrequency: number }) => void;

  // Refresh Config
  refreshInterval: number; // in seconds
  setRefreshInterval: (interval: number) => void;

  // AI Config
  aiConfig: { provider: string; model: string };
  updateAIConfig: (config: { provider: string; model: string }) => void;

  // Actions
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
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('kt_theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kt_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kt_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- Core Data State ---
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [metricsWindow, setMetricsWindow] = useState<string>('1h');
  const [isWorkloadsLoading, setIsWorkloadsLoading] = useState(false);

  // Refresh interval state (must be declared before useEffect that uses it)
  const [refreshInterval, setRefreshIntervalState] = useState<number>(() => {
    if (typeof localStorage === 'undefined' || !localStorage.getItem) return 30;
    const saved = localStorage.getItem('refresh_interval');
    return saved ? parseInt(saved, 10) : 30;
  });
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(() => {
    if (typeof localStorage === 'undefined' || !localStorage.getItem) return null;
    const saved = localStorage.getItem('selected_cluster');
    return saved ? JSON.parse(saved) : null;
  });

  // Persist selected cluster
  useEffect(() => {
    if (selectedCluster) {
      localStorage.setItem('selected_cluster', JSON.stringify(selectedCluster));
    }
  }, [selectedCluster]);

  const [unreadReports, setUnreadReports] = useState<number>(0);

  // Fetch Clusters
  const refreshClusters = useCallback(async () => {
    try {
      const response = await fetchWithOffline('/api/clusters');
      if (response.ok) {
        const data = await response.json();
        const mappedClusters = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          displayName: c.displayName || c.name,
          provider: c.provider || 'On-Prem',
          status: c.status || 'Active',
          region: 'local',
        }));

        if (mappedClusters.length > 0) {
          setClusters(mappedClusters);
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
        const res = await fetchWithOffline('/api/reports');
        if (res.ok) {
          const data = await res.json();
          setUnreadReports(data.filter((r: any) => !r.IsRead).length);
        }
      } catch (e) { console.error(e); }
    };
    fetchReports();
    const interval = setInterval(fetchReports, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchWorkloads = async () => {
      const cacheKey = `cache_workloads_${selectedCluster?.id || ''}_${metricsWindow}`;
      const cached = (typeof localStorage !== 'undefined' && localStorage.getItem) ? localStorage.getItem(cacheKey) : null;
      if (cached) {
        setWorkloads(JSON.parse(cached));
      } else {
        setWorkloads([]);
      }

      if (!selectedCluster) return;

      setIsWorkloadsLoading(true);
      try {
        const response = await fetchWithOffline(`/api/cluster/workloads?cluster=${selectedCluster.id}&window=${metricsWindow}`);
        if (response.ok) {
          const data = await response.json();
          const workloadsWithEvents = Array.isArray(data) ? data.map((w: any) => ({
            ...w,
            events: w.events || []
          })) : [];
          setWorkloads(workloadsWithEvents);
          localStorage.setItem(cacheKey, JSON.stringify(workloadsWithEvents));
        }
      } catch (err) {
        console.error("Error fetching workloads", err);
      } finally {
        setIsWorkloadsLoading(false);
      }
    };
    fetchWorkloads();
  }, [selectedCluster, metricsWindow]);

  const refreshWorkloads = useCallback(async () => {
    if (!selectedCluster) return;
    setIsWorkloadsLoading(true);
    try {
      const response = await fetchWithOffline(`/api/cluster/workloads?cluster=${selectedCluster.id}&window=${metricsWindow}`);
      if (response.ok) {
        const data = await response.json();
        const workloadsWithEvents = Array.isArray(data) ? data.map((w: any) => ({
          ...w,
          events: w.events || []
        })) : [];
        setWorkloads(workloadsWithEvents);
        localStorage.setItem(`cache_workloads_${selectedCluster.id}_${metricsWindow}`, JSON.stringify(workloadsWithEvents));
      }
    } catch (err) {
      console.error("Error refreshing workloads", err);
    } finally {
      setIsWorkloadsLoading(false);
    }
  }, [selectedCluster, metricsWindow]);

  // Auto-refresh workloads based on refreshInterval
  useEffect(() => {
    if (!selectedCluster || refreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      refreshWorkloads();
    }, refreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [selectedCluster, refreshInterval, refreshWorkloads]);

  // --- Notifications & Alerting State ---
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>(() => {
    if (typeof localStorage === 'undefined' || !localStorage.getItem) return [];
    const saved = localStorage.getItem('notification_channels');
    return saved ? JSON.parse(saved) : [];
  });

  const [alertRules, setAlertRules] = useState<AlertRule[]>(() => {
    if (typeof localStorage === 'undefined' || !localStorage.getItem) return [];
    const saved = localStorage.getItem('alert_rules');
    return saved ? JSON.parse(saved) : [];
  });

  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>(() => {
    if (typeof localStorage === 'undefined' || !localStorage.getItem) return [];
    const saved = localStorage.getItem('triggered_alerts_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeNotification, setActiveNotification] = useState<TriggeredAlert | null>(null);

  const [notificationSettings, setNotificationSettings] = useState(() => {
    if (typeof localStorage === 'undefined' || !localStorage.getItem) return { toastEnabled: false, toastFrequency: 5 };
    const saved = localStorage.getItem('notification_settings');
    return saved ? JSON.parse(saved) : { toastEnabled: false, toastFrequency: 5 };
  });

  const [aiConfig, setAiConfig] = useState<{ provider: string; model: string }>(() => {
    if (typeof localStorage === 'undefined' || !localStorage.getItem) return { provider: 'ollama', model: 'llama3:latest' };
    const saved = localStorage.getItem('ai_config');
    return saved ? JSON.parse(saved) : { provider: 'ollama', model: 'llama3:latest' };
  });

  const [lastToastTime, setLastToastTime] = useState(0);

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

  useEffect(() => {
    localStorage.setItem('ai_config', JSON.stringify(aiConfig));
  }, [aiConfig]);

  useEffect(() => {
    localStorage.setItem('refresh_interval', refreshInterval.toString());
  }, [refreshInterval]);

  const setRefreshInterval = useCallback((interval: number) => {
    setRefreshIntervalState(Math.max(10, Math.min(300, interval))); // Clamp between 10s and 300s
  }, []);

  const updateNotificationSettings = (settings: { toastEnabled: boolean; toastFrequency: number }) => {
    setNotificationSettings(settings);
  };

  const updateAIConfig = (config: { provider: string; model: string }) => {
    setAiConfig(config);
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
      const res = await fetchWithOffline(`/api/clusters/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setClusters(prev => prev.filter(c => c.id !== id));
        if (selectedCluster?.id === id) {
          const remaining = clusters.filter(c => c.id !== id);
          if (remaining.length > 0) {
            setSelectedCluster(remaining[0]);
          } else {
            setSelectedCluster(null);
          }
        }
      }
    } catch (e) {
      console.error("Failed to delete cluster", e);
    }
  };

  const checkAlertRules = useCallback((currentWorkloads: Workload[]) => {
    const newAlerts: TriggeredAlert[] = [];
    alertRules.forEach(rule => {
      if (!rule.enabled) return;
      currentWorkloads.forEach(workload => {
        let saturationValue = 0;
        if (rule.metric === 'CPU') {
          const base = workload.metrics.cpuLimit;
          saturationValue = base > 0 ? (workload.metrics.cpuUsage / base) * 100 : 0;
        } else if (rule.metric === 'Memory') {
          const base = workload.metrics.memoryLimit;
          saturationValue = base > 0 ? (workload.metrics.memoryUsage / base) * 100 : 0;
        }
        if (rule.operator === '>' ? saturationValue > rule.threshold : saturationValue < rule.threshold) {
          const lastAlert = triggeredAlerts.find(a => a.ruleId === rule.id && a.workloadName === workload.name);
          if (!lastAlert || (Date.now() - lastAlert.timestamp > 30000)) {
            newAlerts.push({
              id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              ruleId: rule.id,
              ruleName: rule.name,
              workloadName: workload.name,
              workloadId: workload.id,
              metric: rule.metric,
              value: parseFloat(saturationValue.toFixed(1)),
              threshold: rule.threshold,
              timestamp: Date.now(),
              severity: rule.severity,
              channelsNotified: rule.channels
            });
          }
        }
      });
    });

    if (newAlerts.length > 0) {
      setTriggeredAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
      if (notificationSettings.toastEnabled) {
        const now = Date.now();
        if ((now - lastToastTime) / 1000 >= notificationSettings.toastFrequency) {
          setActiveNotification(newAlerts[newAlerts.length - 1]);
          setLastToastTime(now);
          setTimeout(() => setActiveNotification(null), 8000);
        }
      }
    }
  }, [alertRules, triggeredAlerts, notificationSettings, lastToastTime]);

  // Simulate real-time metric updates
  // Only update when CPU/memory changes by more than 0.5% of base to avoid no-op re-renders
  const METRIC_CHANGE_THRESHOLD = 0.005;
  useEffect(() => {
    const interval = setInterval(() => {
      setWorkloads(prev => {
        let changed = false;
        const updated = prev.map(w => {
          const baseCpu = (w.metrics?.cpuLimit > 0 ? w.metrics.cpuLimit : (w.metrics?.cpuRequest > 0 ? w.metrics.cpuRequest : 1));
          const baseMem = (w.metrics?.memoryLimit > 0 ? w.metrics.memoryLimit : (w.metrics?.memoryRequest > 0 ? w.metrics.memoryRequest : 100));
          const cpuVar = (Math.random() * 0.1 - 0.05) * baseCpu;
          const memVar = (Math.random() * 0.04 - 0.02) * baseMem;
          const newCpu = Math.max(0, (w.metrics?.cpuUsage || 0) + cpuVar);
          const newMem = Math.max(0, (w.metrics?.memoryUsage || 0) + memVar);

          // Skip update if changes are below threshold
          const cpuDelta = Math.abs(newCpu - (w.metrics?.cpuUsage || 0)) / (baseCpu || 1);
          const memDelta = Math.abs(newMem - (w.metrics?.memoryUsage || 0)) / (baseMem || 1);
          if (cpuDelta < METRIC_CHANGE_THRESHOLD && memDelta < METRIC_CHANGE_THRESHOLD) {
            return w;
          }

          changed = true;
          return {
            ...w,
            metrics: {
              cpuUsage: newCpu,
              memoryUsage: newMem,
              cpuRequest: w.metrics?.cpuRequest || 0,
              cpuLimit: w.metrics?.cpuLimit || 0,
              memoryRequest: w.metrics?.memoryRequest || 0,
              memoryLimit: w.metrics?.memoryLimit || 0,
              storageRequest: w.metrics?.storageRequest || 0,
              storageLimit: w.metrics?.storageLimit || 0,
              storageUsage: w.metrics?.storageUsage || 0,
              networkIn: w.metrics?.networkIn || 0,
              networkOut: w.metrics?.networkOut || 0,
              diskIo: w.metrics?.diskIo || 0,
            }
          };
        });
        if (changed) {
          checkAlertRules(updated);
          return updated;
        }
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [checkAlertRules]);

  useEffect(() => {
    const checkKey = async () => {
      setIsCheckingKey(true);
      try {
        if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
          setHasApiKey(await (window as any).aistudio.hasSelectedApiKey());
        } else {
          setHasApiKey(true);
        }
      } catch (e) {
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
      notificationChannels,
      alertRules,
      triggeredAlerts,
      isWorkloadsLoading,
      hasApiKey,
      isCheckingKey,
      activeNotification,
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
      metricsWindow,
      setMetricsWindow,
      notificationSettings,
      updateNotificationSettings,
      aiConfig,
      updateAIConfig,
      removeCluster,
      refreshInterval,
      setRefreshInterval,
    }}>
      {children}
    </MonitoringContext.Provider>
  );
};
