import { Router } from 'express';
import { K8sService } from '../config/k8s.js';
import * as k8s from '@kubernetes/client-node';

export const workloadRouter = Router();

// Helper to determine status
const getStatus = (available: number, replicas: number): 'Healthy' | 'Warning' | 'Critical' => {
    if (available === replicas && replicas > 0) return 'Healthy';
    if (available === 0 && replicas > 0) return 'Critical';
    return 'Warning';
};

// Helper mock metrics to ensure UI doesn't crash before real metrics
const getMockMetrics = () => ({
    cpuRequest: 0.5,
    cpuLimit: 1.0,
    cpuUsage: Math.random() * 0.8,
    memoryRequest: 512,
    memoryLimit: 1024,
    memoryUsage: Math.random() * 900,
    storageRequest: 10,
    storageLimit: 20,
    storageUsage: Math.random() * 10,
    networkIn: Math.random() * 10,
    networkOut: Math.random() * 10,
    diskIo: Math.random() * 5
});

workloadRouter.get('/', async (req, res) => {
    try {
        const k8sSvc = K8sService.getInstance();

        // Fetch all resources in parallel
        const [deployments, statefulsets, daemonsets] = await Promise.all([
            k8sSvc.appsV1Api.listDeploymentForAllNamespaces(),
            k8sSvc.appsV1Api.listStatefulSetForAllNamespaces(),
            k8sSvc.appsV1Api.listDaemonSetForAllNamespaces()
        ]);

        const workloads = [
            ...deployments.body.items.map((d: k8s.V1Deployment) => ({
                id: d.metadata?.uid || Math.random().toString(),
                name: d.metadata?.name || 'unknown',
                namespace: d.metadata?.namespace || 'default',
                kind: 'Deployment',
                replicas: d.spec?.replicas || 0,
                availableReplicas: d.status?.availableReplicas || 0,
                status: getStatus(d.status?.availableReplicas || 0, d.spec?.replicas || 0),
                metrics: getMockMetrics(), // Placeholder until Prometheus
                recentLogs: [],
                events: [],
                costPerMonth: Math.floor(Math.random() * 500) + 50
            })),
            ...statefulsets.body.items.map((s: k8s.V1StatefulSet) => ({
                id: s.metadata?.uid || Math.random().toString(),
                name: s.metadata?.name || 'unknown',
                namespace: s.metadata?.namespace || 'default',
                kind: 'StatefulSet',
                replicas: s.spec?.replicas || 0,
                availableReplicas: s.status?.readyReplicas || 0,
                status: getStatus(s.status?.readyReplicas || 0, s.spec?.replicas || 0),
                metrics: getMockMetrics(),
                recentLogs: [],
                events: [],
                costPerMonth: Math.floor(Math.random() * 500) + 100
            })),
            ...daemonsets.body.items.map((ds: k8s.V1DaemonSet) => ({
                id: ds.metadata?.uid || Math.random().toString(),
                name: ds.metadata?.name || 'unknown',
                namespace: ds.metadata?.namespace || 'default',
                kind: 'DaemonSet',
                replicas: ds.status?.desiredNumberScheduled || 0,
                availableReplicas: ds.status?.numberReady || 0,
                status: getStatus(ds.status?.numberReady || 0, ds.status?.desiredNumberScheduled || 0),
                metrics: getMockMetrics(),
                recentLogs: [],
                events: [],
                costPerMonth: Math.floor(Math.random() * 200) + 50
            }))
        ];

        res.json(workloads);

    } catch (err: any) {
        console.error('Failed to list workloads:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch workloads' });
    }
});
