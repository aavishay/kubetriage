
import { Workload, Cluster, Organization, User, NotificationChannel, AlertRule } from './types';

export const GEMINI_FAST_MODEL = 'gemini-flash-lite-latest';
export const GEMINI_PRO_MODEL = 'gemini-3-pro-preview';

export const MOCK_CLUSTERS: Cluster[] = [
  {
    id: 'c-1',
    name: 'cluster-prod-us-east',
    region: 'us-east-1',
    provider: 'GKE',
    status: 'Active'
  },
  {
    id: 'c-2',
    name: 'cluster-staging-eu-west',
    region: 'eu-west-2',
    provider: 'EKS',
    status: 'Active'
  },
  {
    id: 'c-3',
    name: 'cluster-dev-local',
    region: 'local',
    provider: 'On-Prem',
    status: 'Degraded'
  }
];

export const MOCK_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-1',
    name: 'KubeOptima Corp',
    slug: 'kubeoptima',
    plan: 'Enterprise',
    status: 'Active',
    createdAt: '2023-01-15',
    region: 'US'
  },
  {
    id: 'org-2',
    name: 'DevTest Labs',
    slug: 'devtest-labs',
    plan: 'Free',
    status: 'Active',
    createdAt: '2023-11-20',
    region: 'EU'
  }
];

export const MOCK_USERS: User[] = [
  {
    id: 'u-1',
    name: 'Admin User',
    email: 'admin@kubeoptima.io',
    role: 'Admin',
    status: 'Active',
    lastActive: 'Just now'
  },
  {
    id: 'u-2',
    name: 'Jane Doe',
    email: 'jane@kubeoptima.io',
    role: 'Editor',
    status: 'Active',
    lastActive: '2 hours ago'
  },
  {
    id: 'u-3',
    name: 'John Smith',
    email: 'john@kubeoptima.io',
    role: 'Viewer',
    status: 'Inactive',
    lastActive: '5 days ago'
  }
];

export const MOCK_NOTIFICATION_CHANNELS: NotificationChannel[] = [
  {
    id: 'nc-1',
    name: 'SRE On-Call',
    type: 'Slack',
    target: '#sre-alerts',
    status: 'Active',
    lastTriggered: '10 mins ago',
    events: ['Critical']
  },
  {
    id: 'nc-2',
    name: 'OpsGenie Webhook',
    type: 'Webhook',
    target: 'https://api.opsgenie.com/v2/alerts',
    status: 'Active',
    lastTriggered: '2 days ago',
    events: ['Critical', 'Warning']
  },
  {
    id: 'nc-3',
    name: 'Daily Reports',
    type: 'Email',
    target: 'team-leads@kubeoptima.io',
    status: 'Inactive',
    lastTriggered: '1 week ago',
    events: ['Healthy']
  }
];

export const MOCK_ALERT_RULES: AlertRule[] = [
  {
    id: 'ar-1',
    name: 'High CPU Saturation',
    metric: 'CPU',
    operator: '>',
    threshold: 90,
    severity: 'Critical',
    channels: ['nc-1', 'nc-2'],
    enabled: true
  },
  {
    id: 'ar-2',
    name: 'Memory Leak Detection',
    metric: 'Memory',
    operator: '>',
    threshold: 85,
    severity: 'Warning',
    channels: ['nc-1'],
    enabled: true
  },
  {
    id: 'ar-4',
    name: 'Disk Pressure Warning',
    metric: 'Storage',
    operator: '>',
    threshold: 80,
    severity: 'Warning',
    channels: ['nc-1'],
    enabled: true
  }
];

