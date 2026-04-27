
export interface TriageReport {
  ID: number;
  ClusterID: string;
  WorkloadName: string;
  Analysis: string; // The full markdown content
  Severity: string;
  IsRead: boolean;
  CreatedAt: string;
  AutoRemediationPayload?: string;
  ApprovalStatus?: string;
  IncidentType?: string;
}

export const isSecurityReport = (report: TriageReport): boolean => {
  const isSecurityType = report.IncidentType &&
    (report.IncidentType.includes('Privileged') ||
     report.IncidentType.includes('Root') ||
     report.IncidentType.includes('Security'));
  const isSecurityAnalysis = (report.Analysis || '').includes('Security Violation');
  return isSecurityType || isSecurityAnalysis;
};

export const getMetricStatusColor = (value: number) => {
  if (value > 90) return 'bg-rose-500 shadow-[0_0_8px_var(--kt-status-critical)]';
  if (value > 70) return 'bg-amber-500 shadow-[0_0_8px_var(--kt-status-warning)]';
  return 'bg-emerald-500 shadow-[0_0_8px_var(--kt-status-healthy)]';
};

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
  // GPU Metrics
  gpuRequest?: number; // Number of GPUs requested
  gpuLimit?: number; // Number of GPUs limited
  gpuUsage?: number; // Watts
  gpuMemoryUsage?: number; // MiB
  gpuMemoryTotal?: number; // MiB
  gpuUtilization?: number; // Percentage 0-100
  gpuTemperature?: number; // Celsius
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
  clusterId: string;
  name: string;
  namespace: string;
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet' | 'ScaledJob';
  replicas: number;
  availableReplicas: number;
  podCount: number; // Actual count of pods matching the selector
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
  displayName: string;
  region: string;
  provider: 'GKE' | 'EKS' | 'AKS' | 'On-Prem';
  status: 'Active' | 'Degraded' | 'Offline' | 'Pending';
  connectionToken?: string;
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

export type ViewState = 'dashboard' | 'triage' | 'rightsizing' | 'scaling' | 'topology' | 'organizations' | 'users' | 'notifications' | 'templates';

// Karpenter/KEDA Efficiency Metrics
export interface KarpenterEfficiencyMetrics {
  nodePoolName: string;
  instanceTypes: string[];
  totalNodes: number;
  readyNodes: number;
  pendingNodeClaims: number;
  driftedNodes: number;
  utilizationPercent: number;
  binPackingEfficiency: number;
  costPerCPU: number;
  costPerGBMemory: number;
  scaleUpLatencyAvg: number; // milliseconds
  consolidationEnabled: boolean;
  disruptionBudgets: Record<string, string>;
  misconfigurations?: string[];
}

// Unified Provisioner Types (supports AWS Karpenter, Azure NAP, etc.)
export type ProvisionerType = 'karpenter' | 'azure-nap' | 'aks-managed' | 'cluster-autoscaler';
export type CloudProvider = 'aws' | 'azure' | 'gcp';

export interface AzureNodePoolDetails {
  mode?: string; // System, User
  osDiskType?: string;
  osDiskSizeGB?: number;
  maxPods?: number;
  availabilityZones?: string[];
  scaleSetPriority?: string;
  enableAutoScaling?: boolean;
}

export interface AWSNodePoolDetails {
  capacityType?: string; // spot, on-demand
  instanceProfile?: string;
  subnetSelector?: Record<string, string>;
}

export interface UnifiedNodePool {
  name: string;
  provisionerType: ProvisionerType;
  provider: CloudProvider;
  instanceTypes?: string[];
  vmSizeNames?: string[];
  totalNodes: number;
  readyNodes: number;
  pendingNodes: number;
  driftedNodes: number;
  utilizationPercent: number;
  binPackingEfficiency: number;
  costPerCPU: number;
  costPerGBMemory: number;
  totalMonthlyCost?: number;
  totalCPUs?: number;
  totalMemoryGB?: number;
  consolidationEnabled: boolean;
  disruptionBudgets?: Record<string, string>;
  misconfigurations?: string[];
  azureConfig?: AzureNodePoolDetails;
  awsConfig?: AWSNodePoolDetails;

