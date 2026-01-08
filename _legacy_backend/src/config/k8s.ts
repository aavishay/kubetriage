import * as k8s from '@kubernetes/client-node';

export class K8sService {
    private static instance: K8sService;
    public coreV1Api: k8s.CoreV1Api;
    public appsV1Api: k8s.AppsV1Api;
    public metricsApi: k8s.CustomObjectsApi; // For Metrics API usually, or use Metrics API class if available in newer versions

    private constructor() {
        const kc = new k8s.KubeConfig();
        try {
            kc.loadFromDefault();
        } catch (e) {
            console.warn('Failed to load kubeconfig from default. Trying in-cluster...');
            // Fallback or just log, loadFromDefault usually handles in-cluster too if configured rigth
        }

        this.coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
        this.appsV1Api = kc.makeApiClient(k8s.AppsV1Api);
        this.metricsApi = kc.makeApiClient(k8s.CustomObjectsApi); // Metrics are often custom objects or direct API calls
    }

    public static getInstance(): K8sService {
        if (!K8sService.instance) {
            K8sService.instance = new K8sService();
        }
        return K8sService.instance;
    }
}
