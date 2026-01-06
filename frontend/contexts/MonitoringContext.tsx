import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Workload, Cluster, Organization, User, NotificationChannel, AlertRule, TriggeredAlert } from '../types';
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
  selectedCluster: Cluster;
  organizations: Organization[];
  users: User[];
  notificationChannels: NotificationChannel[];
  alertRules: AlertRule[];
  triggeredAlerts: TriggeredAlert[];
  isAuthenticated: boolean;
  hasApiKey: boolean;
  isCheckingKey: boolean;
  activeNotification: TriggeredAlert | null;

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
  const [workloads, setWorkloads] = useState<Workload[]>([]); // Initialize empty, fetch real data
  const [clusters, setClusters] = useState<Cluster[]>(MOCK_CLUSTERS);
  const [selectedCluster, setSelectedCluster] = useState<Cluster>(MOCK_CLUSTERS[0]);
  const [organizations, setOrganizations] = useState<Organization[]>(MOCK_ORGANIZATIONS);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);

  // Fetch Workloads
  useEffect(() => {
    const fetchWorkloads = async () => {
      try {
        const response = await fetch('/api/cluster/workloads');
        if (response.ok) {
          const data = await response.json();
          setWorkloads(data);
        } else {
          console.error("Failed to fetch workloads, falling back to mocks");
          setWorkloads(MOCK_WORKLOADS);
        }
      } catch (err) {
        console.error("Error fetching workloads", err);
        setWorkloads(MOCK_WORKLOADS);
      }
    };
    fetchWorkloads();
  }, []);

  // --- Notifications & Alerting State ---
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>(MOCK_NOTIFICATION_CHANNELS);
  const [alertRules, setAlertRules] = useState<AlertRule[]>(MOCK_ALERT_RULES);
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([]);
  const [activeNotification, setActiveNotification] = useState<TriggeredAlert | null>(null);

  // --- Helpers ---
  const login = () => setIsAuthenticated(true);
  const logout = () => setIsAuthenticated(false);

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
          saturatedValue = (value / workload.metrics.cpuLimit) * 100;
        } else if (rule.metric === 'Memory') {
          value = workload.metrics.memoryUsage;
          saturatedValue = (value / workload.metrics.memoryLimit) * 100;
        } else if (rule.metric === 'Storage') {
          value = workload.metrics.storageUsage;
          saturatedValue = (value / workload.metrics.storageLimit) * 100;
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
              // memoryUsage: Math.min(w.metrics.memoryLimit, Math.max(0, w.metrics.memoryUsage + (w.metrics.memoryLimit * memVar)))
              // Simplified mock update
              memoryUsage: Math.max(0, w.metrics.memoryUsage + (Math.random() > 0.5 ? 10 : -10))
            }
          };
        });
        checkAlertRules(updated);
        return updated;
      });
    }, 5000);

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
      toggleTheme
    }}>
      {children}
    </MonitoringContext.Provider>
  );
};