  // Karpenter NodeClass reference
  nodeClass?: string;

  // Creation timestamp for age calculation
  creationTimestamp?: string;
}

export interface ProvisionerSummary {
  totalProvisioners: number;
  totalNodePools: number;
  totalNodes: number;
  readyNodes: number;
  avgUtilization: number;
  avgBinPackingEfficiency: number;
  costOptimizedCount: number;
  issuesFound: number;
}

export interface UnifiedProvisionerMetrics {
  provisionerType: ProvisionerType;
  provider: CloudProvider;
  nodePools: UnifiedNodePool[];
  summary: ProvisionerSummary;
}

export interface KEDATriggerInfo {
  type: string;
  metricName: string;
  targetValue: number;
  currentValue: number;
  triggerLatency: number; // milliseconds
}

// HPA (Horizontal Pod Autoscaler) Metrics
export interface HPAScaleTargetRef {
  apiVersion: string;
  kind: string;
  name: string;
}

export interface HPAMetricStatus {
  currentUtilization: number;
  targetUtilization: number;
}

export interface HPACustomMetric {
  name: string;
  type: string;
  currentValue: number;
  targetValue: number;
  targetAverage: boolean;
}

export interface HPAMetrics {
  name: string;
  namespace: string;
  scaleTargetRef: HPAScaleTargetRef;
  minReplicas: number;
  maxReplicas: number;
  currentReplicas: number;
  desiredReplicas: number;
  cpuUtilization?: HPAMetricStatus;
  memoryUtilization?: HPAMetricStatus;
  customMetrics?: HPACustomMetric[];
  isActive: boolean;
  ableToScale: boolean;
  scalingLimited: boolean;
  lastScaleTime?: string;
  misconfigurations?: string[];
}

export interface KEDAEfficiencyMetrics {
  workloadName: string;
  namespace: string;
  scaleTargetType: string;
  minReplicas: number;
  maxReplicas: number;
  currentReplicas: number;
  desiredReplicas: number;
  triggerTypes: KEDATriggerInfo[];
  efficiencyScore: number; // 0-100
  timeAtMinPercent: number;
  timeAtMaxPercent: number;
  scaleUpLatency: number; // milliseconds
  cooldownEfficiency: number;
  eventsPerSecond: number;
  isReady: boolean;
  isActive: boolean;
  isFallback: boolean;
  misconfigurations?: string[];
}

export interface EfficiencySummary {
  totalNodePools: number;
  totalKedaScalers: number;
  totalHpaScalers: number;
  avgNodeUtilization: number;
  avgBinPackingEfficiency: number;
  totalCostOptimized: number;
  issuesFound: number;
}

// Multi-Cluster Federation Types
export interface ClusterStatus {
  id: string;
  name: string;
  displayName?: string;
  status: 'Healthy' | 'Degraded' | 'Offline';
  provider: string;
  region: string;
  version: string;
  lastConnected: string;
  nodeCount: number;
  healthyNodeCount: number;
  workloadCount: number;
  incidentCount: number;
  totalCpu: number;
  totalMemory: number;
  usedCpu: number;
  usedMemory: number;
  labels: Record<string, string>;
}

export interface AggregatedWorkload {
  id: string;
  name: string;
  namespace: string;
  kind: string;
  clusterId: string;
  clusterName: string;
  status: 'Healthy' | 'Warning' | 'Critical';
  replicas: number;
  availableReplicas: number;
  cpuUsage: number;
  memoryUsage: number;
  costPerMonth: number;
  hasIncidents: boolean;
  labels: Record<string, string>;
}

export interface AffectedWorkload {
  workloadId: string;
  name: string;
  namespace: string;
  clusterId: string;
  clusterName: string;
}

export interface CrossClusterIncident {
  id: string;
  title: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Active' | 'Resolved' | 'Investigating';
  affectedClusters: string[];
  affectedWorkloads: AffectedWorkload[];
  startedAt: string;
  resolvedAt?: string;
  rootCause?: string;
  pattern: 'Cascading' | 'Correlated' | 'Isolated';
}

