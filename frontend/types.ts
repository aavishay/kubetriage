
export interface ResourceMetrics {
  cpuRequest: number; // in cores
  cpuLimit: number;
  cpuUsage: number;
  memoryRequest: number; // in MiB
  memoryLimit: number;
  memoryUsage: number;
  storageRequest?: number; // in GiB
  storageLimit?: number;
  storageUsage?: number;
  networkIn: number; // MB/s
  networkOut: number; // MB/s
  diskIo: number; // MB/s
  cpuAvg?: number;
  cpuP95?: number;
  cpuP99?: number;
  memoryAvg?: number;
  memoryP95?: number;
  memoryP99?: number;
}

export interface K8sEvent {
  id: string;
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  lastSeen: string;
}

export interface ProvisioningInfo {
  enabled: boolean;
  nodePools: string[];
  nodeClaims: string[];
  misconfigurations?: string[];
}

export interface Workload {
  id: string;
  name: string;
  namespace: string;
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet' | 'ScaledJob';
  replicas: number;
  availableReplicas: number;
  status: 'Healthy' | 'Warning' | 'Critical';
  metrics: ResourceMetrics;
  recentLogs: string[];
  podNames: string[];
  events: K8sEvent[];
  costPerMonth: number;
  recommendation?: {
    action: 'Upsize' | 'Downsize' | 'None';
    confidence: number;
    reason: string;
  };
  scaling?: ScalingInfo;
  schedulerLogs?: string[];
  provisioning?: ProvisioningInfo;
}

export interface KedaConfig {
  name: string;
  triggers: string[];
}

export interface ScalingInfo {
  enabled: boolean;
  min: number;
  max: number;
  current: number;
  kedaReady: boolean;
  active?: boolean;
  paused?: boolean;
  fallback?: boolean;
  config?: KedaConfig;
  misconfigurations?: string[];
}

export interface Cluster {
  id: string;
  name: string;
  region: string;
  provider: 'GKE' | 'EKS' | 'AKS' | 'On-Prem';
  status: 'Active' | 'Degraded' | 'Offline' | 'Pending';
  connectionToken?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'Free' | 'Team' | 'Enterprise';
  status: 'Active' | 'Suspended';
  createdAt: string;
  region: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  status: 'Active' | 'Inactive';
  lastActive: string;
  avatarUrl?: string;
}

export type NotificationType = 'Slack' | 'Webhook' | 'GoogleChat' | 'PagerDuty' | 'Email' | 'MicrosoftTeams';

export interface NotificationChannel {
  id: string;
  name: string;
  type: NotificationType;
  target: string; // Webhook URL, Email address, or Channel ID
  status: 'Active' | 'Inactive' | 'Error';
  lastTriggered?: string;
  events: ('Critical' | 'Warning' | 'Healthy')[];
}

export interface AlertRule {
  id: string;
  name: string;
  metric: 'CPU' | 'Memory' | 'ErrorRate' | 'Cost' | 'Storage';
  operator: '>' | '<';
  threshold: number;
  severity: 'Critical' | 'Warning' | 'Info';
  channels: string[]; // Channel IDs
  enabled: boolean;
  namespace?: string; // Optional scope
}

export interface TriggeredAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  workloadName: string;
  workloadId: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  severity: 'Critical' | 'Warning' | 'Info';
  channelsNotified: string[];
}

export type ViewState = 'dashboard' | 'triage' | 'rightsizing' | 'topology' | 'organizations' | 'users' | 'notifications' | 'templates';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

// Props for views that can trigger the AI Assistant
export interface ViewPropsWithChat {
  workloads: Workload[];
  isDarkMode?: boolean;
  onOpenChat: (initialContext: string) => void;
  defaultTemplate?: string;
}

// Templates
export type OptimizationProfile = 'Balanced' | 'Cost-Saver' | 'Performance' | 'Burstable' | 'Density';
export type DiagnosticPlaybook = 'General Health' | 'Network Connectivity' | 'Security Audit' | 'Resource Constraints' | 'Data Integrity' | 'Scheduling & Affinity';

export interface Playbook {
  id: string;
  name: string;
  description: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentUser {
  ID: string;
  Email: string;
  AvatarURL?: string;
}

export interface Comment {
  ID: string;
  UserID: string;
  User?: CommentUser;
  Content: string;
  ReportID?: number;
  ClusterID?: string;
  Namespace?: string;
  WorkloadName?: string;
  CreatedAt: string;
}