export const MOCK_WORKLOADS: Workload[] = [
  {
    id: 'w-1',
    name: 'payment-service',
    namespace: 'production',
    kind: 'Deployment',
    replicas: 3,
    availableReplicas: 2,
    status: 'Critical',
    metrics: {
      cpuRequest: 0.5,
      cpuLimit: 1.0,
      cpuUsage: 0.95,
      memoryRequest: 512,
      memoryLimit: 1024,
      memoryUsage: 800,
      storageRequest: 2,
      storageLimit: 10,
      storageUsage: 4.5,
      networkIn: 12.5,
      networkOut: 8.2,
      diskIo: 45.0
    },
    costPerMonth: 120,
    recentLogs: [
      '[ERROR] Connection to payment gateway timed out after 5000ms',
      '[ERROR] Retry limit exceeded for transaction tx-9921',
      '[INFO] Health check failed for pod payment-service-7d8b-xyz',
      '[CRITICAL] OOMKilled: container limit reached'
    ],
    events: [
      { id: 'e1', type: 'Warning', reason: 'BackOff', message: 'Back-off restarting failed container', lastSeen: '2m ago' },
      { id: 'e2', type: 'Warning', reason: 'Unhealthy', message: 'Readiness probe failed: 503 Service Unavailable', lastSeen: '5m ago' }
    ]
  },
  {
    id: 'w-2',
    name: 'frontend-app',
    namespace: 'production',
    kind: 'Deployment',
    replicas: 5,
    availableReplicas: 5,
    status: 'Healthy',
    metrics: {
      cpuRequest: 2.0,
      cpuLimit: 4.0,
      cpuUsage: 0.2,
      memoryRequest: 2048,
      memoryLimit: 4096,
      memoryUsage: 450,
      storageRequest: 1,
      storageLimit: 2,
      storageUsage: 0.1,
      networkIn: 2.1,
      networkOut: 15.4,
      diskIo: 2.0
    },
    costPerMonth: 450,
    recentLogs: [
      '[INFO] GET / 200 OK',
      '[INFO] GET /assets/logo.png 200 OK',
    ],
    events: [],
    recommendation: {
      action: 'Downsize',
      confidence: 0.95,
      reason: 'CPU utilization is consistently below 15% of request.'
    }
  },
  {
    id: 'w-3',
    name: 'data-processor-worker',
    namespace: 'data-eng',
    kind: 'StatefulSet',
    replicas: 2,
    availableReplicas: 2,
    status: 'Warning',
    metrics: {
      cpuRequest: 1.0,
      cpuLimit: 1.0,
      cpuUsage: 0.99,
      memoryRequest: 4096,
      memoryLimit: 4096,
      memoryUsage: 3800,
      storageRequest: 50,
      storageLimit: 100,
      storageUsage: 85.5,
      networkIn: 150.0,
      networkOut: 5.0,
      diskIo: 250.0
    },
    costPerMonth: 200,
    recentLogs: [
      '[WARN] Processing queue lagging behind by 500 messages',
      '[WARN] High CPU detected, throughput degraded',
      '[CRITICAL] DiskUsageHigh: Ephemeral storage exceeding 85% on node-2'
    ],
    events: [
       { id: 'e3', type: 'Warning', reason: 'NodePressure', message: 'Node is experiencing memory pressure', lastSeen: '10m ago' },
       { id: 'e5', type: 'Warning', reason: 'Evicted', message: 'Pod evicted due to local storage pressure', lastSeen: '1m ago' }
    ],
    recommendation: {
      action: 'Upsize',
      confidence: 0.88,
      reason: 'Throttling detected. CPU usage at 99% of limit.'
    }
  },
  {
    id: 'w-6',
    name: 'ingress-nginx-controller',
    namespace: 'ingress-nginx',
    kind: 'Deployment',
    replicas: 2,
    availableReplicas: 2,
    status: 'Warning',
    metrics: {
      cpuRequest: 0.5,
      cpuLimit: 1.0,
      cpuUsage: 0.45,
      memoryRequest: 512,
      memoryLimit: 1024,
      memoryUsage: 600,
      storageRequest: 1,
      storageLimit: 2,
      storageUsage: 1.8,
      networkIn: 250.0,
      networkOut: 245.0,
      diskIo: 10.0
    },
    costPerMonth: 80,
    recentLogs: [
      '10.2.0.1 - - [28/Oct/2023:10:00:01 +0000] "POST /api/v1/payments HTTP/1.1" 504 167 "-" "Mozilla/5.0"',
      '[error] 192#192: *4422 upstream timed out (110: Connection timed out) while reading response header from upstream',
      '[crit] 192#192: *4422 open() "/var/lib/nginx/tmp/client_body/0000000001" failed (28: No space left on device)'
    ],
    events: [
      { id: 'e4', type: 'Normal', reason: 'Reloaded', message: 'Configuration reloaded due to ingress change', lastSeen: '15m ago' }
    ]
  },
  {
    id: 'w-7',
    name: 'postgres-primary',
    namespace: 'database',
    kind: 'StatefulSet',
    replicas: 1,
    availableReplicas: 1,
    status: 'Warning',
    metrics: {
      cpuRequest: 2.0,
      cpuLimit: 4.0,
      cpuUsage: 3.8,
      memoryRequest: 4096,
      memoryLimit: 8192,
      memoryUsage: 7200,
      storageRequest: 100,
      storageLimit: 200,
      storageUsage: 145.0,
      networkIn: 45.0,
      networkOut: 120.0,
      diskIo: 350.0
    },
    costPerMonth: 350,
    recentLogs: [
      '2023-10-28 10:05:01.123 UTC [1] LOG:  checkpoint starting: time',
      '2023-10-28 10:10:00.005 UTC [145] FATAL:  remaining connection slots are reserved'
    ],
    events: [],
    recommendation: {
      action: 'Upsize',
      confidence: 0.92,
      reason: 'CPU saturation (95%) and connection limit reached. Vertical scaling required.'
    }
  }
];