export interface GlobalSummary {
  totalClusters: number;
  healthyClusters: number;
  degradedClusters: number;
  offlineClusters: number;
  totalWorkloads: number;
  healthyWorkloads: number;
  warningWorkloads: number;
  criticalWorkloads: number;
  activeIncidents: number;
  criticalIncidents: number;
  totalCpu: number;
  totalMemory: number;
  cpuUtilization: number;
  memoryUtilization: number;
  estimatedMonthlyCost: number;
}

export interface ScalingEfficiencyResponse {
  clusterId: string;
  timestamp: string;
  karpenterMetrics: KarpenterEfficiencyMetrics[];
  kedaMetrics: KEDAEfficiencyMetrics[];
  hpaMetrics: HPAMetrics[];
  summary: EfficiencySummary;

  // Unified provisioner support (new fields for Azure NAP and multi-provider)
  unifiedProvisioners?: UnifiedProvisionerMetrics[];
  detectedProvisioners?: string[]; // List of detected provisioner types
}

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

export interface Recipe {
  ID: string;
  Name: string;
  Description: string;
  TriggerType: string;
  TriggerConfig: string;
  ActionType: string;
  IsEnabled: boolean;
  CreatedAt: string;
}

export interface Comment {
  ID: string;
  Author: string;
  AuthorAvatar?: string;
  Content: string;
  ReportID?: number;
  ClusterID?: string;
  Namespace?: string;
  WorkloadName?: string;
  CreatedAt: string;
}

// GitOps Types
export interface GitOpsCondition {
  type: string;
  status: string;
  reason: string;
  message: string;
  lastTransitionTime?: string;
}

export interface GitOpsResource {
  tool: 'ArgoCD' | 'Flux';
  kind: string;
  name: string;
  namespace: string;
  syncStatus: string;
  healthStatus: string;
  lastSyncTime: string;
  revision: string;
  sourceUrl: string;
  message: string;
  conditions: GitOpsCondition[];
  resourceCount: number;
  readyResources: number;
  syncErrors?: string[];
  misconfigurations?: string[];
}

export interface GitOpsSummary {
  total: number;
  synced: number;
  outOfSync: number;
  degraded: number;
  progressing: number;
  suspended: number;
  unknown: number;
}

export interface GitOpsStatusResponse {
  clusterId: string;
  timestamp: string;
  argocd: GitOpsResource[];
  flux: GitOpsResource[];
  summary: GitOpsSummary;
}

// NodeClaim Types
export interface NodeClaim {
  name: string;
  namespace: string;
  nodePool: string;
  provisionerType: 'karpenter' | 'azure-nap' | 'cluster-autoscaler';
  status: 'Pending' | 'Ready' | 'Drifted' | 'Expired' | 'Terminating' | 'Unknown';
  nodeName?: string;
  instanceType?: string;
  zone?: string;
  capacityType?: string;
  age: number; // seconds
  conditions: GitOpsCondition[];
  launchTime?: string;
  registrationTime?: string;
  misconfigurations?: string[];
}

export interface NodeClaimsSummary {
  total: number;
  ready: number;
  pending: number;
  drifted: number;
  expired: number;
  terminating: number;
  unknown: number;
  avgProvisioningTimeSec: number;
  stuckPendingCount: number;
}

export interface NodeClaimsResponse {
  clusterId: string;
  timestamp: string;
  claims: NodeClaim[];
  summary: NodeClaimsSummary;
}

// Capacity Planning Types
export interface CapacityForecastPoint {
  timestamp: string;
  value: number;
}

export interface CapacityPlan {
  workloadKey: string;
  namespace: string;
  cluster: string;
  metric: 'cpu' | 'memory' | 'network' | 'disk';
  historicalPoints: CapacityForecastPoint[];
  forecastPoints: CapacityForecastPoint[];
  trendSlope: number;
  trendIntercept: number;
  timeToExhaustionHours: number | null;
  recommendation: string;
  confidence: number;
  severity: 'Critical' | 'Warning' | 'Healthy';
}

export interface CapacityPlansResponse {
  timestamp: string;
  plans: CapacityPlan[];
  count: number;
  criticalCount: number;
  warningCount: number;
}
